import { z } from "zod";
import { RoutingModeSchema } from "../routing-mode.ts";

export const SetupProfileNameSchema = z.enum([
  "minimal-direct",
  "direct-http-openai",
  "direct-http-anthropic",
  "cli-oauth",
  "adaptive-direct",
  "supabase-audit",
]);

export type SetupProfileName = z.infer<typeof SetupProfileNameSchema>;

export const SetupAuthModeSchema = z.enum([
  "apiKey",
  "oauth",
  "session",
  "local",
]);
export type SetupAuthMode = z.infer<typeof SetupAuthModeSchema>;

export const SetupTransportSchema = z.enum([
  "directHttp",
  "processAdapter",
  "zcodeWrapper",
  "localModel",
]);
export type SetupTransport = z.infer<typeof SetupTransportSchema>;

export const SetupProviderSelectionSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  authMode: SetupAuthModeSchema,
  transport: SetupTransportSchema,
  client: z.string().min(1).optional(),
  enabled: z.boolean().default(true),
}).strict();
export type SetupProviderSelection = z.infer<
  typeof SetupProviderSelectionSchema
>;

export const SetupPersistenceModeSchema = z.enum([
  "none",
  "localJsonl",
  "supabaseAuditRpc",
]);
export type SetupPersistenceMode = z.infer<typeof SetupPersistenceModeSchema>;

export const SetupTelemetryModeSchema = z.enum([
  "console",
  "otlp",
  "disabled",
]);
export type SetupTelemetryMode = z.infer<typeof SetupTelemetryModeSchema>;

export const SetupFallbackPolicyLabelSchema = z.enum([
  "disabled",
  "safe_provider_unavailable_only",
]);
export type SetupFallbackPolicyLabel = z.infer<
  typeof SetupFallbackPolicyLabelSchema
>;

export const SetupReadinessHintsSchema = z.object({
  authReady: z.record(z.boolean()).optional(),
  transportReady: z.record(z.boolean()).optional(),
  circuitOpen: z.record(z.boolean()).optional(),
}).strict();
export type SetupReadinessHints = z.infer<typeof SetupReadinessHintsSchema>;

export const SetupAdaptiveDirectSchema = z.object({
  enabled: z.boolean().default(false),
  fallbackPolicy: SetupFallbackPolicyLabelSchema.default(
    "safe_provider_unavailable_only",
  ),
  budgetLimitUsd: z.number().finite().nonnegative().optional(),
  readinessHints: SetupReadinessHintsSchema.optional(),
}).strict();
export type SetupAdaptiveDirect = z.infer<typeof SetupAdaptiveDirectSchema>;

export const SetupAgentBusSchema = z.object({
  enabled: z.boolean().default(false),
  transport: z.literal("supabase").default("supabase"),
  realtimeWakeup: z.boolean().default(false),
}).strict();
export type SetupAgentBus = z.infer<typeof SetupAgentBusSchema>;

export const SetupAgentRuntimeSchema = z.object({
  enabled: z.boolean().default(false),
  experimental: z.boolean().default(false),
  transport: z.literal("inMemory").default("inMemory"),
}).strict();
export type SetupAgentRuntime = z.infer<typeof SetupAgentRuntimeSchema>;

export const CommanderConfigSchema = z.object({
  enabled: z.boolean().default(false),
  mode: z.enum(["direct_synthesis", "agent_chat_future"]).default(
    "direct_synthesis",
  ),
  selectionStrategy: z.enum([
    "explicit",
    "first_eligible_synthesis",
    "highest_capability_score",
  ]).default("first_eligible_synthesis"),
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  authMode: SetupAuthModeSchema.optional(),
  transport: SetupTransportSchema.optional(),
  client: z.string().min(1).optional(),
  local: z.boolean().default(false),
}).strict();
export type SetupCommanderConfig = z.infer<typeof CommanderConfigSchema>;

export const SetupPersistenceSchema = z.object({
  mode: SetupPersistenceModeSchema.default("none"),
}).strict();
export type SetupPersistence = z.infer<typeof SetupPersistenceSchema>;

export const SetupTelemetrySchema = z.object({
  mode: SetupTelemetryModeSchema.default("console"),
}).strict();
export type SetupTelemetry = z.infer<typeof SetupTelemetrySchema>;

export const SetupWizardInputSchema = z.object({
  profile: SetupProfileNameSchema.optional(),
  routingMode: RoutingModeSchema.default("direct"),
  experimentalAgentChat: z.boolean().default(false),
  providers: z.array(SetupProviderSelectionSchema).default([]),
  persistence: SetupPersistenceSchema.default({ mode: "none" }),
  telemetry: SetupTelemetrySchema.default({ mode: "console" }),
  adaptiveDirect: SetupAdaptiveDirectSchema.default({
    enabled: false,
    fallbackPolicy: "safe_provider_unavailable_only",
  }),
  agentBus: SetupAgentBusSchema.default({
    enabled: false,
    transport: "supabase",
    realtimeWakeup: false,
  }),
  agentRuntime: SetupAgentRuntimeSchema.default({
    enabled: false,
    experimental: false,
    transport: "inMemory",
  }),
  commander: CommanderConfigSchema.default({
    enabled: false,
    mode: "direct_synthesis",
    selectionStrategy: "first_eligible_synthesis",
    local: false,
  }),
}).strict();
export type SetupWizardInput = z.input<typeof SetupWizardInputSchema>;
export type NormalizedSetupWizardInput = z.output<
  typeof SetupWizardInputSchema
>;

export const GeneratedQuorumRouterConfigSchema = z.object({
  profile: SetupProfileNameSchema,
  routing: z.object({
    mode: RoutingModeSchema,
  }).strict(),
  providers: z.array(SetupProviderSelectionSchema),
  persistence: SetupPersistenceSchema,
  telemetry: SetupTelemetrySchema,
  adaptiveDirect: SetupAdaptiveDirectSchema,
  agentBus: SetupAgentBusSchema,
  agentRuntime: SetupAgentRuntimeSchema,
  commander: CommanderConfigSchema,
  setup: z.object({
    generatedBy: z.literal("quorum-router setup"),
    warnings: z.array(z.string()),
    nonGoals: z.array(z.string()),
  }).strict(),
}).strict();
export type GeneratedQuorumRouterConfig = z.infer<
  typeof GeneratedQuorumRouterConfigSchema
>;

/** @deprecated Use GeneratedQuorumRouterConfigSchema. */
export const GeneratedFusionRouterConfigSchema =
  GeneratedQuorumRouterConfigSchema;
/** @deprecated Use GeneratedQuorumRouterConfig. */
export type GeneratedFusionRouterConfig = GeneratedQuorumRouterConfig;

export type SetupReport = {
  profile: SetupProfileName;
  configPath: string;
  routingMode: "direct" | "agent_chat";
  providers: SetupProviderSelection[];
  commander: SetupCommanderConfig;
  envPlaceholders: string[];
  doctorExpectations: string[];
  warnings: string[];
  nonGoals: string[];
};

export const KNOWN_SETUP_PROFILES: SetupProfileName[] = [
  ...SetupProfileNameSchema.options,
];
