import type {
  FinalSynthesis,
  ModelAdapter,
  ModelOutput,
  ProviderDescriptor,
  SynthesisAdapter,
} from "../router.ts";
import { FinalSynthesisSchema } from "../router.ts";

export const FIXTURE_DIRECT_DESCRIPTOR = {
  provider: "Fixture",
  model: "direct-fast",
  authMode: "session",
  transport: "processAdapter",
  client: "FixtureDirect",
} as const satisfies ProviderDescriptor;

export const FIXTURE_DIRECT_REJECTED_DESCRIPTOR = {
  provider: "Fixture",
  model: "direct-not-ready",
  authMode: "session",
  transport: "processAdapter",
  client: "FixtureDirect",
} as const satisfies ProviderDescriptor;

export const FIXTURE_SYNTHESIS_DESCRIPTOR = {
  provider: "Fixture",
  model: "synthesis-static",
  authMode: "session",
  transport: "processAdapter",
  client: "FixtureSynthesis",
} as const satisfies ProviderDescriptor;

export class FixtureModelAdapter implements ModelAdapter {
  calls = 0;

  constructor(
    readonly descriptor: ProviderDescriptor = FIXTURE_DIRECT_DESCRIPTOR,
    private readonly content = "fixture direct response",
  ) {}

  invoke(prompt: string, _signal: AbortSignal): Promise<ModelOutput> {
    this.calls += 1;
    return Promise.resolve({
      provider: this.descriptor.provider,
      model: this.descriptor.model,
      content: `${this.content}: ${prompt}`,
      latencyMs: 1,
    });
  }
}

export class FixtureSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor = FIXTURE_SYNTHESIS_DESCRIPTOR;
  calls = 0;

  synthesize(
    prompt: string,
    outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    this.calls += 1;
    return Promise.resolve(FinalSynthesisSchema.parse({
      synthesis: `v0.1 fixture synthesis for: ${prompt}`,
      reasoning: `combined ${outputs.length} deterministic fixture output(s)`,
      consensusModel: `${this.descriptor.provider}/${this.descriptor.model}`,
      sources: outputs.map((output) => `${output.provider}/${output.model}`),
    }));
  }
}

export function fixtureCapability(descriptor: ProviderDescriptor) {
  return {
    ...descriptor,
    supportsSynthesis:
      descriptor.provider === FIXTURE_SYNTHESIS_DESCRIPTOR.provider &&
      descriptor.model === FIXTURE_SYNTHESIS_DESCRIPTOR.model &&
      descriptor.authMode === FIXTURE_SYNTHESIS_DESCRIPTOR.authMode &&
      descriptor.transport === FIXTURE_SYNTHESIS_DESCRIPTOR.transport &&
      descriptor.client === FIXTURE_SYNTHESIS_DESCRIPTOR.client,
    supportsStructuredJson: true,
    supportsStreaming: false,
    estimatedCostUsd: 0.001,
    latencyTier: "low" as const,
    reliabilityTier: "preferred" as const,
    enabled: true,
    tags: ["fixture", "offline", "v0.1"],
  };
}
