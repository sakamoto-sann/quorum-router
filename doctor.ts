export {};

type DoctorCheck = {
  name: string;
  ok: boolean;
  detail: string;
  severity?: "info" | "warn" | "error";
};

const MAX_QUEUE_SIZE = 10_000;
const MAX_BATCH_SIZE = 500;
const MAX_DRAIN_MS = 5_000;
const MAX_HTTP_TIMEOUT_MS = 30_000;

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
  const result = await new Deno.Command("/usr/bin/env", {
    args: ["sh", "-c", `command -v ${command} >/dev/null 2>&1`],
    stdout: "null",
    stderr: "null",
  }).output();
  return result.success;
}

function serviceRoleEnvKeys(): string[] {
  return Object.keys(Deno.env.toObject()).filter((key) =>
    /SUPABASE.*SERVICE.*ROLE/i.test(key)
  );
}

const checks: DoctorCheck[] = [];

checks.push({
  name: "deno_version",
  ok: Boolean(Deno.version.deno),
  detail: Deno.version.deno,
  severity: "error",
});

const directHttpEnabled = envFlagEnabled("FUSION_ROUTER_ENABLE_DIRECT_HTTP") ||
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

checks.push({
  name: "supabase_url",
  ok: envPresent("SUPABASE_URL") || envPresent("FUSION_ROUTER_SUPABASE_URL"),
  detail: envPresent("SUPABASE_URL") || envPresent("FUSION_ROUTER_SUPABASE_URL")
    ? "configured"
    : "not configured",
  severity: "warn",
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
      MAX_QUEUE_SIZE,
    ),
    maxBatch: boundedEnv(
      "FUSION_ROUTER_TELEMETRY_MAX_BATCH",
      30,
      MAX_BATCH_SIZE,
    ),
    drainMs: boundedEnv("FUSION_ROUTER_TELEMETRY_DRAIN_MS", 200, MAX_DRAIN_MS),
    httpTimeoutMs: boundedEnv(
      "FUSION_ROUTER_TELEMETRY_HTTP_TIMEOUT_MS",
      500,
      MAX_HTTP_TIMEOUT_MS,
    ),
  }),
});

const blockingOk = checks
  .filter((check) => check.severity === "error")
  .every((check) => check.ok);
console.log(JSON.stringify({ ok: blockingOk, checks }, null, 2));

if (!blockingOk) {
  Deno.exit(1);
}
