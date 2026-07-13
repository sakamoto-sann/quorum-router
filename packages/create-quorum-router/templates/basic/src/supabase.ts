import { z } from "zod";
import {
  GeneratedRouterConfigSchema,
  type SupabaseAuditMode,
} from "./schema.ts";

const CONFIG_PATH = "router.config.json";
const AUDIT_RPC_PATH = "/rest/v1/rpc/insert_workflow_access_audit_batch";
const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;

const FORBIDDEN_SUPABASE_ENV_KEYS = new Set([
  "SUPABASE_SERVICE_ROLE_KEY",
  "QUORUM_ROUTER_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_KEY",
  "QUORUM_ROUTER_SUPABASE_SERVICE_KEY",
  "SUPABASE_ADMIN_KEY",
  "QUORUM_ROUTER_SUPABASE_ADMIN_KEY",
]);

export type SupabaseStatusKind =
  | "disabled"
  | "configured"
  | "partial"
  | "forbidden-credential";

export type SupabaseStatus = {
  kind: SupabaseStatusKind;
  mode: SupabaseAuditMode;
  ok: boolean;
  configuredFields: number;
  requiredFields: number;
  forbiddenEnvKeys: string[];
  detail: string;
};

export type SupabaseAuditRecord = {
  workflow_id: string;
  route?: string;
  decision: "allow" | "error";
  metadata: {
    command: string;
    mode: string;
    auth_mode: string;
    provider_selection_honored: boolean;
    fallback_used: boolean;
    schema_valid: boolean;
  };
};

export type RouteAuditSource = {
  run_id: string;
  command: string;
  mode: string;
  auth_mode: string;
  selected_provider?: string;
  selected_model?: string;
  provider_selection_honored: boolean;
  fallback_used: boolean;
  schema_valid: boolean;
};

export type AuditRequestOptions = {
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  configPath?: string;
  allowInsecureLocalhostForTest?: boolean;
};

type RuntimeCredentials = {
  url?: string;
  anonKey?: string;
  sessionJwt?: string;
};

function envValue(...names: string[]): string | undefined {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

function runtimeCredentials(): RuntimeCredentials {
  return {
    url: envValue("QUORUM_ROUTER_SUPABASE_URL", "SUPABASE_URL"),
    anonKey: envValue(
      "QUORUM_ROUTER_SUPABASE_ANON_KEY",
      "SUPABASE_ANON_KEY",
    ),
    sessionJwt: envValue(
      "QUORUM_ROUTER_SUPABASE_SESSION_JWT",
      "SUPABASE_SESSION_JWT",
    ),
  };
}

export function forbiddenSupabaseEnvKeys(): string[] {
  return Object.keys(Deno.env.toObject()).filter((key) =>
    FORBIDDEN_SUPABASE_ENV_KEYS.has(key.toUpperCase()) ||
    /SUPABASE.*(SERVICE.*ROLE|SERVICE.*KEY|ADMIN.*KEY|JWT.*SECRET)/i.test(key)
  ).sort();
}

function decodeJwtPayload(value: string): Record<string, unknown> | undefined {
  const payload = value.split(".")[1];
  if (!payload) return undefined;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(normalized));
    return parsed && typeof parsed === "object"
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function isPrivilegedCredential(value: string): boolean {
  if (/^sb_secret_/i.test(value) || /service[_-]?role/i.test(value)) {
    return true;
  }
  const role = decodeJwtPayload(value)?.role;
  return typeof role === "string" &&
    /^(service_role|supabase_admin)$/i.test(role);
}

function assertRuntimeCredentialBoundary(credentials: RuntimeCredentials) {
  const forbiddenKeys = forbiddenSupabaseEnvKeys();
  if (forbiddenKeys.length > 0) {
    throw new Error(
      `Supabase audit forbidden-credential: runtime env keys present: ${
        forbiddenKeys.join(", ")
      }; values hidden`,
    );
  }
  if (
    (credentials.anonKey && isPrivilegedCredential(credentials.anonKey)) ||
    (credentials.sessionJwt && isPrivilegedCredential(credentials.sessionJwt))
  ) {
    throw new Error(
      "Supabase audit forbidden-credential: service-role/admin credential detected; value hidden",
    );
  }
}

export async function loadSupabaseAuditMode(
  path = CONFIG_PATH,
): Promise<SupabaseAuditMode> {
  let text: string;
  try {
    text = await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return "disabled";
    throw new Error(`Supabase feature config unreadable: ${path}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(`Supabase feature config invalid JSON: ${path}`);
  }
  const parsed = GeneratedRouterConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Supabase feature config invalid: ${
        parsed.error.issues.map((issue) => issue.path.join(".") || "config")
          .join(", ")
      }`,
    );
  }
  return parsed.data.features?.supabase?.audit.mode ?? "disabled";
}

export async function getSupabaseStatus(
  configPath = CONFIG_PATH,
): Promise<SupabaseStatus> {
  const mode = await loadSupabaseAuditMode(configPath);
  const credentials = runtimeCredentials();
  const forbiddenEnvKeys = forbiddenSupabaseEnvKeys();
  if (
    forbiddenEnvKeys.length > 0 ||
    (credentials.anonKey && isPrivilegedCredential(credentials.anonKey)) ||
    (credentials.sessionJwt && isPrivilegedCredential(credentials.sessionJwt))
  ) {
    return {
      kind: "forbidden-credential",
      mode,
      ok: false,
      configuredFields: Object.values(credentials).filter(Boolean).length,
      requiredFields: 3,
      forbiddenEnvKeys,
      detail: "service-role/admin runtime credential rejected; values hidden",
    };
  }

  const configuredFields = Object.values(credentials).filter(Boolean).length;
  if (configuredFields > 0 && configuredFields < 3) {
    return {
      kind: "partial",
      mode,
      ok: false,
      configuredFields,
      requiredFields: 3,
      forbiddenEnvKeys: [],
      detail:
        "URL, publishable/anon key, and user session JWT must be set together; values hidden",
    };
  }
  if (mode === "disabled") {
    return {
      kind: "disabled",
      mode,
      ok: true,
      configuredFields,
      requiredFields: 3,
      forbiddenEnvKeys: [],
      detail: configuredFields === 3
        ? "credentials present but audit is disabled; values hidden"
        : "Supabase audit is disabled and no credentials are required",
    };
  }
  if (configuredFields === 3) {
    return {
      kind: "configured",
      mode,
      ok: true,
      configuredFields,
      requiredFields: 3,
      forbiddenEnvKeys: [],
      detail:
        "runtime URL, publishable/anon key, and user session JWT are configured; values hidden",
    };
  }
  return {
    kind: "partial",
    mode,
    ok: false,
    configuredFields,
    requiredFields: 3,
    forbiddenEnvKeys: [],
    detail:
      "audit mode requires URL, publishable/anon key, and user session JWT; values hidden",
  };
}

export async function runSupabaseStatus(): Promise<void> {
  const status = await getSupabaseStatus();
  console.log("QuorumRouter Supabase audit status");
  console.log(`state: ${status.kind}`);
  console.log(`audit_mode: ${status.mode}`);
  console.log(
    `runtime_credentials: ${status.configuredFields}/${status.requiredFields} configured; values hidden`,
  );
  if (status.forbiddenEnvKeys.length > 0) {
    console.log(`forbidden_env_keys: ${status.forbiddenEnvKeys.join(", ")}`);
  }
  console.log(`detail: ${status.detail}`);
  console.log("network_request_sent: false");
  if (!status.ok) Deno.exitCode = 1;
}

export function toSupabaseAuditRecord(
  source: RouteAuditSource,
): SupabaseAuditRecord {
  const route = source.selected_provider && source.selected_model
    ? `${source.selected_provider}/${source.selected_model}`
    : source.selected_provider;
  return {
    workflow_id: source.run_id,
    route,
    decision: source.schema_valid ? "allow" : "error",
    metadata: {
      command: source.command,
      mode: source.mode,
      auth_mode: source.auth_mode,
      provider_selection_honored: source.provider_selection_honored,
      fallback_used: source.fallback_used,
      schema_valid: source.schema_valid,
    },
  };
}

function auditEndpoint(
  rawUrl: string,
  allowInsecureLocalhostForTest = false,
): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Supabase audit invalid project URL; value hidden");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "[::1]" ||
    url.hostname === "localhost";
  const allowedProtocol = url.protocol === "https:" ||
    (allowInsecureLocalhostForTest && loopback && url.protocol === "http:");
  if (!allowedProtocol || url.username || url.password) {
    throw new Error(
      "Supabase audit invalid project URL; HTTPS required; value hidden",
    );
  }
  return new URL(AUDIT_RPC_PATH, url).toString();
}

function boundedTimeout(value: number | undefined): number {
  if (!Number.isFinite(value) || (value ?? 0) <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.floor(value!), MAX_TIMEOUT_MS);
}

function httpFailure(status: number): Error {
  if (status === 401 || status === 403) {
    return new Error(`Supabase audit auth failure (HTTP ${status})`);
  }
  if (status === 429) {
    return new Error("Supabase audit rate limited (HTTP 429)");
  }
  if (status >= 500) {
    return new Error(`Supabase audit server failure (HTTP ${status})`);
  }
  return new Error(`Supabase audit RPC rejected request (HTTP ${status})`);
}

export async function sendSupabaseAuditRecord(
  record: SupabaseAuditRecord,
  credentials: Required<RuntimeCredentials>,
  options: AuditRequestOptions = {},
): Promise<void> {
  assertRuntimeCredentialBoundary(credentials);
  const endpoint = auditEndpoint(
    credentials.url,
    options.allowInsecureLocalhostForTest,
  );
  if (options.signal?.aborted) {
    throw new Error("Supabase audit request aborted");
  }
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, boundedTimeout(options.timeoutMs));

  try {
    const response = await (options.fetchFn ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "prefer": "return=minimal",
        "authorization": `Bearer ${credentials.sessionJwt}`,
        "apikey": credentials.anonKey,
      },
      body: JSON.stringify({ records: [record] }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw httpFailure(response.status);
  } catch (error) {
    if (timedOut) throw new Error("Supabase audit request timed out");
    if (controller.signal.aborted) {
      throw new Error("Supabase audit request aborted");
    }
    if (error instanceof Error && error.message.startsWith("Supabase audit")) {
      throw error;
    }
    throw new Error("Supabase audit network failure");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function preflightRequiredSupabaseAudit(
  options: AuditRequestOptions = {},
): Promise<void> {
  const mode = await loadSupabaseAuditMode(options.configPath);
  if (mode !== "required") return;
  const credentials = runtimeCredentials();
  assertRuntimeCredentialBoundary(credentials);
  const missing = Object.entries(credentials).filter(([, value]) => !value).map(
    ([key]) => key,
  );
  if (missing.length > 0) {
    throw new Error(
      `Required Supabase audit incomplete runtime configuration: missing ${
        missing.join(", ")
      }; provider invocation blocked`,
    );
  }
  auditEndpoint(
    credentials.url!,
    options.allowInsecureLocalhostForTest,
  );
  const claims = decodeJwtPayload(credentials.sessionJwt!);
  if (
    claims?.role !== "authenticated" ||
    typeof claims.sub !== "string" || claims.sub.length === 0
  ) {
    throw new Error(
      "Required Supabase audit needs an authenticated user session JWT; provider invocation blocked",
    );
  }
}

export async function auditRouteOutcome(
  source: RouteAuditSource,
  options: AuditRequestOptions = {},
): Promise<void> {
  const credentials = runtimeCredentials();
  assertRuntimeCredentialBoundary(credentials);
  const mode = await loadSupabaseAuditMode(options.configPath);
  if (mode === "disabled") return;

  const missing = Object.entries(credentials).filter(([, value]) => !value)
    .map(([key]) => key);
  try {
    if (missing.length > 0) {
      throw new Error(
        `Supabase audit incomplete runtime configuration: missing ${
          missing.join(", ")
        }; values hidden`,
      );
    }
    await sendSupabaseAuditRecord(
      toSupabaseAuditRecord(source),
      credentials as Required<RuntimeCredentials>,
      options,
    );
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Supabase audit failed";
    if (mode === "optional") {
      console.warn(`WARNING: optional ${message}; route result preserved`);
      return;
    }
    throw new Error(`Required ${message}; route result withheld`);
  }
}

export const SupabaseAuditPayloadSchema = z.object({
  records: z.array(
    z.object({
      workflow_id: z.string().min(1),
      route: z.string().optional(),
      decision: z.enum(["allow", "error"]),
      metadata: z.object({
        command: z.string(),
        mode: z.string(),
        auth_mode: z.string(),
        provider_selection_honored: z.boolean(),
        fallback_used: z.boolean(),
        schema_valid: z.boolean(),
      }).strict(),
    }).strict(),
  ).length(1),
}).strict();
