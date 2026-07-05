import { discoverInventory, invokableEntries } from "./auth_discovery.ts";
import { callEnvFallback } from "./env_fallback_client.ts";
import { assertOptIn, parseAuthMode, type ProviderResult } from "./schema.ts";
import { buildTrace, score, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";

export async function invokeSelected(
  prompt: string,
): Promise<{ results: ProviderResult[]; tracePath: string }> {
  assertOptIn();
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const inventory = discoverInventory(authMode);
  const candidates = invokableEntries(inventory);
  if (candidates.length === 0) {
    throw new Error(
      "Local real model dogfood still blocked: no available local wrapper/session/provider capability",
    );
  }
  const selected = candidates[0];
  const result = selected.source === "env_fallback"
    ? await callEnvFallback(prompt)
    : await callWrapper(selected, prompt);
  const row = score(result);
  const trace = await buildTrace({
    command: "route:once",
    mode: "route_once",
    authMode,
    prompt,
    results: [result],
    selected: row,
    scores: [row],
  });
  const tracePath = await writeTrace("route-once-trace", trace);
  return { results: [result], tracePath };
}

export async function runBestRoute(
  prompt: string,
): Promise<{ results: ProviderResult[]; tracePath: string }> {
  assertOptIn();
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const inventory = discoverInventory(authMode);
  const candidates = invokableEntries(inventory);
  if (candidates.length === 0) {
    throw new Error(
      "Local real model dogfood still blocked: best-route has no available invokable models",
    );
  }
  const results: ProviderResult[] = [];
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      results.push(
        candidate.source === "env_fallback"
          ? await callEnvFallback(prompt)
          : await callWrapper(candidate, prompt),
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (results.length === 0) {
    throw new Error(
      `Local real model dogfood still blocked: all candidates failed: ${
        errors.join("; ")
      }`,
    );
  }
  const scores = results.map(score).sort((a, b) =>
    b.final_score - a.final_score
  );
  const trace = await buildTrace({
    command: "best-route",
    mode: "best_route",
    authMode,
    prompt,
    results,
    selected: scores[0],
    scores,
    errors,
  });
  const tracePath = await writeTrace("best-route-trace", trace);
  return { results, tracePath };
}
