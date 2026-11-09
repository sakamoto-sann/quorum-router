// Inventory and result shapes come from the scaffold template, so the dogfood
// runner and generated projects cannot drift apart. The runner keeps its own
// narrower auth modes, trace format, and opt-in gates below.
import type {
  ScoreRow,
} from "../../../packages/create-quorum-router/templates/basic/src/schema.ts";

export type {
  InventorySource,
  ModelInventory,
  ModelInventoryEntry,
  ProviderResult,
  ScoreRow,
} from "../../../packages/create-quorum-router/templates/basic/src/schema.ts";

/** The dogfood runner does not support the scaffold's "session" auth mode. */
export type AuthMode = "auto" | "wrapper" | "oauth" | "env";

/** Runner trace; the scaffold trace adds provider-selection fields it never writes. */
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
  if (["auto", "wrapper", "oauth", "env"].includes(mode)) {
    return mode as AuthMode;
  }
  throw new Error(
    `local model dogfood blocked: invalid QUORUM_ROUTER_AUTH_MODE '${mode}'`,
  );
}

export function assertOptIn(): void {
  if (Deno.env.get("RUN_EXTERNAL_MODEL_DOGFOOD") !== "1") {
    throw new Error(
      "local model dogfood blocked: set RUN_EXTERNAL_MODEL_DOGFOOD=1 to invoke real models",
    );
  }
}

export function assertAgentChatOptIn(): void {
  if (
    Deno.env.get("RUN_AGENT_CHAT") !== "1" &&
    Deno.env.get("RUN_EXPERIMENTAL_AGENT_CHAT") !== "1"
  ) {
    throw new Error(
      "agent_chat blocked: set RUN_AGENT_CHAT=1; agent_chat is explicit opt-in and has no mutation authority",
    );
  }
}
