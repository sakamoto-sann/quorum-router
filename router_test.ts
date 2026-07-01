import {
  createOtlpHttpTelemetrySink,
  createProcessAdapter,
  FinalSynthesis,
  FinalSynthesisSchema,
  FusionRouter,
  InMemoryBudgetManager,
  ModelAdapter,
  ModelOutput,
  ProcessExecutionError,
  RouterError,
  SynthesisAdapter,
} from "./router.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

async function makeScript(content: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-test-" });
  const path = `${dir}/script.sh`;
  await Deno.writeTextFile(path, content);
  await Deno.chmod(path, 0o755);
  return path;
}

class StaticSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor = {
    provider: "Test",
    model: "static-synth",
    authMode: "session",
    transport: "processAdapter",
    client: "StaticSynth",
  } as const;

  constructor(private readonly response: FinalSynthesis) {}

  synthesize(
    _prompt: string,
    _outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    return Promise.resolve(FinalSynthesisSchema.parse(this.response));
  }
}

class InvalidSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor = {
    provider: "Test",
    model: "invalid-synth",
    authMode: "session",
    transport: "processAdapter",
    client: "InvalidSynth",
  } as const;

  synthesize(): Promise<FinalSynthesis> {
    return Promise.resolve(FinalSynthesisSchema.parse({
      synthesis: "",
      reasoning: "missing",
      consensusModel: "invalid",
      sources: [],
    }));
  }
}

function buildRouter(
  adapter: ModelAdapter,
  synthesisAdapter: SynthesisAdapter,
): FusionRouter {
  return new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter,
    minSuccessfulAdapters: 1,
    timeoutMs: 10_000,
  });
}

Deno.test("malformed provider response is rejected", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
printf ''
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "empty-stdout",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    buildInvocation: () => ({ command: script }),
  });

  await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    Error,
    "returned empty stdout",
  );
});

Deno.test("quorum failure returns RouterError 4401", async () => {
  const failingScript = await makeScript(`#!/usr/bin/env bash
>&2 echo 'upstream boom'
exit 1
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "always-fails",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    retryPolicy: {
      maxAttempts: 1,
      baseDelayMs: 1,
      maxDelayMs: 1,
    },
    buildInvocation: () => ({ command: failingScript }),
  });

  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter: new StaticSynthesisAdapter({
      synthesis: "unused",
      reasoning: "unused",
      consensusModel: "unused",
      sources: ["unused"],
    }),
    minSuccessfulAdapters: 1,
    timeoutMs: 10_000,
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.status, 4401);
  assertEquals(error.code, "consensus_insufficient");
});

Deno.test("synthesis validation failure fails closed", async () => {
  const goodScript = await makeScript(`#!/usr/bin/env bash
echo 'validated upstream output'
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "good",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    buildInvocation: () => ({ command: goodScript }),
  });

  const router = buildRouter(adapter, new InvalidSynthesisAdapter());

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.status, 4401);
  assertEquals(error.code, "consensus_validation_failed");
});

Deno.test("rate-limited adapter retries and succeeds", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-retry-" });
  const counterPath = `${dir}/counter.txt`;
  await Deno.writeTextFile(counterPath, "0");

  const script = await makeScript(`#!/usr/bin/env bash
count=$(cat "$COUNTER_PATH")
if [ "$count" = "0" ]; then
  echo 1 > "$COUNTER_PATH"
  >&2 echo '429 rate limit retry-after 0.01'
  exit 1
fi
echo 'second attempt succeeded'
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "retry-once",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    retryPolicy: {
      maxAttempts: 2,
      baseDelayMs: 5,
      maxDelayMs: 20,
    },
    buildInvocation: () => ({
      command: script,
      env: { COUNTER_PATH: counterPath },
    }),
  });

  const router = buildRouter(
    adapter,
    new StaticSynthesisAdapter({
      synthesis: "ok",
      reasoning: "retried successfully",
      consensusModel: "test/model",
      sources: ["Fixture/retry-once"],
    }),
  );

  const result = await router.route("hello");
  assertEquals(result.synthesis, "ok");
  assertEquals((await Deno.readTextFile(counterPath)).trim(), "1");
});

Deno.test("auth refresh and wrapper env plumbing run before invoke", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-auth-" });
  const gatePath = `${dir}/gate.txt`;

  const readinessScript = await makeScript(`#!/usr/bin/env bash
if [ ! -f "$GATE_PATH" ]; then
  >&2 echo 'not authenticated'
  exit 1
fi
echo 'ready'
`);

  const refreshScript = await makeScript(`#!/usr/bin/env bash
echo 'refreshed' > "$GATE_PATH"
`);

  const invokeScript = await makeScript(`#!/usr/bin/env bash
echo "marker:$WRAPPER_MARKER"
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "refreshable-wrapper",
      authMode: "oauth",
      transport: "zcodeWrapper",
      client: "zcode",
    },
    auth: {
      env: { WRAPPER_MARKER: "fixture-session-marker" },
      readinessCheck: {
        command: readinessScript,
        env: { GATE_PATH: gatePath },
      },
      refreshCommand: {
        command: refreshScript,
        env: { GATE_PATH: gatePath },
      },
    },
    buildInvocation: () => ({ command: invokeScript }),
  });

  const output = await adapter.invoke("hello", new AbortController().signal);
  assertEquals(output.content.trim(), "marker:fixture-session-marker");
  assert((await Deno.stat(gatePath)).isFile);
});

Deno.test("circuit breaker opens after repeated failures", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-circuit-" });
  const counterPath = `${dir}/counter.txt`;
  await Deno.writeTextFile(counterPath, "0");

  const script = await makeScript(`#!/usr/bin/env bash
count=$(cat "$COUNTER_PATH")
count=$((count + 1))
echo "$count" > "$COUNTER_PATH"
>&2 echo 'fatal failure'
exit 1
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "breaker",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    retryPolicy: {
      maxAttempts: 1,
      baseDelayMs: 1,
      maxDelayMs: 1,
    },
    circuitBreaker: {
      failureThreshold: 1,
      cooldownMs: 60_000,
    },
    buildInvocation: () => ({
      command: script,
      env: { COUNTER_PATH: counterPath },
    }),
  });

  await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    Error,
  );

  const secondError = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    Error,
  );

  assertStringIncludes(secondError.message, "circuit open");
  assertEquals((await Deno.readTextFile(counterPath)).trim(), "1");
});

Deno.test("OTLP telemetry sink posts telemetry payload", async () => {
  const received: Array<Record<string, unknown>> = [];
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const abortController = new AbortController();
  Deno.serve(
    { hostname: "127.0.0.1", port, signal: abortController.signal },
    async (request) => {
      received.push(await request.json() as Record<string, unknown>);
      return new Response("ok", { status: 200 });
    },
  );

  const sink = createOtlpHttpTelemetrySink({
    endpoint: `http://127.0.0.1:${port}/v1/logs`,
    serviceName: "fusion-router-test",
  });

  await sink({
    totalAdapters: 3,
    successfulAdapters: 1,
    failedAdapters: 2,
    failures: [
      { provider: "A", model: "m1", code: "rate_limited", message: "429" },
      { provider: "B", model: "m2", code: "auth_failed", message: "401" },
    ],
  });

  abortController.abort();

  assertEquals(received.length, 1);
  const resourceLogs = received[0].resourceLogs as Array<
    Record<string, unknown>
  >;
  const firstResource = resourceLogs[0];
  const resource = firstResource.resource as Record<string, unknown>;
  const resourceAttributes = resource.attributes as Array<
    Record<string, unknown>
  >;
  const scopeLogs = firstResource.scopeLogs as Array<Record<string, unknown>>;
  const logRecords = scopeLogs[0].logRecords as Array<Record<string, unknown>>;
  const attributes = logRecords[0].attributes as Array<Record<string, unknown>>;

  assertEquals(resourceAttributes[0].key as string, "service.name");
  assertEquals(
    (resourceAttributes[0].value as Record<string, unknown>)
      .stringValue as string,
    "fusion-router-test",
  );
  assertEquals(
    (logRecords[0].body as Record<string, unknown>).stringValue,
    "co_failure_telemetry",
  );
  assert(
    attributes.some((attribute) =>
      attribute.key === "fusion.failed_adapters" &&
      (attribute.value as Record<string, unknown>).intValue === 2
    ),
  );
});

Deno.test("zcode-style stdout error is treated as failure", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
cat <<'EOF'
Error: Model config is missing. Create /Users/tetsu/.zcode/cli/config.json with an explicit model provider before running ZCode.
EOF
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "GLM",
      model: "glm-zcode",
      authMode: "oauth",
      transport: "zcodeWrapper",
      client: "zcode",
    },
    buildInvocation: () => ({ command: script }),
  });

  await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    Error,
    "Model config is missing",
  );
});

Deno.test("provider auth policy failures classify as auth_failed", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
>&2 echo 'Your organization has disabled Claude subscription access for Claude Code · Use an Anthropic API key instead, or ask your admin to enable access'
exit 1
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Anthropic",
      model: "claude-code",
      authMode: "oauth",
      transport: "processAdapter",
      client: "ClaudeCode",
    },
    buildInvocation: () => ({ command: script }),
  });

  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
  );

  assertEquals(error.codeName, "auth_failed");
});

Deno.test("leaked API key failures classify as auth_failed", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
>&2 echo 'Your API key was reported as leaked. Please use another API key.'
exit 1
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Google",
      model: "gemini-cli",
      authMode: "oauth",
      transport: "processAdapter",
      client: "GeminiCLI",
    },
    buildInvocation: () => ({ command: script }),
  });

  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
  );

  assertEquals(error.codeName, "auth_failed");
});

Deno.test("budget manager blocks over-budget invocation", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
echo 'would have run'
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "budgeted",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    estimatedCostUsd: 0.2,
    budgetManager: new InMemoryBudgetManager(0.1),
    buildInvocation: () => ({ command: script }),
  });

  await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    Error,
    "Budget exhausted",
  );
});
