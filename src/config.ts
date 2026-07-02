import { z } from "zod";
import { failClosed } from "./errors.ts";
import { parseRoutingMode, type RoutingMode } from "./routing-mode.ts";
import {
  type SetupAdaptiveDirect,
  SetupAdaptiveDirectSchema,
  type SetupPersistence,
  SetupPersistenceSchema,
  type SetupProfileName,
  SetupProfileNameSchema,
  type SetupProviderSelection,
  SetupProviderSelectionSchema,
  type SetupTelemetry,
  SetupTelemetrySchema,
} from "./setup/setup-schema.ts";

export type FusionRouterConfig = {
  routingMode?: RoutingMode;
  setupProfile?: SetupProfileName;
  providers?: SetupProviderSelection[];
  persistence?: SetupPersistence;
  telemetry?: SetupTelemetry;
  adaptiveDirect?: SetupAdaptiveDirect;
};

export const FusionRouterConfigFileSchema = z.object({
  profile: SetupProfileNameSchema.optional(),
  routing: z.object({
    mode: z.unknown().optional(),
  }).strict().optional(),
  providers: z.array(SetupProviderSelectionSchema).optional(),
  persistence: SetupPersistenceSchema.optional(),
  telemetry: SetupTelemetrySchema.optional(),
  adaptiveDirect: SetupAdaptiveDirectSchema.optional(),
  setup: z.object({
    generatedBy: z.literal("fusion-router setup").optional(),
    warnings: z.array(z.string()).optional(),
    nonGoals: z.array(z.string()).optional(),
  }).strict().optional(),
}).strict();

function normalizeFusionRouterConfig(
  parsedJson: unknown,
  path: string,
): FusionRouterConfig {
  const parsedConfig = FusionRouterConfigFileSchema.safeParse(parsedJson);
  if (!parsedConfig.success) {
    failClosed(
      4400,
      "invalid_config_shape",
      "Fusion router config has an invalid shape; raw contents hidden.",
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
  };
}

export function loadFusionRouterConfigValue(
  parsedJson: unknown,
  path = "<memory>",
): FusionRouterConfig {
  return normalizeFusionRouterConfig(parsedJson, path);
}

export function loadFusionRouterConfigText(
  rawConfig: string,
  path = "<memory>",
): FusionRouterConfig {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawConfig);
  } catch {
    failClosed(
      4400,
      "invalid_config_json",
      "Fusion router config contains malformed JSON.",
      { path },
    );
  }
  return normalizeFusionRouterConfig(parsedJson, path);
}

export async function loadFusionRouterConfig(
  path: string,
): Promise<FusionRouterConfig> {
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
      "Fusion router config could not be loaded.",
      { path },
    );
  }

  return loadFusionRouterConfigText(rawConfig, path);
}
