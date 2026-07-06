import {
  callExternalProviderOnce,
  type ExternalProviderConfig,
  type ExternalProviderResult,
  loadExternalProviderConfig,
  loadExternalProviderConfigs,
  type ProviderId,
  publicConfig,
  redactionOk,
  selectedProviderIds,
} from "./external_provider.ts";

const DEFAULT_PROMPT =
  "Fusion Router external dogfood: answer with one concise paragraph explaining one real development decision this router should help with.";
const OUT_DIR = "out/external-dogfood";
const SESSION_PATH = ".fusion-router/session.json";
const LOCAL_CONFIG_PATH = "router.config.local.json";
const PROVIDER_CONFIG_PATH = "provider_config.json";

type CommandName =
  | "auth:status"
  | "auth:login"
  | "route:once"
  | "best-route"
  | "agent-chat"
  | "external:check";

type AuthMode = "auto" | "oauth" | "session" | "wrapper" | "env";

type Trace = {
  run_id: string;
  timestamp: string;
  command: "route_once" | "best_route" | "agent_chat";
  auth_mode: AuthMode;
  provider_mode: "oauth_session_first" | "env_fallback";
  provider_count: number;
  providers: ReturnType<typeof publicConfig>[];
  request_prompt: string;
  results: Array<{
    provider_id: string;
    provider_label: string;
    provider_mode: string;
    model: string;
    response_received: boolean;
    schema_valid: boolean;
    response_summary: string;
  }>;
  schema_valid: boolean;
  redaction_ok: boolean;
  credential_used: boolean;
  credential_value_present: boolean;
  sensitive_value_present: boolean;
  runtime_boundaries: string[];
};

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function hasArg(name: string): boolean {
  return Deno.args.includes(name);
}

function promptFromArgs(): string {
  const promptIndex = Deno.args.indexOf("--prompt");
  if (promptIndex >= 0) {
    const value = Deno.args[promptIndex + 1]?.trim();
    if (value) return value;
  }
  const passthroughIndex = Deno.args.indexOf("--");
  if (passthroughIndex >= 0) {
    const value = Deno.args.slice(passthroughIndex + 1).join(" ").trim();
    if (value) return value;
  }
  return DEFAULT_PROMPT;
}

function parseCommand(): CommandName {
  const first = Deno.args[0];
  if (
    first === "auth:status" || first === "auth:login" ||
    first === "route:once" || first === "best-route" ||
    first === "agent-chat" || first === "external:check"
  ) {
    return first;
  }
  if (hasArg("--check-only")) return "external:check";
  if (hasArg("--matrix")) return "best-route";
  if (hasArg("--once")) return "route:once";
  throw new Error(
    "external dogfood blocked: use auth:status, auth:login, route:once, best-route, or agent-chat",
  );
}

function authMode(): AuthMode {
  const raw = (env("FUSION_ROUTER_AUTH_MODE") ?? "auto").toLowerCase();
  if (["auto", "oauth", "session", "wrapper", "env"].includes(raw)) {
    return raw as AuthMode;
  }
  throw new Error(
    "external dogfood blocked: FUSION_ROUTER_AUTH_MODE must be auto, oauth, session, wrapper, or env",
  );
}

function requireExternalOptIn(): void {
  if (Deno.env.get("RUN_EXTERNAL_MODEL_DOGFOOD") !== "1") {
    throw new Error(
      "external dogfood blocked: set RUN_EXTERNAL_MODEL_DOGFOOD=1 to make real provider calls",
    );
  }
}

function requireAgentChatOptIn(): void {
  if (Deno.env.get("RUN_EXPERIMENTAL_AGENT_CHAT") !== "1") {
    throw new Error(
      "agent-chat blocked: set RUN_EXPERIMENTAL_AGENT_CHAT=1; agent_chat is experimental explicit opt-in only",
    );
  }
}

function exists(path: string): boolean {
  try {
    return Deno.statSync(path).isFile;
  } catch {
    return false;
  }
}

function splitProviderList(
  raw: string | undefined,
  fallback: ProviderId[],
): ProviderId[] {
  if (!raw?.trim()) return fallback;
  const values = raw.split(",").map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const ids: ProviderId[] = [];
  for (const value of values) {
    if (!["grok", "devin", "openai", "localqwen", "glm"].includes(value)) {
      throw new Error(`external dogfood blocked: unknown provider '${value}'`);
    }
    ids.push(value as ProviderId);
  }
  return [...new Set(ids)];
}

function routeProviderIds(mode: AuthMode): ProviderId[] {
  if (mode === "env") return selectedProviderIds(false);
  return splitProviderList(env("FUSION_ROUTER_EXTERNAL_PROVIDER"), ["grok"])
    .slice(
      0,
      1,
    );
}

function bestRouteProviderIds(mode: AuthMode): ProviderId[] {
  if (mode === "env") return selectedProviderIds(true);
  return splitProviderList(env("FUSION_ROUTER_EXTERNAL_PROVIDERS"), [
    "grok",
    "devin",
    "localqwen",
  ]);
}

async function loadOauthSessionFirstConfigs(
  ids: ProviderId[],
): Promise<{ configs: ExternalProviderConfig[]; blockers: string[] }> {
  const configs: ExternalProviderConfig[] = [];
  const blockers: string[] = [];
  for (const id of ids) {
    try {
      const config = await loadExternalProviderConfig(id);
      if (config.providerMode !== "cli") {
        blockers.push(
          `${id}: configured as HTTP/env fallback; set FUSION_ROUTER_AUTH_MODE=env for private manual API-key fallback`,
        );
        continue;
      }
      configs.push(config);
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { configs, blockers };
}

async function loadConfigsFor(
  mode: AuthMode,
  ids: ProviderId[],
): Promise<ExternalProviderConfig[]> {
  if (mode === "env") return await loadExternalProviderConfigs(ids);
  if (
    mode !== "wrapper" && !exists(SESSION_PATH) && !exists(LOCAL_CONFIG_PATH)
  ) {
    throw new Error([
      "OAuth/session-first provider unavailable in this generated scaffold.",
      "No .fusion-router/session.json or router.config.local.json marker is present, and env fallback is disabled by default.",
      "Next step: run `deno task auth:login` or use repo-local `examples/local-model-dogfood`.",
      "Local wrapper sessions are explicit: set FUSION_ROUTER_AUTH_MODE=wrapper after your CLI is authenticated.",
      "Private/manual fallback: set FUSION_ROUTER_AUTH_MODE=env plus local provider env in your shell.",
    ].join("\n"));
  }
  const { configs, blockers } = await loadOauthSessionFirstConfigs(ids);
  if (configs.length > 0) return configs;
  throw new Error([
    "OAuth/session-first provider unavailable in this generated scaffold.",
    "No local wrapper/session provider was invokable, and env fallback is disabled by default.",
    "Next step: run `deno task auth:login` or use repo-local `examples/local-model-dogfood`.",
    "Private/manual fallback: set FUSION_ROUTER_AUTH_MODE=env plus local provider env in your shell.",
    ...blockers.map((blocker) => `- ${blocker}`),
  ].join("\n"));
}

function boundaries(command: Trace["command"], mode: AuthMode): string[] {
  return [
    "deno task smoke is deterministic fixture-only and does not call external provider APIs",
    mode === "env"
      ? "env/API-key fallback is explicit private/manual mode only"
      : "OAuth/session/local-wrapper provider mode is preferred",
    command === "agent_chat"
      ? "agent_chat is experimental explicit opt-in only"
      : "Best Route/direct remains production-ready best-answer routing",
    "external dogfood requires RUN_EXTERNAL_MODEL_DOGFOOD=1 and is not run in default CI",
    "provider credentials are never written to trace",
    "no production autonomous runtime",
    "no live Supabase Agent Bus runtime writes",
    "no service-role runtime",
  ];
}

async function writeTrace(trace: Trace): Promise<string> {
  await Deno.mkdir(OUT_DIR, { recursive: true });
  const path = `${OUT_DIR}/${trace.command}-trace.json`;
  await Deno.writeTextFile(path, `${JSON.stringify(trace, null, 2)}\n`);
  return path;
}

function buildTrace(
  command: Trace["command"],
  mode: AuthMode,
  configs: ExternalProviderConfig[],
  prompt: string,
  results: ExternalProviderResult[],
): Trace {
  const safeResults = results.map((result) => ({
    provider_id: result.providerId,
    provider_label: result.providerLabel,
    provider_mode: result.providerMode,
    model: result.model,
    response_received: result.responseReceived,
    schema_valid: result.schemaValid,
    response_summary: result.responseSummary,
  }));
  const trace: Trace = {
    run_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    command,
    auth_mode: mode,
    provider_mode: mode === "env" ? "env_fallback" : "oauth_session_first",
    provider_count: configs.length,
    providers: configs.map(publicConfig),
    request_prompt: prompt,
    results: safeResults,
    schema_valid: safeResults.every((result) => result.schema_valid),
    redaction_ok: false,
    credential_used: configs.some((config) => config.credential !== undefined),
    credential_value_present: true,
    sensitive_value_present: true,
    runtime_boundaries: boundaries(command, mode),
  };
  const ok = redactionOk(trace, configs);
  trace.redaction_ok = ok;
  trace.credential_value_present = !ok;
  trace.sensitive_value_present = !ok;
  return trace;
}

function sanitizeDiagnostic(value: string): string {
  return value
    .replace(/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]")
    .replace(/(access[_-]?token\s*[:=]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(refresh[_-]?token\s*[:=]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(password\s*[:=]\s*)\S+/gi, "$1[REDACTED]")
    .replace(/(session[_-]?id\s*[:=]\s*)\S+/gi, "$1[REDACTED]");
}

function runAuthStatus(): void {
  const mode = authMode();
  const hasSession = exists(SESSION_PATH);
  const hasLocalConfig = exists(LOCAL_CONFIG_PATH);
  const hasProviderConfig = exists(PROVIDER_CONFIG_PATH);
  console.log("Fusion Router generated scaffold auth status");
  console.log(`Auth mode: ${mode}`);
  console.log("Preferred path: OAuth/session/local-wrapper first");
  console.log(`Session file present: ${hasSession}`);
  console.log(`Local config present: ${hasLocalConfig}`);
  console.log(`Provider config present: ${hasProviderConfig}`);
  console.log(`Env fallback selected: ${mode === "env"}`);
  console.log("Credential values printed: false");
  console.log("Provider request sent: false");
  if (!hasSession && !hasLocalConfig && mode !== "env") {
    console.log("Status: missing OAuth/session scaffold configuration");
    console.log("Next step: deno task auth:login");
  } else if (mode === "env") {
    console.log("Status: explicit private env fallback selected");
  } else {
    console.log("Status: local OAuth/session config marker present");
  }
}

function runAuthLogin(): never {
  console.error(
    "OAuth/session login is not configured in this generated scaffold yet.",
  );
  console.error(
    "Use the repo-local dogfood workspace for local OAuth/wrapper sessions, or use explicit private env fallback only when you choose it.",
  );
  console.error(
    "Do not paste API keys into chat or logs; do not commit .env, router.config.local.json, or .fusion-router/.",
  );
  console.error(
    'Private fallback example: FUSION_ROUTER_AUTH_MODE=env RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "hello"',
  );
  Deno.exit(1);
}

async function runExternalCheck(): Promise<void> {
  const mode = authMode();
  console.log("Fusion Router generated scaffold external check");
  console.log(`Auth mode: ${mode}`);
  console.log("Provider request sent: false");
  console.log("Credential values printed: false");
  if (mode === "env") {
    const configs = await loadExternalProviderConfigs(
      selectedProviderIds(hasArg("--matrix")),
    );
    for (const config of configs) {
      console.log(
        `- ${config.providerLabel}: ${config.providerMode}; model=${config.model}; credential_present=${
          config.credential !== undefined
        }`,
      );
    }
    return;
  }
  if (
    mode !== "wrapper" && !exists(SESSION_PATH) && !exists(LOCAL_CONFIG_PATH)
  ) {
    console.log("Status: no OAuth/session scaffold configuration marker found");
    console.log("Next step: deno task auth:login");
    console.log(
      "Local wrapper check: set FUSION_ROUTER_AUTH_MODE=wrapper to probe authenticated local CLIs",
    );
    return;
  }
  const ids = hasArg("--matrix")
    ? bestRouteProviderIds(mode)
    : routeProviderIds(mode);
  const { configs, blockers } = await loadOauthSessionFirstConfigs(ids);
  for (const config of configs) {
    console.log(
      `- ${config.providerLabel}: ${config.providerMode}; model=${config.model}; credential_present=false`,
    );
  }
  if (configs.length === 0) {
    console.log(
      "Status: no invokable OAuth/session/local-wrapper provider found",
    );
    console.log("Next step: deno task auth:login");
    for (const blocker of blockers) console.log(`- ${blocker}`);
  } else {
    console.log("Status: OAuth/session/local-wrapper provider available");
  }
}

async function runRoute(
  command: "route_once" | "best_route" | "agent_chat",
): Promise<void> {
  if (command === "agent_chat") {
    requireAgentChatOptIn();
    console.log("Status: experimental explicit opt-in");
  }
  requireExternalOptIn();
  const mode = authMode();
  const prompt = promptFromArgs();
  const ids = command === "route_once"
    ? routeProviderIds(mode)
    : bestRouteProviderIds(mode);
  const configs = await loadConfigsFor(mode, ids);
  const results: ExternalProviderResult[] = [];
  for (const config of configs) {
    results.push(await callExternalProviderOnce(config, prompt));
  }
  const trace = buildTrace(command, mode, configs, prompt, results);
  const tracePath = await writeTrace(trace);

  console.log("Fusion Router external dogfood");
  console.log(`Command: ${command}`);
  console.log(`Auth mode: ${mode}`);
  console.log(`Provider mode: ${trace.provider_mode}`);
  console.log(`Provider count: ${configs.length}`);
  console.log(
    `Providers: ${configs.map((config) => config.providerLabel).join(", ")}`,
  );
  console.log(`Models: ${configs.map((config) => config.model).join(", ")}`);
  console.log("");
  console.log("Provider result:");
  console.log(
    `  response_received: ${
      results.every((result) => result.responseReceived)
    }`,
  );
  console.log(`  schema_valid: ${trace.schema_valid}`);
  console.log(`  redaction_ok: ${trace.redaction_ok}`);
  console.log(`  credential_value_present: ${trace.credential_value_present}`);
  console.log(`  sensitive_value_present: ${trace.sensitive_value_present}`);
  console.log("");
  console.log("Final:");
  for (const result of results) {
    console.log(`  [${result.providerLabel}] ${result.responseSummary}`);
  }
  console.log("");
  console.log("Trace:");
  console.log(`  ${tracePath}`);
}

try {
  const command = parseCommand();
  if (command === "auth:status") {
    runAuthStatus();
  } else if (command === "auth:login") {
    runAuthLogin();
  } else if (command === "external:check") {
    await runExternalCheck();
  } else if (command === "route:once") {
    await runRoute("route_once");
  } else if (command === "best-route") {
    await runRoute("best_route");
  } else if (command === "agent-chat") {
    await runRoute("agent_chat");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(sanitizeDiagnostic(message));
  Deno.exit(1);
}
