import { z } from "zod";
import { ModelUsageSchema } from "./prompt-cache.ts";

export const AuthModeSchema = z.enum(["apiKey", "oauth", "session"]);
export const TransportSchema = z.enum([
  "zcodeWrapper",
  "processAdapter",
  "directHttp",
]);

export const ProviderDescriptorSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  authMode: AuthModeSchema,
  transport: TransportSchema,
  client: z.string().min(1).optional(),
});

export type ProviderDescriptor = z.infer<typeof ProviderDescriptorSchema>;

export const ModelOutputSchema = z.object({
  content: z.string().min(1),
  model: z.string().min(1),
  provider: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  usage: ModelUsageSchema.optional(),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export const FinalSynthesisSchema = z.object({
  synthesis: z.string().min(1),
  reasoning: z.string().min(1),
  consensusModel: z.string().min(1),
  sources: z.array(z.string().min(1)).min(1),
});

export const FinalSynthesisJsonSchema = {
  type: "object",
  properties: {
    synthesis: { type: "string", minLength: 1 },
    reasoning: { type: "string", minLength: 1 },
    consensusModel: { type: "string", minLength: 1 },
    sources: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
    },
  },
  required: ["synthesis", "reasoning", "consensusModel", "sources"],
  additionalProperties: false,
} as const;

export type FinalSynthesis = z.infer<typeof FinalSynthesisSchema>;

export const TelemetryFailureSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
});

export type TelemetryFailure = z.infer<typeof TelemetryFailureSchema>;

export const CoFailureTelemetrySchema = z.object({
  totalAdapters: z.number().int().nonnegative(),
  successfulAdapters: z.number().int().nonnegative(),
  failedAdapters: z.number().int().nonnegative(),
  failures: z.array(TelemetryFailureSchema),
});

export type CoFailureTelemetry = z.infer<typeof CoFailureTelemetrySchema>;
