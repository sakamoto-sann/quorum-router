import {
  type FinalSynthesis,
  FinalSynthesisSchema,
  type ModelOutput,
  ModelOutputSchema,
  type ProviderDescriptor,
  ProviderDescriptorSchema,
} from "../schemas.ts";
import type { ModelAdapter, SynthesisAdapter } from "../contracts.ts";
import {
  BudgetManager,
  CircuitBreaker,
  type CircuitBreakerOptions,
  type RetryPolicy,
} from "../budget/budget.ts";
import {
  backoffDelayMs,
  classifyProcessFailure,
  isRetriableError,
  shouldCountTowardsCircuitBreaker,
} from "./process.ts";
import {
  errorMessage,
  ProcessExecutionError,
  redactSecrets,
  sanitizeDiagnosticText,
} from "../errors.ts";
import { sleepWithAbort } from "../utils.ts";
import {
  assertCachePolicySupported,
  type ModelInvocationOptions,
  parsePromptCachePolicy,
  type PromptCacheCapability,
  PromptCacheCapabilitySchema,
  type PromptCachePolicy,
} from "../prompt-cache.ts";

function normalizeRetryPolicy(policy: RetryPolicy): RetryPolicy {
  const maxAttempts =
    Number.isInteger(policy.maxAttempts) && policy.maxAttempts > 0
      ? policy.maxAttempts
      : 1;
  const baseDelayMs = Number.isFinite(policy.baseDelayMs) &&
      policy.baseDelayMs >= 0
    ? policy.baseDelayMs
    : 0;
  const maxDelayMs =
    Number.isFinite(policy.maxDelayMs) && policy.maxDelayMs >= 0
      ? policy.maxDelayMs
      : baseDelayMs;

  return { maxAttempts, baseDelayMs, maxDelayMs };
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type DirectHttpRequest = {
  url: string;
  init: RequestInit;
};

export type DirectHttpExecutionResult = {
  json: unknown;
  durationMs: number;
};

export type DirectHttpResponseParser = (
  result: DirectHttpExecutionResult,
  descriptor: ProviderDescriptor,
) => ModelOutput;

export type DirectHttpAdapterOptions = {
  descriptor: ProviderDescriptor;
  apiKeyEnv: string;
  apiKeyProvider?: () => string | undefined;
  buildRequest: (
    prompt: string,
    apiKey: string,
    cachePolicy: PromptCachePolicy,
  ) => DirectHttpRequest;
  parseResponse: DirectHttpResponseParser;
  fetchFn?: FetchLike;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreakerOptions;
  budgetManager?: BudgetManager;
  estimatedCostUsd?: number;
  defaultTimeoutMs?: number;
  cacheCapability?: PromptCacheCapability;
};

export function trimApiKey(apiKey: string | undefined): string | undefined {
  const trimmed = apiKey?.trim();
  return trimmed ? trimmed : undefined;
}

function truncateForError(text: string, maxLength = 500): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

function retryAfterHeaderMs(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  const epochMs = Date.parse(value);
  if (Number.isFinite(epochMs)) {
    return Math.max(0, epochMs - Date.now());
  }

  return undefined;
}

export async function classifyDirectHttpFailure(
  response: Response,
  label: string,
  secrets: string[],
): Promise<ProcessExecutionError> {
  const retryAfterMs = retryAfterHeaderMs(response.headers.get("retry-after"));
  const rawBody = await response.text().catch(() => "");
  const body = truncateForError(
    sanitizeDiagnosticText(redactSecrets(rawBody, secrets), secrets),
  );
  const message = body
    ? `${label} HTTP ${response.status}: ${body}`
    : `${label} HTTP ${response.status}.`;

  if (response.status === 401 || response.status === 403) {
    return new ProcessExecutionError("auth_failed", message, {
      retryAfterMs,
      redactionValues: secrets,
    });
  }

  if (response.status === 429) {
    return new ProcessExecutionError("rate_limited", message, {
      retryAfterMs,
      redactionValues: secrets,
    });
  }

  if (response.status >= 500) {
    return new ProcessExecutionError("process_failed", message, {
      retryAfterMs,
      redactionValues: secrets,
    });
  }

  return new ProcessExecutionError("provider_malformed", message, {
    retryAfterMs,
    redactionValues: secrets,
  });
}

async function fetchDirectHttpJson(
  request: DirectHttpRequest,
  signal: AbortSignal,
  label: string,
  defaultTimeoutMs: number,
  fetchFn: FetchLike,
  secrets: string[],
): Promise<DirectHttpExecutionResult> {
  if (signal.aborted) {
    throw new ProcessExecutionError(
      "aborted",
      `${label} aborted before direct HTTP request.`,
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, defaultTimeoutMs);

  const onAbort = () => controller.abort();

  try {
    signal.addEventListener("abort", onAbort, { once: true });
    const response = await fetchFn(request.url, {
      ...request.init,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await classifyDirectHttpFailure(response, label, secrets);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (error) {
      throw new ProcessExecutionError(
        "provider_malformed",
        `${label} returned invalid JSON: ${errorMessage(error)}`,
      );
    }

    return {
      json,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof ProcessExecutionError) {
      throw error;
    }

    const name = error instanceof Error ? error.name : "";
    if (timedOut || name === "AbortError") {
      const codeName = timedOut ? "timeout" : "aborted";
      const reason = timedOut
        ? `${label} direct HTTP request timed out after ${defaultTimeoutMs}ms.`
        : `${label} direct HTTP request was aborted.`;
      throw new ProcessExecutionError(codeName, reason, { cause: error });
    }

    throw classifyProcessFailure(
      redactSecrets(errorMessage(error), secrets),
      "",
      "",
      undefined,
    );
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener("abort", onAbort);
  }
}

class DirectHttpModelAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  readonly cacheCapability?: PromptCacheCapability;
  private readonly apiKeyEnv: string;
  private readonly apiKeyProvider: () => string | undefined;
  private readonly buildRequest: (
    prompt: string,
    apiKey: string,
    cachePolicy: PromptCachePolicy,
  ) => DirectHttpRequest;
  private readonly parseResponse: DirectHttpResponseParser;
  private readonly fetchFn: FetchLike;
  private readonly retryPolicy: RetryPolicy;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly budgetManager?: BudgetManager;
  private readonly estimatedCostUsd: number;
  private readonly defaultTimeoutMs: number;

  constructor(options: DirectHttpAdapterOptions) {
    this.descriptor = ProviderDescriptorSchema.parse(options.descriptor);
    this.apiKeyEnv = options.apiKeyEnv;
    this.apiKeyProvider = options.apiKeyProvider ??
      (() => Deno.env.get(options.apiKeyEnv));
    this.buildRequest = options.buildRequest;
    this.parseResponse = options.parseResponse;
    this.fetchFn = options.fetchFn ?? fetch;
    this.retryPolicy = normalizeRetryPolicy(
      options.retryPolicy ?? {
        maxAttempts: 2,
        baseDelayMs: 400,
        maxDelayMs: 5_000,
      },
    );
    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreaker ?? {
        failureThreshold: 3,
        cooldownMs: 15_000,
      },
    );
    this.budgetManager = options.budgetManager;
    this.estimatedCostUsd = options.estimatedCostUsd ?? 0;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000;
    this.cacheCapability = options.cacheCapability
      ? PromptCacheCapabilitySchema.parse(options.cacheCapability)
      : undefined;
  }

  async invoke(
    prompt: string,
    signal: AbortSignal,
    options?: ModelInvocationOptions,
  ): Promise<ModelOutput> {
    const cachePolicy = parsePromptCachePolicy(options?.cache);
    assertCachePolicySupported(
      cachePolicy,
      this.cacheCapability ?? { supported: false, providerManaged: false },
    );
    const label = `${this.descriptor.provider}/${this.descriptor.model}`;
    this.circuitBreaker.assertAvailable(label);

    let lastError: unknown;
    let budgetReserved = false;

    for (
      let attempt = 1;
      attempt <= this.retryPolicy.maxAttempts;
      attempt += 1
    ) {
      try {
        const credential = trimApiKey(this.apiKeyProvider());
        if (!credential) {
          throw new ProcessExecutionError(
            "auth_failed",
            `${label} missing API key environment variable ${this.apiKeyEnv}.`,
          );
        }

        if (
          !budgetReserved && this.estimatedCostUsd > 0 && this.budgetManager
        ) {
          this.budgetManager.consume(label, this.estimatedCostUsd);
          budgetReserved = true;
        }

        const result = await fetchDirectHttpJson(
          this.buildRequest(prompt, credential, cachePolicy),
          signal,
          label,
          this.defaultTimeoutMs,
          this.fetchFn,
          [credential],
        );

        try {
          const parsed = this.parseResponse(result, this.descriptor);
          this.circuitBreaker.recordSuccess();
          return ModelOutputSchema.parse(parsed);
        } catch (error) {
          throw new ProcessExecutionError(
            "provider_malformed",
            `${label} returned malformed provider response: ${
              errorMessage(error)
            }`,
            { cause: error },
          );
        }
      } catch (error) {
        lastError = error;

        if (shouldCountTowardsCircuitBreaker(error)) {
          this.circuitBreaker.recordFailure();
        }

        if (
          !isRetriableError(error) || attempt >= this.retryPolicy.maxAttempts
        ) {
          break;
        }

        const delayMs = backoffDelayMs(attempt, this.retryPolicy, error);
        await sleepWithAbort(delayMs, signal);
      }
    }

    throw lastError;
  }
}

export function createDirectHttpAdapter(
  options: DirectHttpAdapterOptions,
): ModelAdapter {
  return new DirectHttpModelAdapter(options);
}

function getPath(obj: unknown, path: Array<string | number>): unknown {
  return path.reduce<unknown>((current, segment) => {
    if (typeof segment === "number") {
      return Array.isArray(current) ? current[segment] : undefined;
    }
    if (typeof current === "object" && current !== null && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

function parseOpenAIChatContent(
  result: DirectHttpExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const content = getPath(result.json, ["choices", 0, "message", "content"]);
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("missing choices[0].message.content");
  }

  const responseModel = getPath(result.json, ["model"]);
  const inputTokens = getPath(result.json, ["usage", "prompt_tokens"]);
  const outputTokens = getPath(result.json, ["usage", "completion_tokens"]);
  const cachedTokens = getPath(result.json, [
    "usage",
    "prompt_tokens_details",
    "cached_tokens",
  ]);
  return ModelOutputSchema.parse({
    content: content.trim(),
    model: typeof responseModel === "string" && responseModel.trim()
      ? responseModel
      : descriptor.model,
    provider: descriptor.provider,
    latencyMs: result.durationMs,
    usage: {
      ...(typeof inputTokens === "number" ? { inputTokens } : {}),
      ...(typeof outputTokens === "number" ? { outputTokens } : {}),
      ...(typeof cachedTokens === "number"
        ? {
          cacheReadInputTokens: cachedTokens,
          cacheHit: cachedTokens > 0,
          ...(typeof inputTokens === "number"
            ? { uncachedInputTokens: Math.max(0, inputTokens - cachedTokens) }
            : {}),
        }
        : {}),
    },
  });
}

function parseAnthropicMessageContent(
  result: DirectHttpExecutionResult,
  descriptor: ProviderDescriptor,
): ModelOutput {
  const blocks = getPath(result.json, ["content"]);
  if (!Array.isArray(blocks)) {
    throw new Error("missing content blocks");
  }

  const content = blocks
    .flatMap((block) => {
      if (
        typeof block === "object" && block !== null &&
        (block as { type?: unknown }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        return [(block as { text: string }).text];
      }
      return [];
    })
    .join("\n")
    .trim();

  if (!content) {
    throw new Error("missing text content block");
  }

  const responseModel = getPath(result.json, ["model"]);
  const inputTokens = getPath(result.json, ["usage", "input_tokens"]);
  const outputTokens = getPath(result.json, ["usage", "output_tokens"]);
  const cacheCreation = getPath(result.json, [
    "usage",
    "cache_creation_input_tokens",
  ]);
  const cacheRead = getPath(result.json, ["usage", "cache_read_input_tokens"]);
  return ModelOutputSchema.parse({
    content,
    model: typeof responseModel === "string" && responseModel.trim()
      ? responseModel
      : descriptor.model,
    provider: descriptor.provider,
    latencyMs: result.durationMs,
    usage: {
      ...(typeof inputTokens === "number" ? { inputTokens } : {}),
      ...(typeof outputTokens === "number" ? { outputTokens } : {}),
      ...(typeof cacheCreation === "number"
        ? { cacheCreationInputTokens: cacheCreation }
        : {}),
      ...(typeof cacheRead === "number"
        ? { cacheReadInputTokens: cacheRead, cacheHit: cacheRead > 0 }
        : {}),
      ...(typeof inputTokens === "number"
        ? { uncachedInputTokens: inputTokens }
        : {}),
    },
  });
}

export type OpenAIDirectAdapterOptions = {
  model?: string;
  endpoint?: string;
  apiKeyEnv?: string;
  apiKeyProvider?: () => string | undefined;
  fetchFn?: FetchLike;
  budgetManager?: BudgetManager;
  retryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
  responseFormat?: Record<string, unknown>;
};

export function createOpenAIDirectAdapter(
  options: OpenAIDirectAdapterOptions = {},
): ModelAdapter {
  const model = options.model ?? "gpt-4o-mini";
  const endpoint = options.endpoint ??
    "https://api.openai.com/v1/chat/completions";

  return createDirectHttpAdapter({
    descriptor: {
      provider: "OpenAI",
      model,
      authMode: "apiKey",
      transport: "directHttp",
      client: "OpenAIChatCompletions",
    },
    apiKeyEnv: options.apiKeyEnv ?? "OPENAI_API_KEY",
    apiKeyProvider: options.apiKeyProvider,
    fetchFn: options.fetchFn,
    retryPolicy: options.retryPolicy,
    budgetManager: options.budgetManager,
    estimatedCostUsd: 0.02,
    defaultTimeoutMs: options.defaultTimeoutMs,
    cacheCapability: { supported: true, providerManaged: true },
    parseResponse: parseOpenAIChatContent,
    buildRequest: (prompt, apiKey) => ({
      url: endpoint,
      init: {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          ...(options.responseFormat
            ? { response_format: options.responseFormat }
            : {}),
        }),
      },
    }),
  });
}

export type AnthropicDirectAdapterOptions = {
  model?: string;
  endpoint?: string;
  apiKeyEnv?: string;
  apiKeyProvider?: () => string | undefined;
  fetchFn?: FetchLike;
  budgetManager?: BudgetManager;
  retryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
  maxTokens?: number;
};

export function createAnthropicDirectAdapter(
  options: AnthropicDirectAdapterOptions = {},
): ModelAdapter {
  const model = options.model ?? "claude-3-5-haiku-latest";
  const endpoint = options.endpoint ?? "https://api.anthropic.com/v1/messages";

  return createDirectHttpAdapter({
    descriptor: {
      provider: "Anthropic",
      model,
      authMode: "apiKey",
      transport: "directHttp",
      client: "AnthropicMessagesAPI",
    },
    apiKeyEnv: options.apiKeyEnv ?? "ANTHROPIC_API_KEY",
    apiKeyProvider: options.apiKeyProvider,
    fetchFn: options.fetchFn,
    retryPolicy: options.retryPolicy,
    budgetManager: options.budgetManager,
    estimatedCostUsd: 0.03,
    defaultTimeoutMs: options.defaultTimeoutMs,
    cacheCapability: {
      supported: true,
      providerManaged: true,
      ttlSeconds: [300],
    },
    parseResponse: parseAnthropicMessageContent,
    buildRequest: (prompt, apiKey, cachePolicy) => ({
      url: endpoint,
      init: {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens ?? 1024,
          messages: [{
            role: "user",
            content: [{
              type: "text",
              text: prompt,
              ...(cachePolicy.enabled
                ? {
                  cache_control: {
                    type: "ephemeral",
                  },
                }
                : {}),
            }],
          }],
        }),
      },
    }),
  });
}

export type OpenAIDirectSynthesisAdapterOptions = OpenAIDirectAdapterOptions;

export class OpenAIDirectSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor: ProviderDescriptor;
  private readonly adapter: ModelAdapter;

  constructor(options: OpenAIDirectSynthesisAdapterOptions = {}) {
    const model = options.model ?? "gpt-4o-mini";
    this.descriptor = ProviderDescriptorSchema.parse({
      provider: "OpenAI",
      model,
      authMode: "apiKey",
      transport: "directHttp",
      client: "OpenAIChatCompletions",
    });
    this.adapter = createOpenAIDirectAdapter({
      ...options,
      model,
      responseFormat: { type: "json_object" },
    });
  }

  async synthesize(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    const sourceLines = outputs
      .map((output, index) =>
        `${index + 1}. [${output.provider}/${output.model}] ${output.content}`
      )
      .join("\n");
    const synthesisPrompt = [
      "You are the consensus stage of a fail-closed quorum router.",
      "Return only a JSON object with keys: synthesis, reasoning, consensusModel, sources.",
      "Do not wrap the JSON in markdown.",
      `Original user prompt: ${prompt}`,
      "Validated upstream outputs:",
      sourceLines,
      `Set consensusModel to ${this.descriptor.provider}/${this.descriptor.model}.`,
      "Set sources to the list of contributing provider/model labels.",
    ].join("\n\n");

    const output = await this.adapter.invoke(synthesisPrompt, signal);
    return FinalSynthesisSchema.parse(JSON.parse(output.content));
  }
}

export function createOpenAIDirectSynthesisAdapter(
  options: OpenAIDirectSynthesisAdapterOptions = {},
): SynthesisAdapter {
  return new OpenAIDirectSynthesisAdapter(options);
}
