/**
 * Public compatibility barrel for quorum-router.
 *
 * The implementation now lives under src/ so downstream imports from
 * ./router.ts continue to work while provider, telemetry, audit, config,
 * routing-mode, and doctor work can evolve in separate modules.
 */
export * from "./src/schemas.ts";
export * from "./src/errors.ts";
export * from "./src/routing-mode.ts";
export * from "./src/env.ts";
export * from "./src/config.ts";
export * from "./src/contracts.ts";
export * from "./src/prompt-cache.ts";
export * from "./src/fusion.ts";
export * from "./src/budget/budget.ts";
export * from "./src/adapters/process.ts";
export * from "./src/adapters/direct-http.ts";
export * from "./src/telemetry/cofailure.ts";
export * from "./src/telemetry/buffered-batch-sink.ts";
export * from "./src/audit/supabase-audit.ts";
export * from "./src/policy/provider-registry.ts";
export * from "./src/policy/direct-routing-policy.ts";
export * from "./src/policy/fallback-policy.ts";
export * from "./src/setup/index.ts";
export * from "./src/commander/index.ts";
export * from "./src/agent-chat/index.ts";
export * from "./src/agent-runtime/index.ts";
export * from "./src/calibration/calibration.ts";
export * from "./src/ensemble/quality.ts";
export * from "./src/router.ts";
export * from "./src/runtime.ts";

if (import.meta.main) {
  const runtime = await import("./src/runtime.ts");
  await runtime.runDefaultRouterSmoke();
}
