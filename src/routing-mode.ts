import { z } from "zod";
import { failClosed } from "./errors.ts";
import { readRouterEnv } from "./env.ts";

export const RoutingModeSchema = z.enum(["direct", "agent_chat"]);
export type RoutingMode = z.infer<typeof RoutingModeSchema>;
export type ExplicitRoutingModeSource = "request" | "config" | "env";
export type RoutingModeSource = ExplicitRoutingModeSource | "default";
export type RoutingModeResolution = {
  mode: RoutingMode;
  source: RoutingModeSource;
};
export type RoutingModeDecision = RoutingModeResolution & {
  implemented: boolean;
};
export type RoutingModeResolveInput = {
  requestMode?: unknown;
  configMode?: unknown;
  envMode?: unknown;
};

export const ROUTING_MODE_ENV = "QUORUM_ROUTER_MODE";
export const ALLOWED_ROUTING_MODES = RoutingModeSchema.options;

export function parseRoutingMode(
  value: unknown,
  source: ExplicitRoutingModeSource,
): RoutingModeResolution | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    failClosed(
      4400,
      "invalid_routing_mode",
      `Invalid routing mode selected from ${source}. Allowed values: ${
        ALLOWED_ROUTING_MODES.join(
          ", ",
        )
      }.`,
      {
        source,
        allowedModes: ALLOWED_ROUTING_MODES,
        receivedType: value === null ? "null" : typeof value,
      },
    );
  }

  const parsed = RoutingModeSchema.safeParse(value.trim());
  if (!parsed.success) {
    failClosed(
      4400,
      "invalid_routing_mode",
      `Invalid routing mode selected from ${source}. Allowed values: ${
        ALLOWED_ROUTING_MODES.join(
          ", ",
        )
      }.`,
      {
        source,
        allowedModes: ALLOWED_ROUTING_MODES,
      },
    );
  }

  return { mode: parsed.data, source };
}

export function resolveRoutingMode(
  input: RoutingModeResolveInput = {},
): RoutingModeResolution {
  return parseRoutingMode(input.requestMode, "request") ??
    parseRoutingMode(input.configMode, "config") ??
    parseRoutingMode(input.envMode, "env") ??
    { mode: "direct", source: "default" };
}

export function isRoutingModeImplemented(mode: RoutingMode): boolean {
  return mode === "direct";
}

export function describeRoutingModeDecision(
  resolution: RoutingModeResolution,
): RoutingModeDecision {
  return {
    mode: resolution.mode,
    source: resolution.source,
    implemented: isRoutingModeImplemented(resolution.mode),
  };
}

export function readRoutingModeEnv(): string | undefined {
  try {
    return readRouterEnv(ROUTING_MODE_ENV);
  } catch {
    return undefined;
  }
}

export function assertImplementedRoutingMode(
  decision: RoutingModeDecision,
): void {
  if (!decision.implemented) {
    failClosed(
      4401,
      "routing_mode_not_implemented",
      "Routing mode agent_chat requires explicit experimental AgentRuntime opt-in.",
      { routingMode: decision },
    );
  }
}
