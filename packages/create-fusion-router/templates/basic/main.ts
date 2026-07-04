const FUSION_ROUTER_URL = [
  "https://raw.githubusercontent.com",
  "sakamoto-sann",
  "fusion-router",
  // Release tag URL used intentionally for the public v0.1.2 quickstart.
  // Verify the tag target in GitHub release metadata for reproducibility-sensitive runs.
  "v0.1.2",
  "router.ts",
].join("/");

const fusionRouter = await import(FUSION_ROUTER_URL);
const {
  createAnthropicDirectAdapter,
  createOpenAIDirectAdapter,
  FinalSynthesisSchema,
  FusionRouter,
} = fusionRouter;

type ProviderDescriptor = {
  provider: string;
  model: string;
  authMode: "apiKey" | "oauth" | "session";
  transport: "zcodeWrapper" | "processAdapter" | "directHttp";
  client?: string;
};

type ModelOutput = {
  provider: string;
  model: string;
  content: string;
  latencyMs: number;
};

type Mode = "fixture" | "real";

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function hasEnv(name: string): boolean {
  return env(name) !== undefined;
}

function parseMode(args: string[]): Mode {
  if (args.includes("--real")) return "real";
  if (args.includes("--fixture")) return "fixture";
  return "fixture";
}

function promptFromArgs(args: string[], mode: Mode): string {
  const filtered = args.filter((arg) =>
    arg !== "--real" && arg !== "--fixture" && arg !== "--"
  );
  const argPrompt = filtered.join(" ").trim();
  if (argPrompt) return argPrompt;
  if (mode === "real") {
    return env("FUSION_ROUTER_PROMPT") ||
      "Evaluate Fusion Router with one concise answer.";
  }
  return "evaluate Fusion Router v0.1.2";
}

function realProviderPreference(): "auto" | "openai" | "anthropic" {
  const raw = env("FUSION_ROUTER_REAL_PROVIDER")?.toLowerCase();
  if (raw === "openai" || raw === "anthropic") return raw;
  return "auto";
}

class FixtureModelAdapter {
  readonly descriptor: ProviderDescriptor = {
    provider: "Fixture",
    model: "direct-evaluation",
    authMode: "session",
    transport: "processAdapter",
    client: "TemplateFixture",
  };
  calls = 0;

  invoke(prompt: string, _signal: AbortSignal): Promise<ModelOutput> {
    this.calls += 1;
    return Promise.resolve({
      provider: this.descriptor.provider,
      model: this.descriptor.model,
      content: `deterministic local response for: ${prompt}`,
      latencyMs: 1,
    });
  }
}

class FixtureSynthesisAdapter {
  readonly descriptor: ProviderDescriptor = {
    provider: "Fixture",
    model: "synthesis-evaluation",
    authMode: "session",
    transport: "processAdapter",
    client: "TemplateFixtureSynthesis",
  };
  calls = 0;

  synthesize(
    prompt: string,
    outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<unknown> {
    this.calls += 1;
    return Promise.resolve(FinalSynthesisSchema.parse({
      synthesis: `Fusion Router evaluation synthesis for: ${prompt}`,
      reasoning: `combined ${outputs.length} deterministic fixture output(s)`,
      consensusModel: `${this.descriptor.provider}/${this.descriptor.model}`,
      sources: outputs.map((output) => `${output.provider}/${output.model}`),
    }));
  }
}

class PassthroughSynthesisAdapter {
  readonly descriptor: ProviderDescriptor = {
    provider: "Local",
    model: "passthrough-synthesis",
    authMode: "session",
    transport: "processAdapter",
    client: "TemplatePassthroughSynthesis",
  };
  calls = 0;

  synthesize(
    _prompt: string,
    outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<unknown> {
    this.calls += 1;
    const sources = outputs.map((output) =>
      `${output.provider}/${output.model}`
    );
    const synthesis = outputs
      .map((output) => `[${output.provider}/${output.model}] ${output.content}`)
      .join("\n\n");
    return Promise.resolve(FinalSynthesisSchema.parse({
      synthesis,
      reasoning:
        `passed through ${outputs.length} real API output(s) without a second synthesis API call`,
      consensusModel: `${this.descriptor.provider}/${this.descriptor.model}`,
      sources,
    }));
  }
}

function createRealApiAdapters() {
  const preference = realProviderPreference();
  const adapters = [];

  if (
    (preference === "auto" || preference === "openai") &&
    hasEnv("OPENAI_API_KEY")
  ) {
    adapters.push(createOpenAIDirectAdapter({
      defaultTimeoutMs: 60_000,
    }));
  }

  if (
    (preference === "auto" || preference === "anthropic") &&
    hasEnv("ANTHROPIC_API_KEY")
  ) {
    adapters.push(createAnthropicDirectAdapter({
      defaultTimeoutMs: 60_000,
    }));
  }

  if (adapters.length === 0) {
    const requested = preference === "auto"
      ? "OpenAI or Anthropic"
      : preference;
    throw new Error(
      [
        `Real API mode requested, but no ${requested} API key was available.`,
        "Set one of these environment variables locally before running real mode:",
        "- OPENAI_API_KEY",
        "- ANTHROPIC_API_KEY",
        "Optional: set FUSION_ROUTER_REAL_PROVIDER=openai or anthropic.",
        "Secrets are read from the process environment only and are never printed.",
      ].join("\n"),
    );
  }

  return adapters;
}

async function runFixtureSmoke(prompt: string) {
  const adapter = new FixtureModelAdapter();
  const synthesis = new FixtureSynthesisAdapter();
  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter: synthesis,
    minSuccessfulAdapters: 1,
    timeoutMs: 1_000,
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route(prompt);

  console.log(JSON.stringify(
    {
      ok: true,
      mode: "fixture",
      source: FUSION_ROUTER_URL,
      adapterCalls: adapter.calls,
      synthesisCalls: synthesis.calls,
      result,
    },
    null,
    2,
  ));
}

async function runRealApiSmoke(prompt: string) {
  const adapters = createRealApiAdapters();
  const synthesis = new PassthroughSynthesisAdapter();
  const router = new FusionRouter({
    modelAdapters: adapters,
    synthesisAdapter: synthesis,
    minSuccessfulAdapters: 1,
    timeoutMs: 90_000,
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route(prompt);

  console.log(JSON.stringify(
    {
      ok: true,
      mode: "real_api",
      source: FUSION_ROUTER_URL,
      providers: adapters.map((
        adapter: { descriptor: ProviderDescriptor },
      ) => ({
        provider: adapter.descriptor.provider,
        model: adapter.descriptor.model,
        transport: adapter.descriptor.transport,
      })),
      synthesisCalls: synthesis.calls,
      result,
    },
    null,
    2,
  ));
}

const mode = parseMode(Deno.args);
const prompt = promptFromArgs(Deno.args, mode);

try {
  if (mode === "real") {
    await runRealApiSmoke(prompt);
  } else {
    await runFixtureSmoke(prompt);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  Deno.exit(1);
}
