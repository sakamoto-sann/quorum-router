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

export type DogfoodTrace = {
  run_id: string;
  timestamp: string;
  command: string;
  mode: "route_once" | "best_route" | "agent_chat" | "health";
  auth_mode: AuthMode;
  provider?: string;
  model?: string;
  prompt_hash?: string;
  prompt_summary?: string;
  response_summary?: string;
  schema_valid: boolean;
  redaction_ok: boolean;
  credential_value_present: boolean;
  sensitive_value_present: boolean;
  selected_route?: { provider: string; model: string; final_score?: number };
  score_table?: ScoreRow[];
  errors: string[];
  boundaries: string[];
};

export function parseAuthMode(value: string | undefined): AuthMode {
  const mode = (value ?? "auto").trim().toLowerCase();
  if (["auto", "wrapper", "oauth", "session", "env"].includes(mode)) {
    return mode as AuthMode;
  }
  throw new Error(
    `Fusion Router blocked: invalid FUSION_ROUTER_AUTH_MODE '${mode}'`,
  );
}

export function assertOptIn(): void {
  if (Deno.env.get("RUN_EXTERNAL_MODEL_DOGFOOD") !== "1") {
    throw new Error(
      "Fusion Router external dogfood blocked: set RUN_EXTERNAL_MODEL_DOGFOOD=1 to invoke real providers",
    );
  }
}

export function assertAgentChatOptIn(): void {
  if (Deno.env.get("RUN_EXPERIMENTAL_AGENT_CHAT") !== "1") {
    throw new Error(
      "agent_chat blocked: set RUN_EXPERIMENTAL_AGENT_CHAT=1; agent_chat is experimental explicit opt-in only",
    );
  }
}
