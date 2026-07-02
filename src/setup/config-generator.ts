import { failClosed } from "../errors.ts";
import {
  createDefaultProviderCapabilityRegistry,
  providerDescriptorKey,
} from "../policy/provider-registry.ts";
import type { ProviderDescriptor } from "../schemas.ts";
import {
  type GeneratedFusionRouterConfig,
  GeneratedFusionRouterConfigSchema,
  type NormalizedSetupWizardInput,
  type SetupProfileName,
  SetupProfileNameSchema,
  type SetupProviderSelection,
  type SetupReport,
  type SetupWizardInput,
  SetupWizardInputSchema,
} from "./setup-schema.ts";

const DEFAULT_CONFIG_PATH = "fusion-router.config.json";

const NON_GOALS = [
  "no agent_chat runtime",
  "no provider account creation",
  "no OAuth login flow",
  "no API key storage",
  "no live credential validation",
  "no local JSONL audit store implementation",
  "no Supabase migration or audit RPC payload changes",
  "no automatic remote health checks",
  "no hidden fallback behavior",
  "no default direct behavior change",
];

export const SETUP_PROFILE_INPUTS: Record<SetupProfileName, SetupWizardInput> =
  {
    "minimal-direct": {
      profile: "minimal-direct",
      routingMode: "direct",
      providers: [],
      persistence: { mode: "none" },
      telemetry: { mode: "console" },
      adaptiveDirect: {
        enabled: false,
        fallbackPolicy: "safe_provider_unavailable_only",
      },
    },
    "direct-http-openai": {
      profile: "direct-http-openai",
      routingMode: "direct",
      providers: [
        {
          provider: "OpenAI",
          model: "gpt-4o-mini",
          authMode: "apiKey",
          transport: "directHttp",
          client: "OpenAIChatCompletions",
          enabled: true,
        },
      ],
      persistence: { mode: "none" },
      telemetry: { mode: "console" },
      adaptiveDirect: {
        enabled: false,
        fallbackPolicy: "safe_provider_unavailable_only",
      },
    },
    "direct-http-anthropic": {
      profile: "direct-http-anthropic",
      routingMode: "direct",
      providers: [
        {
          provider: "Anthropic",
          model: "claude-3-5-haiku-latest",
          authMode: "apiKey",
          transport: "directHttp",
          client: "AnthropicMessagesAPI",
          enabled: true,
        },
      ],
      persistence: { mode: "none" },
      telemetry: { mode: "console" },
      adaptiveDirect: {
        enabled: false,
        fallbackPolicy: "safe_provider_unavailable_only",
      },
    },
    "cli-oauth": {
      profile: "cli-oauth",
      routingMode: "direct",
      providers: [
        {
          provider: "OpenAI",
          model: "codex",
          authMode: "oauth",
          transport: "processAdapter",
          client: "CodexCLI",
          enabled: true,
        },
        {
          provider: "Anthropic",
          model: "claude-code",
          authMode: "oauth",
          transport: "processAdapter",
          client: "ClaudeCode",
          enabled: true,
        },
        {
          provider: "Google",
          model: "gemini-cli",
          authMode: "oauth",
          transport: "processAdapter",
          client: "GeminiCLI",
          enabled: true,
        },
        {
          provider: "xAI",
          model: "grok",
          authMode: "oauth",
          transport: "processAdapter",
          client: "GrokCLI",
          enabled: true,
        },
        {
          provider: "GLM",
          model: "glm-zcode",
          authMode: "oauth",
          transport: "zcodeWrapper",
          client: "zcode",
          enabled: true,
        },
      ],
      persistence: { mode: "none" },
      telemetry: { mode: "console" },
      adaptiveDirect: {
        enabled: false,
        fallbackPolicy: "safe_provider_unavailable_only",
      },
    },
    "adaptive-direct": {
      profile: "adaptive-direct",
      routingMode: "direct",
      providers: [
        {
          provider: "OpenAI",
          model: "gpt-4o-mini",
          authMode: "apiKey",
          transport: "directHttp",
          client: "OpenAIChatCompletions",
          enabled: true,
        },
        {
          provider: "OpenAI",
          model: "gpt-5.5",
          authMode: "oauth",
          transport: "processAdapter",
          client: "CodexCLI",
          enabled: true,
        },
      ],
      persistence: { mode: "none" },
      telemetry: { mode: "otlp" },
      adaptiveDirect: {
        enabled: true,
        fallbackPolicy: "safe_provider_unavailable_only",
        budgetLimitUsd: 0.25,
      },
    },
    "supabase-audit": {
      profile: "supabase-audit",
      routingMode: "direct",
      providers: [],
      persistence: { mode: "supabaseAuditRpc" },
      telemetry: { mode: "console" },
      adaptiveDirect: {
        enabled: false,
        fallbackPolicy: "safe_provider_unavailable_only",
      },
    },
  };

function mergeProfile(input: SetupWizardInput): SetupWizardInput {
  const profile = input.profile ?? "minimal-direct";
  const parsedProfile = SetupProfileNameSchema.safeParse(profile);
  if (!parsedProfile.success) {
    failClosed(
      4400,
      "unknown_setup_profile",
      "Unknown setup profile selected.",
      { profile, knownProfiles: SetupProfileNameSchema.options },
    );
  }

  const defaults = SETUP_PROFILE_INPUTS[parsedProfile.data];
  return {
    ...defaults,
    ...input,
    profile: parsedProfile.data,
    persistence: { ...defaults.persistence, ...input.persistence },
    telemetry: { ...defaults.telemetry, ...input.telemetry },
    adaptiveDirect: { ...defaults.adaptiveDirect, ...input.adaptiveDirect },
    providers: input.providers ?? defaults.providers,
  };
}

function normalizeInput(input: SetupWizardInput): NormalizedSetupWizardInput {
  const merged = mergeProfile(input);
  const parsed = SetupWizardInputSchema.safeParse(merged);
  if (!parsed.success) {
    failClosed(
      4400,
      "invalid_setup_input",
      "Setup input failed schema validation.",
      { issues: parsed.error.issues.map((issue) => issue.path.join(".")) },
    );
  }
  return parsed.data;
}

function assertAgentChatExplicit(input: NormalizedSetupWizardInput): void {
  if (input.routingMode !== "agent_chat") {
    return;
  }
  if (input.experimentalAgentChat) {
    return;
  }
  failClosed(
    4401,
    "setup_agent_chat_requires_explicit_warning",
    "agent_chat is recognized but not implemented; setup requires experimentalAgentChat=true.",
    { routingMode: input.routingMode },
  );
}

function localModelPlaceholderAllowed(
  selection: SetupProviderSelection,
): boolean {
  return selection.provider === "Local" && selection.authMode === "local" &&
    selection.transport === "localModel";
}

function toProviderDescriptor(
  selection: SetupProviderSelection,
): ProviderDescriptor | undefined {
  if (selection.authMode === "local" || selection.transport === "localModel") {
    return undefined;
  }
  return {
    provider: selection.provider,
    model: selection.model,
    authMode: selection.authMode,
    transport: selection.transport,
    client: selection.client,
  } as ProviderDescriptor;
}

function assertProviderCombination(
  selection: SetupProviderSelection,
  registry: ReturnType<typeof createDefaultProviderCapabilityRegistry>,
): void {
  if (!selection.enabled) {
    return;
  }
  if (localModelPlaceholderAllowed(selection)) {
    return;
  }

  const descriptor = toProviderDescriptor(selection);
  if (!descriptor) {
    failClosed(
      4400,
      "invalid_setup_provider_combination",
      "Local setup providers must use provider=Local, authMode=local, transport=localModel.",
      { provider: selection.provider, model: selection.model },
    );
  }

  const capability = registry.get(descriptor);
  if (!capability) {
    failClosed(
      4400,
      "invalid_setup_provider_combination",
      "Selected provider/auth/transport combination is not registered.",
      {
        provider: descriptor.provider,
        model: descriptor.model,
        authMode: descriptor.authMode,
        transport: descriptor.transport,
        client: descriptor.client,
        key: providerDescriptorKey(descriptor),
      },
    );
  }
}

function assertProviderCombinations(input: NormalizedSetupWizardInput): void {
  const registry = createDefaultProviderCapabilityRegistry();
  for (const selection of input.providers) {
    assertProviderCombination(selection, registry);
  }
}

function warningsFor(input: NormalizedSetupWizardInput): string[] {
  const warnings: string[] = [];
  if (input.routingMode === "agent_chat") {
    warnings.push(
      "agent_chat is recognized but not implemented; runtime route execution fails closed before adapter execution.",
    );
  }
  if (input.persistence.mode === "localJsonl") {
    warnings.push(
      "local JSONL persistence is a placeholder and is not implemented.",
    );
  }
  if (input.persistence.mode === "supabaseAuditRpc") {
    warnings.push(
      "Supabase audit RPC requires URL, anon key, and user/session JWT placeholders only; service-role credentials are forbidden at runtime.",
    );
  }
  if (input.adaptiveDirect.enabled) {
    warnings.push(
      "Adaptive Direct uses safe_provider_unavailable_only fallback classification and does not perform hidden fallback success.",
    );
  }
  return warnings;
}

function envPlaceholdersFor(input: NormalizedSetupWizardInput): string[] {
  const placeholders = new Set<string>();
  for (const provider of input.providers) {
    if (!provider.enabled) {
      continue;
    }
    if (provider.provider === "OpenAI" && provider.transport === "directHttp") {
      placeholders.add("OPENAI_API_KEY=");
    }
    if (
      provider.provider === "Anthropic" && provider.transport === "directHttp"
    ) {
      placeholders.add("ANTHROPIC_API_KEY=");
    }
  }
  if (input.telemetry.mode === "otlp") {
    placeholders.add("OTEL_EXPORTER_OTLP_ENDPOINT=");
  }
  if (input.persistence.mode === "supabaseAuditRpc") {
    placeholders.add("FUSION_ROUTER_SUPABASE_URL=");
    placeholders.add("FUSION_ROUTER_SUPABASE_ANON_KEY=");
    placeholders.add("FUSION_ROUTER_SUPABASE_SESSION_JWT=");
  }
  if (input.adaptiveDirect.budgetLimitUsd !== undefined) {
    placeholders.add("FUSION_ROUTER_BUDGET_LIMIT_USD=");
  }
  return [...placeholders].sort();
}

function doctorExpectationsFor(input: NormalizedSetupWizardInput): string[] {
  const expectations = [
    "deno_version ok",
    "supabase_service_role_absent ok",
    `routing_effective_mode ${input.routingMode}`,
  ];
  if (input.persistence.mode === "supabaseAuditRpc") {
    expectations.push(
      "supabase_audit_config configured when URL and anon key are present",
    );
  } else {
    expectations.push(
      "supabase_audit_config not configured (info) when env is absent",
    );
  }
  if (input.routingMode === "agent_chat") {
    expectations.push(
      "routing_agent_chat_status warns; route execution still fails closed",
    );
  }
  if (input.adaptiveDirect.enabled) {
    expectations.push("adaptive_direct_config safe fallback only");
  }
  return expectations;
}

function buildConfig(
  input: NormalizedSetupWizardInput,
): GeneratedFusionRouterConfig {
  const config = {
    profile: input.profile,
    routing: { mode: input.routingMode },
    providers: input.providers,
    persistence: input.persistence,
    telemetry: input.telemetry,
    adaptiveDirect: input.adaptiveDirect,
    setup: {
      generatedBy: "fusion-router setup" as const,
      warnings: warningsFor(input),
      nonGoals: NON_GOALS,
    },
  };

  return GeneratedFusionRouterConfigSchema.parse(config);
}

export function generateFusionRouterConfig(
  input: SetupWizardInput = {},
): GeneratedFusionRouterConfig {
  const normalized = normalizeInput(input);
  assertAgentChatExplicit(normalized);
  assertProviderCombinations(normalized);
  return buildConfig(normalized);
}

export function stringifyGeneratedFusionRouterConfig(
  config: GeneratedFusionRouterConfig,
): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function generateEnvExample(input: SetupWizardInput = {}): string {
  const normalized = normalizeInput(input);
  assertAgentChatExplicit(normalized);
  assertProviderCombinations(normalized);
  const placeholders = envPlaceholdersFor(normalized);
  const lines = [
    "# fusion-router setup placeholders",
    "# Fill these in your shell, deployment environment, or secret manager.",
    "# Do not put raw secrets in fusion-router.config.json.",
    "# Supabase service-role credentials are admin/migration-only and must never be present at runtime.",
    ...placeholders,
  ];
  return `${lines.join("\n")}\n`;
}

export function generateSetupReport(
  input: SetupWizardInput = {},
  configPath = DEFAULT_CONFIG_PATH,
): SetupReport {
  const normalized = normalizeInput(input);
  assertAgentChatExplicit(normalized);
  assertProviderCombinations(normalized);
  return {
    profile: normalized.profile ?? "minimal-direct",
    configPath,
    routingMode: normalized.routingMode,
    providers: normalized.providers,
    envPlaceholders: envPlaceholdersFor(normalized),
    doctorExpectations: doctorExpectationsFor(normalized),
    warnings: warningsFor(normalized),
    nonGoals: NON_GOALS,
  };
}

export function profileInput(profile: SetupProfileName): SetupWizardInput {
  return SETUP_PROFILE_INPUTS[profile];
}
