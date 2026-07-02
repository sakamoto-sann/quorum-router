import { failClosed } from "../../errors.ts";
import {
  redactAgentChatContent,
  sanitizeAgentChatMetadata,
} from "../redaction.ts";
import {
  AGENT_BUS_MESSAGE_TYPES,
  type AgentBusEvent,
  type AgentBusHistoryQuery,
  type AgentBusIdentity,
  type AgentBusJsonValue,
  type AgentBusMessage,
  type AgentBusMessageType,
  type AgentBusMetadata,
  type AgentBusRecordEventInput,
  type AgentBusRun,
  type AgentBusSendMessageInput,
  type AgentBusStore,
  type AgentBusTeam,
  type AgentBusUnreadQuery,
} from "./types.ts";

const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|authorization|bearer|credential|password|secret|session[_-]?jwt|session|token)/i;

export type InMemoryAgentBusStoreSeed = {
  teams: AgentBusTeam[];
  identities: AgentBusIdentity[];
  runs?: AgentBusRun[];
  messages?: AgentBusMessage[];
  events?: AgentBusEvent[];
};

function failAgentBus(reason: string, detail: Record<string, unknown>): never {
  failClosed(4401, reason, "Agent bus contract validation failed.", detail);
}

function isMessageType(value: string): value is AgentBusMessageType {
  return (AGENT_BUS_MESSAGE_TYPES as readonly string[]).includes(value);
}

function boundedLimit(
  value: number | undefined,
  defaultValue: number,
  max: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (!Number.isFinite(value)) {
    return defaultValue;
  }
  return Math.min(Math.max(Math.trunc(value), 1), max);
}

function sanitizeJsonValue(
  key: string,
  value: unknown,
  extraValues: string[],
  depth = 0,
): AgentBusJsonValue {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    return redactAgentChatContent(value, extraValues);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : "[SANITIZED]";
  }
  if (typeof value === "boolean" || value === null) {
    return value;
  }
  if (depth >= 4) {
    return "[SANITIZED]";
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      sanitizeJsonValue(String(index), entry, extraValues, depth + 1)
    );
  }
  if (typeof value === "object" && value !== null) {
    const output: Record<string, AgentBusJsonValue> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      output[entryKey] = sanitizeJsonValue(
        entryKey,
        entryValue,
        extraValues,
        depth + 1,
      );
    }
    return output;
  }
  return "[SANITIZED]";
}

export function sanitizeAgentBusMetadata(
  metadata: Record<string, unknown> | undefined,
  extraValues: string[] = [],
): AgentBusMetadata {
  const shallow = sanitizeAgentChatMetadata(metadata, extraValues);
  const output: AgentBusMetadata = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    output[key] = sanitizeJsonValue(key, value, extraValues);
  }
  for (const [key, value] of Object.entries(shallow)) {
    if (!(key in output)) {
      output[key] = sanitizeJsonValue(key, value, extraValues);
    }
  }
  return output;
}

export class InMemoryAgentBusStore implements AgentBusStore {
  readonly #teams = new Map<string, AgentBusTeam>();
  readonly #identities = new Map<string, AgentBusIdentity>();
  readonly #runs = new Map<string, AgentBusRun>();
  #messages: AgentBusMessage[];
  #events: AgentBusEvent[];
  #sequence = 0;

  constructor(seed: InMemoryAgentBusStoreSeed) {
    for (const team of seed.teams) {
      this.#teams.set(team.id, { ...team });
    }
    for (const identity of seed.identities) {
      this.#assertTeam(identity.teamId);
      this.#identities.set(identity.id, { ...identity });
    }
    for (const run of seed.runs ?? []) {
      this.#assertTeam(run.teamId);
      if (run.commanderAgentId) {
        this.#assertIdentityInTeam(
          run.commanderAgentId,
          run.teamId,
          "commander",
        );
      }
      this.#runs.set(run.id, { ...run, metadata: cloneMetadata(run.metadata) });
    }
    this.#messages = (seed.messages ?? []).map((message) => ({
      ...message,
      metadata: cloneMetadata(message.metadata),
    }));
    this.#events = (seed.events ?? []).map((event) => ({
      ...event,
      payload: cloneMetadata(event.payload),
    }));
    this.#sequence = highestGeneratedSequence(this.#messages, this.#events);
  }

  async sendMessage(input: AgentBusSendMessageInput): Promise<AgentBusMessage> {
    await Promise.resolve();
    this.#assertTeam(input.teamId);
    const messageType = input.messageType ?? "text";
    if (!isMessageType(messageType)) {
      failAgentBus("agent_bus_message_type_invalid", { messageType });
    }
    if (!input.fromAgentId) {
      failAgentBus("agent_bus_sender_required", { teamId: input.teamId });
    }
    this.#assertIdentityInTeam(input.fromAgentId, input.teamId, "sender");
    if (input.toAgentId) {
      this.#assertIdentityInTeam(input.toAgentId, input.teamId, "recipient");
    }
    if (input.runId) {
      this.#assertRunInTeam(input.runId, input.teamId);
    }
    if (input.body.length === 0) {
      failAgentBus("agent_bus_body_required", { teamId: input.teamId });
    }

    const body = redactAgentChatContent(input.body);
    const message: AgentBusMessage = {
      id: this.#nextId("message"),
      teamId: input.teamId,
      ...(input.runId === undefined ? {} : { runId: input.runId }),
      fromAgentId: input.fromAgentId,
      ...(input.toAgentId === undefined ? {} : { toAgentId: input.toAgentId }),
      messageType,
      body,
      metadata: sanitizeAgentBusMetadata(input.metadata, [input.body]),
      createdAt: this.#nextTimestamp(),
    };
    this.#messages = [...this.#messages, message];
    return cloneMessage(message);
  }

  async unread(input: AgentBusUnreadQuery): Promise<AgentBusMessage[]> {
    await Promise.resolve();
    this.#assertTeam(input.teamId);
    this.#assertIdentityInTeam(input.agentId, input.teamId, "inbox");
    const limit = boundedLimit(input.limit, 50, 100);
    return this.#messages
      .filter((message) =>
        message.teamId === input.teamId &&
        message.toAgentId === input.agentId &&
        message.readAt === undefined
      )
      .sort(compareMessagesAsc)
      .slice(0, limit)
      .map(cloneMessage);
  }

  async markRead(messageId: string): Promise<void> {
    await Promise.resolve();
    const index = this.#messages.findIndex((message) =>
      message.id === messageId
    );
    if (index < 0) {
      failAgentBus("agent_bus_message_not_found", { messageId });
    }
    const message = this.#messages[index];
    this.#messages = [
      ...this.#messages.slice(0, index),
      { ...message, readAt: message.readAt ?? this.#nextTimestamp() },
      ...this.#messages.slice(index + 1),
    ];
  }

  async history(input: AgentBusHistoryQuery): Promise<AgentBusMessage[]> {
    await Promise.resolve();
    this.#assertTeam(input.teamId);
    if (input.runId) {
      this.#assertRunInTeam(input.runId, input.teamId);
    }
    const limit = boundedLimit(input.limit, 100, 500);
    return this.#messages
      .filter((message) =>
        message.teamId === input.teamId &&
        (input.runId === undefined || message.runId === input.runId)
      )
      .sort(compareMessagesAsc)
      .slice(0, limit)
      .map(cloneMessage);
  }

  async recordEvent(input: AgentBusRecordEventInput): Promise<AgentBusEvent> {
    await Promise.resolve();
    this.#assertTeam(input.teamId);
    if (input.runId) {
      this.#assertRunInTeam(input.runId, input.teamId);
    }
    if (input.agentId) {
      this.#assertIdentityInTeam(input.agentId, input.teamId, "event");
    }
    if (input.eventType.trim().length === 0) {
      failAgentBus("agent_bus_event_type_required", { teamId: input.teamId });
    }
    const event: AgentBusEvent = {
      id: this.#nextId("event"),
      teamId: input.teamId,
      ...(input.runId === undefined ? {} : { runId: input.runId }),
      ...(input.agentId === undefined ? {} : { agentId: input.agentId }),
      eventType: input.eventType,
      payload: sanitizeAgentBusMetadata(input.payload),
      createdAt: this.#nextTimestamp(),
    };
    this.#events = [...this.#events, event];
    return cloneEvent(event);
  }

  snapshotEvents(): AgentBusEvent[] {
    return this.#events.map(cloneEvent);
  }

  #assertTeam(teamId: string): void {
    if (!this.#teams.has(teamId)) {
      failAgentBus("agent_bus_team_unknown", { teamId });
    }
  }

  #assertIdentityInTeam(
    identityId: string,
    teamId: string,
    relation: string,
  ): void {
    const identity = this.#identities.get(identityId);
    if (!identity || identity.teamId !== teamId) {
      failAgentBus("agent_bus_identity_team_mismatch", {
        teamId,
        identityId,
        relation,
      });
    }
  }

  #assertRunInTeam(runId: string, teamId: string): void {
    const run = this.#runs.get(runId);
    if (!run || run.teamId !== teamId) {
      failAgentBus("agent_bus_run_team_mismatch", { teamId, runId });
    }
  }

  #nextId(kind: "message" | "event"): string {
    this.#sequence += 1;
    return `${kind}-${String(this.#sequence).padStart(6, "0")}`;
  }

  #nextTimestamp(): string {
    return new Date(Date.UTC(2026, 0, 1, 0, 0, this.#sequence)).toISOString();
  }
}

function compareMessagesAsc(a: AgentBusMessage, b: AgentBusMessage): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function cloneMessage(message: AgentBusMessage): AgentBusMessage {
  return {
    ...message,
    metadata: cloneMetadata(message.metadata),
  };
}

function cloneEvent(event: AgentBusEvent): AgentBusEvent {
  return {
    ...event,
    payload: cloneMetadata(event.payload),
  };
}

function cloneMetadata(metadata: AgentBusMetadata): AgentBusMetadata {
  const clone: AgentBusMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    clone[key] = cloneJsonValue(value);
  }
  return clone;
}

function cloneJsonValue(value: AgentBusJsonValue): AgentBusJsonValue {
  if (Array.isArray(value)) {
    return value.map(cloneJsonValue);
  }
  if (typeof value === "object" && value !== null) {
    const clone: Record<string, AgentBusJsonValue> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneJsonValue(nestedValue);
    }
    return clone;
  }
  return value;
}

function highestGeneratedSequence(
  messages: AgentBusMessage[],
  events: AgentBusEvent[],
): number {
  return Math.max(
    0,
    ...messages.map((message) => generatedSequenceValue(message.id)),
    ...events.map((event) => generatedSequenceValue(event.id)),
  );
}

function generatedSequenceValue(id: string): number {
  const match = /^(?:message|event)-(\d+)$/.exec(id);
  return match ? Number.parseInt(match[1] ?? "0", 10) : 0;
}
