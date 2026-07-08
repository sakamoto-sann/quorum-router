import { failClosed } from "../errors.ts";
import {
  AgentChatAuditMilestone,
  type AgentChatAuditSink,
  createAgentChatAuditEvent,
} from "./audit.ts";
import {
  AGENT_CHAT_PHASE_BY_ROLE,
  assertAgentChatWithinLimits,
  normalizeAgentChatLimits,
} from "./protocol.ts";
import {
  redactAgentChatContent,
  redactAgentChatMessage,
  sanitizeAgentChatMetadata,
} from "./redaction.ts";
import {
  AGENT_CHAT_ROLES,
  type AgentChatCloseout,
  type AgentChatDecision,
  type AgentChatObjection,
  type AgentChatRole,
  type AgentChatRunConfig,
  type AgentChatScriptStep,
  type AgentChatTranscript,
  AgentChatTranscriptSchema,
  type AgentChatTurn,
} from "./types.ts";

const DEFAULT_SCRIPT: Record<AgentChatRole, AgentChatScriptStep> = {
  planner: {
    content:
      "Plan: define scope, safety limits, verification, and closeout gates.",
  },
  coder: {
    content:
      "Code: implement the bounded skeleton with no external side effects.",
  },
  reviewer: {
    content:
      "Review: protocol and simulator skeleton pass deterministic checks.",
  },
  red_team: {
    content:
      "Red-team: no network, no tools, no raw secret transcript leakage.",
  },
  closeout: {
    content: "Closeout: ready after review and red-team pass.",
  },
};

export type AgentChatSimulatorResult = {
  transcript: AgentChatTranscript;
  decision: AgentChatDecision;
};

export type AgentChatSimulatorConfig = AgentChatRunConfig & {
  auditSink?: AgentChatAuditSink;
};

function mergeScript(
  script: AgentChatRunConfig["script"] = {},
): Record<AgentChatRole, AgentChatScriptStep> {
  return {
    planner: { ...DEFAULT_SCRIPT.planner, ...script.planner },
    coder: { ...DEFAULT_SCRIPT.coder, ...script.coder },
    reviewer: { ...DEFAULT_SCRIPT.reviewer, ...script.reviewer },
    red_team: { ...DEFAULT_SCRIPT.red_team, ...script.red_team },
    closeout: { ...DEFAULT_SCRIPT.closeout, ...script.closeout },
  };
}

function emitAudit(
  sink: AgentChatAuditSink | undefined,
  milestone: AgentChatAuditMilestone,
  input: Parameters<typeof createAgentChatAuditEvent>[1],
): void {
  sink?.(createAgentChatAuditEvent(milestone, input));
}

function failAgentChatClosed(
  reason: string,
  metadata: Record<string, unknown> = {},
): never {
  failClosed(4401, "agent_chat_failed_closed", reason, metadata);
}

function finiteNonnegativeStepNumber(
  name: string,
  value: number | undefined,
  defaultValue: number,
): number {
  const normalized = value ?? defaultValue;
  if (!Number.isFinite(normalized) || normalized < 0) {
    failClosed(
      4400,
      "invalid_agent_chat_script_step",
      `${name} must be finite and nonnegative.`,
      { field: name },
    );
  }
  return normalized;
}

export function runAgentChatSimulator(
  config: AgentChatSimulatorConfig,
): AgentChatSimulatorResult {
  const limits = normalizeAgentChatLimits(config.limits ?? {});
  const script = mergeScript(config.script);
  const startedAtMs = config.startedAtMs ?? 0;
  const extraRedactionValues = config.extraRedactionValues ?? [];
  const turns: AgentChatTurn[] = [];
  const objections: AgentChatObjection[] = [];
  const roleTurns: Partial<Record<AgentChatRole, number>> = {};
  let elapsedMs = 0;
  let spentUsd = 0;
  let lastPhase: string | undefined;

  emitAudit(config.auditSink, AgentChatAuditMilestone.started, {
    createdAtMs: startedAtMs,
    metadata: { prompt: redactAgentChatContent(config.prompt) },
    extraRedactionValues,
  });

  for (const role of AGENT_CHAT_ROLES) {
    const phase = AGENT_CHAT_PHASE_BY_ROLE[role];
    const step = script[role];
    const durationMs = finiteNonnegativeStepNumber(
      "durationMs",
      step.durationMs,
      1,
    );
    const budgetUsd = finiteNonnegativeStepNumber(
      "budgetUsd",
      step.budgetUsd,
      0,
    );

    assertAgentChatWithinLimits(
      turns.length < limits.maxTurns,
      "agent_chat exceeded maxTurns before all phases completed.",
      { maxTurns: limits.maxTurns, attemptedRole: role },
    );
    roleTurns[role] = (roleTurns[role] ?? 0) + 1;
    assertAgentChatWithinLimits(
      (roleTurns[role] ?? 0) <= (limits.maxTurnsPerRole[role] ?? 0),
      "agent_chat exceeded maxTurnsPerRole.",
      { role, maxTurnsPerRole: limits.maxTurnsPerRole[role] },
    );
    assertAgentChatWithinLimits(
      durationMs <= limits.maxPhaseDurationMs,
      "agent_chat phase duration exceeded maxPhaseDurationMs.",
      {
        role,
        phase,
        durationMs,
        maxPhaseDurationMs: limits.maxPhaseDurationMs,
      },
    );
    assertAgentChatWithinLimits(
      elapsedMs + durationMs <= limits.maxDurationMs,
      "agent_chat total duration exceeded maxDurationMs.",
      { elapsedMs, durationMs, maxDurationMs: limits.maxDurationMs },
    );
    if (limits.maxBudgetUsd !== undefined) {
      assertAgentChatWithinLimits(
        spentUsd + budgetUsd <= limits.maxBudgetUsd,
        "agent_chat budget exceeded maxBudgetUsd.",
        { spentUsd, budgetUsd, maxBudgetUsd: limits.maxBudgetUsd },
      );
    }

    if (lastPhase !== phase) {
      emitAudit(config.auditSink, AgentChatAuditMilestone.phaseStarted, {
        createdAtMs: startedAtMs + elapsedMs,
        phase,
        role,
        extraRedactionValues,
      });
      lastPhase = phase;
    }

    elapsedMs += durationMs;
    spentUsd += budgetUsd;
    const createdAtMs = startedAtMs + elapsedMs;
    const rawContent = step.objection ?? step.content ?? "";
    const turn = {
      ...redactAgentChatMessage({
        role,
        phase,
        content: rawContent,
        createdAtMs,
        metadata: {
          ...(step.metadata ?? {}),
          budgetUsd,
          durationMs,
        },
      }, extraRedactionValues),
      turnIndex: turns.length,
    } as AgentChatTurn;
    turns.push(turn);

    emitAudit(config.auditSink, AgentChatAuditMilestone.turnRecorded, {
      createdAtMs,
      phase,
      role,
      metadata: { turnIndex: turn.turnIndex },
      extraRedactionValues,
    });

    if (step.objection && (role === "reviewer" || role === "red_team")) {
      const objectionPhase = role === "reviewer" ? "review" : "red_team";
      const objection: AgentChatObjection = {
        role,
        phase: objectionPhase,
        content: redactAgentChatContent(step.objection, extraRedactionValues),
        createdAtMs,
        redacted: true,
        metadata: sanitizeAgentChatMetadata(
          step.metadata,
          extraRedactionValues,
        ),
      };
      objections.push(objection);
      emitAudit(config.auditSink, AgentChatAuditMilestone.objectionRaised, {
        createdAtMs,
        phase,
        role,
        metadata: { objectionCount: objections.length },
        extraRedactionValues,
      });
    }

    if (role === "reviewer" && !step.objection) {
      emitAudit(config.auditSink, AgentChatAuditMilestone.reviewPassed, {
        createdAtMs,
        phase,
        role,
        extraRedactionValues,
      });
    }
    if (role === "red_team" && !step.objection) {
      emitAudit(config.auditSink, AgentChatAuditMilestone.redTeamPassed, {
        createdAtMs,
        phase,
        role,
        extraRedactionValues,
      });
    }
  }

  const completedAtMs = startedAtMs + elapsedMs;
  const closeoutTurn = turns.find((turn) => turn.role === "closeout");
  if (!closeoutTurn) {
    emitAudit(config.auditSink, AgentChatAuditMilestone.failedClosed, {
      createdAtMs: completedAtMs,
      phase: "failed_closed",
      metadata: { reason: "missing closeout turn" },
      extraRedactionValues,
    });
    failAgentChatClosed(
      "agent_chat simulator completed without closeout turn.",
    );
  }

  const closeout: AgentChatCloseout = {
    ready: objections.length === 0,
    summary: objections.length === 0
      ? "Review and red-team passed; standalone simulator closeout ready."
      : "Review or red-team objection blocks closeout readiness.",
    createdAtMs: completedAtMs,
    redacted: true,
    metadata: sanitizeAgentChatMetadata({ spentUsd }, extraRedactionValues),
  };

  const decision: AgentChatDecision = {
    decision: objections.length === 0 ? "ready" : "not_ready",
    reason: objections.length === 0
      ? "review_and_red_team_passed"
      : "objections_block_closeout",
    phase: "closeout",
    objections,
    closeout,
    metadata: sanitizeAgentChatMetadata({ spentUsd }, extraRedactionValues),
  };

  if (decision.decision === "ready") {
    emitAudit(config.auditSink, AgentChatAuditMilestone.closeoutReady, {
      createdAtMs: completedAtMs,
      phase: "closeout",
      role: "closeout",
      extraRedactionValues,
    });
  }

  const transcript = AgentChatTranscriptSchema.parse({
    prompt: redactAgentChatContent(config.prompt, extraRedactionValues),
    startedAtMs,
    completedAtMs,
    redacted: true,
    turns,
    messages: turns.map(({ turnIndex: _turnIndex, ...message }) => message),
    objections,
    decision,
    metadata: sanitizeAgentChatMetadata({ spentUsd }, extraRedactionValues),
  });

  return { transcript, decision };
}
