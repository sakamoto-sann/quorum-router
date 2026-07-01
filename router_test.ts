import {
  CoFailureTelemetry,
  createAnthropicDirectAdapter,
  createBufferedTelemetrySink,
  createOpenAIDirectAdapter,
  createOpenAIDirectSynthesisAdapter,
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
} from "@std/assert";

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

function telemetryFixture(message: string): CoFailureTelemetry {
  return {
    totalAdapters: 2,
    successfulAdapters: 1,
    failedAdapters: 1,
    failures: [
      {
        provider: "Fixture",
        model: "telemetry",
        code: "process_failed",
        message,
      },
    ],
  };
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

Deno.test("process adapter failure diagnostics redact credentials", async () => {
  const leakFixture = ["leak", "fixture", "value"].join("-");
  const failingScript = await makeScript(`#!/usr/bin/env bash
printf 'auth=%s\n' "$FUSION_ROUTER_TEST_AUTH"
>&2 printf 'credential=%s\n' "$FUSION_ROUTER_TEST_AUTH"
exit 1
`);

  const makeLeakingAdapter = () =>
    createProcessAdapter({
      descriptor: {
        provider: "Fixture",
        model: "leaky-process",
        authMode: "session",
        transport: "processAdapter",
        client: "FixtureCLI",
      },
      retryPolicy: {
        maxAttempts: 1,
        baseDelayMs: 1,
        maxDelayMs: 1,
      },
      buildInvocation: () => ({
        command: failingScript,
        env: { FUSION_ROUTER_TEST_AUTH: leakFixture },
      }),
    });

  const processError = await assertRejects(
    () => makeLeakingAdapter().invoke("hello", new AbortController().signal),
    ProcessExecutionError,
  );
  const processSurface = JSON.stringify({
    message: processError.message,
    stdout: processError.stdout,
    stderr: processError.stderr,
  });
  assert(!processSurface.includes(leakFixture));
  assertStringIncludes(processSurface, "[REDACTED]");

  const telemetryRecords: unknown[] = [];
  const router = new FusionRouter({
    modelAdapters: [makeLeakingAdapter()],
    synthesisAdapter: new StaticSynthesisAdapter({
      synthesis: "unused",
      reasoning: "unused",
      consensusModel: "unused",
      sources: ["unused"],
    }),
    minSuccessfulAdapters: 1,
    timeoutMs: 10_000,
    telemetrySink: (telemetry) => {
      telemetryRecords.push(telemetry);
    },
  });

  const routerError = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );
  const routerSurface = JSON.stringify({
    details: routerError.details,
    telemetryRecords,
  });
  assert(!routerSurface.includes(leakFixture));
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
  const abortController = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: abortController.signal },
    async (request) => {
      received.push(await request.json() as Record<string, unknown>);
      return new Response("ok", { status: 200 });
    },
  );
  const port = (server.addr as Deno.NetAddr).port;

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
  await server.finished;

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

Deno.test("OTLP telemetry sink times out slow collectors", async () => {
  const abortController = new AbortController();
  const server = Deno.serve(
    { hostname: "127.0.0.1", port: 0, signal: abortController.signal },
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return new Response("ok", { status: 200 });
    },
  );
  const port = (server.addr as Deno.NetAddr).port;

  const sink = createOtlpHttpTelemetrySink({
    endpoint: `http://127.0.0.1:${port}/v1/logs`,
    serviceName: "fusion-router-test",
    timeoutMs: 5,
  });

  const error = await assertRejects(
    async () => await sink(telemetryFixture("slow collector")),
    ProcessExecutionError,
  );

  abortController.abort();
  await server.finished;

  assertEquals(error.codeName, "timeout");
});

Deno.test("OTLP telemetry sink redacts endpoint credentials in errors", async () => {
  const sink = createOtlpHttpTelemetrySink({
    endpoint: "http://telemetry-user:telemetry-pass@127.0.0.1:1/v1/logs",
    serviceName: "fusion-router-test",
    timeoutMs: 5,
  });

  const error = await assertRejects(
    async () => await sink(telemetryFixture("endpoint credentials")),
    ProcessExecutionError,
  );
  const surface = `${error.message} ${error.stdout} ${error.stderr}`;

  assert(!surface.includes("telemetry-user"));
  assert(!surface.includes("telemetry-pass"));
  assertStringIncludes(surface, "[REDACTED]@");
});

Deno.test("buffered telemetry sink drops oldest when bounded", async () => {
  const delivered: string[] = [];
  const sink = createBufferedTelemetrySink(
    (telemetry) => {
      delivered.push(telemetry.failures[0].message);
    },
    {
      maxQueueSize: 2,
      maxBatchSize: 10,
      flushIntervalMs: 60_000,
      registerUnloadHook: false,
    },
  );

  sink(telemetryFixture("oldest"));
  sink(telemetryFixture("middle"));
  sink(telemetryFixture("newest"));

  assertEquals(sink.stats().queueSize, 2);
  assertEquals(sink.stats().droppedOldest, 1);
  assertEquals(sink.stats().enqueued, 3);

  await sink.close({ force: true, maxDurationMs: 100 });

  assertEquals(delivered, ["middle", "newest"]);
  assertEquals(sink.stats().queueSize, 0);
  assertEquals(sink.stats().closed, true);
});
Deno.test("buffered telemetry sink caps configured queue size", async () => {
  const sink = createBufferedTelemetrySink(() => {}, {
    maxQueueSize: 1_000_000,
    flushIntervalMs: 60_000,
    registerUnloadHook: false,
  });

  assertEquals(sink.stats().maxQueueSize, 10_000);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("buffered telemetry sink flushes immediately at batch size", async () => {
  const delivered: string[] = [];
  const sink = createBufferedTelemetrySink(
    (telemetry) => {
      delivered.push(telemetry.failures[0].message);
    },
    {
      maxBatchSize: 2,
      flushIntervalMs: 60_000,
      registerUnloadHook: false,
    },
  );

  sink(telemetryFixture("first"));
  sink(telemetryFixture("second"));
  for (let attempt = 0; attempt < 10 && delivered.length < 2; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  assertEquals(delivered, ["first", "second"]);
  assertEquals(sink.stats().queueSize, 0);
  assertEquals(sink.stats().delivered, 2);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("buffered telemetry sink retries after transient failure", async () => {
  let currentTime = 1_000;
  let calls = 0;
  const delivered: string[] = [];
  const sink = createBufferedTelemetrySink(
    (telemetry) => {
      calls += 1;
      if (calls === 1) {
        throw new Error("collector unavailable");
      }
      delivered.push(telemetry.failures[0].message);
    },
    {
      maxBatchSize: 1,
      flushIntervalMs: 60_000,
      baseBackoffMs: 100,
      maxBackoffMs: 100,
      maxAttempts: 3,
      now: () => currentTime,
      registerUnloadHook: false,
    },
  );

  sink(telemetryFixture("retry-me"));
  await sink.flush({ maxDurationMs: 50 });

  assertEquals(calls, 1);
  assertEquals(delivered, []);
  assertEquals(sink.stats().failedFlushes, 1);
  assertEquals(sink.stats().queueSize, 1);

  currentTime += 100;
  await sink.flush({ maxDurationMs: 50 });

  assertEquals(calls, 2);
  assertEquals(delivered, ["retry-me"]);
  assertEquals(sink.stats().delivered, 1);
  assertEquals(sink.stats().queueSize, 0);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("buffered telemetry sink close force-drains backoff queue", async () => {
  const currentTime = 1_000;
  let calls = 0;
  const delivered: string[] = [];
  const sink = createBufferedTelemetrySink(
    (telemetry) => {
      calls += 1;
      if (calls === 1) {
        throw new Error("collector unavailable");
      }
      delivered.push(telemetry.failures[0].message);
    },
    {
      maxBatchSize: 1,
      flushIntervalMs: 60_000,
      baseBackoffMs: 10_000,
      maxBackoffMs: 10_000,
      maxAttempts: 3,
      now: () => currentTime,
      registerUnloadHook: false,
    },
  );

  sink(telemetryFixture("shutdown-critical"));
  await sink.flush({ maxDurationMs: 50 });

  assertEquals(sink.stats().queueSize, 1);
  assertEquals(delivered, []);

  await sink.close({ force: true, maxDurationMs: 50 });

  assertEquals(calls, 2);
  assertEquals(delivered, ["shutdown-critical"]);
  assertEquals(sink.stats().queueSize, 0);
  assertEquals(sink.stats().closed, true);
});

Deno.test("buffered telemetry sink close does not retry failures in a tight loop", async () => {
  let calls = 0;
  const sink = createBufferedTelemetrySink(
    () => {
      calls += 1;
      throw new Error("collector still down");
    },
    {
      maxBatchSize: 1,
      maxAttempts: 10,
      defaultDrainMs: 500,
      flushIntervalMs: 60_000,
      registerUnloadHook: false,
    },
  );

  sink(telemetryFixture("shutdown-fail"));
  await sink.close({ force: true, maxDurationMs: 500 });

  assertEquals(calls, 1);
  assertEquals(sink.stats().failedFlushes, 1);
  assertEquals(sink.stats().droppedAfterRetries, 1);
  assertEquals(sink.stats().queueSize, 0);
});

Deno.test("buffered telemetry sink removes unload hook on close", async () => {
  const originalAddEventListener = globalThis.addEventListener;
  const originalRemoveEventListener = globalThis.removeEventListener;
  let addedUnloadListener: EventListenerOrEventListenerObject | undefined;
  let removedUnloadListener: EventListenerOrEventListenerObject | undefined;

  globalThis.addEventListener = ((
    type: Parameters<typeof globalThis.addEventListener>[0],
    listener: Parameters<typeof globalThis.addEventListener>[1],
    options?: Parameters<typeof globalThis.addEventListener>[2],
  ) => {
    if (type === "unload") {
      addedUnloadListener = listener;
    }
    return originalAddEventListener.call(globalThis, type, listener, options);
  }) as typeof globalThis.addEventListener;
  globalThis.removeEventListener = ((
    type: Parameters<typeof globalThis.removeEventListener>[0],
    listener: Parameters<typeof globalThis.removeEventListener>[1],
    options?: Parameters<typeof globalThis.removeEventListener>[2],
  ) => {
    if (type === "unload") {
      removedUnloadListener = listener;
    }
    return originalRemoveEventListener.call(
      globalThis,
      type,
      listener,
      options,
    );
  }) as typeof globalThis.removeEventListener;

  try {
    const sink = createBufferedTelemetrySink(() => {}, {
      flushIntervalMs: 60_000,
    });
    await sink.close({ force: true, maxDurationMs: 50 });

    assert(addedUnloadListener !== undefined);
    assertEquals(removedUnloadListener, addedUnloadListener);
  } finally {
    globalThis.addEventListener = originalAddEventListener;
    globalThis.removeEventListener = originalRemoveEventListener;
  }
});

Deno.test("buffered telemetry sink drain budget limits slow downstream", async () => {
  const sink = createBufferedTelemetrySink(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
    {
      maxBatchSize: 1,
      flushIntervalMs: 60_000,
      maxAttempts: 3,
      registerUnloadHook: false,
    },
  );

  sink(telemetryFixture("slow-drain"));
  const started = Date.now();
  await sink.flush({ force: true, maxDurationMs: 5 });
  const elapsedMs = Date.now() - started;

  assert(elapsedMs < 40);
  assertEquals(sink.stats().queueSize, 0);
  assertEquals(sink.stats().failedFlushes, 1);
  assertEquals(sink.stats().droppedAfterRetries, 1);

  await sink.close({ force: true, maxDurationMs: 5 });
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

Deno.test("OpenAI direct HTTP adapter sends bearer token and parses chat content", async () => {
  let capturedAuthorization = "";
  let capturedBody: Record<string, unknown> | undefined;

  const adapter = createOpenAIDirectAdapter({
    endpoint: "https://fixture.test/openai",
    apiKeyProvider: () => "openai-test-key",
    fetchFn: (_input, init) => {
      capturedAuthorization = new Headers(init?.headers).get("authorization") ??
        "";
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: "gpt-fixture",
            choices: [{ message: { content: "openai says hi" } }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    },
  });

  const output = await adapter.invoke("hello", new AbortController().signal);

  assertEquals(capturedAuthorization, "Bearer openai-test-key");
  assertEquals(capturedBody?.model, "gpt-4o-mini");
  assertEquals(output.provider, "OpenAI");
  assertEquals(output.model, "gpt-fixture");
  assertEquals(output.content, "openai says hi");
});

Deno.test("Anthropic direct HTTP adapter sends API key and parses text blocks", async () => {
  let capturedApiKey = "";
  let capturedVersion = "";
  let capturedBody: Record<string, unknown> | undefined;

  const adapter = createAnthropicDirectAdapter({
    endpoint: "https://fixture.test/anthropic",
    apiKeyProvider: () => "anthropic-test-key",
    fetchFn: (_input, init) => {
      const headers = new Headers(init?.headers);
      capturedApiKey = headers.get("x-api-key") ?? "";
      capturedVersion = headers.get("anthropic-version") ?? "";
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: "claude-fixture",
            content: [
              { type: "text", text: "anthropic" },
              { type: "text", text: "says hi" },
            ],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    },
  });

  const output = await adapter.invoke("hello", new AbortController().signal);

  assertEquals(capturedApiKey, "anthropic-test-key");
  assertEquals(capturedVersion, "2023-06-01");
  assertEquals(capturedBody?.model, "claude-3-5-haiku-latest");
  assertEquals(output.provider, "Anthropic");
  assertEquals(output.model, "claude-fixture");
  assertEquals(output.content, "anthropic\nsays hi");
});

Deno.test("direct HTTP adapter fails closed before fetch when API key is missing", async () => {
  let fetchCalls = 0;
  const adapter = createOpenAIDirectAdapter({
    apiKeyProvider: () => undefined,
    fetchFn: () => {
      fetchCalls += 1;
      return Promise.resolve(new Response("should not run"));
    },
  });

  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
  );

  assertEquals(error.codeName, "auth_failed");
  assertStringIncludes(error.message, "OPENAI_API_KEY");
  assertEquals(fetchCalls, 0);
});

Deno.test("direct HTTP provider auth failures redact API keys", async () => {
  const fixtureCredential = "redaction-test-key";
  const adapter = createOpenAIDirectAdapter({
    apiKeyProvider: () => fixtureCredential,
    fetchFn: () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: { message: `bad key ${fixtureCredential}` },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
  });

  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
  );

  assertEquals(error.codeName, "auth_failed");
  assertStringIncludes(error.message, "[REDACTED]");
  assert(!error.message.includes(fixtureCredential));
});

Deno.test("direct HTTP adapter retries rate limits and succeeds", async () => {
  let attempts = 0;
  const adapter = createOpenAIDirectAdapter({
    apiKeyProvider: () => "openai-retry-key",
    retryPolicy: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5 },
    fetchFn: () => {
      attempts += 1;
      if (attempts === 1) {
        return Promise.resolve(
          new Response("rate limit", {
            status: 429,
            headers: { "retry-after": "0" },
          }),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "retry success" } }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    },
  });

  const output = await adapter.invoke("hello", new AbortController().signal);

  assertEquals(attempts, 2);
  assertEquals(output.content, "retry success");
});

Deno.test("direct HTTP adapter propagates AbortSignal into fetch", async () => {
  let sawSignal = false;
  let sawAbort = false;
  const adapter = createOpenAIDirectAdapter({
    apiKeyProvider: () => "openai-abort-key",
    defaultTimeoutMs: 10,
    retryPolicy: { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1 },
    fetchFn: (_input, init) => {
      const signal = init?.signal;
      sawSignal = signal instanceof AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          sawAbort = true;
          reject(new DOMException("aborted", "AbortError"));
        }, { once: true });
      });
    },
  });

  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
  );

  assertEquals(error.codeName, "timeout");
  assert(sawSignal);
  assert(sawAbort);
});

Deno.test("OpenAI direct HTTP synthesis parses JSON content", async () => {
  const synthesisAdapter = createOpenAIDirectSynthesisAdapter({
    apiKeyProvider: () => "openai-synth-key",
    fetchFn: (_input, _init) =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{
              message: {
                content: JSON.stringify({
                  synthesis: "direct synthesis ok",
                  reasoning: "mocked OpenAI direct HTTP synthesis",
                  consensusModel: "OpenAI/gpt-4o-mini",
                  sources: ["OpenAI/gpt-fixture"],
                }),
              },
            }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
  });

  const output = await synthesisAdapter.synthesize(
    "hello",
    [{
      provider: "OpenAI",
      model: "gpt-fixture",
      content: "source output",
      latencyMs: 1,
    }],
    new AbortController().signal,
  );

  assertEquals(output.synthesis, "direct synthesis ok");
  assertEquals(output.sources, ["OpenAI/gpt-fixture"]);
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
