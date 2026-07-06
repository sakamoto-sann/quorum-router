import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_session.ts";
import { callEnvFallback } from "./auth_env_fallback.ts";
import {
  modelSelectionMatches,
  normalizeSelectionValue,
  providerSelectionMatches,
  type ProviderSelectionRequest,
  readProviderSelectionRequest,
} from "./provider_registry.ts";
import {
  assertOptIn,
  type DogfoodTrace,
  type ModelInventoryEntry,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { buildTrace, score, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";
import { preparePromptWithContext } from "./context.ts";

function hasExplicitSelection(request: ProviderSelectionRequest): boolean {
  return Boolean(
    normalizeSelectionValue(request.providerLabel) ||
      normalizeSelectionValue(request.model),
  );
}

function availableCandidate(entry: ModelInventoryEntry): string {
  const listed = entry.listed_models?.length
    ? ` listed=[${entry.listed_models.join(",")}]`
    : "";
  const blocker = entry.available && entry.can_invoke
    ? "ready"
    : `blocked=${
      entry.blocked_reason ?? entry.list_blocked_reason ?? "not invokable"
    }`;
  return `${entry.provider}/${entry.model} (${entry.model_id}) source=${entry.source} command=${
    entry.command ?? "n/a"
  } ${blocker}${listed}`;
}

function requestedText(request: ProviderSelectionRequest): string {
  return [
    request.providerLabel ? `provider=${request.providerLabel}` : undefined,
    request.model ? `model=${request.model}` : undefined,
  ].filter(Boolean).join(" ") || "none";
}

function withRequestedListedModel(
  entry: ModelInventoryEntry,
  requestedModel: string | undefined,
): ModelInventoryEntry {
  const normalizedRequested = normalizeSelectionValue(requestedModel);
  if (!normalizedRequested) return entry;
  const listed = entry.listed_models ?? [];
  const selected = listed.find((model) =>
    normalizeSelectionValue(model) === normalizedRequested
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

export function selectionHonored(
  request: ProviderSelectionRequest,
  selected: ModelInventoryEntry | ProviderResult,
): boolean {
  if (!hasExplicitSelection(request)) return true;
  const entryLike = {
    provider: selected.provider,
    model: selected.model,
    model_id: "model_id" in selected ? selected.model_id : selected.model,
    source: "source" in selected ? selected.source : "selected",
    command: "command" in selected ? selected.command : undefined,
    listed_models: "listed_models" in selected
      ? selected.listed_models
      : undefined,
  };
  return providerSelectionMatches(entryLike, request.providerLabel) &&
    modelSelectionMatches(entryLike, request.model);
}

export function selectInvokableCandidates(
  candidates: ModelInventoryEntry[],
  _authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE")),
  request = readProviderSelectionRequest(),
  allEntries: ModelInventoryEntry[] = candidates,
): ModelInventoryEntry[] {
  if (!hasExplicitSelection(request)) return candidates;

  const filtered = candidates.filter((entry) => {
    const providerMatches = providerSelectionMatches(
      entry,
      request.providerLabel,
    );
    const modelMatches = modelSelectionMatches(entry, request.model);
    return providerMatches && modelMatches;
  }).map((entry) => withRequestedListedModel(entry, request.model));

  if (filtered.length > 0) return filtered;

  throw new Error(
    `Fusion Router blocked: requested provider/model unavailable (${
      requestedText(request)
    }). ` +
      `Available candidates and blockers: ${
        allEntries.map(availableCandidate).join("; ")
      }`,
  );
}

async function discoverCandidates(authMode: ReturnType<typeof parseAuthMode>) {
  const request = readProviderSelectionRequest();
  const inventory = await discoverInventoryWithModelListing(authMode, request);
  const candidates = selectInvokableCandidates(
    invokableEntries(inventory),
    authMode,
    request,
    inventory.entries,
  );
  return { request, inventory, candidates };
}

export async function invokeSelected(
  prompt: string,
): Promise<
  { results: ProviderResult[]; tracePath: string; trace: DogfoodTrace }
> {
  assertOptIn();
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const { request, candidates } = await discoverCandidates(authMode);
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. No usable OAuth/session/wrapper provider is available yet. Next: deno task auth:login",
    );
  }
  const prepared = await preparePromptWithContext(prompt);
  const safePrompt = prepared.prompt;
  const selected = candidates[0];
  if (!selectionHonored(request, selected)) {
    throw new Error(
      `Fusion Router blocked: provider selection was not honored (${
        requestedText(request)
      } selected=${selected.provider}/${selected.model})`,
    );
  }
  const result = selected.source === "env_fallback"
    ? await callEnvFallback(safePrompt)
    : await callWrapper(selected, safePrompt);
  if (!selectionHonored(request, result)) {
    throw new Error(
      `Fusion Router blocked: provider selection was ignored after invocation (${
        requestedText(request)
      } selected=${result.provider}/${result.model})`,
    );
  }
  const row = score(result);
  const trace = await buildTrace({
    command: "route:once",
    mode: "route_once",
    authMode,
    prompt: safePrompt,
    promptContext: prepared.context,
    results: [result],
    selected: row,
    scores: [row],
    requestedProviderLabel: request.providerLabel,
    requestedModel: request.model,
    providerSelectionHonored: selectionHonored(request, result),
    fallbackUsed: selected.source === "env_fallback",
  });
  if (!trace.provider_selection_honored) {
    throw new Error(
      "Fusion Router blocked: trace shows provider_selection_honored=false",
    );
  }
  const tracePath = await writeTrace("route-once-trace", trace);
  return { results: [result], tracePath, trace };
}

export async function runBestRoute(
  prompt: string,
): Promise<
  { results: ProviderResult[]; tracePath: string; trace: DogfoodTrace }
> {
  assertOptIn();
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const { request, candidates } = await discoverCandidates(authMode);
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. best-route has no usable OAuth/session/wrapper provider yet. Next: deno task auth:login",
    );
  }
  const prepared = await preparePromptWithContext(prompt);
  const safePrompt = prepared.prompt;
  const results: ProviderResult[] = [];
  const errors: string[] = [];
  let usedEnvFallback = false;
  for (const candidate of candidates) {
    try {
      const result = candidate.source === "env_fallback"
        ? await callEnvFallback(safePrompt)
        : await callWrapper(candidate, safePrompt);
      usedEnvFallback = usedEnvFallback || candidate.source === "env_fallback";
      if (!selectionHonored(request, result)) {
        throw new Error(
          `provider selection ignored (${
            requestedText(request)
          } selected=${result.provider}/${result.model})`,
        );
      }
      results.push(result);
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
    promptContext: prepared.context,
    results,
    selected: scores[0],
    scores,
    errors,
    requestedProviderLabel: request.providerLabel,
    requestedModel: request.model,
    providerSelectionHonored: results.every((result) =>
      selectionHonored(request, result)
    ),
    fallbackUsed: usedEnvFallback,
  });
  if (!trace.provider_selection_honored) {
    throw new Error(
      "Fusion Router blocked: trace shows provider_selection_honored=false",
    );
  }
  const tracePath = await writeTrace("best-route-trace", trace);
  return { results, tracePath, trace };
}
