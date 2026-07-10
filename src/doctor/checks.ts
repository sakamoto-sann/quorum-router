import {
  describeRoutingModeDecision,
  parseRoutingMode,
  resolveRoutingMode,
  ROUTING_MODE_ENV,
} from "../routing-mode.ts";
import { loadQuorumRouterConfig, type QuorumRouterConfig } from "../config.ts";
import { RouterError } from "../errors.ts";
import { readRouterEnv, routerEnvPresent } from "../env.ts";
import {
  createDefaultProviderCapabilityRegistry,
  providerDescriptorKey,
} from "../policy/provider-registry.ts";
import type { ProviderDescriptor } from "../schemas.ts";
import type { SetupProviderSelection } from "../setup/setup-schema.ts";
import {
  TELEMETRY_MAX_BATCH_SIZE,
  TELEMETRY_MAX_DRAIN_MS,
  TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  TELEMETRY_MAX_QUEUE_SIZE,
} from "../telemetry/buffered-batch-sink.ts";

export type DoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
  severity?: "info" | "warn" | "error";
};

export type DoctorReport = {
  ok: boolean;
  checks: DoctorCheck[];
};

export type DoctorRunOptions = {
  checkCliCommands?: boolean;
};

const DEFAULT_CONFIG_PATH = "quorum-router.config.json";
const CONFIG_PATH_ENV = "QUORUM_ROUTER_CONFIG";
const LEGACY_CONFIG_PATH = "fusion-router.config.json";

function envFlagEnabled(name: string): boolean {
  const value = readRouterEnv(name);
  return value === "1" || value === "true" || value === "yes";
}

function envPresent(name: string): boolean {
  return routerEnvPresent(name);
}

function boundedEnv(name: string, fallback: number, max: number): number {
  const value = Number(readRouterEnv(name));
  return Number.isFinite(value) && value > 0
    ? Math.min(Math.floor(value), max)
    : fallback;
}

function maskEndpoint(raw: string | undefined): string {
  if (!raw) {
    return "not configured";
  }

  try {
    const url = new URL(raw);
    const auth = url.username || url.password ? "[REDACTED]@" : "";
    return `${url.protocol}//${auth}${url.host}${url.pathname}`;
  } catch {
    return "invalid URL";
  }
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    const result = await new Deno.Command("/usr/bin/env", {
      args: ["sh", "-c", `command -v ${command} >/dev/null 2>&1`],
      stdout: "null",
      stderr: "null",
    }).output();
    return result.success;
  } catch {
    return false;
  }
}

const FORBIDDEN_SUPABASE_PRIVILEGE_ENV_KEYS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "QUORUM_ROUTER_SUPABASE_SERVICE_ROLE_KEY",
  "FUSION_ROUTER_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "QUORUM_ROUTER_SUPABASE_SERVICE_KEY",
  "FUSION_ROUTER_SUPABASE_SERVICE_KEY",
  "SUPABASE_ADMIN_KEY",
  "QUORUM_ROUTER_SUPABASE_ADMIN_KEY",
  "FUSION_ROUTER_SUPABASE_ADMIN_KEY",
]);

function serviceRoleEnvKeys(): string[] {
  return Object.keys(Deno.env.toObject()).filter((key) =>
    FORBIDDEN_SUPABASE_PRIVILEGE_ENV_KEYS.has(key.toUpperCase()) ||
    /SUPABASE.*(SERVICE.*ROLE|SERVICE.*KEY|ADMIN.*KEY|JWT.*SECRET)/i.test(key)
  );
}

async function configPath(): Promise<string> {
  const configured = readRouterEnv(CONFIG_PATH_ENV)?.trim();
  if (configured) return configured;
  try {
    await Deno.stat(DEFAULT_CONFIG_PATH);
    return DEFAULT_CONFIG_PATH;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  try {
    await Deno.stat(LEGACY_CONFIG_PATH);
    return LEGACY_CONFIG_PATH;
  } catch {
    return DEFAULT_CONFIG_PATH;
  }
}

function safeRoutingConfigError(error: unknown): string {
  if (error instanceof RouterError) {
    return error.code;
  }

  if (error instanceof Deno.errors.PermissionDenied) {
    return "permission_denied";
  }

  return "config_check_failed";
}

function setupProviderToDescriptor(
  provider: SetupProviderSelection,
): ProviderDescriptor | undefined {
  if (provider.authMode === "local" || provider.transport === "localModel") {
    return undefined;
  }
  return {
    provider: provider.provider,
    model: provider.model,
    authMode: provider.authMode,
    transport: provider.transport,
    client: provider.client,
  } as ProviderDescriptor;
}

function isLocalModelPlaceholder(provider: SetupProviderSelection): boolean {
  return provider.provider === "Local" && provider.authMode === "local" &&
    provider.transport === "localModel";
}

function pushSetupConfigChecks(
  checks: DoctorCheck[],
  config: QuorumRouterConfig | undefined,
): void {
  if (!config) {
    checks.push({
      name: "setup_profile",
      ok: true,
      detail: "not configured",
      severity: "info",
    });
    return;
  }

  checks.push({
    name: "setup_profile",
    ok: true,
    detail: config.setupProfile
      ? `known profile: ${config.setupProfile}`
      : "not configured",
    severity: "info",
  });

  const providers = config.providers ?? [];
  const registry = createDefaultProviderCapabilityRegistry();
  const missing: string[] = [];
  const placeholders: string[] = [];
  for (const provider of providers) {
    if (!provider.enabled) {
      continue;
    }
    if (isLocalModelPlaceholder(provider)) {
      placeholders.push(`${provider.provider}/${provider.model}`);
      continue;
    }
    const descriptor = setupProviderToDescriptor(provider);
    if (!descriptor || !registry.get(descriptor)) {
      missing.push(
        `${provider.provider}/${provider.model}/${provider.authMode}/${provider.transport}`,
      );
    }
  }

  checks.push({
    name: "setup_provider_capabilities",
    ok: missing.length === 0,
    detail: missing.length === 0
      ? providers.length === 0
        ? "no setup providers selected"
        : `registered providers: ${providers.length}`
      : `unregistered provider selections: ${missing.join(", ")}`,
    severity: missing.length === 0 ? "info" : "error",
  });

  checks.push({
    name: "setup_auth_transport_match",
    ok: missing.length === 0,
    detail: missing.length === 0
      ? "selected auth/transport combinations match capability registry or explicit placeholders"
      : "one or more selected auth/transport combinations do not match capability registry",
    severity: missing.length === 0 ? "info" : "error",
  });

  if (placeholders.length > 0) {
    checks.push({
      name: "setup_local_model_placeholder",
      ok: true,
      detail: `placeholder only, not implemented: ${placeholders.join(", ")}`,
      severity: "warn",
    });
  }

  const persistenceMode = config.persistence?.mode ?? "none";
  checks.push({
    name: "setup_persistence",
    ok: true,
    detail: persistenceMode === "localJsonl"
      ? "local JSONL persistence is a placeholder and not implemented"
      : persistenceMode === "supabaseAuditRpc"
      ? "Supabase audit RPC selected; runtime must use anon key plus user/session JWT only"
      : "none",
    severity: persistenceMode === "localJsonl" ? "warn" : "info",
  });

  checks.push({
    name: "setup_supabase_audit_auth",
    ok: true,
    detail: persistenceMode === "supabaseAuditRpc"
      ? "anon/session pattern only; service-role env is checked separately"
      : "not selected",
    severity: "info",
  });

  const adaptive = config.adaptiveDirect;
  checks.push({
    name: "setup_adaptive_direct",
    ok: !adaptive?.enabled ||
      adaptive.fallbackPolicy === "safe_provider_unavailable_only",
    detail: adaptive?.enabled
      ? `enabled with fallbackPolicy=${adaptive.fallbackPolicy}`
      : "disabled",
    severity: !adaptive?.enabled ||
        adaptive.fallbackPolicy === "safe_provider_unavailable_only"
      ? "info"
      : "error",
  });

  const registryKeys = providers
    .map(setupProviderToDescriptor)
    .filter((descriptor): descriptor is ProviderDescriptor =>
      Boolean(descriptor)
    )
    .map(providerDescriptorKey);
  if (registryKeys.length > 0) {
    checks.push({
      name: "setup_provider_registry_keys",
      ok: true,
      detail: `${registryKeys.length} provider descriptor key(s) resolved`,
      severity: "info",
    });
  }
}

function pushRoutingEnvCheck(
  checks: DoctorCheck[],
  envMode: string | undefined,
) {
  if (envMode === undefined) {
    checks.push({
      name: "routing_mode_env",
      ok: true,
      detail: `${ROUTING_MODE_ENV} absent`,
      severity: "info",
    });
    return;
  }

  try {
    const parsed = parseRoutingMode(envMode, "env");
    checks.push({
      name: "routing_mode_env",
      ok: true,
      detail: parsed
        ? `${ROUTING_MODE_ENV} valid: ${parsed.mode}`
        : `${ROUTING_MODE_ENV} absent`,
      severity: "info",
    });
  } catch (error) {
    const code = error instanceof RouterError
      ? error.code
      : "invalid_routing_mode";
    checks.push({
      name: "routing_mode_env",
      ok: false,
      detail: `${ROUTING_MODE_ENV} invalid (${code}); raw value hidden`,
      severity: "error",
    });
  }
}

export async function runDoctorChecks(
  options: DoctorRunOptions = {},
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "deno_version",
    ok: Boolean(Deno.version.deno),
    detail: Deno.version.deno,
    severity: "error",
  });

  const directHttpEnabled =
    envFlagEnabled("QUORUM_ROUTER_ENABLE_DIRECT_HTTP") ||
    envFlagEnabled("QUORUM_ROUTER_DIRECT_HTTP_ONLY") ||
    envPresent("OPENAI_API_KEY") || envPresent("ANTHROPIC_API_KEY");
  checks.push({
    name: "direct_http_state",
    ok: true,
    detail: directHttpEnabled
      ? "configured or explicitly enabled"
      : "not configured",
  });

  const otlpEndpoint = Deno.env.get("OTEL_EXPORTER_OTLP_ENDPOINT");
  const maskedOtlpEndpoint = maskEndpoint(otlpEndpoint);
  checks.push({
    name: "otlp_endpoint_masking",
    ok: !otlpEndpoint || !maskedOtlpEndpoint.includes("@") ||
      maskedOtlpEndpoint.includes("[REDACTED]@"),
    detail: maskedOtlpEndpoint,
    severity: "error",
  });

  const supabaseUrlConfigured = envPresent("QUORUM_ROUTER_SUPABASE_URL") ||
    envPresent("SUPABASE_URL");
  const supabaseAnonKeyConfigured =
    envPresent("QUORUM_ROUTER_SUPABASE_ANON_KEY") ||
    envPresent("SUPABASE_ANON_KEY");
  const supabaseAuditConfigured = supabaseUrlConfigured &&
    supabaseAnonKeyConfigured;
  const supabaseAuditPartial = supabaseUrlConfigured ||
    supabaseAnonKeyConfigured;
  checks.push({
    name: "supabase_audit_config",
    ok: supabaseAuditConfigured || !supabaseAuditPartial,
    detail: supabaseAuditConfigured
      ? "configured"
      : supabaseAuditPartial
      ? "incomplete: Supabase URL and anon key are both required for audit RPC"
      : "not configured",
    severity: supabaseAuditPartial && !supabaseAuditConfigured
      ? "warn"
      : "info",
  });

  const forbiddenServiceRoleKeys = serviceRoleEnvKeys();
  checks.push({
    name: "supabase_service_role_absent",
    ok: forbiddenServiceRoleKeys.length === 0,
    detail: forbiddenServiceRoleKeys.length === 0
      ? "no service-role-like Supabase env vars present"
      : `forbidden env keys present: ${forbiddenServiceRoleKeys.join(", ")}`,
    severity: "error",
  });

  const path = await configPath();
  let configMode: string | undefined;
  let loadedConfig: QuorumRouterConfig | undefined;
  try {
    const config = await loadQuorumRouterConfig(path);
    loadedConfig = config;
    configMode = config.routingMode;
    checks.push({
      name: "routing_config_file",
      ok: true,
      detail: config.routingMode === undefined
        ? `absent or empty: ${path}`
        : `valid: routing.mode=${config.routingMode}`,
      severity: "info",
    });
  } catch (error) {
    checks.push({
      name: "routing_config_file",
      ok: false,
      detail: `invalid or unreadable: ${path} (${
        safeRoutingConfigError(error)
      }); raw contents hidden`,
      severity: "error",
    });
  }

  pushSetupConfigChecks(checks, loadedConfig);

  const envMode = readRouterEnv(ROUTING_MODE_ENV);
  pushRoutingEnvCheck(checks, envMode);

  if (configMode !== undefined && envMode !== undefined) {
    checks.push({
      name: "routing_config_env_precedence",
      ok: true,
      detail: "config routing.mode takes precedence over QUORUM_ROUTER_MODE",
      severity: "info",
    });
  } else {
    checks.push({
      name: "routing_config_env_precedence",
      ok: true,
      detail: "precedence: request > config > env > default",
      severity: "info",
    });
  }

  try {
    const resolution = resolveRoutingMode({ configMode, envMode });
    const decision = describeRoutingModeDecision(resolution);
    checks.push({
      name: "routing_effective_mode",
      ok: decision.implemented,
      detail:
        `${decision.mode} from ${decision.source}; implemented=${decision.implemented}`,
      severity: decision.implemented ? "info" : "warn",
    });
    checks.push({
      name: "routing_agent_chat_status",
      ok: true,
      detail:
        "agent_chat is explicit opt-in experimental runtime; direct remains the production-ready mode",
      severity: decision.mode === "agent_chat" ? "warn" : "info",
    });
    checks.push({
      name: "routing_direct_readiness",
      ok: true,
      detail: decision.mode === "direct"
        ? "direct mode ready"
        : "direct mode ready; current effective mode requires experimental AgentRuntime opt-in",
      severity: "info",
    });
    checks.push({
      name: "v0_1_readiness",
      ok: decision.mode === "direct" && decision.implemented,
      detail: decision.mode === "direct" && decision.implemented
        ? "safe direct router ready; experimental AgentRuntime available only with explicit opt-in"
        : "safe direct router ready, but current effective mode is not production-implemented",
      severity: decision.mode === "direct" && decision.implemented
        ? "info"
        : "warn",
    });
  } catch {
    checks.push({
      name: "routing_effective_mode",
      ok: false,
      detail: "effective routing mode is invalid; raw value hidden",
      severity: "error",
    });
  }

  if (options.checkCliCommands ?? true) {
    for (const command of ["codex", "claude", "gemini", "zcode", "cline"]) {
      const available = await commandAvailable(command);
      checks.push({
        name: `cli_${command}`,
        ok: available,
        detail: available ? "available" : "not found",
        severity: "warn",
      });
    }
  } else {
    checks.push({
      name: "cli_commands",
      ok: true,
      detail: "skipped by caller; no process execution requested",
      severity: "info",
    });
  }

  checks.push({
    name: "buffer_limits",
    ok: true,
    severity: "info",
    detail: JSON.stringify({
      maxQueue: boundedEnv(
        "QUORUM_ROUTER_TELEMETRY_MAX_QUEUE",
        1_000,
        TELEMETRY_MAX_QUEUE_SIZE,
      ),
      maxBatch: boundedEnv(
        "QUORUM_ROUTER_TELEMETRY_MAX_BATCH",
        30,
        TELEMETRY_MAX_BATCH_SIZE,
      ),
      drainMs: boundedEnv(
        "QUORUM_ROUTER_TELEMETRY_DRAIN_MS",
        200,
        TELEMETRY_MAX_DRAIN_MS,
      ),
      httpTimeoutMs: boundedEnv(
        "QUORUM_ROUTER_TELEMETRY_HTTP_TIMEOUT_MS",
        500,
        TELEMETRY_MAX_HTTP_TIMEOUT_MS,
      ),
    }),
  });

  const ok = checks
    .filter((check) => check.severity === "error")
    .every((check) => check.ok);
  return { ok, checks };
}
