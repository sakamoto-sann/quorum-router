import { QuorumRouter } from "./router.ts";
import { errorMessage, RouterError } from "./errors.ts";
import type { ModelAdapter, TelemetrySink } from "./contracts.ts";
import { InMemoryBudgetManager } from "./budget/budget.ts";
import {
  createAnthropicDirectAdapter,
  createOpenAIDirectAdapter,
  createOpenAIDirectSynthesisAdapter,
  trimApiKey,
} from "./adapters/direct-http.ts";
import {
  createClaudeCodeAdapter,
  createClineCliAdapter,
  createCodexCliAdapter,
  createCodexStructuredSynthesisAdapter,
  createDevinCliAdapter,
  createGeminiCliAdapter,
  createGrokCliAdapter,
  createZcodeGlmAdapter,
  repoLocalBin,
} from "./adapters/process.ts";
import {
  boundedEnvInteger,
  createBufferedBatchSink,
  createCompositeTelemetrySink,
  TELEMETRY_MAX_ATTEMPTS,
  TELEMETRY_MAX_BACKOFF_MS,
  TELEMETRY_MAX_BASE_BACKOFF_MS,
  TELEMETRY_MAX_BATCH_SIZE,
  TELEMETRY_MAX_DRAIN_MS,
  TELEMETRY_MAX_FLUSH_INTERVAL_MS,
  TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  TELEMETRY_MAX_QUEUE_SIZE,
} from "./telemetry/buffered-batch-sink.ts";
import { createOtlpTelemetryHandler } from "./telemetry/buffered-batch-sink.ts";
import { readRouterEnv } from "./env.ts";

const consoleTelemetrySink: TelemetrySink = (telemetry) => {
  console.warn("Co-failure telemetry:");
  console.warn(JSON.stringify(telemetry, null, 2));
};

export function maybeCreateEnvTelemetrySink(): TelemetrySink | undefined {
  const endpoint = Deno.env.get("OTEL_EXPORTER_OTLP_ENDPOINT");
  if (!endpoint) {
    return undefined;
  }

  const otlpHandler = createOtlpTelemetryHandler({
    endpoint,
    serviceName: "quorum-router",
    timeoutMs: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_HTTP_TIMEOUT_MS",
      500,
      TELEMETRY_MAX_HTTP_TIMEOUT_MS,
    ),
  });

  return createBufferedBatchSink(otlpHandler, {
    name: "otlp_telemetry",
    maxQueueSize: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_MAX_QUEUE",
      1_000,
      TELEMETRY_MAX_QUEUE_SIZE,
    ),
    maxBatchSize: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_MAX_BATCH",
      30,
      TELEMETRY_MAX_BATCH_SIZE,
    ),
    flushIntervalMs: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_FLUSH_INTERVAL_MS",
      500,
      TELEMETRY_MAX_FLUSH_INTERVAL_MS,
    ),
    maxAttempts: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_MAX_ATTEMPTS",
      5,
      TELEMETRY_MAX_ATTEMPTS,
    ),
    baseBackoffMs: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_BASE_BACKOFF_MS",
      250,
      TELEMETRY_MAX_BASE_BACKOFF_MS,
    ),
    maxBackoffMs: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_MAX_BACKOFF_MS",
      30_000,
      TELEMETRY_MAX_BACKOFF_MS,
    ),
    defaultDrainMs: boundedEnvInteger(
      "QUORUM_ROUTER_TELEMETRY_DRAIN_MS",
      200,
      TELEMETRY_MAX_DRAIN_MS,
    ),
    registerUnloadHook: !envFlagEnabled(
      "QUORUM_ROUTER_TELEMETRY_DISABLE_UNLOAD_HOOK",
    ),
  });
}

export function envFlagEnabled(name: string): boolean {
  return readRouterEnv(name) === "1" ||
    readRouterEnv(name)?.toLowerCase() === "true";
}

export function createDefaultDirectHttpAdapters(): ModelAdapter[] {
  const adapters: ModelAdapter[] = [];

  if (trimApiKey(Deno.env.get("OPENAI_API_KEY"))) {
    adapters.push(
      createOpenAIDirectAdapter({
        budgetManager: new InMemoryBudgetManager(0.2),
      }),
    );
  }

  if (trimApiKey(Deno.env.get("ANTHROPIC_API_KEY"))) {
    adapters.push(
      createAnthropicDirectAdapter({
        budgetManager: new InMemoryBudgetManager(0.2),
      }),
    );
  }

  return adapters;
}

export function createDefaultCliAdapters(): ModelAdapter[] {
  return [
    createCodexCliAdapter({ budgetManager: new InMemoryBudgetManager(0.25) }),
    createClaudeCodeAdapter({
      budgetManager: new InMemoryBudgetManager(0.25),
    }),
    createGeminiCliAdapter({
      budgetManager: new InMemoryBudgetManager(0.15),
    }),
    createGrokCliAdapter({ budgetManager: new InMemoryBudgetManager(0.2) }),
    createDevinCliAdapter({ budgetManager: new InMemoryBudgetManager(0.2) }),
    createClineCliAdapter({ budgetManager: new InMemoryBudgetManager(0.15) }),
    createZcodeGlmAdapter({
      command: repoLocalBin("zcode-headless"),
      budgetManager: new InMemoryBudgetManager(0.15),
      auth: {
        env: Deno.env.get("ZCODE_HOME")
          ? { ZCODE_HOME: Deno.env.get("ZCODE_HOME")! }
          : undefined,
        readinessCheck: {
          command: repoLocalBin("zcode-headless"),
          args: ["doctor"],
        },
      },
    }),
  ];
}

export function createDefaultRouter(): QuorumRouter {
  const envTelemetrySink = maybeCreateEnvTelemetrySink();
  const telemetrySink = envTelemetrySink
    ? createCompositeTelemetrySink(consoleTelemetrySink, envTelemetrySink)
    : consoleTelemetrySink;
  const directOnly = envFlagEnabled("QUORUM_ROUTER_DIRECT_HTTP_ONLY");
  const directHttpEnabled = directOnly ||
    envFlagEnabled("QUORUM_ROUTER_ENABLE_DIRECT_HTTP");
  const directAdapters = directHttpEnabled
    ? createDefaultDirectHttpAdapters()
    : [];
  const cliAdapters = directOnly ? [] : createDefaultCliAdapters();
  const modelAdapters = [...directAdapters, ...cliAdapters];

  if (directOnly && !trimApiKey(Deno.env.get("OPENAI_API_KEY"))) {
    throw new Error(
      "QUORUM_ROUTER_DIRECT_HTTP_ONLY requires OPENAI_API_KEY for direct HTTP synthesis.",
    );
  }

  const synthesisAdapter = directOnly
    ? createOpenAIDirectSynthesisAdapter({
      budgetManager: new InMemoryBudgetManager(0.25),
    })
    : createCodexStructuredSynthesisAdapter({
      budgetManager: new InMemoryBudgetManager(0.25),
    });

  return new QuorumRouter({
    timeoutMs: 120_000,
    minSuccessfulAdapters: Math.min(2, modelAdapters.length),
    telemetrySink,
    modelAdapters,
    synthesisAdapter,
  });
}

export async function runDefaultRouterSmoke(): Promise<void> {
  let router: QuorumRouter | undefined;

  try {
    router = createDefaultRouter();
    const result = await router.route(
      "Explain the impact of quantum computing on encryption.",
    );
    console.log("\n--- Final Synthesis Result ---");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (error instanceof RouterError) {
      console.error(
        `Router Error [${error.status}/${error.code}]: ${error.message}`,
      );
      console.error(JSON.stringify(error.details, null, 2));
    } else if (error instanceof Error) {
      console.error("Router Error:", error.message);
    } else {
      console.error("Router Error:", String(error));
    }
  } finally {
    await router?.closeTelemetry({
      maxDurationMs: boundedEnvInteger(
        "QUORUM_ROUTER_TELEMETRY_DRAIN_MS",
        200,
        TELEMETRY_MAX_DRAIN_MS,
      ),
      force: true,
    }).catch((error) => {
      console.warn(`Telemetry shutdown drain failure: ${errorMessage(error)}`);
    });
  }
}

if (import.meta.main) {
  await runDefaultRouterSmoke();
}
