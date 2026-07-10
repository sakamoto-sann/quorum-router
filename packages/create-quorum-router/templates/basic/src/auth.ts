import { printLoginGuidance } from "./auth_oauth.ts";
import { readRouterEnv } from "./env.ts";
import {
  discoverInventoryWithModelListing,
  envFallbackConfigured,
  invokableEntries,
} from "./auth_session.ts";
import { printInventoryTable } from "./model_inventory.ts";
import { parseAuthMode } from "./schema.ts";

export async function runAuthStatus(): Promise<void> {
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const inventory = await discoverInventoryWithModelListing(authMode);
  console.log("QuorumRouter auth status");
  console.log(`Auth mode: ${authMode}`);
  console.log("Preferred path: OAuth/session/local-wrapper first");
  console.log("Provider request sent: false");
  console.log("Credential values printed: false");
  console.log(`Env fallback configured: ${envFallbackConfigured()}`);
  printInventoryTable(inventory);
  const usableEntries = invokableEntries(inventory);
  if (usableEntries.length === 0) {
    console.log("Status: missing usable OAuth/session/wrapper provider");
    console.log("Next action: deno task auth:login");
  } else if (authMode === "env") {
    console.log("Status: explicit private env fallback is configured");
    console.log(
      'Next action: RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."',
    );
  } else {
    console.log(
      "Status: at least one OAuth/session/wrapper provider appears usable",
    );
    console.log(
      'Next action: RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."',
    );
  }
}

export function runAuthLogin(): never {
  return printLoginGuidance();
}

export async function runAuthLogout(): Promise<void> {
  try {
    await Deno.remove(".quorum-router", { recursive: true });
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  console.log("QuorumRouter auth logout");
  console.log(
    "Removed generated local session metadata directory if present: .quorum-router/",
  );
  console.log(
    "Provider CLI/browser sessions are managed by each provider CLI and were not modified.",
  );
  console.log("Credential values printed: false");
}
