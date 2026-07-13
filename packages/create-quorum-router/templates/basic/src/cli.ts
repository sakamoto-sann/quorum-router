import { runAgentChat } from "./agent_chat.ts";
import { readRouterEnv } from "./env.ts";
import { runAuthLogin, runAuthLogout, runAuthStatus } from "./auth.ts";
import { discoverInventory, invokableEntries } from "./auth_session.ts";
import { invokeSelected, runBestRoute } from "./best_route.ts";
import { runIntake } from "./intake.ts";
import {
  inventoryCommand,
  printInventoryTable,
  writeInventory,
} from "./model_inventory.ts";
import { redact, summarize } from "./redact.ts";
import { parseAuthMode } from "./schema.ts";
import {
  auditRouteOutcome,
  preflightRequiredSupabaseAudit,
  runSupabaseStatus,
} from "./supabase.ts";
import { buildTrace, writeTrace } from "./trace.ts";

const DEFAULT_PROMPT = "Review this README for risky claims.";

type CommandName =
  | "intake"
  | "auth:status"
  | "auth:login"
  | "auth:logout"
  | "models:list"
  | "health"
  | "supabase:status"
  | "route:once"
  | "best-route"
  | "agent-chat";

function commandName(): CommandName {
  const command = Deno.args[0];
  if (
    command === "intake" || command === "auth:status" ||
    command === "auth:login" || command === "auth:logout" ||
    command === "models:list" || command === "health" ||
    command === "supabase:status" ||
    command === "route:once" || command === "best-route" ||
    command === "agent-chat"
  ) return command;
  throw new Error(
    "usage: deno task intake|auth:status|auth:login|auth:logout|models:list|health|supabase:status|route:once|best-route|agent-chat",
  );
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

async function runModelsList(): Promise<void> {
  const inventory = await inventoryCommand();
  console.log("QuorumRouter model inventory");
  console.log("Provider request sent: false");
  console.log("Generation endpoint called: false");
  console.log("Credential values printed: false");
  printInventoryTable(inventory);
}

async function runHealth(): Promise<void> {
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const inventory = discoverInventory(authMode);
  await writeInventory(inventory);
  const invokable = invokableEntries(inventory);
  const trace = await buildTrace({
    command: "health",
    mode: "health",
    authMode,
    errors: invokable.length === 0
      ? ["no invokable OAuth/session/wrapper provider discovered"]
      : [],
  });
  const tracePath = await writeTrace("health-trace", trace);
  console.log("QuorumRouter health");
  console.log(
    `Config example present: ${await Deno.stat("router.config.example.json")
      .then((s) => s.isFile).catch(
        () => false,
      )}`,
  );
  console.log(`Model inventory entries: ${inventory.entries.length}`);
  console.log(`Usable providers: ${invokable.length}`);
  console.log("Provider request sent: false");
  console.log(`Trace: ${tracePath}`);
  console.log(
    'Recommended dogfood: RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."',
  );
}

try {
  const command = commandName();
  if (command === "intake") await runIntake();
  else if (command === "auth:status") await runAuthStatus();
  else if (command === "auth:login") runAuthLogin();
  else if (command === "auth:logout") await runAuthLogout();
  else if (command === "models:list") await runModelsList();
  else if (command === "health") await runHealth();
  else if (command === "supabase:status") await runSupabaseStatus();
  else if (command === "route:once") {
    await preflightRequiredSupabaseAudit();
    const { results, tracePath, trace } = await invokeSelected(
      promptFromArgs(),
    );
    await auditRouteOutcome(trace);
    console.log("QuorumRouter route:once");
    console.log(`provider: ${results[0].provider}`);
    console.log(`model: ${results[0].model}`);
    console.log(`response_received: ${results[0].response_received}`);
    console.log(`schema_valid: ${results[0].schema_valid}`);
    console.log(`redaction_ok: ${trace.redaction_ok}`);
    console.log(`credential_value_present: ${trace.credential_value_present}`);
    console.log(`sensitive_value_present: ${trace.sensitive_value_present}`);
    console.log(`final: ${summarize(results[0].response_summary, 500)}`);
    console.log(`trace: ${tracePath}`);
  } else if (command === "best-route") {
    await preflightRequiredSupabaseAudit();
    const { results, tracePath, trace } = await runBestRoute(promptFromArgs());
    await auditRouteOutcome(trace);
    console.log("QuorumRouter best-route");
    console.log(`models_called: ${results.length}`);
    console.log(`trace: ${tracePath}`);
  } else if (command === "agent-chat") {
    console.log("QuorumRouter live multi-model Agent Chat");
    const { tracePath, turns } = await runAgentChat(
      promptFromArgs(),
      (progress) => {
        if (progress.type === "start") {
          console.log(
            `agents: ${
              progress.agents.map((agent) => `${agent.provider}/${agent.model}`)
                .join(" ↔ ")
            }`,
          );
          console.log("");
        } else if (progress.type === "turn") {
          const turn = progress.turn;
          console.log(`Round ${turn.round}`);
          console.log(
            `${turn.provider}/${turn.model}${
              turn.reply_to
                ? ` → replying to ${turn.reply_to.provider}/${turn.reply_to.model} (round ${turn.reply_to.round})`
                : " → opening proposal"
            }`,
          );
          console.log(turn.content);
          console.log("");
        }
      },
    );
    console.log(`dialogue_complete: true`);
    console.log(`turns: ${turns.length}`);
    console.log(`trace: ${tracePath}`);
  }
} catch (error) {
  console.error(redact(error instanceof Error ? error.message : String(error)));
  Deno.exit(1);
}
