import type { ModelAdapter } from "../contracts.ts";
import type { ProviderDescriptor } from "../schemas.ts";
import type { CommanderConfig } from "../commander/types.ts";
import type {
  AgentChatDecision,
  AgentChatTranscript,
} from "../agent-chat/types.ts";
import type {
  AgentBusEvent,
  AgentBusMessage,
  AgentBusStore,
} from "../agent-chat/bus/types.ts";
import type { ActionProposal } from "./execution.ts";
import type { ActionRunner } from "./repo-action-runner.ts";
import type {
  SafeLoopApprovalResolver,
  SafeLoopArtifact,
  SafeLoopClient,
  SafeLoopExecutionReceipt,
} from "../safeloop/types.ts";

export const AGENT_RUNTIME_ROLES = Object.freeze(
  [
    "commander",
    "coder",
    "reviewer",
    "red_team",
    "closeout",
  ] as const,
);

export type AgentRuntimeRole = typeof AGENT_RUNTIME_ROLES[number];

export type AgentRuntimeRoleBinding = {
  role: AgentRuntimeRole;
  adapter: ModelAdapter;
  required?: boolean;
};

export type AgentRuntimeLimits = {
  maxTurns: number;
  maxDurationMs: number;
  maxBudgetUsd?: number;
  maxPromptChars: number;
  maxRounds: number;
};

export type AgentRuntimeBusIds = {
  teamId: string;
  runId: string;
  roleAgentIds: Record<AgentRuntimeRole, string>;
};

export type AgentRuntimeConfig = {
  enabled: boolean;
  experimental?: boolean;
  bus: AgentBusStore;
  commander: CommanderConfig;
  roles: AgentRuntimeRoleBinding[];
  limits?: Partial<AgentRuntimeLimits>;
  busIds?: Partial<AgentRuntimeBusIds> & {
    roleAgentIds?: Partial<Record<AgentRuntimeRole, string>>;
  };
  execution?: {
    safeloop: SafeLoopClient;
    repo: string;
    runRoot: string;
    taskId: string | ((proposal: ActionProposal) => string);
    runId:
      | string
      | ((proposal: ActionProposal, executionIndex: number) => string);
    policyVersion: string;
    policyRef: string;
    requestedBy: string;
    approvalResolver?: SafeLoopApprovalResolver;
    expectedArtifactScope: string[];
    timeoutSeconds?: number;
    actionRunner: ActionRunner;
  };
};

export type AgentRuntimeResult = {
  ok: boolean;
  decision: AgentChatDecision;
  transcript: AgentChatTranscript;
  messages: AgentBusMessage[];
  events: AgentBusEvent[];
  receipts: SafeLoopExecutionReceipt[];
  artifacts: SafeLoopArtifact[];
  finalAnswer?: string;
  runtimeSummary: {
    turns: number;
    objections: number;
    budgetUsedUsd: number;
    durationMs: number;
  };
};

export const AgentRuntimeOutputStatuses = Object.freeze(
  [
    "plan",
    "result",
    "pass",
    "object",
    "ready",
    "not_ready",
  ] as const,
);

export type AgentRuntimeOutputStatus =
  typeof AgentRuntimeOutputStatuses[number];

export type ParsedAgentRuntimeRoleOutput = {
  status: AgentRuntimeOutputStatus;
  content: string;
  objection: string | null;
  finalAnswer: string | null;
  budgetUsd: number;
  actions: ActionProposal[];
};

export const DEFAULT_AGENT_RUNTIME_LIMITS: AgentRuntimeLimits = {
  maxTurns: 5,
  maxDurationMs: 30_000,
  maxBudgetUsd: 0,
  maxPromptChars: 24_000,
  maxRounds: 3,
};

export const DEFAULT_AGENT_RUNTIME_BUS_IDS: AgentRuntimeBusIds = {
  teamId: "agent-runtime-team",
  runId: "agent-runtime-run",
  roleAgentIds: {
    commander: "agent-runtime-commander",
    coder: "agent-runtime-coder",
    reviewer: "agent-runtime-reviewer",
    red_team: "agent-runtime-red-team",
    closeout: "agent-runtime-closeout",
  },
};

export function agentRuntimeDescriptorMetadata(
  descriptor: ProviderDescriptor,
): Record<string, string> {
  return {
    provider: descriptor.provider,
    model: descriptor.model,
    authMode: descriptor.authMode,
    transport: descriptor.transport,
    ...(descriptor.client === undefined ? {} : { client: descriptor.client }),
  };
}
