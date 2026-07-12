import { readRouterEnv } from "./env.ts";
import type { CostAwareTrace, ModelInventoryEntry } from "./schema.ts";

export type CostExclusion = {
  model_id: string;
  estimated_cost_usd?: number;
  reason: "missing_estimate" | "budget_exceeded";
};

export type CostAwareSelection =
  | CostAwareTrace
  | {
    enabled: false;
    selected_model_ids: string[];
    excluded: CostExclusion[];
  };

export type CostAwareConfig = {
  maxBudgetUsd: number;
  estimates: Map<string, number>;
};

function normalizedModelId(value: string): string {
  return value.trim().toLowerCase();
}

function parsePositiveBudget(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      "QuorumRouter blocked: QUORUM_ROUTER_MAX_BUDGET_USD must be a finite number > 0",
    );
  }
  return value;
}

function parseEstimates(raw: string): Map<string, number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "QuorumRouter blocked: QUORUM_ROUTER_ESTIMATED_COSTS_JSON must be valid JSON",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      "QuorumRouter blocked: QUORUM_ROUTER_ESTIMATED_COSTS_JSON must be a model-id to USD object",
    );
  }

  const estimates = new Map<string, number>();
  for (const [rawModelId, rawCost] of Object.entries(parsed)) {
    const modelId = normalizedModelId(rawModelId);
    if (
      !modelId || typeof rawCost !== "number" || !Number.isFinite(rawCost) ||
      rawCost < 0
    ) {
      throw new Error(
        "QuorumRouter blocked: every cost estimate must use a non-empty model id and a finite USD number >= 0",
      );
    }
    if (estimates.has(modelId)) {
      throw new Error(
        `QuorumRouter blocked: duplicate normalized cost estimate for ${modelId}`,
      );
    }
    estimates.set(modelId, rawCost);
  }
  if (estimates.size === 0) {
    throw new Error(
      "QuorumRouter blocked: QUORUM_ROUTER_ESTIMATED_COSTS_JSON must contain at least one estimate",
    );
  }
  return estimates;
}

export function readCostAwareConfig(): CostAwareConfig | undefined {
  const rawBudget = readRouterEnv("QUORUM_ROUTER_MAX_BUDGET_USD");
  const rawEstimates = readRouterEnv("QUORUM_ROUTER_ESTIMATED_COSTS_JSON");
  if (rawBudget === undefined && rawEstimates === undefined) return undefined;
  if (rawBudget === undefined || rawEstimates === undefined) {
    throw new Error(
      "QuorumRouter blocked: cost-aware routing requires both QUORUM_ROUTER_MAX_BUDGET_USD and QUORUM_ROUTER_ESTIMATED_COSTS_JSON",
    );
  }
  return {
    maxBudgetUsd: parsePositiveBudget(rawBudget),
    estimates: parseEstimates(rawEstimates),
  };
}

export function selectCandidatesWithinBudget(
  candidates: ModelInventoryEntry[],
  config = readCostAwareConfig(),
): { candidates: ModelInventoryEntry[]; cost: CostAwareSelection } {
  if (!config) {
    return {
      candidates,
      cost: {
        enabled: false,
        selected_model_ids: candidates.map((candidate) => candidate.model_id),
        excluded: [],
      },
    };
  }

  const selected: ModelInventoryEntry[] = [];
  const excluded: CostExclusion[] = [];
  let estimatedTotalUsd = 0;
  for (const candidate of candidates) {
    const estimate = config.estimates.get(
      normalizedModelId(candidate.model_id),
    );
    if (estimate === undefined) {
      excluded.push({
        model_id: candidate.model_id,
        reason: "missing_estimate",
      });
      continue;
    }
    if (estimatedTotalUsd + estimate > config.maxBudgetUsd) {
      excluded.push({
        model_id: candidate.model_id,
        estimated_cost_usd: estimate,
        reason: "budget_exceeded",
      });
      continue;
    }
    selected.push(candidate);
    estimatedTotalUsd += estimate;
  }

  if (selected.length === 0) {
    throw new Error(
      "QuorumRouter blocked: cost-aware routing selected no candidates within the configured budget",
    );
  }
  return {
    candidates: selected,
    cost: {
      enabled: true,
      pricing_source: "configured_estimate_not_live_billing",
      max_budget_usd: config.maxBudgetUsd,
      estimated_total_usd: estimatedTotalUsd,
      selected_model_ids: selected.map((candidate) => candidate.model_id),
      excluded,
    },
  };
}
