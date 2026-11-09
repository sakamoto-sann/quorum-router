import { discoverInventoryWithModelListing } from "./packages/create-quorum-router/templates/basic/src/auth_session.ts";
import {
  addExplicitModel,
  defaultModelConfigPath,
  defaultVerifiedModelCachePath,
  fingerprintCommandPath,
  loadExplicitModelConfig,
  loadVerifiedModelCache,
  MODEL_PROVIDER_KEYS,
  type ModelCatalogReport,
  type ModelProviderKey,
  providerKeyForEntry,
  recordVerifiedModel,
  resolveCommandPath,
  resolveModelCatalog,
} from "./examples/local-model-dogfood/src/model_catalog.ts";
import type { ModelInventoryEntry } from "./examples/local-model-dogfood/src/schema.ts";
import { callWrapper } from "./examples/local-model-dogfood/src/wrapper_client.ts";

const args = [...Deno.args];
if (args[0] === "--") args.shift();
const command = args.shift() ?? "list";
const jsonIndex = args.indexOf("--json");
const jsonMode = jsonIndex >= 0;
if (jsonMode) args.splice(jsonIndex, 1);

function usage(): never {
  console.error(`Usage:
  deno task models -- list [--json]
  deno task models -- add <provider> <model> [--json]
  deno task models -- probe <provider> [model] [--json]

Providers: ${MODEL_PROVIDER_KEYS.join(", ")}`);
  Deno.exit(2);
}

function fail(
  code: string,
  detail: string,
  context: Record<string, unknown> = {},
): never {
  if (jsonMode) {
    console.log(
      JSON.stringify(
        { ok: false, operation: `model_${command}`, code, ...context, detail },
        null,
        2,
      ),
    );
  } else {
    console.error(detail);
  }
  Deno.exit(1);
}

function printCatalog(report: ModelCatalogReport): void {
  console.log("QuorumRouter model catalog\n");
  console.log(
    "| provider | wrapper | auth | catalog | verified | listed | configured | stale | hints |",
  );
  console.log("| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
  for (const provider of report.providers) {
    const count = (status: string) =>
      provider.models.filter((model) => model.status === status).length;
    console.log(
      `| ${provider.providerKey} | ${provider.wrapper} (${provider.wrapperState}) | ${provider.authMode} | ${provider.catalogState} | ${
        count("verified")
      } | ${count("listed")} | ${count("configured")} | ${count("stale")} | ${
        count("hinted")
      } |`,
    );
  }
  console.log("\nModels\n");
  console.log("| provider | model | status | sources | last verified |");
  console.log("| --- | --- | --- | --- | --- |");
  for (const provider of report.providers) {
    for (const model of provider.models) {
      console.log(
        `| ${provider.providerKey} | ${model.model} | ${model.status} | ${
          model.sources.join(", ")
        } | ${model.verifiedAt ?? "—"} |`,
      );
    }
  }
}

async function catalog() {
  const inventory = await discoverInventoryWithModelListing();
  const report = await resolveModelCatalog({ inventory });
  return { inventory, report };
}

if (command === "list") {
  if (args.length > 0) usage();
  const { report } = await catalog();
  if (jsonMode) console.log(JSON.stringify(report, null, 2));
  else printCatalog(report);
} else if (command === "add") {
  if (args.length !== 2) usage();
  const [provider, model] = args;
  const config = await addExplicitModel(
    defaultModelConfigPath(),
    provider,
    model,
  );
  const result = {
    ok: true,
    operation: "model_add",
    provider,
    model,
    configured_models: config.providers[provider as ModelProviderKey] ?? [],
  };
  if (jsonMode) console.log(JSON.stringify(result, null, 2));
  else console.log(`Configured ${provider}/${model}`);
} else if (command === "probe") {
  if (args.length < 1 || args.length > 2) usage();
  const providerKey = args[0] as ModelProviderKey;
  if (!MODEL_PROVIDER_KEYS.includes(providerKey)) usage();
  const requestedModel = args[1];
  const { inventory, report } = await catalog();
  const entry = inventory.entries.find((item) =>
    providerKeyForEntry(item) === providerKey
  );
  if (!entry?.available || !entry.can_invoke || !entry.command) {
    fail(
      "wrapper_unavailable",
      `probe blocked: wrapper unavailable for ${providerKey}`,
      { provider: providerKey },
    );
  }
  let models: string[];
  if (requestedModel) {
    models = [requestedModel];
  } else {
    const provider = report.providers.find((item) =>
      item.providerKey === providerKey
    )!;
    models = provider.models.filter((model) =>
      model.sources.some((source) =>
        source === "explicit_config" || source === "provider_catalog" ||
        source === "verified_cache"
      )
    ).map((model) => model.model);
    if (models.length === 0) {
      fail(
        "no_probe_candidates",
        `probe blocked: no configured/listed/previously verified models for ${providerKey}; specify a model explicitly`,
        { provider: providerKey },
      );
    }
  }
  const cachePath = defaultVerifiedModelCachePath();
  const results: Array<Record<string, unknown>> = [];
  for (const model of [...new Set(models)].sort()) {
    const candidate: ModelInventoryEntry = {
      ...entry,
      model,
      model_id: `${providerKey}/${model}`,
      invocation_model: model,
    };
    try {
      const response = await callWrapper(
        candidate,
        "Reply with exactly QUORUM_MODEL_PROBE_OK and no other text.",
      );
      const exact = response.raw_content.trim() === "QUORUM_MODEL_PROBE_OK";
      if (!exact) {
        throw new Error("probe response did not match expected sentinel");
      }
      const verifiedAt = new Date().toISOString();
      const authMode = entry.auth_mode;
      if (
        authMode !== "oauth" && authMode !== "session" && authMode !== "env"
      ) {
        throw new Error(`probe blocked: unsupported auth mode ${authMode}`);
      }
      const wrapperPath = await resolveCommandPath(entry.command);
      if (!wrapperPath) {
        throw new Error("probe blocked: wrapper path unavailable");
      }
      await recordVerifiedModel(cachePath, {
        providerKey,
        provider: entry.provider,
        wrapper: entry.command,
        wrapperPath,
        wrapperFingerprint: await fingerprintCommandPath(wrapperPath),
        model,
        authMode,
        verifiedAt,
      });
      results.push({
        provider: providerKey,
        model,
        status: "verified",
        verifiedAt,
      });
    } catch (error) {
      results.push({
        provider: providerKey,
        model,
        status: "probe_failed",
        detail: error instanceof Error ? error.message : "probe failed",
      });
    }
  }
  const result = {
    ok: results.every((item) => item.status === "verified"),
    operation: "model_probe",
    results,
    cache_record_count: (await loadVerifiedModelCache(cachePath)).length,
    configured_provider_count: Object.keys(
      (await loadExplicitModelConfig(defaultModelConfigPath())).providers,
    ).length,
  };
  if (jsonMode) console.log(JSON.stringify(result, null, 2));
  else {
    console.log("| provider | model | result | detail |");
    console.log("| --- | --- | --- | --- |");
    for (const item of results) {
      console.log(
        `| ${item.provider} | ${item.model} | ${item.status} | ${
          item.detail ?? "—"
        } |`,
      );
    }
  }
  if (!result.ok) Deno.exit(1);
} else {
  usage();
}
