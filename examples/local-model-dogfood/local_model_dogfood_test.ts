import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { discoverInventory, parseGrokModelList } from "./src/auth_discovery.ts";
import { selectInvokableCandidates } from "./src/best_route_runner.ts";
import { chatCompletionsUrl } from "./src/env_fallback_client.ts";
import { parseAuthMode } from "./src/schema.ts";
import { redact, redactionOk } from "./src/redact.ts";
import { buildTrace, writeTrace } from "./src/trace.ts";
import { buildWrapperArgs } from "./src/wrapper_client.ts";
import { LOCAL_PROVIDER_SPECS } from "./src/provider_registry.ts";

Deno.test("provider registry excludes Qwen until a non-secret session path exists", () => {
  assertEquals(
    LOCAL_PROVIDER_SPECS.some((spec) => spec.model_id === "alibaba/qwen-cli"),
    false,
  );
});

function setEnvForTest(
  values: Record<string, string | undefined>,
  run: () => void,
): void {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, Deno.env.get(key)]),
  );
  try {
    for (const [key, value] of Object.entries(values)) {
      value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
    }
  }
}

function fixtureCandidates() {
  return [{
    provider: "OpenAI",
    auth_mode: "oauth" as const,
    model: "codex-cli",
    model_id: "openai/codex-cli",
    source: "oauth_session" as const,
    available: true,
    can_list_models: false,
    can_invoke: true,
    notes: [],
    command: "codex",
    args_template: ["exec", "__PROMPT__"],
  }, {
    provider: "xAI",
    auth_mode: "oauth" as const,
    model: "grok-cli",
    model_id: "xai/grok-cli",
    source: "oauth_session" as const,
    available: true,
    can_list_models: true,
    listed_models: ["grok-build", "grok-composer-2.5-fast"],
    can_invoke: true,
    notes: [],
    command: "grok",
    args_template: ["-p", "__PROMPT__"],
  }, {
    provider: "OpenAI-compatible env fallback",
    auth_mode: "env" as const,
    model: "env-model",
    model_id: "env/env-model",
    source: "env_fallback" as const,
    available: true,
    can_list_models: false,
    can_invoke: true,
    notes: [],
  }];
}

Deno.test("local model dogfood parses auth modes and rejects invalid values", () => {
  assertEquals(parseAuthMode(undefined), "auto");
  assertEquals(parseAuthMode("wrapper"), "wrapper");
  assertEquals(parseAuthMode("oauth"), "oauth");
  assertEquals(parseAuthMode("env"), "env");
  assertThrows(() => parseAuthMode("api-key-primary"));
});

Deno.test("local model dogfood auto mode reports env fallback but does not use it", () => {
  const previous = Deno.env.get("QUORUM_ROUTER_AUTH_MODE");
  const providerKey = ["FUSION", "ROUTER", "PROVIDER", "API", "KEY"].join("_");
  const oldBase = Deno.env.get("QUORUM_ROUTER_PROVIDER_BASE_URL");
  const oldKey = Deno.env.get(providerKey);
  const oldModel = Deno.env.get("QUORUM_ROUTER_PROVIDER_MODEL");
  try {
    Deno.env.delete("QUORUM_ROUTER_AUTH_MODE");
    Deno.env.set(
      "QUORUM_ROUTER_PROVIDER_BASE_URL",
      "https://example.invalid/v1",
    );
    Deno.env.set(providerKey, ["fixture", "secret", "value"].join("-"));
    Deno.env.set("QUORUM_ROUTER_PROVIDER_MODEL", "fixture-model");
    const inventory = discoverInventory();
    assertEquals(inventory.auth_mode, "auto");
    assertEquals(inventory.env_fallback_configured, true);
    assertEquals(inventory.env_fallback_used, false);
    const fallback = inventory.entries.find((entry) =>
      entry.source === "env_fallback"
    );
    assert(fallback);
    assertEquals(fallback.available, false);
    assertStringIncludes(
      fallback.blocked_reason ?? "",
      "not used unless QUORUM_ROUTER_AUTH_MODE=env",
    );
  } finally {
    previous === undefined
      ? Deno.env.delete("QUORUM_ROUTER_AUTH_MODE")
      : Deno.env.set("QUORUM_ROUTER_AUTH_MODE", previous);
    oldBase === undefined
      ? Deno.env.delete("QUORUM_ROUTER_PROVIDER_BASE_URL")
      : Deno.env.set("QUORUM_ROUTER_PROVIDER_BASE_URL", oldBase);
    oldKey === undefined
      ? Deno.env.delete(providerKey)
      : Deno.env.set(providerKey, oldKey);
    oldModel === undefined
      ? Deno.env.delete("QUORUM_ROUTER_PROVIDER_MODEL")
      : Deno.env.set("QUORUM_ROUTER_PROVIDER_MODEL", oldModel);
  }
});

Deno.test("local model dogfood redacts sensitive diagnostics", () => {
  const fixtureToken = ["fixture", "token"].join("-");
  const fixtureSecret = ["fixture", "secret"].join("-");
  const raw =
    `Authorization: Bearer ${fixtureToken}\napi_key=${fixtureSecret}\ncookie=session-value`;
  const safe = redact(raw, [fixtureToken, fixtureSecret]);
  assert(!safe.includes(fixtureToken));
  assert(!safe.includes(fixtureSecret));
  assert(!/Authorization: Bearer/i.test(safe));
  assert(!/cookie=session-value/i.test(safe));
  assertEquals(
    redact("tool failed session_id=019f345c-46ae-7743-8191-bd448d4a4f0f"),
    "tool failed [REDACTED]",
  );
  const jsonSafe = redact(
    JSON.stringify({
      api_key: fixtureSecret,
      refresh_token: fixtureToken,
      session_id: "session-value",
    }),
    [fixtureToken, fixtureSecret],
  );
  assert(!jsonSafe.includes(fixtureToken));
  assert(!jsonSafe.includes(fixtureSecret));
  assert(!jsonSafe.includes("session-value"));
  assertEquals(redactionOk({ session_id: "session-value" }), false);
});

Deno.test("local model dogfood env fallback URL handling preserves query", () => {
  assertEquals(
    chatCompletionsUrl("https://example.invalid/v1?api-version=1"),
    "https://example.invalid/v1/chat/completions?api-version=1",
  );
  assertEquals(
    chatCompletionsUrl(
      "https://example.invalid/v1/chat/completions?api-version=1",
    ),
    "https://example.invalid/v1/chat/completions?api-version=1",
  );
});

Deno.test("local model dogfood parses safe grok model list output", () => {
  const output =
    `You are logged in with grok.com.\n\nDefault model: grok-composer-2.5-fast\n\nAvailable models:\n  * grok-composer-2.5-fast (default)\n  - grok-build\n`;
  assertEquals(parseGrokModelList(output), [
    "grok-build",
    "grok-composer-2.5-fast",
  ]);
});

Deno.test("local model dogfood selection honors provider label aliases", () => {
  for (const label of ["grok-cli", "xAI", "xai"]) {
    setEnvForTest({
      QUORUM_ROUTER_PROVIDER_LABEL: label,
      QUORUM_ROUTER_PROVIDER_MODEL: undefined,
    }, () => {
      const [selected] = selectInvokableCandidates(fixtureCandidates());
      assertEquals(selected.provider, "xAI");
      assertEquals(selected.model, "grok-cli");
    });
  }
  setEnvForTest({
    QUORUM_ROUTER_PROVIDER_LABEL: "codex-cli",
    QUORUM_ROUTER_PROVIDER_MODEL: undefined,
  }, () => {
    const [selected] = selectInvokableCandidates(fixtureCandidates());
    assertEquals(selected.provider, "OpenAI");
    assertEquals(selected.model, "codex-cli");
  });
});

Deno.test("local model dogfood selection honors Grok listed model aliases", () => {
  for (const model of ["grok-build", "grok-composer-2.5-fast"]) {
    setEnvForTest({
      QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
      QUORUM_ROUTER_PROVIDER_MODEL: model,
    }, () => {
      const [selected] = selectInvokableCandidates(fixtureCandidates());
      assertEquals(selected.provider, "xAI");
      assertEquals(selected.model, model);
      assertEquals(selected.invocation_model, model);
      assertEquals(
        buildWrapperArgs(selected, "hello", "out.txt")[0],
        "--model",
      );
      assertEquals(buildWrapperArgs(selected, "hello", "out.txt")[1], model);
    });
  }
});

Deno.test("wrapper model override applies to non-Grok CLIs", () => {
  const entry = fixtureCandidates().find((candidate) =>
    candidate.command === "codex"
  )!;
  const args = buildWrapperArgs(
    { ...entry, invocation_model: "gpt-5.4-mini" },
    "hello",
    "out.txt",
  );
  assertEquals(args.slice(0, 3), ["--model", "gpt-5.4-mini", "exec"]);
});

Deno.test("local model dogfood unknown requested provider fails safely", () => {
  setEnvForTest({
    QUORUM_ROUTER_PROVIDER_LABEL: "missing-provider",
    QUORUM_ROUTER_PROVIDER_MODEL: undefined,
  }, () => {
    assertThrows(
      () => selectInvokableCandidates(fixtureCandidates()),
      Error,
      "requested wrapper candidate not available",
    );
  });
});

Deno.test("local model dogfood requested wrapper does not silently use env fallback", () => {
  setEnvForTest({
    QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
    QUORUM_ROUTER_PROVIDER_MODEL: "env-model",
  }, () => {
    assertThrows(
      () => selectInvokableCandidates(fixtureCandidates()),
      Error,
      "requested wrapper candidate not available",
    );
  });
});

Deno.test("local model dogfood env fallback is available only in env mode", () => {
  const providerKey = ["FUSION", "ROUTER", "PROVIDER", "API", "KEY"].join("_");
  setEnvForTest({
    QUORUM_ROUTER_AUTH_MODE: "env",
    QUORUM_ROUTER_PROVIDER_BASE_URL: "https://example.invalid/v1",
    [providerKey]: ["fixture", "secret", "value"].join("-"),
    QUORUM_ROUTER_PROVIDER_MODEL: "env-model",
  }, () => {
    const inventory = discoverInventory();
    assertEquals(inventory.env_fallback_configured, true);
    assertEquals(inventory.env_fallback_used, true);
    const fallback = inventory.entries.find((entry) =>
      entry.source === "env_fallback"
    );
    assert(fallback);
    assertEquals(fallback.available, true);
    assertEquals(fallback.can_invoke, true);
    assertEquals(fallback.model, "env-model");
  });
});

Deno.test("local model dogfood selects requested Grok listed model", () => {
  const oldLabel = Deno.env.get("QUORUM_ROUTER_PROVIDER_LABEL");
  const oldModel = Deno.env.get("QUORUM_ROUTER_PROVIDER_MODEL");
  try {
    Deno.env.set("QUORUM_ROUTER_PROVIDER_LABEL", "grok-cli");
    Deno.env.set("QUORUM_ROUTER_PROVIDER_MODEL", "grok-build");
    const [selected] = selectInvokableCandidates([{
      provider: "xAI",
      auth_mode: "oauth",
      model: "grok-cli",
      model_id: "xai/grok-cli",
      source: "oauth_session",
      available: true,
      can_list_models: true,
      listed_models: ["grok-build", "grok-composer-2.5-fast"],
      can_invoke: true,
      notes: [],
      command: "grok",
      args_template: ["-p", "__PROMPT__"],
    }]);
    assertEquals(selected.model, "grok-build");
    assertEquals(selected.invocation_model, "grok-build");
    assertEquals(
      buildWrapperArgs(selected, "hello", "out.txt").slice(0, 2),
      ["--model", "grok-build"],
    );
  } finally {
    oldLabel === undefined
      ? Deno.env.delete("QUORUM_ROUTER_PROVIDER_LABEL")
      : Deno.env.set("QUORUM_ROUTER_PROVIDER_LABEL", oldLabel);
    oldModel === undefined
      ? Deno.env.delete("QUORUM_ROUTER_PROVIDER_MODEL")
      : Deno.env.set("QUORUM_ROUTER_PROVIDER_MODEL", oldModel);
  }
});

Deno.test("local model dogfood fails safely for unknown requested model", () => {
  const oldModel = Deno.env.get("QUORUM_ROUTER_PROVIDER_MODEL");
  try {
    Deno.env.set("QUORUM_ROUTER_PROVIDER_MODEL", "missing-grok-model");
    assertThrows(
      () =>
        selectInvokableCandidates([{
          provider: "xAI",
          auth_mode: "oauth",
          model: "grok-cli",
          model_id: "xai/grok-cli",
          source: "oauth_session",
          available: true,
          can_list_models: true,
          listed_models: ["grok-build"],
          can_invoke: true,
          notes: [],
          command: "grok",
        }]),
      Error,
      "requested wrapper candidate not available",
    );
  } finally {
    oldModel === undefined
      ? Deno.env.delete("QUORUM_ROUTER_PROVIDER_MODEL")
      : Deno.env.set("QUORUM_ROUTER_PROVIDER_MODEL", oldModel);
  }
});

Deno.test("local model dogfood wrapper client is non-shell, isolated, and retries empty SIGPIPE once", async () => {
  const source = await Deno.readTextFile(
    "examples/local-model-dogfood/src/wrapper_client.ts",
  );
  assertStringIncludes(source, "new Deno.Command(entry.command");
  assertStringIncludes(source, 'stdin: "null"');
  assertStringIncludes(source, 'cwd: Deno.env.get("TMPDIR") || "/tmp"');
  assertStringIncludes(source, "output.code === 141");
  assertStringIncludes(source, "output.stdout.length === 0");
  assertStringIncludes(source, "output.stderr.length === 0");
  assertStringIncludes(source, 'child.kill("SIGKILL")');
});

Deno.test("agent chat tells autonomous wrappers to remain text-only", async () => {
  const source = await Deno.readTextFile(
    "examples/local-model-dogfood/src/agent_chat_runner.ts",
  );
  assertStringIncludes(
    source,
    "Do not use tools, inspect files, run commands, or modify the workspace.",
  );
});

Deno.test("local model dogfood trace schema stays sanitized", async () => {
  const trace = await buildTrace({
    command: "route:once",
    mode: "route_once",
    authMode: "auto",
    prompt: "Review this README for risky claims.",
    results: [{
      provider: "Fixture",
      model: "fixture-model",
      response_received: true,
      schema_valid: true,
      response_summary: "Safe concise answer.",
      raw_content: "Safe concise answer.",
    }],
  });
  assertEquals(trace.schema_valid, true);
  assertEquals(trace.credential_value_present, false);
  assertEquals(trace.sensitive_value_present, false);
  assertEquals(redactionOk(trace), true);
  assertStringIncludes(
    trace.boundaries.join("\n"),
    "agent_chat remains explicit opt-in and separate from direct routing",
  );
});

Deno.test("local model dogfood refuses to write unsafe trace", async () => {
  const trace = await buildTrace({
    command: "route:once",
    mode: "route_once",
    authMode: "auto",
    errors: [JSON.stringify({ session_id: "session-value" })],
  });
  assertEquals(trace.redaction_ok, false);
  await assertRejects(
    () => writeTrace("unsafe-fixture", trace),
    Error,
    "refusing to write trace",
  );
});

Deno.test("local model dogfood CLI blocks route without opt-in", async () => {
  const output = await new Deno.Command("deno", {
    args: [
      "run",
      "--allow-env",
      "--allow-read",
      "--allow-run=codex,claude,gemini,grok,devin",
      "--allow-net",
      "--allow-write=../../out/dogfood/local-model-dogfood",
      "src/cli.ts",
      "route:once",
      "--prompt",
      "hello",
    ],
    cwd: "examples/local-model-dogfood",
    stdout: "piped",
    stderr: "piped",
  }).output();
  const combined = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.code !== 0);
  assertStringIncludes(combined, "RUN_EXTERNAL_MODEL_DOGFOOD=1");
});

Deno.test("local model dogfood docs preserve launch boundaries", async () => {
  const readme = await Deno.readTextFile(
    "examples/local-model-dogfood/README.md",
  );
  assertStringIncludes(readme, "NPX is not the");
  assertStringIncludes(
    readme,
    "Public Product Hunt/X launch remains **NO-GO**",
  );
  assertStringIncludes(readme, "generic OpenAI-compatible env fallback");
  assertStringIncludes(
    readme,
    "agent_chat` remains explicit opt-in and has no mutation authority",
  );
});
