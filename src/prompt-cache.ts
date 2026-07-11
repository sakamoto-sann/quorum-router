import { z } from "zod";

/** Provider-native prompt cache behavior advertised by an adapter. */
export const PromptCacheCapabilitySchema = z.object({
  supported: z.boolean(),
  providerManaged: z.boolean(),
  ttlSeconds: z.array(z.number().int().positive()).optional(),
});
export type PromptCacheCapability = z.infer<
  typeof PromptCacheCapabilitySchema
>;

/** The semantic class of a request. Sensitive classes are never cached by default. */
export const PromptCachePayloadClassSchema = z.enum([
  "read_only",
  "mutation",
  "approval",
  "credential",
]);
export type PromptCachePayloadClass = z.infer<
  typeof PromptCachePayloadClassSchema
>;

/** Per-adapter or per-invocation cache policy. Caching is opt-in. */
export const PromptCachePolicySchema = z.object({
  enabled: z.boolean().default(false),
  payloadClass: PromptCachePayloadClassSchema.default("read_only"),
  ttlSeconds: z.number().int().positive().optional(),
  cacheKey: z.string().trim().min(1).max(256).optional(),
}).strict().superRefine((policy, ctx) => {
  if (
    policy.enabled &&
    ["mutation", "approval", "credential"].includes(policy.payloadClass)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${policy.payloadClass} payloads cannot enable prompt caching`,
      path: ["enabled"],
    });
  }
});
export type PromptCachePolicy = z.infer<typeof PromptCachePolicySchema>;
export type PromptCachePolicyInput = z.input<typeof PromptCachePolicySchema>;

export type ModelInvocationOptions = {
  cache?: PromptCachePolicyInput;
};

/** Normalized token accounting across provider response formats. */
export const ModelUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
  cacheCreationInputTokens: z.number().int().nonnegative().optional(),
  cacheReadInputTokens: z.number().int().nonnegative().optional(),
  uncachedInputTokens: z.number().int().nonnegative().optional(),
  cacheHit: z.boolean().optional(),
}).strict();
export type ModelUsage = z.infer<typeof ModelUsageSchema>;

export function parsePromptCachePolicy(
  value: PromptCachePolicyInput | undefined,
): PromptCachePolicy {
  return PromptCachePolicySchema.parse(value ?? {});
}

export function assertCachePolicySupported(
  policy: PromptCachePolicy,
  capability: PromptCacheCapability,
): void {
  if (!policy.enabled) return;
  if (!capability.supported) {
    throw new Error("Prompt caching is not supported by this adapter.");
  }
  if (
    policy.ttlSeconds !== undefined &&
    capability.ttlSeconds !== undefined &&
    !capability.ttlSeconds.includes(policy.ttlSeconds)
  ) {
    throw new Error(
      `Unsupported prompt cache TTL ${policy.ttlSeconds}; supported values: ${
        capability.ttlSeconds.join(
          ", ",
        )
      }.`,
    );
  }
}
