import { z } from "zod";

export const SupabaseAuditModeSchema = z.enum([
  "disabled",
  "optional",
  "required",
]);

export type SupabaseAuditMode = z.infer<typeof SupabaseAuditModeSchema>;

export const SupabaseFeatureConfigSchema = z.object({
  audit: z.object({
    mode: SupabaseAuditModeSchema,
  }).strict(),
}).strict();

export type SupabaseFeatureConfig = z.infer<
  typeof SupabaseFeatureConfigSchema
>;

export const SelectiveFeatureConfigSchema = z.object({
  supabase: SupabaseFeatureConfigSchema.optional(),
}).strict();

const SECRET_CONFIG_KEY =
  /^(?:quorum_router_)?supabase_(?:url|anon_key|publishable_key|session_jwt|access_token|service_role_key|admin_key)$/i;

function normalizedConfigKey(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-z0-9]+/gi, "_")
    .toLowerCase();
}

function findSupabaseCredentialPath(
  value: unknown,
  path: Array<string | number> = [],
): Array<string | number> | undefined {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSupabaseCredentialPath(value[index], [...path, index]);
      if (found) return found;
    }
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  for (const [key, nested] of Object.entries(value)) {
    const normalized = normalizedConfigKey(key);
    if (
      SECRET_CONFIG_KEY.test(normalized) ||
      (/supabase/.test(normalized) &&
        /(secret|token|key|credential|password|url)/.test(normalized))
    ) {
      return [...path, key];
    }
    const found = findSupabaseCredentialPath(nested, [...path, key]);
    if (found) return found;
  }
  return undefined;
}

export const GeneratedRouterConfigSchema = z.object({
  features: SelectiveFeatureConfigSchema.optional(),
}).passthrough().superRefine((value, context) => {
  const path = findSupabaseCredentialPath(value);
  if (path) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path,
      message: "Supabase runtime credentials belong in the environment only",
    });
  }
});

export type AuthMode = "auto" | "wrapper" | "oauth" | "session" | "env";
export type InventorySource =
  | "wrapper"
  | "oauth_session"
  | "local_cli"
  | "env_fallback"
  | "static_config";

export type ModelInventoryEntry = {
  provider: string;
  auth_mode: AuthMode | "session" | "oauth" | "env";
  model: string;
  model_id: string;
  source: InventorySource;
  available: boolean;
  blocked_reason?: string;
  can_list_models: boolean;
  listed_models?: string[];
  list_blocked_reason?: string;
  can_invoke: boolean;
  notes: string[];
  command?: string;
  args_template?: string[];
  prompt_transport?: "stdin" | "file";
  invocation_model?: string;
};

export type ModelInventory = {
  generated_at: string;
  auth_mode: AuthMode;
  entries: ModelInventoryEntry[];
  available_count: number;
  blocked_count: number;
  env_fallback_configured: boolean;
  env_fallback_used: boolean;
};

export type ProviderResult = {
  provider: string;
  model: string;
  model_id?: string;
  source?: string;
  command?: string;
  listed_models?: string[];
  response_received: boolean;
  schema_valid: boolean;
  response_summary: string;
  raw_content: string;
  error?: string;
};

export type ScoreRow = {
  provider: string;
  model: string;
  schema_valid: boolean;
  response_received: boolean;
  clarity: number;
  completeness: number;
  risk: number;
  instruction_fit: number;
  final_score: number;
};

export type AgentChatTurn = {
  round: number;
  provider: string;
  model: string;
  reply_to?: { provider: string; model: string; round: number };
  content: string;
};

export type PromptContextTrace = {
  prompt_has_context: boolean;
  original_prompt_chars: number;
  effective_prompt_chars: number;
  prompt_truncated: boolean;
  context_chars: number;
  github_repo?: string;
  github_default_branch?: string;
  files_included: string[];
  files_considered: number;
  tree_truncated: boolean;
  context_fetch_error?: string;
};

export type CostAwareTrace = {
  enabled: boolean;
  pricing_source: "configured_estimate_not_live_billing";
  max_budget_usd?: number;
  estimated_total_usd?: number;
  selected_model_ids: string[];
  excluded: Array<{
    model_id: string;
    estimated_cost_usd?: number;
    reason: "missing_estimate" | "budget_exceeded";
  }>;
};

export type DogfoodTrace = {
  run_id: string;
  timestamp: string;
  command: string;
  mode: "route_once" | "best_route" | "agent_chat" | "health";
  auth_mode: AuthMode;
  provider?: string;
  model?: string;
  requested_provider_label?: string;
  requested_model?: string;
  selected_provider?: string;
  selected_model?: string;
  provider_selection_honored: boolean;
  fallback_used: boolean;
  prompt_hash?: string;
  prompt_summary?: string;
  prompt_context?: PromptContextTrace;
  cost_aware?: CostAwareTrace;
  response_summary?: string;
  schema_valid: boolean;
  redaction_ok: boolean;
  credential_value_present: boolean;
  sensitive_value_present: boolean;
  selected_route?: { provider: string; model: string; final_score?: number };
  score_table?: ScoreRow[];
  agent_chat_turns?: AgentChatTurn[];
  errors: string[];
  boundaries: string[];
};

export function parseAuthMode(value: string | undefined): AuthMode {
  const mode = (value ?? "auto").trim().toLowerCase();
  if (["auto", "wrapper", "oauth", "session", "env"].includes(mode)) {
    return mode as AuthMode;
  }
  throw new Error(
    `QuorumRouter blocked: invalid QUORUM_ROUTER_AUTH_MODE '${mode}'`,
  );
}

export function assertOptIn(): void {
  if (Deno.env.get("RUN_EXTERNAL_MODEL_DOGFOOD") !== "1") {
    throw new Error(
      "QuorumRouter external dogfood blocked: set RUN_EXTERNAL_MODEL_DOGFOOD=1 to invoke real providers",
    );
  }
}

export function assertAgentChatOptIn(): void {
  if (Deno.env.get("RUN_EXPERIMENTAL_AGENT_CHAT") !== "1") {
    throw new Error(
      "agent_chat blocked: set RUN_EXPERIMENTAL_AGENT_CHAT=1; live multi-model dialogue is explicit opt-in",
    );
  }
}
