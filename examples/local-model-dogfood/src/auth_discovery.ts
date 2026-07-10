import {
  envFallbackEntry,
  LOCAL_PROVIDER_SPECS,
  type ProviderSpec,
} from "./provider_registry.ts";
import { redact, summarize } from "./redact.ts";
import { readRouterEnv } from "./env.ts";
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
    readRouterEnv("QUORUM_ROUTER_PROVIDER_BASE_URL")?.trim() &&
      readRouterEnv("QUORUM_ROUTER_PROVIDER_API_KEY")?.trim() &&
      readRouterEnv("QUORUM_ROUTER_PROVIDER_MODEL")?.trim(),
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

function specKey(spec: ProviderSpec): string {
  return `${spec.provider}\u0000${spec.model_id}`;
}

function specForEntry(entry: ModelInventoryEntry): ProviderSpec | undefined {
  return LOCAL_PROVIDER_SPECS.find((spec) =>
    specKey(spec) === `${entry.provider}\u0000${entry.model_id}`
  );
}

export function discoverInventory(
  mode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE")),
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
      can_list_models: false,
      list_blocked_reason: spec.list_blocked_reason ??
        (spec.list_models_args
          ? "model listing not run in sync inventory path"
          : "no safe non-interactive model list command configured"),
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
        ? "env fallback configured but not used unless QUORUM_ROUTER_AUTH_MODE=env"
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

async function outputWithTimeout(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<Deno.CommandOutput> {
  const child = new Deno.Command(command, {
    args,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let killId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      child.output(),
      new Promise<Deno.CommandOutput>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            child.kill("SIGTERM");
          } catch { /* best effort */ }
          killId = setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch { /* best effort */ }
            reject(new Error("model listing timed out"));
          }, 1_000);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (killId) clearTimeout(killId);
  }
}

export function parseGrokModelList(output: string): string[] {
  const models = new Set<string>();
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^(?:[*-])\s+([^\s(]+)(?:\s+\(default\))?$/);
    if (match) models.add(match[1]);
  }
  return [...models].sort();
}

async function enrichModelListing(
  entry: ModelInventoryEntry,
): Promise<ModelInventoryEntry> {
  const spec = specForEntry(entry);
  if (!entry.available || !entry.command || !spec?.list_models_args) {
    return entry;
  }
  try {
    const output = await outputWithTimeout(
      entry.command,
      spec.list_models_args,
      10_000,
    );
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    if (output.code !== 0) {
      return {
        ...entry,
        can_list_models: false,
        list_blocked_reason: summarize(redact(stderr || stdout), 300),
      };
    }
    const listedModels = entry.provider === "xAI"
      ? parseGrokModelList(stdout)
      : [];
    return {
      ...entry,
      can_list_models: listedModels.length > 0,
      listed_models: listedModels,
      list_blocked_reason: listedModels.length > 0
        ? undefined
        : "model list command succeeded but no model ids were parsed",
      notes: listedModels.length > 0
        ? [
          ...entry.notes,
          `Listed ${listedModels.length} model(s) via safe list-only command.`,
        ]
        : entry.notes,
    };
  } catch (error) {
    return {
      ...entry,
      can_list_models: false,
      list_blocked_reason: summarize(
        redact(error instanceof Error ? error.message : String(error)),
        300,
      ),
    };
  }
}

export async function discoverInventoryWithModelListing(
  mode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE")),
): Promise<ModelInventory> {
  const inventory = discoverInventory(mode);
  const entries = await Promise.all(inventory.entries.map(enrichModelListing));
  return {
    ...inventory,
    entries,
  };
}

export function invokableEntries(
  inventory: ModelInventory,
): ModelInventoryEntry[] {
  return inventory.entries.filter((entry) =>
    entry.available && entry.can_invoke
  );
}
