import {
  CoFailureTelemetry,
  createAnthropicDirectAdapter,
  createBufferedBatchSink,
  createBufferedTelemetrySink,
  createOpenAIDirectAdapter,
  createOpenAIDirectSynthesisAdapter,
  createOtlpHttpTelemetrySink,
  createProcessAdapter,
  createSupabaseAuditHandler,
  createSupabaseAuditSink,
  FinalSynthesis,
  FinalSynthesisSchema,
  FusionRouter,
  InMemoryBudgetManager,
  ModelAdapter,
  ModelOutput,
  parseRoutingMode,
  ProcessExecutionError,
  resolveRoutingMode,
  RouterError,
  ROUTING_MODE_ENV,
  SynthesisAdapter,
} from "./router.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { FakeTime } from "@std/testing/time";

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

type AuditFixture = {
  eventType: string;
  actorType: "ai_assistant";
  decision: "allow" | "deny" | "error";
  workflowId: string;
};

function auditFixture(eventType: string): AuditFixture {
  return {
    eventType,
    actorType: "ai_assistant",
    decision: "allow",
    workflowId: "wf-fixture",
  };
}

class CountingAdapter implements ModelAdapter {
  readonly descriptor = {
    provider: "Fixture",
    model: "counting",
    authMode: "session",
    transport: "processAdapter",
    client: "CountingAdapter",
  } as const;
  calls = 0;

  constructor(
    private readonly response: ModelOutput = {
      provider: "Fixture",
      model: "counting",
      content: "validated upstream output",
      latencyMs: 1,
    },
  ) {}

  invoke(_prompt: string, _signal: AbortSignal): Promise<ModelOutput> {
    this.calls += 1;
    return Promise.resolve(this.response);
  }
}

async function withRoutingModeEnv<T>(
  value: string | undefined,
  fn: () => T | Promise<T>,
): Promise<T> {
  const original = Deno.env.get(ROUTING_MODE_ENV);
  if (value === undefined) {
    Deno.env.delete(ROUTING_MODE_ENV);
  } else {
    Deno.env.set(ROUTING_MODE_ENV, value);
  }

  try {
    return await fn();
  } finally {
    if (original === undefined) {
      Deno.env.delete(ROUTING_MODE_ENV);
    } else {
      Deno.env.set(ROUTING_MODE_ENV, original);
    }
  }
}

function buildRouter(
  adapter: ModelAdapter,
  synthesisAdapter: SynthesisAdapter,
  options: {
    routingMode?: unknown;
    routingModeEnvProvider?: () => unknown;
  } = {},
): FusionRouter {
  return new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter,
    minSuccessfulAdapters: 1,
    timeoutMs: 10_000,
    routingMode: options.routingMode,
    routingModeEnvProvider: options.routingModeEnvProvider,
  });
}

function staticOkSynthesis(): StaticSynthesisAdapter {
  return new StaticSynthesisAdapter({
    synthesis: "ok",
    reasoning: "fixture consensus",
    consensusModel: "Test/static-synth",
    sources: ["Fixture/counting"],
  });
}

Deno.test("routing mode default is direct", () => {
  assertEquals(resolveRoutingMode(), { mode: "direct", source: "default" });
});

Deno.test("routing mode absent or undefined values default to direct", () => {
  assertEquals(
    resolveRoutingMode({
      requestMode: undefined,
      configMode: undefined,
      envMode: undefined,
    }),
    { mode: "direct", source: "default" },
  );
  assertEquals(parseRoutingMode(undefined, "request"), undefined);
});

Deno.test("routing mode direct explicit value works", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => undefined,
  });

  assertEquals(router.resolveRoutingModeForRequest({ routingMode: "direct" }), {
    mode: "direct",
    source: "request",
  });

  const result = await router.route("hello", { routingMode: "direct" });

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("routing mode precedence is request metadata over config over env over default", () => {
  assertEquals(
    resolveRoutingMode({
      requestMode: "direct",
      configMode: "agent_chat",
      envMode: "agent_chat",
    }),
    { mode: "direct", source: "request" },
  );
  assertEquals(
    resolveRoutingMode({ configMode: "agent_chat", envMode: "direct" }),
    { mode: "agent_chat", source: "config" },
  );
  assertEquals(resolveRoutingMode({ envMode: "direct" }), {
    mode: "direct",
    source: "env",
  });
  assertEquals(resolveRoutingMode(), { mode: "direct", source: "default" });
});

Deno.test("routing mode default direct path preserves successful router behavior", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => undefined,
  });

  assertEquals(router.resolveRoutingModeForRequest(), {
    mode: "direct",
    source: "default",
  });

  const result = await router.route("hello");

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("routing mode request direct overrides config and skips env provider at runtime", async () => {
  const adapter = new CountingAdapter();
  let envCalls = 0;
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: "agent_chat",
    routingModeEnvProvider: () => {
      envCalls += 1;
      throw new Error("env provider should not run when request mode is set");
    },
  });

  assertEquals(router.resolveRoutingModeForRequest({ routingMode: "direct" }), {
    mode: "direct",
    source: "request",
  });

  const result = await router.route("hello", { routingMode: "direct" });

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
  assertEquals(envCalls, 0);
});

Deno.test("routing mode config direct overrides and skips env provider at runtime", async () => {
  const adapter = new CountingAdapter();
  let envCalls = 0;
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: "direct",
    routingModeEnvProvider: () => {
      envCalls += 1;
      throw new Error("env provider should not run when config mode is set");
    },
  });

  assertEquals(router.resolveRoutingModeForRequest(), {
    mode: "direct",
    source: "config",
  });

  const result = await router.route("hello");

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
  assertEquals(envCalls, 0);
});

Deno.test("routing mode config agent_chat fails closed before adapter execution", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: "agent_chat",
    routingModeEnvProvider: () => "direct",
  });

  assertEquals(router.resolveRoutingModeForRequest(), {
    mode: "agent_chat",
    source: "config",
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.code, "routing_mode_not_implemented");
  assertEquals(adapter.calls, 0);
});

Deno.test("routing mode agent_chat is recognized but fails closed before adapter execution", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => undefined,
  });

  assertEquals(
    router.resolveRoutingModeForRequest({ routingMode: "agent_chat" }),
    {
      mode: "agent_chat",
      source: "request",
    },
  );

  const error = await assertRejects(
    () => router.route("hello", { routingMode: "agent_chat" }),
    RouterError,
  );

  assertEquals(error.status, 4401);
  assertEquals(error.code, "routing_mode_not_implemented");
  assertEquals(adapter.calls, 0);
});

Deno.test("routing mode invalid value fails closed before adapter execution", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => undefined,
  });

  const error = await assertRejects(
    () => router.route("hello", { routingMode: "auto" }),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
  assert(!error.message.includes("auto"));
  assertEquals(adapter.calls, 0);
});

Deno.test("routing mode invalid request value overrides valid lower-precedence modes", async () => {
  const adapter = new CountingAdapter();
  let envCalls = 0;
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: "direct",
    routingModeEnvProvider: () => {
      envCalls += 1;
      return "direct";
    },
  });

  const error = await assertRejects(
    () => router.route("hello", { routingMode: "auto" }),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
  assert(!error.message.includes("auto"));
  assertEquals(adapter.calls, 0);
  assertEquals(envCalls, 0);
});

Deno.test("routing mode non-string explicit values fail closed before adapter execution", async () => {
  const requestAdapter = new CountingAdapter();
  const requestRouter = buildRouter(requestAdapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => "direct",
  });
  const requestError = await assertRejects(
    () => requestRouter.route("hello", { routingMode: 123 }),
    RouterError,
  );
  assertEquals(requestError.status, 4400);
  assertEquals(requestError.code, "invalid_routing_mode");
  assertEquals(requestAdapter.calls, 0);

  const configAdapter = new CountingAdapter();
  const configRouter = buildRouter(configAdapter, staticOkSynthesis(), {
    routingMode: null,
    routingModeEnvProvider: () => "direct",
  });
  const configError = await assertRejects(
    () => configRouter.route("hello"),
    RouterError,
  );
  assertEquals(configError.status, 4400);
  assertEquals(configError.code, "invalid_routing_mode");
  assertEquals(configAdapter.calls, 0);

  const envAdapter = new CountingAdapter();
  const envRouter = buildRouter(envAdapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => ({ mode: "direct" }),
  });
  const envError = await assertRejects(
    () => envRouter.route("hello"),
    RouterError,
  );
  assertEquals(envError.status, 4400);
  assertEquals(envError.code, "invalid_routing_mode");
  assertEquals(envAdapter.calls, 0);
});

Deno.test("routing mode config empty string fails closed before adapter execution", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: "",
    routingModeEnvProvider: () => "direct",
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
  assertEquals(adapter.calls, 0);
});

Deno.test("routing mode explicit empty string fails closed", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingModeEnvProvider: () => undefined,
  });

  const error = await assertRejects(
    () => router.route("hello", { routingMode: "" }),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
  assertEquals(adapter.calls, 0);
});

Deno.test("routing mode env empty string fails closed before adapter execution", async () => {
  await withRoutingModeEnv("", async () => {
    const adapter = new CountingAdapter();
    const router = buildRouter(adapter, staticOkSynthesis());

    const error = await assertRejects(
      () => router.route("hello"),
      RouterError,
    );

    assertEquals(error.status, 4400);
    assertEquals(error.code, "invalid_routing_mode");
    assertEquals(adapter.calls, 0);
  });
});

Deno.test("routing mode env direct works", async () => {
  await withRoutingModeEnv("direct", async () => {
    const adapter = new CountingAdapter();
    const router = buildRouter(adapter, staticOkSynthesis());

    assertEquals(router.resolveRoutingModeForRequest(), {
      mode: "direct",
      source: "env",
    });

    const result = await router.route("hello");

    assertEquals(result.synthesis, "ok");
    assertEquals(adapter.calls, 1);
  });
});

Deno.test("routing mode env agent_chat resolves but fails closed before adapter execution", async () => {
  await withRoutingModeEnv("agent_chat", async () => {
    const adapter = new CountingAdapter();
    const router = buildRouter(adapter, staticOkSynthesis());

    assertEquals(router.resolveRoutingModeForRequest(), {
      mode: "agent_chat",
      source: "env",
    });

    const error = await assertRejects(
      () => router.route("hello"),
      RouterError,
    );

    assertEquals(error.code, "routing_mode_not_implemented");
    assertEquals(adapter.calls, 0);
  });
});

Deno.test("routing mode invalid env value fails closed before adapter execution", async () => {
  await withRoutingModeEnv("invalid", async () => {
    const adapter = new CountingAdapter();
    const router = buildRouter(adapter, staticOkSynthesis());

    const error = await assertRejects(
      () => router.route("hello"),
      RouterError,
    );

    assertEquals(error.status, 4400);
    assertEquals(error.code, "invalid_routing_mode");
    assert(!error.message.includes("invalid"));
    assertEquals(adapter.calls, 0);
  });
});

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

Deno.test("generic buffered batch sink fail-closed rejects full queue", async () => {
  const sink = createBufferedBatchSink<number>(() => {}, {
    maxQueueSize: 1,
    maxBatchSize: 10,
    flushIntervalMs: 60_000,
    overflowPolicy: "fail_closed",
    registerUnloadHook: false,
  });

  sink(1);
  await assertRejects(
    async () => await sink(2),
    ProcessExecutionError,
    "queue is full",
  );
  assertEquals(sink.stats().queueSize, 1);
  assertEquals(sink.stats().rejected, 1);
  assertEquals(sink.stats().droppedOldest, 0);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("generic buffered batch sink preserves ordered batches", async () => {
  const batches: number[][] = [];
  const sink = createBufferedBatchSink<number>((records) => {
    batches.push([...records]);
  }, {
    maxQueueSize: 10,
    maxBatchSize: 3,
    flushIntervalMs: 60_000,
    registerUnloadHook: false,
  });

  sink(1);
  sink(2);
  sink(3);
  sink(4);
  sink(5);
  await sink.flush({ force: true, maxDurationMs: 100 });

  assertEquals(batches, [[1, 2, 3], [4, 5]]);
  assertEquals(sink.stats().delivered, 5);
  assertEquals(sink.stats().queueSize, 0);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("generic buffered batch sink retries deterministically with FakeTime", async () => {
  const time = new FakeTime(0);
  try {
    let calls = 0;
    const delivered: number[] = [];
    const sink = createBufferedBatchSink<number>((records) => {
      calls += 1;
      if (calls === 1) {
        throw new Error("collector unavailable");
      }
      delivered.push(...records);
    }, {
      maxBatchSize: 1,
      flushIntervalMs: 60_000,
      baseBackoffMs: 100,
      maxBackoffMs: 100,
      maxAttempts: 3,
      registerUnloadHook: false,
    });

    sink(42);
    await sink.flush({ maxDurationMs: 50 });

    assertEquals(calls, 1);
    assertEquals(delivered, []);
    assertEquals(sink.stats().queueSize, 1);

    await sink.flush({ maxDurationMs: 50 });
    assertEquals(calls, 1);

    time.tick(100);
    await sink.flush({ maxDurationMs: 50 });

    assertEquals(calls, 2);
    assertEquals(delivered, [42]);
    assertEquals(sink.stats().delivered, 1);
    assertEquals(sink.stats().queueSize, 0);

    await sink.close({ force: true, maxDurationMs: 50 });
  } finally {
    time.restore();
  }
});

Deno.test("generic buffered batch sink drop-oldest implementation avoids Array.shift", async () => {
  const source = await Deno.readTextFile("router.ts");
  const genericBlock = source.slice(
    source.indexOf("export function createBufferedBatchSink"),
    source.indexOf("export function createBufferedTelemetrySink"),
  );

  assert(!genericBlock.includes(".shift("));
});

Deno.test("generic must-accept sink preserves concurrent accepted records after failed flush", async () => {
  let rejectFirst: ((error: Error) => void) | undefined;
  const delivered: number[] = [];
  const calls: number[][] = [];
  const sink = createBufferedBatchSink<number>((records) => {
    calls.push([...records]);
    if (calls.length === 1) {
      return new Promise<void>((_resolve, reject) => {
        rejectFirst = reject;
      });
    }
    delivered.push(...records);
  }, {
    deliveryMode: "must_accept",
    overflowPolicy: "fail_closed",
    maxQueueSize: 2,
    maxBatchSize: 1,
    defaultDrainMs: 1_000,
    registerUnloadHook: false,
  });

  const first = sink(1) as Promise<void>;
  for (
    let attempt = 0;
    attempt < 10 && rejectFirst === undefined;
    attempt += 1
  ) {
    await Promise.resolve();
  }
  assert(rejectFirst);

  const second = sink(2) as Promise<void>;
  await assertRejects(
    async () => await sink(3),
    ProcessExecutionError,
    "queue is full",
  );

  rejectFirst(new Error("audit store unavailable"));
  await assertRejects(
    async () => await first,
    Error,
    "audit store unavailable",
  );
  await second;

  assertEquals(delivered, [1, 2]);
  assertEquals(sink.stats().queueSize, 0);
  assertEquals(sink.stats().rejected, 1);
  assertEquals(sink.stats().delivered, 2);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("legacy telemetry sink avoids duplicate delivery after partial downstream failure", async () => {
  const time = new FakeTime(0);
  try {
    let failSecond = true;
    const delivered: string[] = [];
    const sink = createBufferedTelemetrySink((telemetry) => {
      const message = telemetry.failures[0]?.message ?? "missing";
      if (message === "second" && failSecond) {
        failSecond = false;
        throw new Error("partial downstream failure");
      }
      delivered.push(message);
    }, {
      maxQueueSize: 5,
      maxBatchSize: 2,
      flushIntervalMs: 60_000,
      baseBackoffMs: 100,
      maxBackoffMs: 100,
      maxAttempts: 3,
      registerUnloadHook: false,
    });

    sink(telemetryFixture("first"));
    sink(telemetryFixture("second"));
    await sink.flush({ maxDurationMs: 50 });

    assertEquals(delivered, ["first"]);
    assertEquals(sink.stats().queueSize, 1);

    await sink.flush({ maxDurationMs: 50 });

    assertEquals(delivered, ["first"]);
    assertEquals(sink.stats().queueSize, 1);

    await sink.flush({ maxDurationMs: 50, force: true });

    assertEquals(delivered, ["first", "second"]);
    assertEquals(sink.stats().queueSize, 0);

    await sink.close({ force: true, maxDurationMs: 50 });
  } finally {
    time.restore();
  }
});

Deno.test("generic must-accept sink recovers after handler failure", async () => {
  let failNext = true;
  const delivered: number[] = [];
  const sink = createBufferedBatchSink<number>((records) => {
    if (failNext) {
      failNext = false;
      throw new Error("audit store unavailable");
    }
    delivered.push(...records);
  }, {
    deliveryMode: "must_accept",
    overflowPolicy: "fail_closed",
    maxQueueSize: 3,
    maxBatchSize: 1,
    defaultDrainMs: 50,
    registerUnloadHook: false,
  });

  await assertRejects(
    async () => await sink(1),
    Error,
    "audit store unavailable",
  );
  assertEquals(sink.stats().queueSize, 1);
  assertEquals(sink.stats().delivered, 0);

  await sink(2);

  assertEquals(delivered, [1, 2]);
  assertEquals(sink.stats().delivered, 2);
  assertEquals(sink.stats().queueSize, 0);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("supabase audit RPC payload omits DB-owned identity fields", async () => {
  const jwtCredential = ["jwt", "fixture", "value"].join("-");
  const publicCredential = ["public", "fixture", "value"].join("-");
  const requests: Array<{ input: string | URL | Request; init?: RequestInit }> =
    [];
  const handler = createSupabaseAuditHandler({
    supabaseUrl: "https://project.example.test",
    jwtProvider: () => jwtCredential,
    anonKeyProvider: () => publicCredential,
    fetchFn: (input, init) => {
      requests.push({ input, init });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });
  const record = {
    ...auditFixture("workflow.access"),
    actorId: "00000000-0000-0000-0000-000000000001",
    createdAt: "2000-01-01T00:00:00.000Z",
    org_id: "client-org",
    actor_id: "00000000-0000-0000-0000-000000000002",
    created_at: "1999-01-01T00:00:00.000Z",
  } as AuditFixture & Record<string, unknown>;

  await handler([record], { deadlineMs: Date.now() + 1_000 });

  assertEquals(requests.length, 1);
  const body = JSON.parse(String(requests[0].init?.body));
  assertEquals(body.records.length, 1);
  assertEquals(body.records[0].event_type, "workflow.access");
  assertEquals(body.records[0].actor_type, "ai_assistant");
  assertEquals(body.records[0].workflow_id, "wf-fixture");
  assertEquals(body.records[0].decision, "allow");
  assertEquals("org_id" in body.records[0], false);
  assertEquals("actor_id" in body.records[0], false);
  assertEquals("created_at" in body.records[0], false);
  assertEquals("actorId" in body.records[0], false);
  assertEquals("createdAt" in body.records[0], false);
});

Deno.test("supabase audit handler calls the batch RPC with user JWT", async () => {
  const jwtCredential = ["jwt", "transport", "fixture"].join("-");
  const publicCredential = ["public", "transport", "fixture"].join("-");
  const requests: Array<{ input: string | URL | Request; init?: RequestInit }> =
    [];
  const handler = createSupabaseAuditHandler({
    supabaseUrl: "https://project.example.test/",
    jwtProvider: () => jwtCredential,
    anonKeyProvider: () => publicCredential,
    fetchFn: (input, init) => {
      requests.push({ input, init });
      return Promise.resolve(new Response(null, { status: 204 }));
    },
  });

  await handler([auditFixture("workflow.rpc")], {
    deadlineMs: Date.now() + 1_000,
  });

  assertEquals(
    String(requests[0].input),
    "https://project.example.test/rest/v1/rpc/insert_workflow_access_audit_batch",
  );
  const headers = requests[0].init?.headers as Record<string, string>;
  assertEquals(headers["authorization"], `Bearer ${jwtCredential}`);
  assertEquals(headers["apikey"], publicCredential);
  assertEquals(headers["prefer"], "return=minimal");
});

Deno.test("supabase audit RPC failure rejects the must-accept sink", async () => {
  const jwtCredential = ["jwt", "failure", "fixture"].join("-");
  const publicCredential = ["public", "failure", "fixture"].join("-");
  const sink = createSupabaseAuditSink({
    flushHandler: createSupabaseAuditHandler({
      supabaseUrl: "https://project.example.test",
      jwtProvider: () => jwtCredential,
      anonKeyProvider: () => publicCredential,
      fetchFn: () =>
        Promise.resolve(
          new Response(`upstream ${jwtCredential} ${publicCredential}`, {
            status: 500,
          }),
        ),
    }),
    defaultDrainMs: 100,
    registerUnloadHook: false,
  });

  const error = await assertRejects(
    async () => await sink(auditFixture("workflow.fail")),
    ProcessExecutionError,
    "HTTP 500",
  );

  assert(!error.message.includes(jwtCredential));
  assert(!error.message.includes(publicCredential));
  assertStringIncludes(error.message, "[REDACTED]");
  assertEquals(sink.stats().queueSize, 1);

  await sink.close({ force: true, maxDurationMs: 10 });
});

Deno.test("supabase audit sink preserves accepted records after transient RPC failure", async () => {
  const jwtCredential = ["jwt", "transient", "fixture"].join("-");
  const publicCredential = ["public", "transient", "fixture"].join("-");
  let calls = 0;
  const bodies: unknown[] = [];
  const sink = createSupabaseAuditSink({
    flushHandler: createSupabaseAuditHandler({
      supabaseUrl: "https://project.example.test",
      jwtProvider: () => jwtCredential,
      anonKeyProvider: () => publicCredential,
      fetchFn: (_input, init) => {
        calls += 1;
        bodies.push(JSON.parse(String(init?.body)));
        if (calls === 1) {
          return Promise.resolve(
            new Response("temporary unavailable", { status: 500 }),
          );
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      },
    }),
    maxQueueSize: 2,
    maxBatchSize: 2,
    defaultDrainMs: 100,
    registerUnloadHook: false,
  });

  await assertRejects(
    async () => await sink(auditFixture("workflow.first")),
    ProcessExecutionError,
    "HTTP 500",
  );
  await sink(auditFixture("workflow.second"));

  const retried = bodies[1] as { records: Array<{ event_type: string }> };
  assertEquals(
    retried.records.map((record) => record.event_type),
    ["workflow.first", "workflow.second"],
  );
  assertEquals(sink.stats().queueSize, 0);
  assertEquals(sink.stats().delivered, 2);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("supabase audit runtime path works without service-role env", async () => {
  const original = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const jwtCredential = ["jwt", "runtime", "fixture"].join("-");
    const publicCredential = ["public", "runtime", "fixture"].join("-");
    let delivered = 0;
    const sink = createSupabaseAuditSink({
      flushHandler: createSupabaseAuditHandler({
        supabaseUrl: "https://project.example.test",
        jwtProvider: () => jwtCredential,
        anonKeyProvider: () => publicCredential,
        fetchFn: () => {
          delivered += 1;
          return Promise.resolve(new Response(null, { status: 204 }));
        },
      }),
      registerUnloadHook: false,
    });

    await sink(auditFixture("workflow.runtime"));

    assertEquals(delivered, 1);
    assertEquals(sink.stats().delivered, 1);
  } finally {
    if (original === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", original);
    }
  }
});

Deno.test("supabase audit migration enforces RPC-only authenticated writes", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260701130000_workflow_access_audit.sql",
  );
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");

  assertStringIncludes(
    normalized,
    "create table if not exists public.workflow_access_audit",
  );
  assertStringIncludes(
    normalized,
    "alter table public.workflow_access_audit enable row level security",
  );
  assertStringIncludes(
    normalized,
    "revoke all privileges on table public.workflow_access_audit from authenticated",
  );
  assertStringIncludes(
    normalized,
    "grant execute on function public.insert_workflow_access_audit_batch(jsonb) to authenticated",
  );
  assert(
    !/grant\s+(?:all|select|insert|update|delete)(?:\s+privileges)?\s+on\s+table\s+public\.workflow_access_audit\s+to\s+authenticated/i
      .test(sql),
  );
});

Deno.test("supabase audit migration denies anon table and RPC access", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260701130000_workflow_access_audit.sql",
  );
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");

  assertStringIncludes(
    normalized,
    "revoke all privileges on table public.workflow_access_audit from anon",
  );
  assertStringIncludes(
    normalized,
    "revoke all privileges on function public.insert_workflow_access_audit_batch(jsonb) from anon",
  );
  assert(
    !/grant\s+execute\s+on\s+function\s+public\.insert_workflow_access_audit_batch\(jsonb\)\s+to\s+anon/i
      .test(sql),
  );
});

Deno.test("supabase audit RPC SQL derives actor and org from auth claims", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260701130000_workflow_access_audit.sql",
  );
  const normalized = sql.toLowerCase().replace(/\s+/g, " ");

  assertStringIncludes(normalized, "security definer");
  assertStringIncludes(normalized, "set search_path = public, pg_temp");
  assertStringIncludes(normalized, "claim_actor_id := auth.uid()");
  assertStringIncludes(
    normalized,
    "claim_org_id := nullif(auth.jwt() ->> 'org_id', '')",
  );
  assertStringIncludes(normalized, "claim_org_id,");
  assertStringIncludes(normalized, "claim_actor_id,");
  assertStringIncludes(normalized, "now()");
  assert(!/rec\s*->>\s*'org_id'/i.test(sql));
  assert(!/rec\s*->>\s*'actor_id'/i.test(sql));
  assert(!/rec\s*->>\s*'created_at'/i.test(sql));
});

Deno.test("supabase audit sink fail-closed delivery does not drop accepted logs", async () => {
  const delivered: AuditFixture[] = [];
  const sink = createSupabaseAuditSink({
    flushHandler: (records) => {
      delivered.push(...records as AuditFixture[]);
    },
    maxQueueSize: 2,
    maxBatchSize: 2,
    flushIntervalMs: 60_000,
    registerUnloadHook: false,
  });

  await sink(auditFixture("workflow.start"));
  await sink(auditFixture("workflow.end"));

  assertEquals(delivered.map((record) => record.eventType), [
    "workflow.start",
    "workflow.end",
  ]);
  assertEquals(sink.stats().delivered, 2);
  assertEquals(sink.stats().droppedOldest, 0);
  assertEquals(sink.stats().droppedAfterRetries, 0);
  assertEquals(sink.stats().queueSize, 0);

  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("supabase audit sink runtime path does not require service role env", async () => {
  const original = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const delivered: AuditFixture[] = [];
    const sink = createSupabaseAuditSink({
      flushHandler: (records) => {
        delivered.push(...records as AuditFixture[]);
      },
      registerUnloadHook: false,
    });

    await sink(auditFixture("workflow.audit"));

    assertEquals(delivered.length, 1);
    assertEquals(Object.keys(delivered[0]).includes("org_id"), false);
    assertEquals(Object.keys(delivered[0]).includes("service_role"), false);
  } finally {
    if (original === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", original);
    }
  }
});

Deno.test("router runtime sink implementation has no Supabase service-role env dependency", async () => {
  const source = await Deno.readTextFile("router.ts");
  assert(!/SUPABASE.*SERVICE.*ROLE/i.test(source));
});

function isolatedDoctorEnv(
  env: Record<string, string> = {},
): Record<string, string> {
  return { PATH: Deno.env.get("PATH") ?? "", ...env };
}

Deno.test("doctor masks endpoint query and fragment credentials", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-env", "--allow-run", "doctor.ts"],
    clearEnv: true,
    env: isolatedDoctorEnv({
      OTEL_EXPORTER_OTLP_ENDPOINT:
        "https://user:password@example.test/v1/logs?q=redaction-fixture#fragment-fixture",
    }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  assertStringIncludes(text, "https://[REDACTED]@example.test/v1/logs");
  assert(!text.includes("redaction-fixture"));
  assert(!text.includes("fragment-fixture"));
  assert(!text.includes("q="));
  assert(!text.includes("password"));
});

Deno.test("doctor service-role check is scoped to Supabase env keys", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-env", "--allow-run", "doctor.ts"],
    clearEnv: true,
    env: isolatedDoctorEnv({
      SERVICE_ROLE_KEY: "unrelated-fixture-value",
    }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  assertStringIncludes(text, "no service-role-like Supabase env vars present");
});

Deno.test("doctor fails closed when Supabase service-role env is present", async () => {
  const credentialFixture = ["runtime", "blocked", "fixture"].join("-");
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-env", "--allow-run", "doctor.ts"],
    clearEnv: true,
    env: isolatedDoctorEnv({
      FUSION_ROUTER_SUPABASE_SERVICE_ROLE_KEY: credentialFixture,
    }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(!output.success, text);
  assertStringIncludes(text, "supabase_service_role_absent");
  assertStringIncludes(text, "FUSION_ROUTER_SUPABASE_SERVICE_ROLE_KEY");
  assert(!text.includes(credentialFixture));
});

Deno.test("doctor treats unconfigured Supabase audit as informational", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-env", "--allow-run", "doctor.ts"],
    clearEnv: true,
    env: isolatedDoctorEnv(),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const report = JSON.parse(text);
  const check = report.checks.find((item: { name: string }) =>
    item.name === "supabase_audit_config"
  );
  assertEquals(check.detail, "not configured");
  assertEquals(check.severity, "info");
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
