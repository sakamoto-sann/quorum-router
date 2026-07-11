import type {
  CoFailureTelemetry,
  FinalSynthesis,
  ModelOutput,
  ProviderDescriptor,
} from "./schemas.ts";
import type {
  ModelInvocationOptions,
  PromptCacheCapability,
} from "./prompt-cache.ts";

export interface ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  readonly cacheCapability?: PromptCacheCapability;
  invoke(
    prompt: string,
    signal: AbortSignal,
    options?: ModelInvocationOptions,
  ): Promise<ModelOutput>;
}

export interface SynthesisAdapter {
  readonly descriptor: ProviderDescriptor;
  synthesize(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<FinalSynthesis>;
}

export type TelemetrySink = (
  telemetry: CoFailureTelemetry,
) => void | Promise<void>;
