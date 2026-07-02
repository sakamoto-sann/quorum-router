import { failClosed } from "../errors.ts";
import {
  AGENT_CHAT_ROLES,
  type AgentChatLimits,
  type AgentChatPhase,
  type AgentChatRole,
} from "./types.ts";

export const AGENT_CHAT_PHASE_BY_ROLE: Record<AgentChatRole, AgentChatPhase> = {
  planner: "planning",
  coder: "coding",
  reviewer: "review",
  red_team: "red_team",
  closeout: "closeout",
};

export const DEFAULT_AGENT_CHAT_LIMITS: AgentChatLimits = {
  maxTurns: 8,
  maxTurnsPerRole: {
    planner: 1,
    coder: 1,
    reviewer: 1,
    red_team: 1,
    closeout: 1,
  },
  maxDurationMs: 30_000,
  maxPhaseDurationMs: 10_000,
};

function assertPositiveInteger(name: string, value: unknown): number {
  if (!Number.isInteger(value) || Number(value) < 1) {
    failClosed(
      4400,
      "invalid_agent_chat_limits",
      `${name} must be a positive integer.`,
      { field: name, receivedType: typeof value },
    );
  }
  return Number(value);
}

export function normalizeAgentChatLimits(
  input: Partial<AgentChatLimits> = {},
): AgentChatLimits {
  const maxTurns = assertPositiveInteger(
    "maxTurns",
    input.maxTurns ?? DEFAULT_AGENT_CHAT_LIMITS.maxTurns,
  );
  const maxDurationMs = assertPositiveInteger(
    "maxDurationMs",
    input.maxDurationMs ?? DEFAULT_AGENT_CHAT_LIMITS.maxDurationMs,
  );
  const maxPhaseDurationMs = assertPositiveInteger(
    "maxPhaseDurationMs",
    input.maxPhaseDurationMs ?? DEFAULT_AGENT_CHAT_LIMITS.maxPhaseDurationMs,
  );
  const maxTurnsPerRole: Partial<Record<AgentChatRole, number>> = {
    ...DEFAULT_AGENT_CHAT_LIMITS.maxTurnsPerRole,
  };

  for (const role of AGENT_CHAT_ROLES) {
    const roleLimit = input.maxTurnsPerRole?.[role];
    if (roleLimit !== undefined) {
      maxTurnsPerRole[role] = assertPositiveInteger(
        `maxTurnsPerRole.${role}`,
        roleLimit,
      );
    }
  }

  if (input.maxBudgetUsd !== undefined) {
    if (!Number.isFinite(input.maxBudgetUsd) || input.maxBudgetUsd < 0) {
      failClosed(
        4400,
        "invalid_agent_chat_limits",
        "maxBudgetUsd must be finite and nonnegative when provided.",
        { field: "maxBudgetUsd" },
      );
    }
  }

  return {
    maxTurns,
    maxTurnsPerRole,
    maxDurationMs,
    maxPhaseDurationMs,
    ...(input.maxBudgetUsd === undefined
      ? {}
      : { maxBudgetUsd: input.maxBudgetUsd }),
  };
}

export function assertAgentChatWithinLimits(
  condition: boolean,
  reason: string,
  metadata: Record<string, unknown> = {},
): void {
  if (!condition) {
    failClosed(
      4401,
      "agent_chat_limit_exceeded",
      reason,
      metadata,
    );
  }
}
