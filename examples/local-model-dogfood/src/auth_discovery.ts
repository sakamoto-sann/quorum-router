import { envFallbackEntry, LOCAL_PROVIDER_SPECS } from "./provider_registry.ts";
import {
  type AuthMode,
  type ModelInventory,
  type ModelInventoryEntry,
  parseAuthMode,
} from "./schema.ts";

export function commandExists(command: string): boolean {
  const path = Deno.env.get("PATH") ?? "";
  const sep = Deno.build.os === "windows" ? ";" : ":";
  const exts = Deno.build.os === "windows"
    ? (Deno.env.get("PATHEXT") ?? ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const dir of path.split(sep)) {
    if (!dir) continue;
    for (const ext of exts) {
      try {
        const stat = Deno.statSync(`${dir}/${command}${ext}`);
        if (!stat.isFile) continue;
        if (Deno.build.os === "windows" || ((stat.mode ?? 0) & 0o111) !== 0) {
          return true;
        }
      } catch { /* keep scanning */ }
    }
  }
  return false;
}

export function envFallbackConfigured(): boolean {
  return Boolean(
    Deno.env.get("FUSION_ROUTER_PROVIDER_BASE_URL")?.trim() &&
      Deno.env.get("FUSION_ROUTER_PROVIDER_API_KEY")?.trim() &&
      Deno.env.get("FUSION_ROUTER_PROVIDER_MODEL")?.trim(),
  );
}

function includeForMode(entryAuth: string, mode: AuthMode): boolean {
  if (mode === "auto") return entryAuth !== "env";
  if (mode === "wrapper") {
    return entryAuth === "oauth" || entryAuth === "session";
  }
  if (mode === "oauth") return entryAuth === "oauth";
  return entryAuth === "env";
}

export function discoverInventory(
  mode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE")),
): ModelInventory {
  const entries: ModelInventoryEntry[] = [];
  for (const spec of LOCAL_PROVIDER_SPECS) {
    if (!includeForMode(spec.auth_mode, mode)) continue;
    const exists = spec.command ? commandExists(spec.command) : false;
    entries.push({
      provider: spec.provider,
      auth_mode: spec.auth_mode,
      model: spec.model,
      model_id: spec.model_id,
      source: spec.source,
      available: exists,
      blocked_reason: exists
        ? undefined
        : `missing local command: ${spec.command}`,
      can_list_models: spec.can_list_models,
      can_invoke: exists,
      command: spec.command,
      args_template: spec.args_template,
      notes: exists
        ? [
          ...spec.notes,
          "Command exists; actual auth is verified only during explicit opt-in invocation.",
        ]
        : spec.notes,
    });
  }

  const fallback = envFallbackEntry(envFallbackConfigured());
  if (mode === "env") {
    entries.push(fallback);
  } else if (mode === "auto") {
    // Report but do not silently use env fallback in auto mode.
    entries.push({
      ...fallback,
      available: false,
      can_invoke: false,
      blocked_reason: fallback.available
        ? "env fallback configured but not used unless FUSION_ROUTER_AUTH_MODE=env"
        : fallback.blocked_reason,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    auth_mode: mode,
    entries,
    available_count: entries.filter((entry) => entry.available).length,
    blocked_count: entries.filter((entry) => !entry.available).length,
    env_fallback_configured: envFallbackConfigured(),
    env_fallback_used: mode === "env" && envFallbackConfigured(),
  };
}

export function invokableEntries(
  inventory: ModelInventory,
): ModelInventoryEntry[] {
  return inventory.entries.filter((entry) =>
    entry.available && entry.can_invoke
  );
}
