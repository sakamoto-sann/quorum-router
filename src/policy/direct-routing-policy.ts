import type { BudgetManager } from "../budget/budget.ts";
import type { ProviderDescriptor } from "../schemas.ts";
import {
  createDefaultProviderCapabilityRegistry,
  type ProviderCapability,
  ProviderCapabilityRegistry,
} from "./provider-registry.ts";

export type ProviderReadinessHint = {
  authReady?: boolean;
  transportReady?: boolean;
  circuitOpen?: boolean;
  reason?: string;
};

export type DirectRoutingDecision = {
  mode: "direct";
  selectedAdapters: ProviderDescriptor[];
  rejectedAdapters: Array<{
    descriptor: ProviderDescriptor;
    reason: string;
  }>;
  synthesis: ProviderDescriptor;
  budgetEstimatedUsd?: number;
  fallbackPolicy: "disabled" | "safe_provider_unavailable_only";
};

export type DirectRoutingPolicyInput = {
  candidates: ProviderDescriptor[];
  synthesisCandidates: ProviderDescriptor[];
  providerRegistry?: ProviderCapabilityRegistry;
  readinessHints?:
    | Map<string, ProviderReadinessHint>
    | Record<string, ProviderReadinessHint>;
  budgetManager?: BudgetManager;
};

export interface DirectRoutingPolicy {
  decide(input: DirectRoutingPolicyInput): DirectRoutingDecision;
}

export type CapabilityDirectRoutingPolicyOptions = {
  fallbackPolicy?: DirectRoutingDecision["fallbackPolicy"];
};

function descriptorLabel(descriptor: ProviderDescriptor): string {
  return `${descriptor.provider}/${descriptor.model}`;
}

function readinessKey(descriptor: ProviderDescriptor): string {
  return [
    descriptor.provider,
    descriptor.model,
    descriptor.authMode,
    descriptor.transport,
    descriptor.client ?? "",
  ].map((part) => part.toLowerCase()).join("\u0000");
}

function lookupReadinessHint(
  hints: DirectRoutingPolicyInput["readinessHints"],
  descriptor: ProviderDescriptor,
): ProviderReadinessHint | undefined {
  if (!hints) {
    return undefined;
  }
  const key = readinessKey(descriptor);
  if (hints instanceof Map) {
    return hints.get(key) ?? hints.get(descriptorLabel(descriptor));
  }
  return hints[key] ?? hints[descriptorLabel(descriptor)];
}

function readinessRejectionReason(
  descriptor: ProviderDescriptor,
  hint: ProviderReadinessHint | undefined,
): string | undefined {
  if (!hint) {
    return undefined;
  }
  if (hint.authReady === false) {
    return hint.reason ?? `auth not ready for ${descriptorLabel(descriptor)}`;
  }
  if (hint.transportReady === false) {
    return hint.reason ??
      `transport not ready for ${descriptorLabel(descriptor)}`;
  }
  if (hint.circuitOpen === true) {
    return hint.reason ?? `circuit open for ${descriptorLabel(descriptor)}`;
  }
  return undefined;
}

function capabilityRejectionReason(
  descriptor: ProviderDescriptor,
  capability: ProviderCapability | undefined,
): string | undefined {
  if (!capability) {
    return `missing capability for ${descriptorLabel(descriptor)}`;
  }
  if (!capability.enabled) {
    return `provider disabled for ${descriptorLabel(descriptor)}`;
  }
  if (
    capability.authMode !== descriptor.authMode ||
    capability.transport !== descriptor.transport ||
    capability.client !== descriptor.client
  ) {
    return `capability descriptor mismatch for ${descriptorLabel(descriptor)}`;
  }
  return undefined;
}

function estimatedCost(capability: ProviderCapability | undefined): number {
  return capability?.estimatedCostUsd ?? 0;
}

export class CapabilityDirectRoutingPolicy implements DirectRoutingPolicy {
  private readonly fallbackPolicy: DirectRoutingDecision["fallbackPolicy"];

  constructor(options: CapabilityDirectRoutingPolicyOptions = {}) {
    this.fallbackPolicy = options.fallbackPolicy ??
      "safe_provider_unavailable_only";
  }

  decide(input: DirectRoutingPolicyInput): DirectRoutingDecision {
    if (input.synthesisCandidates.length === 0) {
      throw new Error(
        "Direct routing policy requires at least one synthesis candidate.",
      );
    }

    const registry = input.providerRegistry ??
      createDefaultProviderCapabilityRegistry();
    const rejectedAdapters: DirectRoutingDecision["rejectedAdapters"] = [];
    const selectedAdapters: ProviderDescriptor[] = [];
    const budgetSnapshot = input.budgetManager?.snapshot();
    const budgetLimit = budgetSnapshot?.remainingUsd;
    let budgetEstimatedUsd = 0;

    const synthesis = this.selectSynthesisCandidate(
      input.synthesisCandidates,
      registry,
      input.readinessHints,
    );
    const synthesisCost = estimatedCost(registry.require(synthesis));
    if (
      budgetLimit !== undefined &&
      synthesisCost > budgetLimit + 1e-9
    ) {
      throw new Error(
        `Direct routing policy synthesis candidate exceeds remaining budget for ${
          descriptorLabel(synthesis)
        }`,
      );
    }
    budgetEstimatedUsd += synthesisCost;

    for (const descriptor of input.candidates) {
      const capability = registry.get(descriptor);
      const capabilityReason = capabilityRejectionReason(
        descriptor,
        capability,
      );
      if (capabilityReason) {
        rejectedAdapters.push({ descriptor, reason: capabilityReason });
        continue;
      }

      const readinessReason = readinessRejectionReason(
        descriptor,
        lookupReadinessHint(input.readinessHints, descriptor),
      );
      if (readinessReason) {
        rejectedAdapters.push({ descriptor, reason: readinessReason });
        continue;
      }

      const cost = estimatedCost(capability);
      if (
        budgetLimit !== undefined &&
        budgetEstimatedUsd + cost > budgetLimit + 1e-9
      ) {
        rejectedAdapters.push({
          descriptor,
          reason: `budget estimate exceeds remaining budget for ${
            descriptorLabel(descriptor)
          }`,
        });
        continue;
      }

      budgetEstimatedUsd += cost;
      selectedAdapters.push(descriptor);
    }

    return {
      mode: "direct",
      selectedAdapters,
      rejectedAdapters,
      synthesis,
      budgetEstimatedUsd,
      fallbackPolicy: this.fallbackPolicy,
    };
  }

  private selectSynthesisCandidate(
    candidates: ProviderDescriptor[],
    registry: ProviderCapabilityRegistry,
    hints: DirectRoutingPolicyInput["readinessHints"],
  ): ProviderDescriptor {
    for (const descriptor of candidates) {
      const capability = registry.get(descriptor);
      if (capabilityRejectionReason(descriptor, capability)) {
        continue;
      }
      if (!capability?.supportsSynthesis) {
        continue;
      }
      if (
        readinessRejectionReason(
          descriptor,
          lookupReadinessHint(hints, descriptor),
        )
      ) {
        continue;
      }
      return descriptor;
    }

    throw new Error(
      "Direct routing policy requires an enabled synthesis candidate with supportsSynthesis=true.",
    );
  }
}

export function createCapabilityDirectRoutingPolicy(
  options: CapabilityDirectRoutingPolicyOptions = {},
): DirectRoutingPolicy {
  return new CapabilityDirectRoutingPolicy(options);
}
