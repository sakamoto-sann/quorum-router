import { assertEquals, assertRejects } from "@std/assert";
import {
  addExplicitModel,
  loadExplicitModelConfig,
  recordVerifiedModel,
  resolveModelCatalog,
  type VerifiedModelRecord,
} from "./model_catalog.ts";
import type { ModelInventory } from "./schema.ts";

const inventory: ModelInventory = {
  generated_at: "2026-07-11T00:00:00.000Z",
  auth_mode: "auto",
  available_count: 2,
  blocked_count: 0,
  env_fallback_configured: false,
  env_fallback_used: false,
  entries: [
    {
      provider: "OpenAI",
      auth_mode: "oauth",
      model: "codex-cli",
      model_id: "openai/codex-cli",
      source: "oauth_session",
      available: true,
      can_list_models: false,
      list_blocked_reason: "catalog command not exposed",
      can_invoke: true,
      notes: [],
      command: "codex",
      args_template: ["exec", "__PROMPT__"],
    },
    {
      provider: "xAI",
      auth_mode: "oauth",
      model: "grok-cli",
      model_id: "xai/grok-cli",
      source: "oauth_session",
      available: true,
      can_list_models: true,
      listed_models: ["grok-4.5"],
      can_invoke: true,
      notes: [],
      command: "grok",
      args_template: ["-p", "__PROMPT__"],
    },
  ],
};

Deno.test("explicit model config is atomic deduplicated and mode 0600", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/models.json`;
  try {
    await addExplicitModel(path, "codex", "gpt-5.4-mini");
    await addExplicitModel(path, "codex", "gpt-5.4-mini");
    const config = await loadExplicitModelConfig(path);
    assertEquals(config.providers.codex, ["gpt-5.4-mini"]);
    if (Deno.build.os !== "windows") {
      assertEquals((await Deno.stat(path)).mode! & 0o777, 0o600);
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("verified cache binds provider wrapper model auth and timestamp", async () => {
  const dir = await Deno.makeTempDir();
  const path = `${dir}/verified.json`;
  const record: VerifiedModelRecord = {
    providerKey: "codex",
    provider: "OpenAI",
    wrapper: "codex",
    wrapperPath: "/test/codex",
    wrapperFingerprint:
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    model: "gpt-5.4-mini",
    authMode: "oauth",
    verifiedAt: "2026-07-11T00:00:00.000Z",
  };
  try {
    await recordVerifiedModel(path, record);
    const report = await resolveModelCatalog({
      inventory,
      wrapperPaths: { codex: "/test/codex", grok: "/test/grok" },
      wrapperFingerprints: {
        codex:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        grok:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      configPath: `${dir}/missing-config.json`,
      cachePath: path,
      now: new Date("2026-07-12T00:00:00.000Z"),
    });
    const model = report.providers.find((p) => p.providerKey === "codex")!
      .models.find((m) => m.model === "gpt-5.4-mini")!;
    assertEquals(model.status, "verified");
    assertEquals(model.sources, ["verified_cache", "versioned_hint"]);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("catalog distinguishes listed configured hinted stale and not_exposed", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await addExplicitModel(`${dir}/models.json`, "codex", "custom-codex");
    await recordVerifiedModel(`${dir}/verified.json`, {
      providerKey: "codex",
      provider: "OpenAI",
      wrapper: "codex",
      wrapperPath: "/test/codex",
      wrapperFingerprint:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      model: "old-model",
      authMode: "oauth",
      verifiedAt: "2026-05-01T00:00:00.000Z",
    });
    const report = await resolveModelCatalog({
      inventory,
      wrapperPaths: { codex: "/test/codex", grok: "/test/grok" },
      wrapperFingerprints: {
        codex:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        grok:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      configPath: `${dir}/models.json`,
      cachePath: `${dir}/verified.json`,
      now: new Date("2026-07-12T00:00:00.000Z"),
    });
    const codex = report.providers.find((p) => p.providerKey === "codex")!;
    assertEquals(codex.catalogState, "not_exposed");
    assertEquals(
      codex.models.find((m) => m.model === "custom-codex")!.status,
      "configured",
    );
    assertEquals(
      codex.models.find((m) => m.model === "old-model")!.status,
      "stale",
    );
    const grok = report.providers.find((p) => p.providerKey === "grok")!;
    assertEquals(grok.catalogState, "listed");
    assertEquals(grok.models[0].status, "listed");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("future-dated verification is stale rather than trusted", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await recordVerifiedModel(`${dir}/verified.json`, {
      providerKey: "codex",
      provider: "OpenAI",
      wrapper: "codex",
      wrapperPath: "/test/codex",
      wrapperFingerprint:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      model: "future-model",
      authMode: "oauth",
      verifiedAt: "2027-01-01T00:00:00.000Z",
    });
    const report = await resolveModelCatalog({
      inventory,
      wrapperPaths: { codex: "/test/codex", grok: "/test/grok" },
      wrapperFingerprints: {
        codex:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        grok:
          "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      },
      configPath: `${dir}/missing.json`,
      cachePath: `${dir}/verified.json`,
      now: new Date("2026-07-12T00:00:00.000Z"),
    });
    const model = report.providers.find((p) => p.providerKey === "codex")!
      .models.find((m) => m.model === "future-model")!;
    assertEquals(model.status, "stale");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("model CLI list and add preserve machine-readable contracts", async () => {
  const dir = await Deno.makeTempDir();
  const cli = `${Deno.cwd()}/model-catalog.ts`;
  const env = {
    HOME: dir,
    PATH: "",
    QUORUM_ROUTER_MODEL_CONFIG: `${dir}/models.json`,
    QUORUM_ROUTER_VERIFIED_MODEL_CACHE: `${dir}/verified.json`,
  };
  try {
    const add = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", cli, "add", "codex", "gpt-5.4-mini", "--json"],
      clearEnv: true,
      env,
    }).output();
    assertEquals(add.code, 0);
    assertEquals(JSON.parse(new TextDecoder().decode(add.stdout)).ok, true);
    const list = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", cli, "list", "--json"],
      clearEnv: true,
      env,
    }).output();
    assertEquals(list.code, 0);
    const report = JSON.parse(new TextDecoder().decode(list.stdout));
    const codex = report.providers.find((item: { providerKey: string }) =>
      item.providerKey === "codex"
    );
    assertEquals(codex.wrapperState, "missing");
    assertEquals(
      codex.models.find((item: { model: string }) =>
        item.model === "gpt-5.4-mini"
      ).status,
      "configured",
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("model probe fails closed without wrapper and writes no verified cache", async () => {
  const dir = await Deno.makeTempDir();
  const cache = `${dir}/verified.json`;
  try {
    const output = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        `${Deno.cwd()}/model-catalog.ts`,
        "probe",
        "codex",
        "gpt-5.4-mini",
        "--json",
      ],
      clearEnv: true,
      env: {
        HOME: dir,
        PATH: "",
        QUORUM_ROUTER_VERIFIED_MODEL_CACHE: cache,
      },
    }).output();
    assertEquals(output.code, 1);
    const failure = JSON.parse(new TextDecoder().decode(output.stdout));
    assertEquals(failure.ok, false);
    assertEquals(failure.code, "wrapper_unavailable");
    assertEquals(failure.provider, "codex");
    await assertRejects(() => Deno.stat(cache), Deno.errors.NotFound);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("model probe success E2E binds the executable path and exact sentinel", async () => {
  if (Deno.build.os === "windows") return;
  const dir = await Deno.makeTempDir();
  const bin = `${dir}/bin`;
  const cache = `${dir}/verified.json`;
  await Deno.mkdir(bin);
  const wrapper = `${bin}/codex`;
  await Deno.writeTextFile(
    wrapper,
    `#!/bin/sh\nout=''\nmodel=''\nprompt=''\nwhile [ "$#" -gt 0 ]; do\n  case "$1" in\n    --model) shift; model="$1" ;;\n    --output-last-message) shift; out="$1" ;;\n    -) IFS= read -r prompt || true ;;\n  esac\n  shift\ndone\n[ "$model" = "test-model" ] || exit 31\n[ "$prompt" = "Reply with exactly QUORUM_MODEL_PROBE_OK and no other text." ] || exit 32\n[ -n "$out" ] || exit 33\nprintf 'QUORUM_MODEL_PROBE_OK' > "$out"\n`,
    { mode: 0o700 },
  );
  try {
    const output = await new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "-A",
        `${Deno.cwd()}/model-catalog.ts`,
        "probe",
        "codex",
        "test-model",
        "--json",
      ],
      clearEnv: true,
      env: {
        HOME: dir,
        PATH: bin,
        QUORUM_ROUTER_VERIFIED_MODEL_CACHE: cache,
      },
    }).output();
    assertEquals(output.code, 0, new TextDecoder().decode(output.stderr));
    const result = JSON.parse(new TextDecoder().decode(output.stdout));
    assertEquals(result.ok, true);
    const records = JSON.parse(await Deno.readTextFile(cache)).records;
    assertEquals(records[0].wrapperPath, await Deno.realPath(wrapper));

    const report = await resolveModelCatalog({
      inventory,
      cachePath: cache,
      configPath: `${dir}/missing.json`,
      wrapperPaths: { codex: await Deno.realPath(wrapper) },
      wrapperFingerprints: {
        codex:
          "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      },
      now: new Date(),
    });
    assertEquals(
      report.providers.find((p) => p.providerKey === "codex")!.models.some((
        m,
      ) => m.model === "test-model" && m.status === "verified"),
      false,
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("explicit model config rejects unknown providers and unsafe model ids", async () => {
  const dir = await Deno.makeTempDir();
  try {
    await assertRejects(() => addExplicitModel(`${dir}/x`, "unknown", "model"));
    await assertRejects(() =>
      addExplicitModel(`${dir}/x`, "codex", "--danger")
    );
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});
