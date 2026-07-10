import { z } from "zod";
import { failClosed } from "./errors.ts";
import { parseRoutingMode, type RoutingMode } from "./routing-mode.ts";
import {
  CommanderConfigSchema,
  type SetupAdaptiveDirect,
  SetupAdaptiveDirectSchema,
  type SetupAgentBus,
  SetupAgentBusSchema,
  type SetupAgentRuntime,
  SetupAgentRuntimeSchema,
  type SetupCommanderConfig,
  type SetupPersistence,
  SetupPersistenceSchema,
  type SetupProfileName,
  SetupProfileNameSchema,
  type SetupProviderSelection,
  SetupProviderSelectionSchema,
  type SetupTelemetry,
  SetupTelemetrySchema,
} from "./setup/setup-schema.ts";

export type QuorumRouterConfig = {
  routingMode?: RoutingMode;
  setupProfile?: SetupProfileName;
  providers?: SetupProviderSelection[];
  persistence?: SetupPersistence;
  telemetry?: SetupTelemetry;
  adaptiveDirect?: SetupAdaptiveDirect;
  agentBus?: SetupAgentBus;
  agentRuntime?: SetupAgentRuntime;
  commander?: SetupCommanderConfig;
};

export const QuorumRouterConfigFileSchema = z.object({
  profile: SetupProfileNameSchema.optional(),
  routing: z.object({
    mode: z.unknown().optional(),
  }).strict().optional(),
  providers: z.array(SetupProviderSelectionSchema).optional(),
  persistence: SetupPersistenceSchema.optional(),
  telemetry: SetupTelemetrySchema.optional(),
  adaptiveDirect: SetupAdaptiveDirectSchema.optional(),
  agentBus: SetupAgentBusSchema.optional(),
  agentRuntime: SetupAgentRuntimeSchema.optional(),
  commander: CommanderConfigSchema.optional(),
  setup: z.object({
    generatedBy: z.enum([
      "quorum-router setup",
      "fusion-router setup",
    ]).optional(),
    warnings: z.array(z.string()).optional(),
    nonGoals: z.array(z.string()).optional(),
  }).strict().optional(),
}).strict();

function normalizeQuorumRouterConfig(
  parsedJson: unknown,
  path: string,
): QuorumRouterConfig {
  const parsedConfig = QuorumRouterConfigFileSchema.safeParse(parsedJson);
  if (!parsedConfig.success) {
    failClosed(
      4400,
      "invalid_config_shape",
      "QuorumRouter config has an invalid shape; raw contents hidden.",
      { path },
    );
  }

  const routingMode = parseRoutingMode(
    parsedConfig.data.routing?.mode,
    "config",
  )?.mode;

  return {
    ...(routingMode === undefined ? {} : { routingMode }),
    ...(parsedConfig.data.profile === undefined
      ? {}
      : { setupProfile: parsedConfig.data.profile }),
    ...(parsedConfig.data.providers === undefined
      ? {}
      : { providers: parsedConfig.data.providers }),
    ...(parsedConfig.data.persistence === undefined
      ? {}
      : { persistence: parsedConfig.data.persistence }),
    ...(parsedConfig.data.telemetry === undefined
      ? {}
      : { telemetry: parsedConfig.data.telemetry }),
    ...(parsedConfig.data.adaptiveDirect === undefined
      ? {}
      : { adaptiveDirect: parsedConfig.data.adaptiveDirect }),
    ...(parsedConfig.data.agentBus === undefined
      ? {}
      : { agentBus: parsedConfig.data.agentBus }),
    ...(parsedConfig.data.agentRuntime === undefined
      ? {}
      : { agentRuntime: parsedConfig.data.agentRuntime }),
    ...(parsedConfig.data.commander === undefined
      ? {}
      : { commander: parsedConfig.data.commander }),
  };
}

export function loadQuorumRouterConfigValue(
  parsedJson: unknown,
  path = "<memory>",
): QuorumRouterConfig {
  return normalizeQuorumRouterConfig(parsedJson, path);
}

export function loadQuorumRouterConfigText(
  rawConfig: string,
  path = "<memory>",
): QuorumRouterConfig {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawConfig);
  } catch {
    failClosed(
      4400,
      "invalid_config_json",
      "QuorumRouter config contains malformed JSON.",
      { path },
    );
  }
  return normalizeQuorumRouterConfig(parsedJson, path);
}

export async function loadQuorumRouterConfig(
  path: string,
): Promise<QuorumRouterConfig> {
  let rawConfig: string;
  try {
    rawConfig = await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {};
    }

    failClosed(
      4400,
      "config_load_failed",
      "QuorumRouter config could not be loaded.",
      { path },
    );
  }

  return loadQuorumRouterConfigText(rawConfig, path);
}

/** @deprecated Use QuorumRouterConfig. */
export type FusionRouterConfig = QuorumRouterConfig;
/** @deprecated Use QuorumRouterConfigFileSchema. */
export const FusionRouterConfigFileSchema = QuorumRouterConfigFileSchema;
/** @deprecated Use loadQuorumRouterConfigValue. */
export const loadFusionRouterConfigValue = loadQuorumRouterConfigValue;
/** @deprecated Use loadQuorumRouterConfigText. */
export const loadFusionRouterConfigText = loadQuorumRouterConfigText;
/** @deprecated Use loadQuorumRouterConfig. */
export const loadFusionRouterConfig = loadQuorumRouterConfig;
