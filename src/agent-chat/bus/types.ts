export const AGENT_BUS_MESSAGE_TYPES = Object.freeze(
  [
    "text",
    "task",
    "result",
    "objection",
    "closeout",
    "directive",
  ] as const,
);

export type AgentBusMessageType = typeof AGENT_BUS_MESSAGE_TYPES[number];

export type AgentBusEventType = string;

export type AgentBusJsonPrimitive = string | number | boolean | null;
export type AgentBusJsonValue =
  | AgentBusJsonPrimitive
  | AgentBusJsonValue[]
  | { readonly [key: string]: AgentBusJsonValue };
export type AgentBusMetadata = Record<string, AgentBusJsonValue>;

export type AgentBusConfig = {
  enabled: boolean;
  transport: "supabase";
  realtimeWakeup: boolean;
};

export type AgentBusTeam = {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
};

export type AgentBusMemberRole = "owner" | "operator" | "viewer";

export type AgentBusMember = {
  id: string;
  teamId: string;
  userId: string;
  role: AgentBusMemberRole;
  createdAt: string;
};

export type AgentBusIdentityStatus = "idle" | "active" | "blocked" | "offline";

export type AgentBusIdentity = {
  id: string;
  teamId: string;
  agentName: string;
  agentRole: string;
  provider?: string;
  model?: string;
  runtimeType: string;
  status: AgentBusIdentityStatus;
  claimedByUserId?: string;
  lastSeenAt?: string;
  createdAt: string;
};

export type AgentBusRunStatus =
  | "pending"
  | "running"
  | "blocked"
  | "completed"
  | "failed_closed";

export type AgentBusRun = {
  id: string;
  teamId: string;
  commanderAgentId?: string;
  routingMode: "direct" | "agent_chat";
  status: AgentBusRunStatus;
  budgetLimitUsd?: number;
  startedAt: string;
  completedAt?: string;
  metadata: AgentBusMetadata;
};

export type AgentBusMessage = {
  id: string;
  teamId: string;
  runId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  messageType: AgentBusMessageType;
  body: string;
  metadata: AgentBusMetadata;
  createdAt: string;
  deliveredAt?: string;
  readAt?: string;
};

export type AgentBusEvent = {
  id: string;
  teamId: string;
  runId?: string;
  agentId?: string;
  eventType: AgentBusEventType;
  payload: AgentBusMetadata;
  createdAt: string;
};

export type AgentBusDirective =
  | {
    type: "spawn_agent";
    role: string;
    provider?: string;
    reason: string;
  }
  | {
    type: "start_monitor";
    teamId: string;
    agentId: string;
  }
  | {
    type: "missing_dependency";
    dependency: string;
    reason: string;
  }
  | {
    type: `custom.${string}`;
    reason?: string;
    [key: string]: AgentBusJsonValue | undefined;
  };

export type AgentBusSendMessageInput = {
  teamId: string;
  runId?: string;
  fromAgentId?: string;
  toAgentId?: string;
  messageType?: AgentBusMessageType;
  body: string;
  metadata?: Record<string, unknown>;
};

export type AgentBusRecordEventInput = {
  teamId: string;
  runId?: string;
  agentId?: string;
  eventType: AgentBusEventType;
  payload?: Record<string, unknown>;
};

export type AgentBusHistoryQuery = {
  teamId: string;
  runId?: string;
  limit?: number;
};

export type AgentBusUnreadQuery = {
  teamId: string;
  agentId: string;
  limit?: number;
};

export type AgentBusStore = {
  sendMessage(input: AgentBusSendMessageInput): Promise<AgentBusMessage>;
  unread(input: AgentBusUnreadQuery): Promise<AgentBusMessage[]>;
  markRead(messageId: string): Promise<void>;
  history(input: AgentBusHistoryQuery): Promise<AgentBusMessage[]>;
  recordEvent(input: AgentBusRecordEventInput): Promise<AgentBusEvent>;
};
