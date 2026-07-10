import {
  discoverInventory,
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_discovery.ts";
import { runAgentChat } from "./agent_chat_runner.ts";
import { invokeSelected, runBestRoute } from "./best_route_runner.ts";
import { inventoryCommand, writeInventory } from "./model_inventory.ts";
import { parseAuthMode } from "./schema.ts";
import { buildTrace, writeTrace } from "./trace.ts";
import { summarize } from "./redact.ts";
import { readRouterEnv } from "./env.ts";

function argValue(name: string, fallback: string): string {
  const index = Deno.args.indexOf(name);
  if (index >= 0) return Deno.args[index + 1] ?? fallback;
  const passthrough = Deno.args.indexOf("--");
  if (passthrough >= 0) {
    return Deno.args.slice(passthrough + 1).join(" ") || fallback;
  }
  return fallback;
}

function printInventorySummary(
  inventory: ReturnType<typeof discoverInventory>,
): void {
  console.log("QuorumRouter local model inventory");
  console.log(`auth_mode: ${inventory.auth_mode}`);
  console.log(`available_count: ${inventory.available_count}`);
  console.log(`blocked_count: ${inventory.blocked_count}`);
  console.log(`env_fallback_configured: ${inventory.env_fallback_configured}`);
  console.log(`fallback_used: ${inventory.env_fallback_used ? "env" : "none"}`);
  if (inventory.env_fallback_used) {
    console.log("env fallback is not the preferred public dogfood path");
  }
  for (const entry of inventory.entries) {
    console.log(
      `- ${entry.provider}/${entry.model}: available=${entry.available}; source=${entry.source}; can_list_models=${entry.can_list_models}; can_invoke=${entry.can_invoke}${
        entry.listed_models?.length
          ? `; listed_models=${entry.listed_models.join(",")}`
          : ""
      }${
        entry.list_blocked_reason
          ? `; list_blocked=${entry.list_blocked_reason}`
          : ""
      }${entry.blocked_reason ? `; blocked=${entry.blocked_reason}` : ""}`,
    );
  }
}

async function main(): Promise<void> {
  const command = Deno.args[0] ?? "help";
  if (command === "inventory" || command === "models:list") {
    const inventory = await inventoryCommand();
    console.log("Generation endpoint called: false");
    printInventorySummary(inventory);
    console.log(
      "wrote: ../../out/dogfood/local-model-dogfood/model-inventory.json",
    );
    return;
  }
  if (command === "intake") {
    const inventory = await discoverInventoryWithModelListing();
    await writeInventory(inventory);
    console.log("QuorumRouter intake");
    console.log("Step 1 — Detect local providers");
    printInventorySummary(inventory);
    console.log("Step 2 — Recommended next action");
    if (invokableEntries(inventory).length === 0) {
      console.log("QuorumRouter intake blocked");
      console.log("No usable OAuth/session/wrapper provider is available yet.");
      console.log("Next:");
      console.log("  deno task auth:login");
    } else {
      console.log(
        'RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."',
      );
    }
    return;
  }
  if (command === "auth:status") {
    const inventory = await discoverInventoryWithModelListing();
    await writeInventory(inventory);
    printInventorySummary(inventory);
    if (invokableEntries(inventory).length === 0) {
      console.log(
        "next_action: install/login to a local provider CLI, or explicitly set QUORUM_ROUTER_AUTH_MODE=env with generic provider env",
      );
    }
    return;
  }
  if (command === "auth:login") {
    console.error(
      "OAuth/session login is not configured for this repo-local dogfood helper.",
    );
    console.error("Use an installed provider CLI login, then rerun:");
    console.error("  deno task intake");
    console.error(
      "Generic env fallback exists, but it is private/manual and not the preferred path.",
    );
    Deno.exit(1);
  }
  if (command === "auth:logout") {
    console.log(
      "Provider CLI/browser sessions are managed by each provider CLI and were not modified.",
    );
    console.log("Credential values printed: false");
    return;
  }
  if (command === "health") {
    const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
    const inventory = discoverInventory(authMode);
    await writeInventory(inventory);
    const trace = await buildTrace({
      command: "health",
      mode: "health",
      authMode,
      errors: invokableEntries(inventory).length === 0
        ? ["no invokable local models discovered"]
        : [],
    });
    const path = await writeTrace("health-trace", trace);
    console.log("QuorumRouter local model dogfood health");
    console.log(
      `available_invokable_models: ${invokableEntries(inventory).length}`,
    );
    console.log("external_model_call_sent: false");
    console.log(`trace: ${path}`);
    return;
  }
  const prompt = argValue("--prompt", "Review this README for risky claims.");
  if (command === "route:once") {
    const { results, tracePath } = await invokeSelected(prompt);
    console.log("QuorumRouter local model dogfood");
    console.log("mode: route_once");
    console.log(`provider: ${results[0].provider}`);
    console.log(`model: ${results[0].model}`);
    console.log(`schema_valid: ${results[0].schema_valid}`);
    console.log(`final: ${summarize(results[0].response_summary, 500)}`);
    console.log(`trace: ${tracePath}`);
    return;
  }
  if (command === "best-route") {
    const { results, tracePath } = await runBestRoute(prompt);
    console.log("QuorumRouter local model dogfood");
    console.log("mode: best_route");
    console.log(`models_called: ${results.length}`);
    console.log(`trace: ${tracePath}`);
    return;
  }
  if (command === "agent-chat") {
    const { tracePath } = await runAgentChat(prompt);
    console.log("QuorumRouter local model dogfood");
    console.log("mode: agent_chat experimental explicit opt-in");
    console.log(`trace: ${tracePath}`);
    return;
  }
  throw new Error(
    "usage: deno task intake|auth:status|auth:login|auth:logout|models:list|health|route:once|best-route|agent-chat",
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}
