import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_session.ts";
import { callEnvFallback } from "./auth_env_fallback.ts";
import {
  assertOptIn,
  type ModelInventoryEntry,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { buildTrace, score, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";

function normalized(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function providerAliases(entry: ModelInventoryEntry): string[] {
  return [
    entry.provider,
    entry.model,
    entry.model_id,
    entry.source,
    entry.command,
  ].filter((value): value is string => Boolean(value)).map((value) =>
    value.toLowerCase()
  );
}

function modelAliases(entry: ModelInventoryEntry): string[] {
  return [
    entry.model,
    entry.model_id,
    ...(entry.listed_models ?? []),
  ].map((value) => value.toLowerCase());
}

function withRequestedListedModel(
  entry: ModelInventoryEntry,
  requestedModel: string | undefined,
): ModelInventoryEntry {
  if (!requestedModel) return entry;
  const listed = entry.listed_models ?? [];
  const selected = listed.find((model) =>
    model.toLowerCase() === requestedModel
  );
  if (!selected) return entry;
  return {
    ...entry,
    model: selected,
    model_id: `${entry.provider.toLowerCase()}/${selected}`,
    invocation_model: selected,
    notes: [
      ...entry.notes,
      `Selected listed model ${selected} for this invocation.`,
    ],
  };
}

export function selectInvokableCandidates(
  candidates: ModelInventoryEntry[],
  authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE")),
): ModelInventoryEntry[] {
  const requestedProvider = normalized(
    Deno.env.get("FUSION_ROUTER_WRAPPER_PROVIDER_LABEL") ??
      (authMode === "env"
        ? Deno.env.get("FUSION_ROUTER_PROVIDER_LABEL")
        : undefined),
  );
  const requestedModel = normalized(
    Deno.env.get("FUSION_ROUTER_WRAPPER_PROVIDER_MODEL") ??
      (authMode === "env"
        ? Deno.env.get("FUSION_ROUTER_PROVIDER_MODEL")
        : undefined),
  );
  if (!requestedProvider && !requestedModel) return candidates;

  const filtered = candidates.filter((entry) => {
    const providerMatches = !requestedProvider ||
      providerAliases(entry).some((alias) => alias === requestedProvider);
    const modelMatches = !requestedModel ||
      modelAliases(entry).some((alias) => alias === requestedModel);
    return providerMatches && modelMatches;
  }).map((entry) => withRequestedListedModel(entry, requestedModel));

  if (filtered.length > 0) return filtered;

  const requested = [
    requestedProvider ? `provider=${requestedProvider}` : undefined,
    requestedModel ? `model=${requestedModel}` : undefined,
  ].filter(Boolean).join(" ");
  const available = candidates.map((entry) => {
    const listed = entry.listed_models?.length
      ? ` listed=[${entry.listed_models.join(",")}]`
      : "";
    return `${entry.provider}/${entry.model} (${entry.model_id})${listed}`;
  }).join("; ");
  throw new Error(
    `Fusion Router blocked: requested wrapper candidate not available (${requested}); candidates: ${available}`,
  );
}

export async function invokeSelected(
  prompt: string,
): Promise<{ results: ProviderResult[]; tracePath: string }> {
  assertOptIn();
  const safePrompt = prompt.slice(0, 4000);
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const inventory = await discoverInventoryWithModelListing(authMode);
  const candidates = selectInvokableCandidates(
    invokableEntries(inventory),
    authMode,
  );
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. No usable OAuth/session/wrapper provider is available yet. Next: deno task auth:login",
    );
  }
  const selected = candidates[0];
  const result = selected.source === "env_fallback"
    ? await callEnvFallback(safePrompt)
    : await callWrapper(selected, safePrompt);
  const row = score(result);
  const trace = await buildTrace({
    command: "route:once",
    mode: "route_once",
    authMode,
    prompt: safePrompt,
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
  const safePrompt = prompt.slice(0, 4000);
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const inventory = await discoverInventoryWithModelListing(authMode);
  const candidates = selectInvokableCandidates(
    invokableEntries(inventory),
    authMode,
  );
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. best-route has no usable OAuth/session/wrapper provider yet. Next: deno task auth:login",
    );
  }
  const results: ProviderResult[] = [];
  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      results.push(
        candidate.source === "env_fallback"
          ? await callEnvFallback(safePrompt)
          : await callWrapper(candidate, safePrompt),
      );
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (results.length === 0) {
    throw new Error(
      `OAuth/session-first provider unavailable. all candidates failed safely: ${
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
    prompt: safePrompt,
    results,
    selected: scores[0],
    scores,
    errors,
  });
  const tracePath = await writeTrace("best-route-trace", trace);
  return { results, tracePath };
}
