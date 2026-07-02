import {
  describeRoutingModeDecision,
  parseRoutingMode,
  resolveRoutingMode,
  ROUTING_MODE_ENV,
} from "../routing-mode.ts";
import { loadFusionRouterConfig } from "../config.ts";
import { RouterError } from "../errors.ts";
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

const DEFAULT_CONFIG_PATH = "fusion-router.config.json";
const CONFIG_PATH_ENV = "FUSION_ROUTER_CONFIG";

function envFlagEnabled(name: string): boolean {
  const value = Deno.env.get(name);
  return value === "1" || value === "true" || value === "yes";
}

function envPresent(name: string): boolean {
  return Boolean(Deno.env.get(name)?.trim());
}

function boundedEnv(name: string, fallback: number, max: number): number {
  const value = Number(Deno.env.get(name));
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

function serviceRoleEnvKeys(): string[] {
  return Object.keys(Deno.env.toObject()).filter((key) =>
    /SUPABASE.*SERVICE.*ROLE/i.test(key)
  );
}

function configPath(): string {
  return Deno.env.get(CONFIG_PATH_ENV)?.trim() || DEFAULT_CONFIG_PATH;
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

export async function runDoctorChecks(): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  checks.push({
    name: "deno_version",
    ok: Boolean(Deno.version.deno),
    detail: Deno.version.deno,
    severity: "error",
  });

  const directHttpEnabled =
    envFlagEnabled("FUSION_ROUTER_ENABLE_DIRECT_HTTP") ||
    envFlagEnabled("FUSION_ROUTER_DIRECT_HTTP_ONLY") ||
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

  const supabaseUrlConfigured = envPresent("FUSION_ROUTER_SUPABASE_URL") ||
    envPresent("SUPABASE_URL");
  const supabaseAnonKeyConfigured =
    envPresent("FUSION_ROUTER_SUPABASE_ANON_KEY") ||
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

  const path = configPath();
  let configMode: string | undefined;
  try {
    const config = await loadFusionRouterConfig(path);
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

  const envMode = Deno.env.get(ROUTING_MODE_ENV);
  pushRoutingEnvCheck(checks, envMode);

  if (configMode !== undefined && envMode !== undefined) {
    checks.push({
      name: "routing_config_env_precedence",
      ok: true,
      detail: "config routing.mode takes precedence over FUSION_ROUTER_MODE",
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
        "agent_chat is recognized but not implemented; direct remains the runtime-ready mode",
      severity: decision.mode === "agent_chat" ? "warn" : "info",
    });
    checks.push({
      name: "routing_direct_readiness",
      ok: true,
      detail: decision.mode === "direct"
        ? "direct mode ready"
        : "direct mode ready; current effective mode is not implemented",
      severity: "info",
    });
  } catch {
    checks.push({
      name: "routing_effective_mode",
      ok: false,
      detail: "effective routing mode is invalid; raw value hidden",
      severity: "error",
    });
  }

  for (const command of ["codex", "claude", "gemini", "zcode", "cline"]) {
    const available = await commandAvailable(command);
    checks.push({
      name: `cli_${command}`,
      ok: available,
      detail: available ? "available" : "not found",
      severity: "warn",
    });
  }

  checks.push({
    name: "buffer_limits",
    ok: true,
    severity: "info",
    detail: JSON.stringify({
      maxQueue: boundedEnv(
        "FUSION_ROUTER_TELEMETRY_MAX_QUEUE",
        1_000,
        TELEMETRY_MAX_QUEUE_SIZE,
      ),
      maxBatch: boundedEnv(
        "FUSION_ROUTER_TELEMETRY_MAX_BATCH",
        30,
        TELEMETRY_MAX_BATCH_SIZE,
      ),
      drainMs: boundedEnv(
        "FUSION_ROUTER_TELEMETRY_DRAIN_MS",
        200,
        TELEMETRY_MAX_DRAIN_MS,
      ),
      httpTimeoutMs: boundedEnv(
        "FUSION_ROUTER_TELEMETRY_HTTP_TIMEOUT_MS",
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
