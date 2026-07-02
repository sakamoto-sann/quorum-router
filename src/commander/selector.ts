import { failClosed } from "../errors.ts";
import {
  createDefaultProviderCapabilityRegistry,
  providerDescriptorKey,
} from "../policy/provider-registry.ts";
import type { ProviderDescriptor } from "../schemas.ts";
import type {
  CommanderConfig,
  CommanderDescriptor,
  CommanderSelectionInput,
  CommanderSelectionResult,
} from "./types.ts";

function commanderDescriptor(config: CommanderConfig): CommanderDescriptor {
  return {
    role: "commander",
    mode: config.enabled ? config.mode : "disabled",
    selectionStrategy: config.selectionStrategy,
    provider: config.provider,
    model: config.model,
    authMode: config.authMode,
    transport: config.transport,
    client: config.client,
    local: config.local,
  };
}

function isLocalCommanderPlaceholder(config: CommanderConfig): boolean {
  return config.local === true && config.provider === "Local" &&
    config.authMode === "local" && config.transport === "localModel";
}

function hasAnyLocalCommanderShape(config: CommanderConfig): boolean {
  return config.local === true || config.provider === "Local" ||
    config.authMode === "local" || config.transport === "localModel";
}

function requireExplicitDescriptor(
  config: CommanderConfig,
): ProviderDescriptor {
  const missing = [
    ["provider", config.provider],
    ["model", config.model],
    ["authMode", config.authMode],
    ["transport", config.transport],
    ["client", config.client],
  ].filter(([, value]) => value === undefined || value === "").map(([key]) =>
    key
  );

  if (missing.length > 0) {
    failClosed(
      4400,
      "commander_explicit_descriptor_incomplete",
      "Explicit commander selection requires provider, model, authMode, transport, and client unless it is a local placeholder.",
      { missing },
    );
  }

  if (config.authMode === "local" || config.transport === "localModel") {
    failClosed(
      4400,
      "commander_local_placeholder_invalid",
      "Local commander placeholder must use provider=Local, authMode=local, transport=localModel, and local=true.",
      {
        provider: config.provider,
        model: config.model,
        authMode: config.authMode,
        transport: config.transport,
        local: config.local,
      },
    );
  }

  return {
    provider: config.provider!,
    model: config.model!,
    authMode: config.authMode as ProviderDescriptor["authMode"],
    transport: config.transport as ProviderDescriptor["transport"],
    client: config.client!,
  };
}

function validateExplicitNonLocalCommander(
  input: CommanderSelectionInput,
): ProviderDescriptor {
  const registry = input.providerRegistry ??
    createDefaultProviderCapabilityRegistry();
  const descriptor = requireExplicitDescriptor(input.commander);
  const capability = registry.get(descriptor);
  if (!capability) {
    failClosed(
      4400,
      "invalid_commander_selection",
      "Explicit commander provider/model/client combination is not registered.",
      {
        provider: descriptor.provider,
        model: descriptor.model,
        authMode: descriptor.authMode,
        transport: descriptor.transport,
        client: descriptor.client,
        key: providerDescriptorKey(descriptor),
      },
    );
  }
  if (!capability.enabled || !capability.supportsSynthesis) {
    failClosed(
      4401,
      "commander_provider_not_synthesis_capable",
      "Explicit commander selection for direct_synthesis requires an enabled synthesis-capable provider descriptor.",
      {
        provider: descriptor.provider,
        model: descriptor.model,
        enabled: capability.enabled,
        supportsSynthesis: capability.supportsSynthesis,
      },
    );
  }
  return descriptor;
}

function firstEligibleSynthesisCandidate(
  input: CommanderSelectionInput,
): ProviderDescriptor | undefined {
  const registry = input.providerRegistry ??
    createDefaultProviderCapabilityRegistry();
  return input.synthesisCandidates.find((descriptor) => {
    const capability = registry.get(descriptor);
    return capability?.enabled === true &&
      capability.supportsSynthesis === true;
  });
}

type ScoredCommanderCandidate = {
  descriptor: ProviderDescriptor;
  score: number;
  cost: number;
  key: string;
};

function highestCapabilityCandidate(
  input: CommanderSelectionInput,
): ProviderDescriptor | undefined {
  const registry = input.providerRegistry ??
    createDefaultProviderCapabilityRegistry();
  const scored: ScoredCommanderCandidate[] = [];
  for (const descriptor of input.synthesisCandidates) {
    const capability = registry.get(descriptor);
    if (!capability?.enabled || !capability.supportsSynthesis) {
      continue;
    }
    scored.push({
      descriptor,
      score: (capability.supportsSynthesis ? 100 : 0) +
        (capability.supportsStructuredJson ? 10 : 0) +
        (capability.enabled ? 1 : 0),
      cost: capability.estimatedCostUsd ?? Number.POSITIVE_INFINITY,
      key: providerDescriptorKey(descriptor),
    });
  }
  scored.sort((a, b) =>
    b.score - a.score || a.cost - b.cost || a.key.localeCompare(b.key)
  );
  return scored[0]?.descriptor;
}

export function selectCommander(
  input: CommanderSelectionInput,
): CommanderSelectionResult {
  const commander = commanderDescriptor(input.commander);
  if (!input.commander.enabled) {
    return {
      selected: false,
      reason: "commander disabled; no production routing effect",
      commander,
    };
  }

  if (input.commander.mode === "agent_chat_future") {
    return {
      selected: false,
      reason:
        "agent_chat commander is future-only and not production-connected",
      commander,
    };
  }

  if (input.commander.selectionStrategy === "explicit") {
    if (isLocalCommanderPlaceholder(input.commander)) {
      return {
        selected: true,
        reason:
          "local commander placeholder accepted as config contract only; no local runtime is implemented",
        commander,
      };
    }
    if (hasAnyLocalCommanderShape(input.commander)) {
      failClosed(
        4400,
        "invalid_commander_local_placeholder",
        "Local commander placeholder must use provider=Local, authMode=local, transport=localModel, and local=true.",
        {
          provider: input.commander.provider,
          model: input.commander.model,
          authMode: input.commander.authMode,
          transport: input.commander.transport,
          local: input.commander.local,
        },
      );
    }
    const descriptor = validateExplicitNonLocalCommander(input);
    return {
      selected: true,
      reason: "explicit synthesis-capable commander descriptor selected",
      descriptor,
      commander,
    };
  }

  if (hasAnyLocalCommanderShape(input.commander)) {
    failClosed(
      4400,
      "commander_local_requires_explicit_selection",
      "Local commander placeholders require explicit selection.",
      {
        selectionStrategy: input.commander.selectionStrategy,
        provider: input.commander.provider,
        model: input.commander.model,
        authMode: input.commander.authMode,
        transport: input.commander.transport,
        local: input.commander.local,
      },
    );
  }

  const descriptor =
    input.commander.selectionStrategy === "first_eligible_synthesis"
      ? firstEligibleSynthesisCandidate(input)
      : highestCapabilityCandidate(input);

  if (!descriptor) {
    return {
      selected: false,
      reason: "no enabled synthesis-capable commander candidate found",
      commander,
    };
  }

  return {
    selected: true,
    reason:
      `${input.commander.selectionStrategy} commander descriptor selected`,
    descriptor,
    commander,
  };
}
