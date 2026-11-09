import { runDoctorChecks } from "./src/doctor/checks.ts";
import { discoverInventoryWithModelListing } from "./packages/create-quorum-router/templates/basic/src/auth_session.ts";
import {
  type ModelCatalogSource,
  resolveModelCatalog,
} from "./examples/local-model-dogfood/src/model_catalog.ts";

const jsonMode = Deno.args.includes("--json");
if (Deno.args.some((arg) => arg !== "--json")) {
  console.error("usage: deno task doctor -- [--json]");
  Deno.exit(2);
}

const [report, inventory] = await Promise.all([
  runDoctorChecks(),
  discoverInventoryWithModelListing(),
]);
const hasHome = Boolean(Deno.env.get("HOME")?.trim());
let catalogPersistenceError = false;
let modelCatalog;
try {
  modelCatalog = await resolveModelCatalog({
    inventory,
    ...(hasHome ? {} : {
      explicitConfig: {
        schema_version: "quorum-router.model-config.v1" as const,
        providers: {},
      },
      verifiedRecords: [],
    }),
  });
} catch {
  catalogPersistenceError = true;
  modelCatalog = await resolveModelCatalog({
    inventory,
    explicitConfig: {
      schema_version: "quorum-router.model-config.v1" as const,
      providers: {},
    },
    verifiedRecords: [],
  });
  report.checks.push({
    name: "model_catalog_persistence",
    ok: false,
    detail: "invalid or unreadable model config/cache; values hidden",
    severity: "error",
  });
  report.ok = false;
}
if (!catalogPersistenceError) {
  report.checks.push({
    name: "model_catalog_persistence",
    ok: true,
    detail: hasHome
      ? "config/cache parsed or absent"
      : "HOME absent; persistence skipped",
    severity: "info",
  });
}
const providerRows = modelCatalog.providers.map((provider) => {
  const countStatus = (status: string) =>
    provider.models.filter((model) => model.status === status).length;
  const countSource = (source: ModelCatalogSource) =>
    provider.models.filter((model) => model.sources.includes(source)).length;
  const verified = countStatus("verified");
  return {
    provider: provider.provider,
    provider_key: provider.providerKey,
    wrapper: provider.wrapper,
    auth: provider.authMode,
    wrapper_state: provider.wrapperState,
    catalog_state: provider.catalogState,
    verified_models: verified,
    listed_models: countSource("provider_catalog"),
    configured_models: countSource("explicit_config"),
    stale_models: countStatus("stale"),
    hinted_models: countSource("versioned_hint"),
    invoke_readiness: !provider.canInvoke
      ? "blocked"
      : verified > 0
      ? "verified"
      : "candidate",
    action: !provider.canInvoke
      ? `install ${provider.wrapper}`
      : verified > 0
      ? "ready"
      : `quorum-router models probe ${provider.providerKey} <model>`,
    detail: provider.detail,
  };
});
const combined = {
  ...report,
  provider_inventory: {
    auth_mode: inventory.auth_mode,
    available_count: inventory.available_count,
    blocked_count: inventory.blocked_count,
    rows: providerRows,
  },
  model_catalog: modelCatalog,
};

if (jsonMode) {
  console.log(JSON.stringify(combined, null, 2));
} else {
  console.log("QuorumRouter doctor\n");
  console.log(
    "| provider key | command | auth | wrapper state | catalog state | verified | listed sources | config sources | stale | hint sources | readiness |",
  );
  console.log(
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |",
  );
  for (const row of providerRows) {
    console.log(
      `| ${row.provider_key} | ${row.wrapper} | ${row.auth} | ${row.wrapper_state} | ${row.catalog_state} | ${row.verified_models} | ${row.listed_models} | ${row.configured_models} | ${row.stale_models} | ${row.hinted_models} | ${row.invoke_readiness} |`,
    );
  }
  console.log("\nRecommended actions\n");
  for (const row of providerRows.filter((item) => item.action !== "ready")) {
    console.log(`- ${row.provider_key}: \`${row.action}\``);
  }
  console.log("\nCore checks\n");
  console.log("| status | check | detail |");
  console.log("| --- | --- | --- |");
  for (const check of report.checks) {
    console.log(
      `| ${check.ok ? "PASS" : "FAIL"} | ${check.name} | ${
        check.detail.replaceAll("|", "\\|")
      } |`,
    );
  }
  console.log(
    "\nAuth note: wrapper presence and catalog metadata are read-only checks. Provider-owned credentials are never opened or printed. Only `quorum-router models probe` performs a live call and writes a verified cache record.",
  );
}

if (!report.ok) {
  Deno.exit(1);
}
