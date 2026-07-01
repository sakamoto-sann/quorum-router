import { z } from "zod";
import { failClosed } from "./errors.ts";
import { parseRoutingMode, type RoutingMode } from "./routing-mode.ts";

export type FusionRouterConfig = {
  routingMode?: RoutingMode;
};

export const FusionRouterConfigFileSchema = z.object({
  routing: z.object({
    mode: z.unknown().optional(),
  }).strict().optional(),
}).strict();

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

  const parsedConfig = FusionRouterConfigFileSchema.safeParse(parsedJson);
  if (!parsedConfig.success) {
    failClosed(
      4400,
      "invalid_config_shape",
      'Fusion router config must match { routing?: { mode?: "direct" | "agent_chat" } }.',
      { path },
    );
  }

  const routingMode = parseRoutingMode(
    parsedConfig.data.routing?.mode,
    "config",
  )?.mode;

  return routingMode === undefined ? {} : { routingMode };
}
