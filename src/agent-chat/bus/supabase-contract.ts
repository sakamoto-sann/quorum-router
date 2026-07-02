import type {
  AgentBusConfig,
  AgentBusEvent,
  AgentBusMessage,
  AgentBusMessageType,
  AgentBusMetadata,
  AgentBusRecordEventInput,
  AgentBusSendMessageInput,
} from "./types.ts";

export const AGENT_BUS_RPC = Object.freeze(
  {
    sendMessage: "fusion_agent_send_message",
    markMessageRead: "fusion_agent_mark_message_read",
    unreadMessages: "fusion_agent_unread_messages",
    history: "fusion_agent_history",
    recordEvent: "fusion_agent_record_event",
  } as const,
);

export const DEFAULT_AGENT_BUS_CONFIG: AgentBusConfig = Object.freeze({
  enabled: false,
  transport: "supabase",
  realtimeWakeup: false,
});

export type SupabaseAgentBusMessageRow = {
  id: string;
  team_id: string;
  run_id: string | null;
  from_agent_id: string | null;
  to_agent_id: string | null;
  message_type: AgentBusMessageType;
  body: string;
  metadata: AgentBusMetadata;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
};

export type SupabaseAgentBusEventRow = {
  id: string;
  team_id: string;
  run_id: string | null;
  agent_id: string | null;
  event_type: string;
  payload: AgentBusMetadata;
  created_at: string;
};

export type SupabaseAgentBusSendMessageRpcArgs = {
  p_team_id: string;
  p_run_id: string | null;
  p_from_agent_id: string | null;
  p_to_agent_id: string | null;
  p_message_type: AgentBusMessageType;
  p_body: string;
  p_metadata: Record<string, unknown>;
};

export type SupabaseAgentBusRecordEventRpcArgs = {
  p_team_id: string;
  p_run_id: string | null;
  p_agent_id: string | null;
  p_event_type: string;
  p_payload: Record<string, unknown>;
};

export function toSupabaseSendMessageRpcArgs(
  input: AgentBusSendMessageInput,
): SupabaseAgentBusSendMessageRpcArgs {
  return {
    p_team_id: input.teamId,
    p_run_id: input.runId ?? null,
    p_from_agent_id: input.fromAgentId ?? null,
    p_to_agent_id: input.toAgentId ?? null,
    p_message_type: input.messageType ?? "text",
    p_body: input.body,
    p_metadata: input.metadata ?? {},
  };
}

export function toSupabaseRecordEventRpcArgs(
  input: AgentBusRecordEventInput,
): SupabaseAgentBusRecordEventRpcArgs {
  return {
    p_team_id: input.teamId,
    p_run_id: input.runId ?? null,
    p_agent_id: input.agentId ?? null,
    p_event_type: input.eventType,
    p_payload: input.payload ?? {},
  };
}

export function fromSupabaseMessageRow(
  row: SupabaseAgentBusMessageRow,
): AgentBusMessage {
  return {
    id: row.id,
    teamId: row.team_id,
    ...(row.run_id === null ? {} : { runId: row.run_id }),
    ...(row.from_agent_id === null ? {} : { fromAgentId: row.from_agent_id }),
    ...(row.to_agent_id === null ? {} : { toAgentId: row.to_agent_id }),
    messageType: row.message_type,
    body: row.body,
    metadata: row.metadata,
    createdAt: row.created_at,
    ...(row.delivered_at === null ? {} : { deliveredAt: row.delivered_at }),
    ...(row.read_at === null ? {} : { readAt: row.read_at }),
  };
}

export function fromSupabaseEventRow(
  row: SupabaseAgentBusEventRow,
): AgentBusEvent {
  return {
    id: row.id,
    teamId: row.team_id,
    ...(row.run_id === null ? {} : { runId: row.run_id }),
    ...(row.agent_id === null ? {} : { agentId: row.agent_id }),
    eventType: row.event_type,
    payload: row.payload,
    createdAt: row.created_at,
  };
}
