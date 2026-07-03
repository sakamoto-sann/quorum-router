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
const { FusionRouter, FinalSynthesisSchema } = fusionRouter;

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

const adapter = new FixtureModelAdapter();
const synthesis = new FixtureSynthesisAdapter();
const router = new FusionRouter({
  modelAdapters: [adapter],
  synthesisAdapter: synthesis,
  minSuccessfulAdapters: 1,
  timeoutMs: 1_000,
  routingModeEnvProvider: () => undefined,
});

const result = await router.route("evaluate Fusion Router v0.1.2");

console.log(JSON.stringify(
  {
    ok: true,
    source: FUSION_ROUTER_URL,
    adapterCalls: adapter.calls,
    synthesisCalls: synthesis.calls,
    result,
  },
  null,
  2,
));
