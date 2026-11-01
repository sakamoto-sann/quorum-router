import { z } from "zod";
import type { ModelInventory, ModelInventoryEntry } from "./schema.ts";

export const MODEL_PROVIDER_KEYS = [
  "codex",
  "claude",
  "gemini",
  "grok",
  "devin",
  "qwen",
] as const;
export type ModelProviderKey = typeof MODEL_PROVIDER_KEYS[number];

export const VERSIONED_MODEL_HINTS = {
  schemaVersion: "quorum-router.model-hints.v1",
  catalogVersion: "2026-11-02",
  updatedAt: "2026-11-02T00:00:00.000Z",
  providers: {
    codex: ["gpt-5.4", "gpt-5.4-mini", "gpt-5.6-sol"],
    claude: ["claude-sonnet-5-5", "claude-opus-5-5"],
    gemini: ["gemini-3.1-pro-preview", "gemini-3.8-flash"],
    grok: ["grok-4.5", "grok-composer-2.5-fast"],
    devin: ["claude-sonnet-5-5", "claude-opus-5-5", "codex"],
    qwen: ["qwen3-coder-max"],
  } satisfies Record<ModelProviderKey, readonly string[]>,
} as const;

const PROVIDER_BY_COMMAND: Record<string, ModelProviderKey> = {
  codex: "codex",
  claude: "claude",
  gemini: "gemini",
  grok: "grok",
  devin: "devin",
  qwen: "qwen",
};

const ModelIdSchema = z.string().min(1).max(120).regex(
  /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/,
  "model id contains unsupported characters",
);
const ProviderKeySchema = z.enum(MODEL_PROVIDER_KEYS);
const ExplicitConfigSchema = z.object({
  schema_version: z.literal("quorum-router.model-config.v1"),
  providers: z.record(ProviderKeySchema, z.array(ModelIdSchema).max(50)),
}).strict();
const VerifiedRecordSchema = z.object({
  providerKey: ProviderKeySchema,
  provider: z.string().min(1).max(80),
  wrapper: z.string().min(1).max(80),
  wrapperPath: z.string().min(1).max(1000),
  wrapperFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  model: ModelIdSchema,
  authMode: z.enum(["oauth", "session", "env"]),
  verifiedAt: z.string().datetime(),
}).strict();
const VerifiedCacheSchema = z.object({
  schema_version: z.literal("quorum-router.verified-model-cache.v3"),
  records: z.array(VerifiedRecordSchema).max(500),
}).strict();
const LegacyVerifiedCacheSchema = z.object({
  schema_version: z.enum([
    "quorum-router.verified-model-cache.v1",
    "quorum-router.verified-model-cache.v2",
  ]),
  records: z.array(z.unknown()).max(500),
}).strict();

export type ExplicitModelConfig = z.infer<typeof ExplicitConfigSchema>;
export type VerifiedModelRecord = z.infer<typeof VerifiedRecordSchema>;
export type ModelCatalogStatus =
  | "verified"
  | "stale"
  | "listed"
  | "configured"
  | "hinted";
export type ModelCatalogSource =
  | "verified_cache"
  | "provider_catalog"
  | "explicit_config"
  | "versioned_hint";
export type CatalogModel = {
  model: string;
  status: ModelCatalogStatus;
  sources: ModelCatalogSource[];
  verifiedAt?: string;
};
export type ProviderCatalog = {
  providerKey: ModelProviderKey;
  provider: string;
  wrapper: string;
  authMode: string;
  wrapperState: "found" | "missing";
  canInvoke: boolean;
  catalogState: "listed" | "not_exposed" | "wrapper_missing";
  models: CatalogModel[];
  detail: string;
};
export type ModelCatalogReport = {
  generatedAt: string;
  hintCatalog: {
    schemaVersion: typeof VERSIONED_MODEL_HINTS.schemaVersion;
    catalogVersion: string;
    updatedAt: string;
  };
  providers: ProviderCatalog[];
};

function defaultConfig(): ExplicitModelConfig {
  return {
    schema_version: "quorum-router.model-config.v1",
    providers: {},
  };
}

async function readJsonIfPresent(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await Deno.readTextFile(path));
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    if (error instanceof SyntaxError) {
      throw new Error(`invalid JSON in ${path}`);
    }
    throw error;
  }
}

async function atomicJsonWrite(path: string, value: unknown): Promise<void> {
  const separator = path.lastIndexOf("/");
  const dir = separator >= 0 ? path.slice(0, separator) || "/" : ".";
  await Deno.mkdir(dir, { recursive: true, mode: 0o700 });
  const temp = `${path}.tmp-${crypto.randomUUID()}`;
  try {
    await Deno.writeTextFile(temp, `${JSON.stringify(value, null, 2)}\n`, {
      mode: 0o600,
    });
    await Deno.rename(temp, path);
    if (Deno.build.os !== "windows") await Deno.chmod(path, 0o600);
  } finally {
    await Deno.remove(temp).catch(() => undefined);
  }
}

export function defaultModelConfigPath(): string {
  const override = Deno.env.get("QUORUM_ROUTER_MODEL_CONFIG")?.trim();
  if (override) return override;
  const home = Deno.env.get("HOME")?.trim();
  if (!home) throw new Error("HOME is required to resolve model config path");
  return `${home}/.config/quorum-router/models.json`;
}

export function defaultVerifiedModelCachePath(): string {
  const override = Deno.env.get("QUORUM_ROUTER_VERIFIED_MODEL_CACHE")?.trim();
  if (override) return override;
  const home = Deno.env.get("HOME")?.trim();
  if (!home) {
    throw new Error("HOME is required to resolve verified model cache path");
  }
  return `${home}/.config/quorum-router/verified-models.json`;
}

export async function resolveCommandPath(
  command: string,
): Promise<string | undefined> {
  const separator = Deno.build.os === "windows" ? ";" : ":";
  const extensions = Deno.build.os === "windows"
    ? (Deno.env.get("PATHEXT") ?? ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const dir of (Deno.env.get("PATH") ?? "").split(separator)) {
    if (!dir) continue;
    for (const extension of extensions) {
      const candidate = `${dir}/${command}${extension}`;
      try {
        const stat = await Deno.stat(candidate);
        if (
          stat.isFile &&
          (Deno.build.os === "windows" || ((stat.mode ?? 0) & 0o111) !== 0)
        ) {
          return await Deno.realPath(candidate);
        }
      } catch { /* keep searching */ }
    }
  }
  return undefined;
}

export async function fingerprintCommandPath(path: string): Promise<string> {
  const bytes = await Deno.readFile(path);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `sha256:${hex}`;
}

export async function loadExplicitModelConfig(
  path = defaultModelConfigPath(),
): Promise<ExplicitModelConfig> {
  const value = await readJsonIfPresent(path);
  return value === undefined
    ? defaultConfig()
    : ExplicitConfigSchema.parse(value);
}

export async function addExplicitModel(
  path: string,
  providerKey: string,
  model: string,
): Promise<ExplicitModelConfig> {
  const provider = ProviderKeySchema.parse(providerKey);
  const modelId = ModelIdSchema.parse(model);
  const config = await loadExplicitModelConfig(path);
  const models = [...new Set([...(config.providers[provider] ?? []), modelId])]
    .sort();
  const next = ExplicitConfigSchema.parse({
    ...config,
    providers: { ...config.providers, [provider]: models },
  });
  await atomicJsonWrite(path, next);
  return next;
}

export async function loadVerifiedModelCache(
  path = defaultVerifiedModelCachePath(),
): Promise<VerifiedModelRecord[]> {
  const value = await readJsonIfPresent(path);
  if (value === undefined) return [];
  if (LegacyVerifiedCacheSchema.safeParse(value).success) return [];
  return VerifiedCacheSchema.parse(value).records;
}

export async function recordVerifiedModel(
  path: string,
  input: VerifiedModelRecord,
): Promise<void> {
  const record = VerifiedRecordSchema.parse(input);
  const records = await loadVerifiedModelCache(path);
  const withoutPrevious = records.filter((item) =>
    !(item.providerKey === record.providerKey && item.model === record.model &&
      item.authMode === record.authMode && item.wrapper === record.wrapper)
  );
  withoutPrevious.push(record);
  withoutPrevious.sort((a, b) =>
    `${a.providerKey}/${a.model}`.localeCompare(`${b.providerKey}/${b.model}`)
  );
  const payload = VerifiedCacheSchema.parse({
    schema_version: "quorum-router.verified-model-cache.v3",
    records: withoutPrevious,
  });
  await atomicJsonWrite(path, payload);
}

export function providerKeyForEntry(
  entry: ModelInventoryEntry,
): ModelProviderKey | undefined {
  return entry.command ? PROVIDER_BY_COMMAND[entry.command] : undefined;
}

const SOURCE_ORDER: ModelCatalogSource[] = [
  "verified_cache",
  "provider_catalog",
  "explicit_config",
  "versioned_hint",
];

export async function resolveModelCatalog(input: {
  inventory: ModelInventory;
  configPath?: string;
  cachePath?: string;
  explicitConfig?: ExplicitModelConfig;
  verifiedRecords?: VerifiedModelRecord[];
  wrapperPaths?: Partial<Record<ModelProviderKey, string>>;
  wrapperFingerprints?: Partial<Record<ModelProviderKey, string>>;
  now?: Date;
}): Promise<ModelCatalogReport> {
  const config = input.explicitConfig ?? await loadExplicitModelConfig(
    input.configPath ?? defaultModelConfigPath(),
  );
  const verified = input.verifiedRecords ?? await loadVerifiedModelCache(
    input.cachePath ?? defaultVerifiedModelCachePath(),
  );
  const now = input.now ?? new Date();
  const providers: ProviderCatalog[] = [];
  for (const entry of input.inventory.entries) {
    const providerKey = providerKeyForEntry(entry);
    if (!providerKey) continue;
    const byModel = new Map<string, {
      sources: Set<ModelCatalogSource>;
      verifiedAt?: string;
    }>();
    const add = (
      model: string,
      source: ModelCatalogSource,
      verifiedAt?: string,
    ) => {
      const parsed = ModelIdSchema.safeParse(model);
      if (!parsed.success) return;
      const current = byModel.get(parsed.data) ?? { sources: new Set() };
      current.sources.add(source);
      if (
        verifiedAt && (!current.verifiedAt || verifiedAt > current.verifiedAt)
      ) {
        current.verifiedAt = verifiedAt;
      }
      byModel.set(parsed.data, current);
    };
    for (const model of VERSIONED_MODEL_HINTS.providers[providerKey]) {
      add(model, "versioned_hint");
    }
    for (const model of config.providers[providerKey] ?? []) {
      add(model, "explicit_config");
    }
    for (const model of entry.listed_models ?? []) {
      add(model, "provider_catalog");
    }
    const currentWrapperPath = input.wrapperPaths?.[providerKey] ??
      (entry.command ? await resolveCommandPath(entry.command) : undefined);
    const currentWrapperFingerprint =
      input.wrapperFingerprints?.[providerKey] ??
        (currentWrapperPath
          ? await fingerprintCommandPath(currentWrapperPath)
          : undefined);
    for (
      const record of verified.filter((item) =>
        item.providerKey === providerKey && item.provider === entry.provider &&
        item.wrapper === entry.command && item.authMode === entry.auth_mode &&
        item.wrapperPath === currentWrapperPath &&
        item.wrapperFingerprint === currentWrapperFingerprint
      )
    ) {
      add(record.model, "verified_cache", record.verifiedAt);
    }
    const models: CatalogModel[] = [...byModel.entries()].map(
      ([model, value]) => {
        let status: ModelCatalogStatus;
        if (value.verifiedAt) {
          const ageMs = now.getTime() - new Date(value.verifiedAt).getTime();
          status = ageMs >= -5 * 60 * 1_000 &&
              ageMs <= 30 * 24 * 60 * 60 * 1_000
            ? "verified"
            : "stale";
        } else if (value.sources.has("provider_catalog")) status = "listed";
        else if (value.sources.has("explicit_config")) status = "configured";
        else status = "hinted";
        return {
          model,
          status,
          sources: SOURCE_ORDER.filter((source) => value.sources.has(source)),
          ...(value.verifiedAt ? { verifiedAt: value.verifiedAt } : {}),
        };
      },
    ).sort((a, b) => {
      const rank = {
        verified: 0,
        listed: 1,
        configured: 2,
        stale: 3,
        hinted: 4,
      };
      return rank[a.status] - rank[b.status] || a.model.localeCompare(b.model);
    });
    const catalogState = !entry.available
      ? "wrapper_missing" as const
      : entry.can_list_models
      ? "listed" as const
      : "not_exposed" as const;
    providers.push({
      providerKey,
      provider: entry.provider,
      wrapper: entry.command ?? "—",
      authMode: entry.auth_mode,
      wrapperState: entry.available ? "found" : "missing",
      canInvoke: entry.available && entry.can_invoke,
      catalogState,
      models,
      detail: entry.blocked_reason ?? entry.list_blocked_reason ?? "ready",
    });
  }
  providers.sort((a, b) =>
    MODEL_PROVIDER_KEYS.indexOf(a.providerKey) -
    MODEL_PROVIDER_KEYS.indexOf(b.providerKey)
  );
  return {
    generatedAt: now.toISOString(),
    hintCatalog: {
      schemaVersion: VERSIONED_MODEL_HINTS.schemaVersion,
      catalogVersion: VERSIONED_MODEL_HINTS.catalogVersion,
      updatedAt: VERSIONED_MODEL_HINTS.updatedAt,
    },
    providers,
  };
}
