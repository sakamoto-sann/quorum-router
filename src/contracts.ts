import type {
  CoFailureTelemetry,
  FinalSynthesis,
  ModelOutput,
  ProviderDescriptor,
} from "./schemas.ts";

export interface ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  invoke(prompt: string, signal: AbortSignal): Promise<ModelOutput>;
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
