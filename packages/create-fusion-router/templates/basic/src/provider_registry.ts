import type { ModelInventoryEntry } from "./schema.ts";

export type ProviderSpec = {
  provider: string;
  model: string;
  model_id: string;
  auth_mode: "oauth" | "session" | "env";
  source: "wrapper" | "oauth_session" | "local_cli" | "env_fallback";
  command?: string;
  args_template?: string[];
  list_models_args?: string[];
  list_blocked_reason?: string;
  notes: string[];
};

export const LOCAL_PROVIDER_SPECS: ProviderSpec[] = [
  {
    provider: "OpenAI",
    model: "codex-cli",
    model_id: "openai/codex-cli",
    auth_mode: "oauth",
    source: "oauth_session",
    command: "codex",
    args_template: [
      "exec",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--cd",
      "__CWD__",
      "--output-last-message",
      "__OUT__",
      "__PROMPT__",
    ],
    list_blocked_reason:
      "codex models is tty/stdin dependent in this environment; model catalog listing is unavailable from non-interactive Deno.",
    notes: [
      "Uses existing Codex CLI OAuth/session; command presence and invocation are verified separately.",
    ],
  },
  {
    provider: "Anthropic",
    model: "claude-code",
    model_id: "anthropic/claude-code",
    auth_mode: "oauth",
    source: "oauth_session",
    command: "claude",
    args_template: ["-p", "__PROMPT__"],
    list_blocked_reason:
      "Claude Code model listing is blocked by organization policy / disabled subscription access in this environment.",
    notes: [
      "Uses existing Claude Code session; do not trigger login from dogfood runner.",
    ],
  },
  {
    provider: "Google",
    model: "gemini-cli",
    model_id: "google/gemini-cli",
    auth_mode: "oauth",
    source: "oauth_session",
    command: "gemini",
    args_template: ["-p", "__PROMPT__"],
    list_blocked_reason:
      "Gemini CLI list/invoke paths require a trusted directory in non-interactive runs unless the user opts into the trust setting.",
    notes: [
      "Gemini CLI can require workspace trust; inventory does not trigger login or trust flows.",
    ],
  },
  {
    provider: "xAI",
    model: "grok-cli",
    model_id: "xai/grok-cli",
    auth_mode: "session",
    source: "oauth_session",
    command: "grok",
    args_template: [
      "-p",
      "__PROMPT__",
      "--output-format",
      "plain",
      "--permission-mode",
      "plan",
      "--disable-web-search",
    ],
    list_models_args: ["models"],
    notes: [
      "Uses existing Grok CLI session; `grok models` is safe list-only discovery.",
    ],
  },
  {
    provider: "Cognition",
    model: "devin-cli",
    model_id: "cognition/devin-cli",
    auth_mode: "session",
    source: "local_cli",
    command: "devin",
    args_template: ["-p", "__PROMPT__"],
    list_blocked_reason:
      "Devin CLI does not expose a models subcommand in this environment.",
    notes: ["Uses existing Devin CLI session."],
  },
  {
    provider: "Alibaba",
    model: "qwen-cli",
    model_id: "alibaba/qwen-cli",
    auth_mode: "session",
    source: "local_cli",
    command: "qwen",
    args_template: ["-p", "__PROMPT__"],
    list_blocked_reason:
      "Qwen CLI model listing path is stdin/API-key dependent in this environment.",
    notes: ["Uses existing local Qwen CLI session."],
  },
];

export function envFallbackEntry(configured: boolean): ModelInventoryEntry {
  const label = Deno.env.get("FUSION_ROUTER_PROVIDER_LABEL")?.trim() ||
    "OpenAI-compatible env fallback";
  const model = Deno.env.get("FUSION_ROUTER_PROVIDER_MODEL")?.trim() ||
    "missing-model";
  return {
    provider: label,
    auth_mode: "env",
    model,
    model_id: `env/${model}`,
    source: "env_fallback",
    available: configured,
    blocked_reason: configured
      ? undefined
      : "missing explicit private env fallback configuration",
    can_list_models: false,
    list_blocked_reason:
      "Generic env fallback uses a single user-selected model and does not perform provider catalog discovery.",
    can_invoke: configured,
    notes: [
      "Env fallback is explicit-only and is not the preferred public dogfood path.",
    ],
  };
}
