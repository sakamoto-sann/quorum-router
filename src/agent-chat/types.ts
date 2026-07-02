import { z } from "zod";

export const AgentChatRoleSchema = z.enum([
  "planner",
  "coder",
  "reviewer",
  "red_team",
  "closeout",
]);
export type AgentChatRole = z.infer<typeof AgentChatRoleSchema>;

export const AgentChatPhaseSchema = z.enum([
  "planning",
  "coding",
  "review",
  "red_team",
  "closeout",
  "failed_closed",
]);
export type AgentChatPhase = z.infer<typeof AgentChatPhaseSchema>;

export const AgentChatDecisionSchema = z.enum([
  "ready",
  "not_ready",
  "failed_closed",
]);
export type AgentChatDecisionState = z.infer<typeof AgentChatDecisionSchema>;

export const AgentChatMetadataValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export const AgentChatMetadataSchema = z.record(AgentChatMetadataValueSchema);
export type AgentChatMetadata = z.infer<typeof AgentChatMetadataSchema>;

export const AgentChatMessageSchema = z.object({
  role: AgentChatRoleSchema,
  phase: AgentChatPhaseSchema,
  content: z.string(),
  createdAtMs: z.number().int().nonnegative(),
  redacted: z.literal(true),
  metadata: AgentChatMetadataSchema.default({}),
}).strict();
export type AgentChatMessage = z.infer<typeof AgentChatMessageSchema>;

export const AgentChatTurnSchema = AgentChatMessageSchema.extend({
  turnIndex: z.number().int().nonnegative(),
}).strict();
export type AgentChatTurn = z.infer<typeof AgentChatTurnSchema>;

export const AgentChatObjectionSchema = z.object({
  role: z.enum(["reviewer", "red_team"]),
  phase: z.enum(["review", "red_team"]),
  content: z.string(),
  createdAtMs: z.number().int().nonnegative(),
  redacted: z.literal(true),
  metadata: AgentChatMetadataSchema.default({}),
}).strict();
export type AgentChatObjection = z.infer<typeof AgentChatObjectionSchema>;

export const AgentChatCloseoutSchema = z.object({
  ready: z.boolean(),
  summary: z.string(),
  createdAtMs: z.number().int().nonnegative(),
  redacted: z.literal(true),
  metadata: AgentChatMetadataSchema.default({}),
}).strict();
export type AgentChatCloseout = z.infer<typeof AgentChatCloseoutSchema>;

export const AgentChatDecisionResultSchema = z.object({
  decision: AgentChatDecisionSchema,
  reason: z.string(),
  phase: AgentChatPhaseSchema,
  objections: z.array(AgentChatObjectionSchema),
  closeout: AgentChatCloseoutSchema.optional(),
  metadata: AgentChatMetadataSchema.default({}),
}).strict();
export type AgentChatDecision = z.infer<typeof AgentChatDecisionResultSchema>;

export const AgentChatTranscriptSchema = z.object({
  prompt: z.string(),
  startedAtMs: z.number().int().nonnegative(),
  completedAtMs: z.number().int().nonnegative().optional(),
  redacted: z.literal(true),
  turns: z.array(AgentChatTurnSchema),
  messages: z.array(AgentChatMessageSchema),
  objections: z.array(AgentChatObjectionSchema),
  decision: AgentChatDecisionResultSchema.optional(),
  metadata: AgentChatMetadataSchema.default({}),
}).strict();
export type AgentChatTranscript = z.infer<typeof AgentChatTranscriptSchema>;

export type AgentChatLimits = {
  maxTurns: number;
  maxTurnsPerRole: Partial<Record<AgentChatRole, number>>;
  maxDurationMs: number;
  maxPhaseDurationMs: number;
  maxBudgetUsd?: number;
};

export type AgentChatScriptStep = {
  content?: string;
  objection?: string;
  durationMs?: number;
  budgetUsd?: number;
  metadata?: Record<string, unknown>;
};

export type AgentChatRunConfig = {
  prompt: string;
  limits?: Partial<AgentChatLimits>;
  script?: Partial<Record<AgentChatRole, AgentChatScriptStep>>;
  startedAtMs?: number;
  extraRedactionValues?: string[];
};

export const AGENT_CHAT_ROLES = Object.freeze(
  [
    ...AgentChatRoleSchema.options,
  ] as const,
);
