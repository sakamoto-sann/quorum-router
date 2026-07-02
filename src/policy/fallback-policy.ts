import { ProcessExecutionError, RouterError } from "../errors.ts";

export type SafeFallbackReason =
  | "provider_unavailable"
  | "auth_missing"
  | "circuit_open"
  | "timeout_before_model_output";

export type UnsafeFallbackReason =
  | "validation_mismatch"
  | "malformed_provider_response"
  | "consensus_validation_failure"
  | "routing_mode_invalid"
  | "agent_chat_not_implemented"
  | "audit_failure"
  | "provider_identity_mismatch"
  | "budget_exhausted"
  | "unknown";

export type FallbackReason = SafeFallbackReason | UnsafeFallbackReason;

export type FallbackPolicyDecision = {
  allowed: boolean;
  reason: FallbackReason;
};

export interface FallbackPolicy {
  decide(reason: FallbackReason): FallbackPolicyDecision;
}

const SAFE_FALLBACK_REASONS = new Set<FallbackReason>([
  "provider_unavailable",
  "auth_missing",
  "circuit_open",
  "timeout_before_model_output",
]);

export class SafeProviderUnavailableFallbackPolicy implements FallbackPolicy {
  decide(reason: FallbackReason): FallbackPolicyDecision {
    return {
      allowed: SAFE_FALLBACK_REASONS.has(reason),
      reason,
    };
  }
}

export function createSafeProviderUnavailableFallbackPolicy(): FallbackPolicy {
  return new SafeProviderUnavailableFallbackPolicy();
}

export function isFallbackAllowed(reason: FallbackReason): boolean {
  return SAFE_FALLBACK_REASONS.has(reason);
}

export type FallbackReasonContext = {
  boundary?: "provider" | "audit";
};

export function fallbackReasonFromError(
  error: unknown,
  context: FallbackReasonContext = {},
): FallbackReason {
  if (context.boundary === "audit") {
    return "audit_failure";
  }

  if (error instanceof ProcessExecutionError) {
    if (context.boundary !== "provider") {
      return "unknown";
    }

    switch (error.codeName) {
      case "command_unavailable":
        return "provider_unavailable";
      case "auth_failed":
        return "auth_missing";
      case "circuit_open":
        return "circuit_open";
      case "timeout":
        return "timeout_before_model_output";
      case "provider_malformed":
        return "malformed_provider_response";
      case "validation_mismatch":
        return "validation_mismatch";
      case "provider_identity_mismatch":
        return "provider_identity_mismatch";
      case "audit_failure":
        return "audit_failure";
      case "budget_exhausted":
        return "budget_exhausted";
      default:
        return "unknown";
    }
  }

  if (error instanceof RouterError) {
    switch (error.code) {
      case "invalid_routing_mode":
        return "routing_mode_invalid";
      case "routing_mode_not_implemented":
        return "agent_chat_not_implemented";
      case "consensus_validation_failed":
      case "consensus_insufficient":
        return "consensus_validation_failure";
      case "validation_mismatch":
        return "validation_mismatch";
      case "provider_identity_mismatch":
        return "provider_identity_mismatch";
      case "audit_failure":
        return "audit_failure";
      case "budget_exhausted":
        return "budget_exhausted";
      default:
        return "unknown";
    }
  }

  return "unknown";
}
