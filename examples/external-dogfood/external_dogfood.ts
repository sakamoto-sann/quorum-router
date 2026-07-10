import {
  callExternalProviderOnce,
  type ExternalProviderConfig,
  type ExternalProviderResult,
  loadExternalProviderConfigs,
  publicConfig,
  redactionOk,
  selectedProviderIds,
} from "./external_provider.ts";

const DEFAULT_PROMPT =
  "QuorumRouter external dogfood: answer with one concise paragraph explaining one real development decision this router should help with.";
const OUT_DIR = "out/external-dogfood";

type Trace = {
  run_id: string;
  timestamp: string;
  mode: "best_route";
  provider_mode: "external";
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

function requireOptIn(): void {
  if (Deno.env.get("RUN_EXTERNAL_MODEL_DOGFOOD") !== "1") {
    throw new Error(
      "external dogfood blocked: set RUN_EXTERNAL_MODEL_DOGFOOD=1 to make real provider calls",
    );
  }
}

function boundaries(matrix: boolean): string[] {
  return [
    "deno task smoke is deterministic fixture-only",
    matrix
      ? "external:matrix is manual opt-in and makes one call per selected provider"
      : "external:once is manual opt-in and makes exactly one provider call",
    "external dogfood is not run in default CI",
    "provider credentials are read only from local env and are never written to trace",
    "Best Route/direct remains production-ready best-answer routing",
    "agent_chat remains experimental explicit opt-in only",
    "no production autonomous runtime",
    "no live Supabase Agent Bus runtime writes",
    "no service-role runtime",
  ];
}

async function writeTrace(trace: Trace, matrix: boolean): Promise<string> {
  await Deno.mkdir(OUT_DIR, { recursive: true });
  const path = `${OUT_DIR}/${
    matrix ? "external-matrix" : "external-once"
  }-trace.json`;
  await Deno.writeTextFile(path, `${JSON.stringify(trace, null, 2)}\n`);
  return path;
}

function buildTrace(
  configs: ExternalProviderConfig[],
  prompt: string,
  results: ExternalProviderResult[],
  matrix: boolean,
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
    mode: "best_route",
    provider_mode: "external",
    provider_count: configs.length,
    providers: configs.map(publicConfig),
    request_prompt: prompt,
    results: safeResults,
    schema_valid: safeResults.every((result) => result.schema_valid),
    redaction_ok: false,
    credential_used: configs.some((config) => config.credential !== undefined),
    credential_value_present: true,
    sensitive_value_present: true,
    runtime_boundaries: boundaries(matrix),
  };
  const ok = redactionOk(trace, configs);
  trace.redaction_ok = ok;
  trace.credential_value_present = !ok;
  trace.sensitive_value_present = !ok;
  return trace;
}

async function runCheckOnly(matrix: boolean): Promise<void> {
  const ids = selectedProviderIds(matrix);
  const configs = await loadExternalProviderConfigs(ids);
  console.log("QuorumRouter external dogfood");
  console.log("Mode: best_route");
  console.log("Provider mode: external");
  console.log(
    `Selected providers: ${configs.map((config) => config.id).join(", ")}`,
  );
  for (const config of configs) {
    console.log(
      `- ${config.providerLabel}: ${config.providerMode}; model=${config.model}; credential_present=${
        config.credential !== undefined
      }`,
    );
  }
  console.log("Check-only: true");
  console.log("Provider request sent: false");
}

async function runProviderDogfood(matrix: boolean): Promise<void> {
  requireOptIn();
  const prompt = promptFromArgs();
  const configs = await loadExternalProviderConfigs(
    selectedProviderIds(matrix),
  );
  const results: ExternalProviderResult[] = [];
  for (const config of configs) {
    results.push(await callExternalProviderOnce(config, prompt));
  }
  const trace = buildTrace(configs, prompt, results, matrix);
  const tracePath = await writeTrace(trace, matrix);

  console.log("QuorumRouter external dogfood");
  console.log("Mode: best_route");
  console.log("Provider mode: external");
  console.log(`Provider count: ${configs.length}`);
  console.log(
    `Providers: ${configs.map((config) => config.providerLabel).join(", ")}`,
  );
  console.log(`Models: ${configs.map((config) => config.model).join(", ")}`);
  console.log("");
  console.log("Request:");
  console.log(`  ${prompt}`);
  console.log("");
  console.log("Provider result:");
  console.log(
    `  response_received: ${
      results.every((result) => result.responseReceived)
    }`,
  );
  console.log(`  schema_valid: ${trace.schema_valid}`);
  console.log(`  redaction_ok: ${trace.redaction_ok}`);
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
  const matrix = hasArg("--matrix");
  if (hasArg("--check-only")) {
    await runCheckOnly(matrix);
  } else if (hasArg("--once") || matrix) {
    await runProviderDogfood(matrix);
  } else {
    throw new Error(
      "external dogfood blocked: pass --check-only, --once, or --matrix",
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}
