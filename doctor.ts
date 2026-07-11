import { runDoctorChecks } from "./src/doctor/checks.ts";
import { discoverInventoryWithModelListing } from "./examples/local-model-dogfood/src/auth_discovery.ts";

const jsonMode = Deno.args.includes("--json");
if (Deno.args.some((arg) => arg !== "--json")) {
  console.error("usage: deno task doctor -- [--json]");
  Deno.exit(2);
}

const [report, inventory] = await Promise.all([
  runDoctorChecks(),
  discoverInventoryWithModelListing(),
]);

const providerRows = inventory.entries.map((entry) => ({
  provider: entry.provider,
  model: entry.model,
  wrapper: entry.command ?? "—",
  auth: entry.auth_mode,
  wrapper_state: entry.available ? "found" : "missing",
  model_list: entry.can_list_models
    ? `${entry.listed_models?.length ?? 0} listed`
    : "unavailable",
  invoke_readiness: entry.can_invoke ? "candidate" : "blocked",
  detail: entry.blocked_reason ?? entry.list_blocked_reason ?? "ready",
}));
const combined = {
  ...report,
  provider_inventory: {
    auth_mode: inventory.auth_mode,
    available_count: inventory.available_count,
    blocked_count: inventory.blocked_count,
    rows: providerRows,
  },
};

if (jsonMode) {
  console.log(JSON.stringify(combined, null, 2));
} else {
  console.log("QuorumRouter doctor\n");
  console.log(
    "| provider | model | wrapper | auth | wrapper state | model list | invoke readiness |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of providerRows) {
    console.log(
      `| ${row.provider} | ${row.model} | ${row.wrapper} | ${row.auth} | ${row.wrapper_state} | ${row.model_list} | ${row.invoke_readiness} |`,
    );
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
    "\nAuth note: wrapper presence is verified here; provider-owned OAuth/session files are not opened or printed. Live authentication is confirmed only by an explicit opt-in invocation.",
  );
}

if (!report.ok) {
  Deno.exit(1);
}
