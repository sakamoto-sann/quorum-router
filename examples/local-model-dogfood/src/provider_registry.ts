import type { ModelInventoryEntry } from "./schema.ts";

export type ProviderSpec = {
  provider: string;
  model: string;
  model_id: string;
  auth_mode: "oauth" | "session" | "env";
  source: "wrapper" | "oauth_session" | "local_cli" | "env_fallback";
  command?: string;
  args_template?: string[];
  can_list_models: boolean;
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
    can_list_models: false,
    notes: [
      "Uses existing Codex CLI OAuth/session; model listing is not required for dogfood.",
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
    can_list_models: false,
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
    can_list_models: false,
    notes: [
      "Gemini CLI can hang on some version/help probes; inventory only checks command presence.",
    ],
  },
  {
    provider: "xAI",
    model: "grok-cli",
    model_id: "xai/grok-cli",
    auth_mode: "oauth",
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
    can_list_models: false,
    notes: ["Uses existing Grok CLI session."],
  },
  {
    provider: "Cognition",
    model: "devin-cli",
    model_id: "cognition/devin-cli",
    auth_mode: "session",
    source: "local_cli",
    command: "devin",
    args_template: ["-p", "__PROMPT__"],
    can_list_models: false,
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
    can_list_models: false,
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
      : "missing FUSION_ROUTER_PROVIDER_BASE_URL, FUSION_ROUTER_PROVIDER_API_KEY, or FUSION_ROUTER_PROVIDER_MODEL",
    can_list_models: false,
    can_invoke: configured,
    notes: [
      "Env fallback is explicit-only and is not the preferred public dogfood path.",
    ],
  };
}
