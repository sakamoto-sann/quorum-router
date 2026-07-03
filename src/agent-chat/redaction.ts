import type { AgentChatMessage, AgentChatMetadata } from "./types.ts";
import { redactOpaqueCredentialShapes } from "../errors.ts";

const SENSITIVE_KEY_PATTERN =
  /(api[_-]?key|authorization|bearer|credential|password|secret|session[_-]?jwt|session|token)/i;
const KEY_VALUE_PATTERN =
  /\b(api[_-]?key|authorization|bearer|credential|password|secret|session[_-]?jwt|session|token)\b\s*[:=]\s*([^\s,;\]}]+)/gi;
const JSON_KEY_VALUE_PATTERN =
  /("(?:api[_-]?key|authorization|bearer|credential|password|secret|session[_-]?jwt|session|token)"\s*:\s*")([^"]+)(")/gi;
const BEARER_PATTERN = /\bBearer\s+[-._~+/=A-Za-z0-9]+/gi;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactAgentChatContent(
  content: string,
  extraValues: string[] = [],
): string {
  let redacted = content;
  for (const value of extraValues) {
    if (!value) {
      continue;
    }
    redacted = redacted.replace(
      new RegExp(escapeRegExp(value), "g"),
      "[REDACTED]",
    );
  }

  redacted = redacted.replace(BEARER_PATTERN, "Bearer [REDACTED]");
  redacted = redacted.replace(
    JSON_KEY_VALUE_PATTERN,
    (_match, prefix: string, _value: string, suffix: string) =>
      `${prefix}[REDACTED]${suffix}`,
  );
  redacted = redacted.replace(
    KEY_VALUE_PATTERN,
    (_match, key: string) => `${key}=[REDACTED]`,
  );
  return redactOpaqueCredentialShapes(redacted);
}

export function sanitizeAgentChatMetadata(
  metadata: Record<string, unknown> | undefined,
  extraValues: string[] = [],
): AgentChatMetadata {
  const sanitized: AgentChatMetadata = {};
  if (!metadata) {
    return sanitized;
  }

  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") {
      sanitized[key] = redactAgentChatContent(value, extraValues);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[key] = value;
    } else if (typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    } else {
      sanitized[key] = "[SANITIZED]";
    }
  }
  return sanitized;
}

export function redactAgentChatMessage(
  message: Omit<AgentChatMessage, "redacted" | "metadata"> & {
    metadata?: Record<string, unknown>;
  },
  extraValues: string[] = [],
): AgentChatMessage {
  return {
    ...message,
    content: redactAgentChatContent(message.content, extraValues),
    redacted: true,
    metadata: sanitizeAgentChatMetadata(message.metadata, extraValues),
  };
}
