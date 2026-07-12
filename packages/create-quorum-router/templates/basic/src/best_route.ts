import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_session.ts";
import { callEnvFallback } from "./auth_env_fallback.ts";
import { readRouterEnv } from "./env.ts";
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
import { selectCandidatesWithinBudget } from "./cost_aware.ts";

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

function autoCandidateScore(entry: ModelInventoryEntry): number {
  let score = 0;
  if (entry.can_list_models && entry.listed_models?.length) score += 100;
  if (entry.source === "env_fallback") score -= 100;
  return score;
}

function rankAutoCandidates(
  candidates: ModelInventoryEntry[],
): ModelInventoryEntry[] {
  return candidates.map((entry, index) => ({ entry, index })).sort((a, b) =>
    autoCandidateScore(b.entry) - autoCandidateScore(a.entry) ||
    a.index - b.index
  ).map(({ entry }) => entry);
}

function withPreferredAutoListedModel(
  entry: ModelInventoryEntry,
): ModelInventoryEntry {
  const listed = entry.listed_models ?? [];
  const preferred =
    listed.find((model) => model === "grok-composer-2.5-fast") ??
      listed.find((model) => model.includes("composer"));
  if (!preferred) return entry;
  return {
    ...entry,
    model: preferred,
    model_id: `${entry.provider.toLowerCase()}/${preferred}`,
    invocation_model: preferred,
    notes: [
      ...entry.notes,
      `Auto-selected listed model ${preferred} for this invocation.`,
    ],
  };
}

function withRequestedListedModel(
  entry: ModelInventoryEntry,
  requestedModel: string | undefined,
): ModelInventoryEntry {
  const normalizedRequested = normalizeSelectionValue(requestedModel);
  if (!normalizedRequested) return entry;
  const providerPrefix = normalizeSelectionValue(entry.provider)?.replace(
    /[^a-z0-9]+/g,
    "",
  );
  const listed = entry.listed_models ?? [];
  const selected = listed.find((model) => {
    const normalizedModel = normalizeSelectionValue(model);
    return normalizedModel === normalizedRequested ||
      (providerPrefix
        ? `${providerPrefix}/${normalizedModel}` === normalizedRequested
        : false);
  });
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
    model_id: selected.model_id ?? selected.model,
    source: selected.source ?? "selected",
    command: selected.command,
    listed_models: selected.listed_models,
  };
  return providerSelectionMatches(entryLike, request.providerLabel) &&
    modelSelectionMatches(entryLike, request.model);
}

export function selectInvokableCandidates(
  candidates: ModelInventoryEntry[],
  _authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE")),
  request = readProviderSelectionRequest(),
  allEntries: ModelInventoryEntry[] = candidates,
): ModelInventoryEntry[] {
  if (!hasExplicitSelection(request)) {
    return rankAutoCandidates(candidates).map(withPreferredAutoListedModel);
  }

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
    `QuorumRouter blocked: requested provider/model unavailable (${
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
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const { request, candidates } = await discoverCandidates(authMode);
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. No usable OAuth/session/wrapper provider is available yet. Next: deno task auth:login",
    );
  }
  const prepared = await preparePromptWithContext(prompt);
  const safePrompt = prepared.prompt;
  const errors: string[] = [];
  let selected: ModelInventoryEntry | undefined;
  let result: ProviderResult | undefined;
  let selectedIndex = -1;

  for (const [index, candidate] of candidates.entries()) {
    if (!selectionHonored(request, candidate)) {
      throw new Error(
        `QuorumRouter blocked: provider selection was not honored (${
          requestedText(request)
        } selected=${candidate.provider}/${candidate.model})`,
      );
    }
    try {
      const candidateResult = candidate.source === "env_fallback"
        ? await callEnvFallback(safePrompt)
        : await callWrapper(candidate, safePrompt);
      if (!selectionHonored(request, candidateResult)) {
        throw new Error(
          `provider selection was ignored after invocation (${
            requestedText(request)
          } selected=${candidateResult.provider}/${candidateResult.model})`,
        );
      }
      selected = candidate;
      result = candidateResult;
      selectedIndex = index;
      break;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      if (hasExplicitSelection(request)) break;
    }
  }

  if (!selected || !result) {
    throw new Error(
      `OAuth/session-first provider unavailable. all candidates failed safely: ${
        errors.join("; ")
      }`,
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
    errors,
    requestedProviderLabel: request.providerLabel,
    requestedModel: request.model,
    providerSelectionHonored: selectionHonored(request, result),
    fallbackUsed: selectedIndex > 0 || selected.source === "env_fallback",
  });
  const tracePath = await writeTrace("route-once-trace", trace);
  return { results: [result], tracePath, trace };
}

export async function runBestRoute(
  prompt: string,
): Promise<
  { results: ProviderResult[]; tracePath: string; trace: DogfoodTrace }
> {
  assertOptIn();
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const { request, candidates: discoveredCandidates } =
    await discoverCandidates(
      authMode,
    );
  const costAwareDecision = selectCandidatesWithinBudget(discoveredCandidates);
  const candidates = costAwareDecision.candidates;
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
    costAware: costAwareDecision.cost.enabled
      ? costAwareDecision.cost
      : undefined,
  });
  const tracePath = await writeTrace("best-route-trace", trace);
  return { results, tracePath, trace };
}
