import type { AgentChatPhase, AgentChatRole } from "./types.ts";
import { sanitizeAgentChatMetadata } from "./redaction.ts";

export const AgentChatAuditMilestone = {
  started: "agent_chat.started",
  phaseStarted: "agent_chat.phase_started",
  turnRecorded: "agent_chat.turn_recorded",
  objectionRaised: "agent_chat.objection_raised",
  reviewPassed: "agent_chat.review_passed",
  redTeamPassed: "agent_chat.red_team_passed",
  closeoutReady: "agent_chat.closeout_ready",
  failedClosed: "agent_chat.failed_closed",
} as const;

export type AgentChatAuditMilestone =
  typeof AgentChatAuditMilestone[keyof typeof AgentChatAuditMilestone];

export type AgentChatAuditEvent = {
  milestone: AgentChatAuditMilestone;
  createdAtMs: number;
  phase?: AgentChatPhase;
  role?: AgentChatRole;
  redacted: true;
  metadata: Record<string, string | number | boolean | null>;
};

export type AgentChatAuditSink = (event: AgentChatAuditEvent) => void;

export function createAgentChatAuditEvent(
  milestone: AgentChatAuditMilestone,
  input: {
    createdAtMs: number;
    phase?: AgentChatPhase;
    role?: AgentChatRole;
    metadata?: Record<string, unknown>;
    extraRedactionValues?: string[];
  },
): AgentChatAuditEvent {
  return {
    milestone,
    createdAtMs: input.createdAtMs,
    ...(input.phase === undefined ? {} : { phase: input.phase }),
    ...(input.role === undefined ? {} : { role: input.role }),
    redacted: true,
    metadata: sanitizeAgentChatMetadata(
      input.metadata,
      input.extraRedactionValues,
    ),
  };
}

export function createInMemoryAgentChatAuditSink(): {
  sink: AgentChatAuditSink;
  events: AgentChatAuditEvent[];
} {
  const events: AgentChatAuditEvent[] = [];
  return {
    events,
    sink: (event) => {
      events.push(event);
    },
  };
}
