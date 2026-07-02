import type { ProviderCapabilityRegistry } from "../policy/provider-registry.ts";
import type { ProviderDescriptor } from "../schemas.ts";
import type { SetupAuthMode, SetupTransport } from "../setup/setup-schema.ts";

export type CommanderRole = "commander";

export type CommanderMode =
  | "disabled"
  | "direct_synthesis"
  | "agent_chat_future";

export type CommanderSelectionStrategy =
  | "explicit"
  | "first_eligible_synthesis"
  | "highest_capability_score";

export type CommanderConfig = {
  enabled: boolean;
  mode: Exclude<CommanderMode, "disabled">;
  selectionStrategy: CommanderSelectionStrategy;
  provider?: string;
  model?: string;
  authMode?: SetupAuthMode;
  transport?: SetupTransport;
  client?: string;
  local: boolean;
};

export type CommanderDescriptor = {
  role: CommanderRole;
  mode: CommanderMode;
  selectionStrategy: CommanderSelectionStrategy;
  provider?: string;
  model?: string;
  authMode?: SetupAuthMode;
  transport?: SetupTransport;
  client?: string;
  local?: boolean;
};

export type CommanderSelectionResult = {
  selected: boolean;
  reason: string;
  descriptor?: ProviderDescriptor;
  commander: CommanderDescriptor;
};

export type CommanderSelectionInput = {
  commander: CommanderConfig;
  synthesisCandidates: ProviderDescriptor[];
  providerRegistry?: ProviderCapabilityRegistry;
};
