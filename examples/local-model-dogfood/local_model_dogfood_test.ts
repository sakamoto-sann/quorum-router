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

Deno.test("local model dogfood parses auth modes and rejects invalid values", () => {
  assertEquals(parseAuthMode(undefined), "auto");
  assertEquals(parseAuthMode("wrapper"), "wrapper");
  assertEquals(parseAuthMode("oauth"), "oauth");
  assertEquals(parseAuthMode("env"), "env");
  assertThrows(() => parseAuthMode("api-key-primary"));
});

Deno.test("local model dogfood auto mode reports env fallback but does not use it", () => {
  const previous = Deno.env.get("FUSION_ROUTER_AUTH_MODE");
  const providerKey = ["FUSION", "ROUTER", "PROVIDER", "API", "KEY"].join("_");
  const oldBase = Deno.env.get("FUSION_ROUTER_PROVIDER_BASE_URL");
  const oldKey = Deno.env.get(providerKey);
  const oldModel = Deno.env.get("FUSION_ROUTER_PROVIDER_MODEL");
  try {
    Deno.env.delete("FUSION_ROUTER_AUTH_MODE");
    Deno.env.set(
      "FUSION_ROUTER_PROVIDER_BASE_URL",
      "https://example.invalid/v1",
    );
    Deno.env.set(providerKey, ["fixture", "secret", "value"].join("-"));
    Deno.env.set("FUSION_ROUTER_PROVIDER_MODEL", "fixture-model");
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
      "not used unless FUSION_ROUTER_AUTH_MODE=env",
    );
  } finally {
    previous === undefined
      ? Deno.env.delete("FUSION_ROUTER_AUTH_MODE")
      : Deno.env.set("FUSION_ROUTER_AUTH_MODE", previous);
    oldBase === undefined
      ? Deno.env.delete("FUSION_ROUTER_PROVIDER_BASE_URL")
      : Deno.env.set("FUSION_ROUTER_PROVIDER_BASE_URL", oldBase);
    oldKey === undefined
      ? Deno.env.delete(providerKey)
      : Deno.env.set(providerKey, oldKey);
    oldModel === undefined
      ? Deno.env.delete("FUSION_ROUTER_PROVIDER_MODEL")
      : Deno.env.set("FUSION_ROUTER_PROVIDER_MODEL", oldModel);
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

Deno.test("local model dogfood selects requested Grok listed model", () => {
  const oldLabel = Deno.env.get("FUSION_ROUTER_PROVIDER_LABEL");
  const oldModel = Deno.env.get("FUSION_ROUTER_PROVIDER_MODEL");
  try {
    Deno.env.set("FUSION_ROUTER_PROVIDER_LABEL", "grok-cli");
    Deno.env.set("FUSION_ROUTER_PROVIDER_MODEL", "grok-build");
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
      ? Deno.env.delete("FUSION_ROUTER_PROVIDER_LABEL")
      : Deno.env.set("FUSION_ROUTER_PROVIDER_LABEL", oldLabel);
    oldModel === undefined
      ? Deno.env.delete("FUSION_ROUTER_PROVIDER_MODEL")
      : Deno.env.set("FUSION_ROUTER_PROVIDER_MODEL", oldModel);
  }
});

Deno.test("local model dogfood fails safely for unknown requested model", () => {
  const oldModel = Deno.env.get("FUSION_ROUTER_PROVIDER_MODEL");
  try {
    Deno.env.set("FUSION_ROUTER_PROVIDER_MODEL", "missing-grok-model");
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
      ? Deno.env.delete("FUSION_ROUTER_PROVIDER_MODEL")
      : Deno.env.set("FUSION_ROUTER_PROVIDER_MODEL", oldModel);
  }
});

Deno.test("local model dogfood wrapper client is non-shell and stdin-closed", async () => {
  const source = await Deno.readTextFile(
    "examples/local-model-dogfood/src/wrapper_client.ts",
  );
  assertStringIncludes(source, "new Deno.Command(entry.command");
  assertStringIncludes(source, 'stdin: "null"');
  assertStringIncludes(source, 'child.kill("SIGKILL")');
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
    "agent_chat remains experimental explicit opt-in only",
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
      "--allow-run=codex,claude,gemini,grok,devin,qwen",
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
    "agent_chat` remains experimental explicit opt-in only",
  );
});
