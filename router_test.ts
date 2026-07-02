import {
  AGENT_CHAT_ROLES,
  AgentChatAuditMilestone,
  AgentChatObjectionSchema,
  AgentChatRoleSchema,
  CircuitBreaker,
  CoFailureTelemetry,
  createAnthropicDirectAdapter,
  createBufferedBatchSink,
  createBufferedTelemetrySink,
  createCapabilityDirectRoutingPolicy,
  createClaudeCodeAdapter,
  createClineCliAdapter,
  createCodexCliAdapter,
  createCodexStructuredSynthesisAdapter,
  createDefaultProviderCapabilityRegistry,
  createDevinCliAdapter,
  createGeminiCliAdapter,
  createGrokCliAdapter,
  createInMemoryAgentChatAuditSink,
  createOpenAIDirectAdapter,
  createOpenAIDirectSynthesisAdapter,
  createOtlpHttpTelemetrySink,
  createProcessAdapter,
  createSafeProviderUnavailableFallbackPolicy,
  createSupabaseAuditHandler,
  createSupabaseAuditSink,
  createZcodeGlmAdapter,
  describeRoutingModeDecision,
  fallbackReasonFromError,
  FinalSynthesis,
  FinalSynthesisSchema,
  FusionRouter,
  generateEnvExample,
  generateFusionRouterConfig,
  generateSetupReport,
  InMemoryBudgetManager,
  isFallbackAllowed,
  loadFusionRouterConfig,
  loadFusionRouterConfigText,
  loadFusionRouterConfigValue,
  ModelAdapter,
  ModelOutput,
  normalizeAgentChatLimits,
  parseRoutingMode,
  ProcessExecutionError,
  ProviderCapabilityRegistry,
  redactAgentChatContent,
  redactSecrets,
  resolveRoutingMode,
  RouterError,
  ROUTING_MODE_ENV,
  runAgentChatSimulator,
  SynthesisAdapter,
} from "./router.ts";
import type { DirectRoutingDecision, ProviderDescriptor } from "./router.ts";
import type {
  AgentChatDecision as SmokeAgentChatDecision,
  AgentChatLimits as SmokeAgentChatLimits,
  AgentChatMessage as SmokeAgentChatMessage,
  AgentChatRole as SmokeAgentChatRole,
  AgentChatRunConfig as SmokeAgentChatRunConfig,
  AgentChatTranscript as SmokeAgentChatTranscript,
  AnthropicDirectAdapterOptions as SmokeAnthropicDirectAdapterOptions,
  AuthStrategy as SmokeAuthStrategy,
  BudgetManager as SmokeBudgetManager,
  BufferedBatchHandler as SmokeBufferedBatchHandler,
  BufferedBatchSink as SmokeBufferedBatchSink,
  BufferedBatchSinkOptions as SmokeBufferedBatchSinkOptions,
  BufferedBatchSinkStats as SmokeBufferedBatchSinkStats,
  BufferedSinkDeliveryMode as SmokeBufferedSinkDeliveryMode,
  BufferedSinkFlushContext as SmokeBufferedSinkFlushContext,
  BufferedSinkOverflowPolicy as SmokeBufferedSinkOverflowPolicy,
  BufferedTelemetrySinkOptions as SmokeBufferedTelemetrySinkOptions,
  BufferedTelemetrySinkStats as SmokeBufferedTelemetrySinkStats,
  CircuitBreakerOptions as SmokeCircuitBreakerOptions,
  ClineCliAdapterOptions as SmokeClineCliAdapterOptions,
  CodexCliAdapterOptions as SmokeCodexCliAdapterOptions,
  CodexSynthesisAdapterOptions as SmokeCodexSynthesisAdapterOptions,
  CoFailureTelemetry as SmokeCoFailureTelemetry,
  DevinCliAdapterOptions as SmokeDevinCliAdapterOptions,
  DirectHttpAdapterOptions as SmokeDirectHttpAdapterOptions,
  DirectHttpExecutionResult as SmokeDirectHttpExecutionResult,
  DirectHttpRequest as SmokeDirectHttpRequest,
  DirectHttpResponseParser as SmokeDirectHttpResponseParser,
  DirectRoutingDecision as SmokeDirectRoutingDecision,
  DirectRoutingPolicy as SmokeDirectRoutingPolicy,
  ExplicitRoutingModeSource as SmokeExplicitRoutingModeSource,
  FallbackPolicy as SmokeFallbackPolicy,
  FallbackPolicyDecision as SmokeFallbackPolicyDecision,
  FallbackReason as SmokeFallbackReason,
  FallbackReasonContext as SmokeFallbackReasonContext,
  FetchLike as SmokeFetchLike,
  FinalSynthesis as SmokeFinalSynthesis,
  FlushableTelemetrySink as SmokeFlushableTelemetrySink,
  FusionRouterConfig as SmokeFusionRouterConfig,
  FusionRouterOptions as SmokeFusionRouterOptions,
  FusionRouterRouteOptions as SmokeFusionRouterRouteOptions,
  GeminiCliAdapterOptions as SmokeGeminiCliAdapterOptions,
  GeneratedFusionRouterConfig as SmokeGeneratedFusionRouterConfig,
  GrokCliAdapterOptions as SmokeGrokCliAdapterOptions,
  ModelAdapter as SmokeModelAdapter,
  ModelOutput as SmokeModelOutput,
  ModelOutputParser as SmokeModelOutputParser,
  OpenAIDirectAdapterOptions as SmokeOpenAIDirectAdapterOptions,
  OpenAIDirectSynthesisAdapterOptions
    as SmokeOpenAIDirectSynthesisAdapterOptions,
  OtlpTelemetrySinkOptions as SmokeOtlpTelemetrySinkOptions,
  ProcessExecutionResult as SmokeProcessExecutionResult,
  ProcessInvocation as SmokeProcessInvocation,
  ProcessModelAdapterOptions as SmokeProcessModelAdapterOptions,
  ProviderCapability as SmokeProviderCapability,
  ProviderDescriptor as SmokeProviderDescriptor,
  ProviderReadinessHint as SmokeProviderReadinessHint,
  RetryPolicy as SmokeRetryPolicy,
  RoutingMode as SmokeRoutingMode,
  RoutingModeDecision as SmokeRoutingModeDecision,
  RoutingModeResolution as SmokeRoutingModeResolution,
  RoutingModeResolveInput as SmokeRoutingModeResolveInput,
  RoutingModeSource as SmokeRoutingModeSource,
  SetupReport as SmokeSetupReport,
  SetupWizardInput as SmokeSetupWizardInput,
  SupabaseAuditHandlerOptions as SmokeSupabaseAuditHandlerOptions,
  SupabaseAuditRecord as SmokeSupabaseAuditRecord,
  SupabaseAuditSinkOptions as SmokeSupabaseAuditSinkOptions,
  SynthesisAdapter as SmokeSynthesisAdapter,
  TelemetryFailure as SmokeTelemetryFailure,
  TelemetryFlushOptions as SmokeTelemetryFlushOptions,
  TelemetrySink as SmokeTelemetrySink,
  ZcodeAdapterOptions as SmokeZcodeAdapterOptions,
} from "./router.ts";
import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
  assertThrows,
} from "@std/assert";
import { FakeTime } from "@std/testing/time";

type PublicExportTypeSmoke = [
  SmokeAgentChatDecision,
  SmokeAgentChatLimits,
  SmokeAgentChatMessage,
  SmokeAgentChatRole,
  SmokeAgentChatRunConfig,
  SmokeAgentChatTranscript,
  SmokeAnthropicDirectAdapterOptions,
  SmokeAuthStrategy,
  SmokeBufferedBatchHandler<unknown>,
  SmokeBufferedBatchSink<unknown>,
  SmokeBufferedBatchSinkOptions,
  SmokeBufferedBatchSinkStats,
  SmokeBufferedSinkDeliveryMode,
  SmokeBufferedSinkFlushContext,
  SmokeBufferedSinkOverflowPolicy,
  SmokeBufferedTelemetrySinkOptions,
  SmokeBufferedTelemetrySinkStats,
  SmokeBudgetManager,
  SmokeCircuitBreakerOptions,
  SmokeClineCliAdapterOptions,
  SmokeCodexCliAdapterOptions,
  SmokeCodexSynthesisAdapterOptions,
  SmokeCoFailureTelemetry,
  SmokeDevinCliAdapterOptions,
  SmokeDirectHttpAdapterOptions,
  SmokeDirectHttpExecutionResult,
  SmokeDirectRoutingDecision,
  SmokeDirectRoutingPolicy,
  SmokeDirectHttpRequest,
  SmokeDirectHttpResponseParser,
  SmokeExplicitRoutingModeSource,
  SmokeFetchLike,
  SmokeFinalSynthesis,
  SmokeFlushableTelemetrySink,
  SmokeFallbackPolicy,
  SmokeFallbackPolicyDecision,
  SmokeFallbackReason,
  SmokeFallbackReasonContext,
  SmokeFusionRouterConfig,
  SmokeFusionRouterOptions,
  SmokeFusionRouterRouteOptions,
  SmokeGeminiCliAdapterOptions,
  SmokeGrokCliAdapterOptions,
  SmokeGeneratedFusionRouterConfig,
  SmokeModelAdapter,
  SmokeModelOutput,
  SmokeModelOutputParser,
  SmokeOpenAIDirectAdapterOptions,
  SmokeOpenAIDirectSynthesisAdapterOptions,
  SmokeOtlpTelemetrySinkOptions,
  SmokeProviderCapability,
  SmokeProviderReadinessHint,
  SmokeProcessExecutionResult,
  SmokeProcessInvocation,
  SmokeProcessModelAdapterOptions,
  SmokeProviderDescriptor,
  SmokeRetryPolicy,
  SmokeRoutingMode,
  SmokeRoutingModeDecision,
  SmokeRoutingModeResolution,
  SmokeRoutingModeResolveInput,
  SmokeRoutingModeSource,
  SmokeSetupReport,
  SmokeSetupWizardInput,
  SmokeSupabaseAuditHandlerOptions,
  SmokeSupabaseAuditRecord,
  SmokeSupabaseAuditSinkOptions,
  SmokeSynthesisAdapter,
  SmokeTelemetryFailure,
  SmokeTelemetryFlushOptions,
  SmokeTelemetrySink,
  SmokeZcodeAdapterOptions,
];

function assertPublicTypeSmoke(_value?: PublicExportTypeSmoke): void {
}

const LEGACY_PUBLIC_EXPORT_NAMES = [
  "AGENT_CHAT_PHASE_BY_ROLE",
  "AGENT_CHAT_ROLES",
  "AgentChatAuditMilestone",
  "AgentChatDecision",
  "AgentChatDecisionResultSchema",
  "AgentChatLimits",
  "AgentChatMessage",
  "AgentChatMessageSchema",
  "AgentChatPhase",
  "AgentChatPhaseSchema",
  "AgentChatRole",
  "AgentChatRoleSchema",
  "AgentChatRunConfig",
  "AgentChatTranscript",
  "AgentChatTranscriptSchema",
  "ALLOWED_ROUTING_MODES",
  "AnthropicDirectAdapterOptions",
  "AuthStrategy",
  "BudgetManager",
  "BufferedBatchHandler",
  "BufferedBatchSink",
  "BufferedBatchSinkOptions",
  "BufferedBatchSinkStats",
  "BufferedSinkDeliveryMode",
  "BufferedSinkFlushContext",
  "BufferedSinkOverflowPolicy",
  "BufferedTelemetrySinkOptions",
  "BufferedTelemetrySinkStats",
  "CircuitBreakerOptions",
  "ClaudeCodeAdapterOptions",
  "ClineCliAdapterOptions",
  "CoFailureTelemetry",
  "CoFailureTelemetrySchema",
  "CodexCliAdapterOptions",
  "CodexStructuredSynthesisAdapter",
  "CodexSynthesisAdapterOptions",
  "DevinCliAdapterOptions",
  "DirectRoutingDecision",
  "DirectRoutingPolicy",
  "DirectHttpAdapterOptions",
  "DirectHttpExecutionResult",
  "DirectHttpRequest",
  "DirectHttpResponseParser",
  "ExplicitRoutingModeSource",
  "FallbackPolicy",
  "FallbackPolicyDecision",
  "FallbackReason",
  "FallbackReasonContext",
  "FetchLike",
  "FinalSynthesis",
  "FinalSynthesisSchema",
  "FlushableTelemetrySink",
  "FusionRouter",
  "FusionRouterConfig",
  "FusionRouterConfigFileSchema",
  "FusionRouterOptions",
  "FusionRouterRouteOptions",
  "GeminiCliAdapterOptions",
  "GeneratedFusionRouterConfig",
  "GeneratedFusionRouterConfigSchema",
  "GrokCliAdapterOptions",
  "InMemoryBudgetManager",
  "ModelAdapter",
  "ModelOutput",
  "ModelOutputParser",
  "ModelOutputSchema",
  "OpenAIDirectAdapterOptions",
  "OpenAIDirectSynthesisAdapter",
  "OpenAIDirectSynthesisAdapterOptions",
  "OtlpTelemetrySinkOptions",
  "ProcessExecutionError",
  "ProcessExecutionResult",
  "ProcessInvocation",
  "ProcessModelAdapterOptions",
  "ProviderDescriptor",
  "ProviderDescriptorSchema",
  "ProviderCapability",
  "ProviderCapabilityRegistry",
  "ProviderReadinessHint",
  "ROUTING_MODE_ENV",
  "RetryPolicy",
  "RouterError",
  "RoutingMode",
  "RoutingModeDecision",
  "RoutingModeResolution",
  "RoutingModeResolveInput",
  "RoutingModeSchema",
  "RoutingModeSource",
  "SupabaseAuditHandlerOptions",
  "SupabaseAuditRecord",
  "SupabaseAuditSinkOptions",
  "SynthesisAdapter",
  "TelemetryFailure",
  "TelemetryFailureSchema",
  "TelemetryFlushOptions",
  "TelemetrySink",
  "ZcodeAdapterOptions",
  "closeTelemetrySink",
  "createAnthropicDirectAdapter",
  "createBufferedBatchSink",
  "createBufferedTelemetrySink",
  "createCapabilityDirectRoutingPolicy",
  "createDefaultProviderCapabilityRegistry",
  "createInMemoryAgentChatAuditSink",
  "createSafeProviderUnavailableFallbackPolicy",
  "createClaudeCodeAdapter",
  "createClineCliAdapter",
  "createCodexCliAdapter",
  "createCodexStructuredSynthesisAdapter",
  "createCompositeTelemetrySink",
  "createDevinCliAdapter",
  "createDirectHttpAdapter",
  "createGeminiCliAdapter",
  "createGrokCliAdapter",
  "createOpenAIDirectAdapter",
  "createOpenAIDirectSynthesisAdapter",
  "createOtlpHttpTelemetrySink",
  "createOtlpTelemetryHandler",
  "createProcessAdapter",
  "createSupabaseAuditHandler",
  "createSupabaseAuditSink",
  "createZcodeGlmAdapter",
  "fallbackReasonFromError",
  "generateEnvExample",
  "generateFusionRouterConfig",
  "generateSetupReport",
  "profileInput",
  "runSetupCli",
  "SetupProfileNameSchema",
  "SetupWizardInputSchema",
  "stringifyGeneratedFusionRouterConfig",
  "describeRoutingModeDecision",
  "flushTelemetrySink",
  "isFallbackAllowed",
  "isRoutingModeImplemented",
  "loadFusionRouterConfig",
  "loadFusionRouterConfigText",
  "loadFusionRouterConfigValue",
  "normalizeAgentChatLimits",
  "parseRoutingMode",
  "redactAgentChatContent",
  "resolveRoutingMode",
  "runAgentChatSimulator",
] as const;

async function makeScript(content: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-test-" });
  const path = `${dir}/script.sh`;
  await Deno.writeTextFile(path, content);
  await Deno.chmod(path, 0o755);
  return path;
}

async function writeConfigFile(content: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-config-test-" });
  const path = `${dir}/fusion-router.config.json`;
  await Deno.writeTextFile(path, content);
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

class DescriptorFixtureAdapter implements ModelAdapter {
  calls = 0;

  constructor(readonly descriptor: ProviderDescriptor) {}

  invoke(prompt: string, _signal: AbortSignal): Promise<ModelOutput> {
    this.calls += 1;
    return Promise.resolve({
      provider: this.descriptor.provider,
      model: this.descriptor.model,
      content: `fixture output for ${prompt}`,
      latencyMs: 1,
    });
  }
}

class DescriptorSynthesisAdapter implements SynthesisAdapter {
  calls = 0;

  constructor(readonly descriptor: ProviderDescriptor) {}

  synthesize(
    prompt: string,
    outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    this.calls += 1;
    return Promise.resolve(FinalSynthesisSchema.parse({
      synthesis: `fixture synthesis for ${prompt}`,
      reasoning: `combined ${outputs.length} fixture output(s)`,
      consensusModel: `${this.descriptor.provider}/${this.descriptor.model}`,
      sources: outputs.map((output) => `${output.provider}/${output.model}`),
    }));
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

function fixtureDescriptor(
  provider: string,
  model: string,
  client = "FixtureCLI",
) {
  return {
    provider,
    model,
    authMode: "session",
    transport: "processAdapter",
    client,
  } as const;
}

Deno.test("agent chat roles enum accepts known roles only", () => {
  assertEquals(AgentChatRoleSchema.parse("planner"), "planner");
  assertEquals(AgentChatRoleSchema.parse("coder"), "coder");
  assertThrows(() => AgentChatRoleSchema.parse("operator"));
  assert(Object.isFrozen(AGENT_CHAT_ROLES));
  assertThrows(() => {
    (AGENT_CHAT_ROLES as unknown as string[]).push("operator");
  }, TypeError);
});

Deno.test("agent chat invalid limits fail closed", () => {
  const error = assertThrows(
    () => normalizeAgentChatLimits({ maxTurns: 0 }),
    RouterError,
  );
  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_agent_chat_limits");
});

Deno.test("agent chat objections only allow review/red_team phases", () => {
  const base = {
    role: "reviewer",
    content: "blocked",
    createdAtMs: 1,
    redacted: true,
    metadata: {},
  } as const;
  assertEquals(
    AgentChatObjectionSchema.parse({
      ...base,
      phase: "review",
    }).phase,
    "review",
  );
  assertThrows(() =>
    AgentChatObjectionSchema.parse({
      ...base,
      phase: "coding",
    })
  );
});

Deno.test("agent chat simulator produces deterministic transcript", () => {
  const first = runAgentChatSimulator({
    prompt: "ship safely",
    startedAtMs: 10,
  });
  const second = runAgentChatSimulator({
    prompt: "ship safely",
    startedAtMs: 10,
  });
  assertEquals(first, second);
  assertEquals(first.decision.decision, "ready");
  assertEquals(first.transcript.turns.map((turn) => turn.role), [
    "planner",
    "coder",
    "reviewer",
    "red_team",
    "closeout",
  ]);
  assert(first.transcript.turns.every((turn) => turn.redacted));
});

Deno.test("agent chat max turns are enforced", () => {
  const error = assertThrows(
    () =>
      runAgentChatSimulator({
        prompt: "bounded",
        limits: { maxTurns: 4 },
      }),
    RouterError,
  );
  assertEquals(error.status, 4401);
  assertEquals(error.code, "agent_chat_limit_exceeded");
});

Deno.test("agent chat timeout and budget limits are enforced", () => {
  assertThrows(
    () =>
      runAgentChatSimulator({
        prompt: "timeout",
        limits: { maxPhaseDurationMs: 1 },
        script: { planner: { durationMs: 2 } },
      }),
    RouterError,
  );
  assertThrows(
    () =>
      runAgentChatSimulator({
        prompt: "budget",
        limits: { maxBudgetUsd: 0.01 },
        script: { coder: { budgetUsd: 0.02 } },
      }),
    RouterError,
  );
  const negativeStepError = assertThrows(
    () =>
      runAgentChatSimulator({
        prompt: "negative",
        script: { coder: { durationMs: -1, budgetUsd: -0.01 } },
      }),
    RouterError,
  );
  assertEquals(negativeStepError.code, "invalid_agent_chat_script_step");
});

Deno.test("agent chat reviewer objection blocks closeout ready", () => {
  const result = runAgentChatSimulator({
    prompt: "review objection",
    script: { reviewer: { objection: "Reviewer blocks: missing tests" } },
  });
  assertEquals(result.decision.decision, "not_ready");
  assertEquals(result.decision.closeout?.ready, false);
  assertEquals(result.transcript.objections[0].role, "reviewer");
});

Deno.test("agent chat red-team objection blocks closeout ready", () => {
  const result = runAgentChatSimulator({
    prompt: "red team objection",
    script: { red_team: { objection: "Red-team blocks: unsafe fallback" } },
  });
  assertEquals(result.decision.decision, "not_ready");
  assertEquals(result.decision.closeout?.ready, false);
  assertEquals(result.transcript.objections[0].role, "red_team");
});

Deno.test("agent chat closeout ready only when review and red-team pass", () => {
  const result = runAgentChatSimulator({ prompt: "clean run" });
  assertEquals(result.decision.decision, "ready");
  assertEquals(result.decision.closeout?.ready, true);
  assertEquals(result.transcript.objections, []);
});

Deno.test("agent chat transcript redacts token password and secret patterns", () => {
  const rawToken = ["tok", "agent", "fixture"].join("-");
  const result = runAgentChatSimulator({
    prompt: `token=${rawToken}`,
    extraRedactionValues: [rawToken],
    script: {
      coder: {
        content:
          `Use bearer ${rawToken} password=hunter2 secret=hidden session_jwt=abc`,
        metadata: {
          authorization: "Basic abc123",
          token: rawToken,
          safe: "kept",
        },
      },
    },
  });
  const surface = JSON.stringify(result);
  assert(!surface.includes(rawToken));
  assert(!surface.includes("hunter2"));
  assert(!surface.includes("hidden"));
  assert(!surface.includes("Basic abc123"));
  assertStringIncludes(surface, "[REDACTED]");
  assertStringIncludes(surface, "kept");
  assertStringIncludes(
    redactAgentChatContent("Authorization: Bearer abc"),
    "Authorization=[REDACTED]",
  );
});

Deno.test("agent chat audit milestones are emitted in order", () => {
  const audit = createInMemoryAgentChatAuditSink();
  runAgentChatSimulator({ prompt: "audit", auditSink: audit.sink });
  assertEquals(audit.events.map((event) => event.milestone), [
    AgentChatAuditMilestone.started,
    AgentChatAuditMilestone.phaseStarted,
    AgentChatAuditMilestone.turnRecorded,
    AgentChatAuditMilestone.phaseStarted,
    AgentChatAuditMilestone.turnRecorded,
    AgentChatAuditMilestone.phaseStarted,
    AgentChatAuditMilestone.turnRecorded,
    AgentChatAuditMilestone.reviewPassed,
    AgentChatAuditMilestone.phaseStarted,
    AgentChatAuditMilestone.turnRecorded,
    AgentChatAuditMilestone.redTeamPassed,
    AgentChatAuditMilestone.phaseStarted,
    AgentChatAuditMilestone.turnRecorded,
    AgentChatAuditMilestone.closeoutReady,
  ]);
});

Deno.test("agent chat simulator has no network or process side effects", async () => {
  const files = [
    "src/agent-chat/simulator.ts",
    "src/agent-chat/audit.ts",
    "src/agent-chat/protocol.ts",
    "src/agent-chat/redaction.ts",
  ];
  for (const file of files) {
    const source = await Deno.readTextFile(file);
    assert(!source.includes("fetch("), file);
    assert(!source.includes("Deno.Command"), file);
    assert(!source.includes("Deno.write"), file);
  }
});

Deno.test("agent_chat route still fails closed before adapter execution with agent modules present", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis());
  const error = await assertRejects(
    () => router.route("hello", { routingMode: "agent_chat" }),
    RouterError,
  );
  assertEquals(error.status, 4401);
  assertEquals(error.code, "routing_mode_not_implemented");
  assertEquals(adapter.calls, 0);
});

Deno.test("provider registry validates known providers", () => {
  const registry = createDefaultProviderCapabilityRegistry();
  const descriptors = [
    createCodexCliAdapter().descriptor,
    createClaudeCodeAdapter().descriptor,
    createGeminiCliAdapter().descriptor,
    createGrokCliAdapter().descriptor,
    createDevinCliAdapter().descriptor,
    createClineCliAdapter().descriptor,
    createZcodeGlmAdapter().descriptor,
    createOpenAIDirectAdapter().descriptor,
    createAnthropicDirectAdapter().descriptor,
    createCodexStructuredSynthesisAdapter().descriptor,
    createOpenAIDirectSynthesisAdapter().descriptor,
  ];

  for (const descriptor of descriptors) {
    const capability = registry.require(descriptor);
    assertEquals(capability.authMode, descriptor.authMode);
    assertEquals(capability.transport, descriptor.transport);
    assertEquals(capability.client, descriptor.client);
  }

  const openAiDirect = registry.require({
    provider: "OpenAI",
    model: "gpt-4o-mini",
    authMode: "apiKey",
    transport: "directHttp",
    client: "OpenAIChatCompletions",
  });
  assertEquals(openAiDirect.supportsSynthesis, true);
  assertEquals(openAiDirect.supportsStructuredJson, true);
  assertEquals(openAiDirect.enabled, true);
});

Deno.test("provider registry protects lookup state and separates auth modes", () => {
  const oauth = {
    provider: "Fixture",
    model: "same-model",
    authMode: "oauth",
    transport: "processAdapter",
    client: "FixtureCLI",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    estimatedCostUsd: 0.01,
    enabled: true,
    tags: ["oauth"] as string[],
  } as const;
  const apiKey = {
    ...oauth,
    authMode: "apiKey",
    estimatedCostUsd: 0.02,
    tags: ["api-key"] as string[],
  } as const;
  const registry = new ProviderCapabilityRegistry([oauth, apiKey]);

  const oauthLookup = registry.require(oauth);
  oauthLookup.enabled = false;
  oauthLookup.tags?.push("mutated");

  assertEquals(registry.require(oauth).enabled, true);
  assertEquals(registry.require(oauth).tags, ["oauth"]);
  assertEquals(registry.require(apiKey).estimatedCostUsd, 0.02);
});

Deno.test("provider registry rejects invalid estimated cost", () => {
  const descriptor = fixtureDescriptor("Fixture", "invalid-cost");
  assertThrows(
    () =>
      new ProviderCapabilityRegistry([
        {
          ...descriptor,
          supportsSynthesis: false,
          supportsStructuredJson: false,
          estimatedCostUsd: Number.NaN,
          enabled: true,
        },
      ]),
    Error,
    "estimatedCostUsd must be a finite number >= 0",
  );
  assertThrows(
    () =>
      new ProviderCapabilityRegistry([
        {
          ...descriptor,
          supportsSynthesis: false,
          supportsStructuredJson: false,
          estimatedCostUsd: -0.01,
          enabled: true,
        },
      ]),
    Error,
    "estimatedCostUsd must be a finite number >= 0",
  );
});

Deno.test("disabled provider is rejected by direct routing policy", () => {
  const descriptor = fixtureDescriptor("Fixture", "disabled-provider");
  const synthesis = fixtureDescriptor("Fixture", "synth", "SynthCLI");
  const registry = new ProviderCapabilityRegistry([
    {
      ...descriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: false,
    },
    {
      ...synthesis,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
  ]);

  const decision = createCapabilityDirectRoutingPolicy().decide({
    candidates: [descriptor],
    synthesisCandidates: [synthesis],
    providerRegistry: registry,
  });

  assertEquals(decision.selectedAdapters, []);
  assertEquals(
    decision.rejectedAdapters[0].reason,
    "provider disabled for Fixture/disabled-provider",
  );
});

Deno.test("missing auth/readiness hint is rejected by direct routing policy", () => {
  const descriptor = fixtureDescriptor("Fixture", "missing-auth");
  const synthesis = fixtureDescriptor("Fixture", "synth", "SynthCLI");
  const registry = new ProviderCapabilityRegistry([
    {
      ...descriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...synthesis,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
  ]);

  const decision = createCapabilityDirectRoutingPolicy().decide({
    candidates: [descriptor],
    synthesisCandidates: [synthesis],
    providerRegistry: registry,
    readinessHints: {
      "Fixture/missing-auth": { authReady: false, reason: "auth missing" },
    },
  });

  assertEquals(decision.selectedAdapters, []);
  assertEquals(decision.rejectedAdapters[0].reason, "auth missing");
});

Deno.test("budget estimate is included in direct routing decision", () => {
  const cheap = fixtureDescriptor("Fixture", "cheap");
  const expensive = fixtureDescriptor("Fixture", "expensive");
  const synthesis = fixtureDescriptor("Fixture", "synth", "SynthCLI");
  const registry = new ProviderCapabilityRegistry([
    {
      ...cheap,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...expensive,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.2,
      enabled: true,
    },
    {
      ...synthesis,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.02,
      enabled: true,
    },
  ]);

  const decision = createCapabilityDirectRoutingPolicy().decide({
    candidates: [cheap, expensive],
    synthesisCandidates: [synthesis],
    providerRegistry: registry,
    budgetManager: new InMemoryBudgetManager(0.05),
  });

  assertEquals(decision.selectedAdapters, [cheap]);
  assertEquals(decision.budgetEstimatedUsd, 0.03);
  assertStringIncludes(
    decision.rejectedAdapters[0].reason,
    "budget estimate exceeds remaining budget",
  );
});

Deno.test("synthesis candidate over budget fails closed in direct routing policy", () => {
  const candidate = fixtureDescriptor("Fixture", "candidate");
  const synthesis = fixtureDescriptor("Fixture", "expensive-synth", "SynthCLI");
  const registry = new ProviderCapabilityRegistry([
    {
      ...candidate,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...synthesis,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.2,
      enabled: true,
    },
  ]);

  assertThrows(
    () =>
      createCapabilityDirectRoutingPolicy().decide({
        candidates: [candidate],
        synthesisCandidates: [synthesis],
        providerRegistry: registry,
        budgetManager: new InMemoryBudgetManager(0.05),
      }),
    Error,
    "synthesis candidate exceeds remaining budget",
  );
});

Deno.test("missing eligible synthesis candidate fails closed", () => {
  const candidate = fixtureDescriptor("Fixture", "candidate");
  const synthesis = fixtureDescriptor("Fixture", "disabled-synth", "SynthCLI");
  const registry = new ProviderCapabilityRegistry([
    {
      ...candidate,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...synthesis,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.01,
      enabled: false,
    },
  ]);

  assertThrows(
    () =>
      createCapabilityDirectRoutingPolicy().decide({
        candidates: [candidate],
        synthesisCandidates: [synthesis],
        providerRegistry: registry,
      }),
    Error,
    "requires an enabled synthesis candidate",
  );
});

Deno.test("fallback policy allows provider_unavailable only from safe set", () => {
  const policy = createSafeProviderUnavailableFallbackPolicy();

  assertEquals(policy.decide("provider_unavailable"), {
    allowed: true,
    reason: "provider_unavailable",
  });
  assertEquals(isFallbackAllowed("auth_missing"), true);
  assertEquals(isFallbackAllowed("timeout_before_model_output"), true);
});

Deno.test("fallback policy rejects validation mismatch", () => {
  const policy = createSafeProviderUnavailableFallbackPolicy();

  assertEquals(policy.decide("validation_mismatch"), {
    allowed: false,
    reason: "validation_mismatch",
  });
  assertEquals(isFallbackAllowed("malformed_provider_response"), false);
  assertEquals(isFallbackAllowed("consensus_validation_failure"), false);
});

Deno.test("fallback reason mapping keeps audit failures unsafe", () => {
  const auditError = new ProcessExecutionError(
    "auth_failed",
    "audit sink auth failed",
  );

  assertEquals(fallbackReasonFromError(auditError), "unknown");
  assertEquals(
    fallbackReasonFromError(auditError, { boundary: "audit" }),
    "audit_failure",
  );
  assertEquals(isFallbackAllowed("audit_failure"), false);
});

Deno.test("fallback reason mapping classifies explicit unsafe origins", () => {
  assertEquals(
    fallbackReasonFromError(
      new ProcessExecutionError(
        "provider_identity_mismatch",
        "provider identity changed",
      ),
      { boundary: "provider" },
    ),
    "provider_identity_mismatch",
  );
  assertEquals(
    fallbackReasonFromError(new RouterError(4401, "validation_mismatch", "no")),
    "validation_mismatch",
  );
  assertEquals(
    fallbackReasonFromError(new RouterError(4401, "audit_failure", "no")),
    "audit_failure",
  );
  assertEquals(
    fallbackReasonFromError(new RouterError(4401, "budget_exhausted", "no")),
    "budget_exhausted",
  );
});

Deno.test("default behavior remains unchanged without policy", async () => {
  const first = new CountingAdapter({
    provider: "Fixture",
    model: "first",
    content: "first validated output",
    latencyMs: 1,
  });
  const second = new CountingAdapter({
    provider: "Fixture",
    model: "second",
    content: "second validated output",
    latencyMs: 1,
  });
  const router = new FusionRouter({
    modelAdapters: [first, second],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 2,
    timeoutMs: 10_000,
  });

  const result = await router.route("hello");

  assertEquals(result.synthesis, "ok");
  assertEquals(first.calls, 1);
  assertEquals(second.calls, 1);
});

Deno.test("adaptive direct wiring passes readiness and budget and recalculates quorum", async () => {
  const synthesisAdapter = staticOkSynthesis();
  const notReadyDescriptor = fixtureDescriptor(
    "Fixture",
    "not-ready",
    "NotReadyCLI",
  );
  const expensiveDescriptor = fixtureDescriptor(
    "Fixture",
    "expensive",
    "ExpensiveCLI",
  );
  const cheapDescriptor = fixtureDescriptor("Fixture", "cheap", "CheapCLI");
  const makeAdapter = (
    descriptor: ProviderDescriptor,
  ): ModelAdapter & { calls: number } => ({
    descriptor,
    calls: 0,
    invoke(_prompt: string, _signal: AbortSignal) {
      this.calls += 1;
      return Promise.resolve({
        provider: descriptor.provider,
        model: descriptor.model,
        content: `${descriptor.model} output`,
        latencyMs: 1,
      });
    },
  });
  const notReady = makeAdapter(notReadyDescriptor);
  const expensive = makeAdapter(expensiveDescriptor);
  const cheap = makeAdapter(cheapDescriptor);
  const registry = new ProviderCapabilityRegistry([
    {
      ...notReadyDescriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...expensiveDescriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.05,
      enabled: true,
    },
    {
      ...cheapDescriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...synthesisAdapter.descriptor,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
  ]);
  const router = new FusionRouter({
    modelAdapters: [notReady, expensive, cheap],
    synthesisAdapter,
    timeoutMs: 10_000,
    directRoutingPolicy: createCapabilityDirectRoutingPolicy(),
    providerRegistry: registry,
    providerReadinessHints: {
      "Fixture/not-ready": { authReady: false, reason: "fixture auth down" },
    },
    directRoutingBudgetManager: new InMemoryBudgetManager(0.025),
  });

  const result = await router.route("hello");

  assertEquals(result.synthesis, "ok");
  assertEquals(notReady.calls, 0);
  assertEquals(expensive.calls, 0);
  assertEquals(cheap.calls, 1);
});

Deno.test("direct routing rejection details are included in quorum failures", async () => {
  const synthesisAdapter = staticOkSynthesis();
  const descriptor = fixtureDescriptor(
    "Fixture",
    "selected-fail",
    "SelectedFailCLI",
  );
  const adapter: ModelAdapter = {
    descriptor,
    invoke: () => Promise.reject(new Error("fixture failure")),
  };
  const registry = new ProviderCapabilityRegistry([
    {
      ...descriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...synthesisAdapter.descriptor,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
  ]);
  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter,
    timeoutMs: 10_000,
    directRoutingPolicy: createCapabilityDirectRoutingPolicy(),
    providerRegistry: registry,
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );
  const details = error.details as {
    directRoutingDecision?: DirectRoutingDecision;
    effectiveMinSuccessfulAdapters?: number;
  };
  assertEquals(error.code, "consensus_insufficient");
  assertEquals(details.effectiveMinSuccessfulAdapters, 1);
  assertEquals(details.directRoutingDecision?.selectedAdapters, [descriptor]);
});

Deno.test("direct routing decision reports implemented true", () => {
  assertEquals(
    describeRoutingModeDecision({ mode: "direct", source: "default" }),
    { mode: "direct", source: "default", implemented: true },
  );
});

Deno.test("agent_chat routing decision reports implemented false", () => {
  assertEquals(
    describeRoutingModeDecision({ mode: "agent_chat", source: "request" }),
    { mode: "agent_chat", source: "request", implemented: false },
  );
});

Deno.test("routing decision source is preserved for request config env and default", () => {
  assertEquals(
    describeRoutingModeDecision(
      resolveRoutingMode({ requestMode: "direct", configMode: "agent_chat" }),
    ),
    { mode: "direct", source: "request", implemented: true },
  );
  assertEquals(
    describeRoutingModeDecision(
      resolveRoutingMode({ configMode: "direct", envMode: "agent_chat" }),
    ),
    { mode: "direct", source: "config", implemented: true },
  );
  assertEquals(
    describeRoutingModeDecision(resolveRoutingMode({ envMode: "direct" })),
    { mode: "direct", source: "env", implemented: true },
  );
  assertEquals(describeRoutingModeDecision(resolveRoutingMode()), {
    mode: "direct",
    source: "default",
    implemented: true,
  });
});

Deno.test("router exposes routing decisions for request config env and default", async () => {
  const configPath = await writeConfigFile(JSON.stringify({
    routing: { mode: "direct" },
  }));
  const config = await loadFusionRouterConfig(configPath);
  const router = buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    routingMode: config.routingMode,
    routingModeEnvProvider: () => "agent_chat",
  });

  assertEquals(router.describeRoutingModeDecisionForRequest(), {
    mode: "direct",
    source: "config",
    implemented: true,
  });
  assertEquals(
    router.describeRoutingModeDecisionForRequest({ routingMode: "direct" }),
    { mode: "direct", source: "request", implemented: true },
  );

  const envRouter = buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    routingModeEnvProvider: () => "direct",
  });
  assertEquals(envRouter.describeRoutingModeDecisionForRequest(), {
    mode: "direct",
    source: "env",
    implemented: true,
  });

  const defaultRouter = buildRouter(
    new CountingAdapter(),
    staticOkSynthesis(),
    {
      routingModeEnvProvider: () => undefined,
    },
  );
  assertEquals(defaultRouter.describeRoutingModeDecisionForRequest(), {
    mode: "direct",
    source: "default",
    implemented: true,
  });
});

Deno.test("missing config file returns empty config with no routing mode", async () => {
  const dir = await Deno.makeTempDir({
    prefix: "fusion-router-config-missing-",
  });
  const config = await loadFusionRouterConfig(
    `${dir}/fusion-router.config.json`,
  );

  assertEquals(config, {});
  assertEquals(resolveRoutingMode({ configMode: config.routingMode }), {
    mode: "direct",
    source: "default",
  });
});

Deno.test("minimal-direct profile generates valid config", async () => {
  const config = generateFusionRouterConfig({ profile: "minimal-direct" });
  assertEquals(config.profile, "minimal-direct");
  assertEquals(config.routing.mode, "direct");
  assertEquals(config.providers, []);
  assertEquals(config.persistence.mode, "none");
  assertEquals(config.adaptiveDirect.enabled, false);

  const path = await writeConfigFile(JSON.stringify(config));
  const loaded = await loadFusionRouterConfig(path);
  assertEquals(loaded.routingMode, "direct");
  assertEquals(loaded.setupProfile, "minimal-direct");
});

Deno.test("direct-http-openai profile emits only placeholders, not raw secrets", () => {
  const config = generateFusionRouterConfig({ profile: "direct-http-openai" });
  const envExample = generateEnvExample({ profile: "direct-http-openai" });
  const serialized = JSON.stringify(config) + envExample;

  assertEquals(config.providers[0], {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    authMode: "apiKey",
    transport: "directHttp",
    client: "OpenAIChatCompletions",
    enabled: true,
  });
  assertStringIncludes(envExample, "OPENAI_API_KEY=");
  assert(!serialized.includes("sk-"));
  assert(!serialized.includes("fixture-secret-value"));
  assert(!JSON.stringify(config).includes("OPENAI_API_KEY"));
});

Deno.test("supabase-audit profile never emits service-role key", () => {
  const config = generateFusionRouterConfig({ profile: "supabase-audit" });
  const envExample = generateEnvExample({ profile: "supabase-audit" });
  const report = generateSetupReport({ profile: "supabase-audit" });
  const surface = JSON.stringify({ config, envExample, report });

  assertEquals(config.persistence.mode, "supabaseAuditRpc");
  assertStringIncludes(envExample, "FUSION_ROUTER_SUPABASE_URL=");
  assertStringIncludes(envExample, "FUSION_ROUTER_SUPABASE_ANON_KEY=");
  assertStringIncludes(envExample, "FUSION_ROUTER_SUPABASE_SESSION_JWT=");
  assert(!surface.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(!surface.includes("FUSION_ROUTER_SUPABASE_SERVICE_ROLE_KEY"));
});

Deno.test("adaptive-direct profile enables policy config safely", () => {
  const config = generateFusionRouterConfig({ profile: "adaptive-direct" });
  assertEquals(config.adaptiveDirect.enabled, true);
  assertEquals(
    config.adaptiveDirect.fallbackPolicy,
    "safe_provider_unavailable_only",
  );
  assertEquals(config.adaptiveDirect.budgetLimitUsd, 0.25);
  assert(config.providers.length >= 2);
});

Deno.test("generated config value and text loaders match file loader", async () => {
  const generated = generateFusionRouterConfig({ profile: "minimal-direct" });
  const fromValue = loadFusionRouterConfigValue(generated);
  const fromText = loadFusionRouterConfigText(JSON.stringify(generated));
  const fromFile = await loadFusionRouterConfig(
    await writeConfigFile(JSON.stringify(generated)),
  );

  assertEquals(fromValue, fromText);
  assertEquals(fromValue, fromFile);
  assertEquals(fromValue.routingMode, "direct");
  assertEquals(fromValue.setupProfile, "minimal-direct");
});

Deno.test("generated minimal-direct config can construct fixture router", async () => {
  const loaded = loadFusionRouterConfigValue(
    generateFusionRouterConfig({ profile: "minimal-direct" }),
  );
  const adapter = new CountingAdapter();
  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route("generated minimal direct");

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("generated adaptive-direct config wires registry and fixture adapters", async () => {
  const generated = generateFusionRouterConfig({ profile: "adaptive-direct" });
  const loaded = loadFusionRouterConfigValue(generated);
  const descriptors = generated.providers.map((provider) =>
    provider as ProviderDescriptor
  );
  const adapters = descriptors.map((provider) =>
    new DescriptorFixtureAdapter(provider)
  );
  const synthesisProvider =
    descriptors.find((provider) =>
      provider.provider === "OpenAI" && provider.model === "gpt-5.5"
    ) ?? descriptors[0];
  const synthesis = new DescriptorSynthesisAdapter(synthesisProvider);
  const router = new FusionRouter({
    modelAdapters: adapters,
    synthesisAdapter: synthesis,
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    providerRegistry: createDefaultProviderCapabilityRegistry(),
    directRoutingPolicy: createCapabilityDirectRoutingPolicy({
      fallbackPolicy: loaded.adaptiveDirect?.fallbackPolicy,
    }),
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route("generated adaptive direct");

  assertEquals(result.consensusModel, "OpenAI/gpt-5.5");
  assertEquals(synthesis.calls, 1);
  assert(adapters.some((adapter) => adapter.calls === 1));
});

Deno.test("generated agent_chat config still fails closed before adapter execution", async () => {
  const loaded = loadFusionRouterConfigValue(generateFusionRouterConfig({
    profile: "minimal-direct",
    routingMode: "agent_chat",
    experimentalAgentChat: true,
  }));
  const adapter = new CountingAdapter();
  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  await assertRejects(
    () => router.route("agent_chat stays unavailable"),
    RouterError,
    "not implemented",
  );
  assertEquals(adapter.calls, 0);
});

Deno.test("generated supabase-audit config emits no service-role placeholders", () => {
  const generated = generateFusionRouterConfig({ profile: "supabase-audit" });
  const envExample = generateEnvExample({ profile: "supabase-audit" });
  const surface = JSON.stringify(generated) + envExample;

  assert(!/SERVICE_ROLE|SERVICE_KEY|ADMIN_KEY|JWT_SECRET/i.test(surface));
  assertStringIncludes(surface, "FUSION_ROUTER_SUPABASE_ANON_KEY=");
  assertStringIncludes(surface, "FUSION_ROUTER_SUPABASE_SESSION_JWT=");
});

Deno.test("unknown setup profile fails closed", () => {
  const error = assertThrows(
    () => generateFusionRouterConfig({ profile: "unknown" as never }),
    RouterError,
  );
  assertEquals(error.status, 4400);
  assertEquals(error.code, "unknown_setup_profile");
});

Deno.test("invalid provider/auth/transport setup combo fails closed", () => {
  const error = assertThrows(
    () =>
      generateFusionRouterConfig({
        profile: "minimal-direct",
        providers: [
          {
            provider: "OpenAI",
            model: "gpt-4o-mini",
            authMode: "oauth",
            transport: "directHttp",
            client: "OpenAIChatCompletions",
            enabled: true,
          },
        ],
      }),
    RouterError,
  );
  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_setup_provider_combination");
});

Deno.test("setup output is deterministic", () => {
  const first = JSON.stringify(
    generateFusionRouterConfig({ profile: "adaptive-direct" }),
  );
  const second = JSON.stringify(
    generateFusionRouterConfig({ profile: "adaptive-direct" }),
  );
  assertEquals(first, second);
  assertEquals(
    generateEnvExample({ profile: "adaptive-direct" }),
    generateEnvExample({ profile: "adaptive-direct" }),
  );
});

Deno.test("setup CLI --help advertises canonical setup entrypoint", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      `${Deno.cwd()}/setup.ts`,
      "--help",
    ],
    clearEnv: true,
    env: { PATH: Deno.env.get("PATH") ?? "" },
  }).output();
  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  assertStringIncludes(text, "deno task setup -- [--profile NAME]");
  assertStringIncludes(text, "deno run --allow-read --allow-write setup.ts");
  assert(!text.includes("src/setup/cli.ts"));
});

Deno.test("setup CLI dry-run does not write files", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-setup-dryrun-" });
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      `${Deno.cwd()}/setup.ts`,
      "--profile",
      "minimal-direct",
    ],
    cwd: dir,
    clearEnv: true,
    env: { PATH: Deno.env.get("PATH") ?? "" },
  }).output();
  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  assertStringIncludes(text, "Dry-run only: no files written");
  await assertRejects(
    () => Deno.stat(`${dir}/fusion-router.config.json`),
    Deno.errors.NotFound,
  );
});

Deno.test("v0.1 offline examples and smoke run without network permissions", async () => {
  const commands = [
    ["run", "examples/basic-direct.ts"],
    ["run", "examples/adaptive-direct.ts"],
    ["run", "examples/setup-generated-config.ts"],
    ["run", "--allow-read", "--allow-env", "examples/v0_1_smoke.ts"],
    ["task", "smoke:v0.1"],
  ];

  for (const args of commands) {
    const output = await new Deno.Command(Deno.execPath(), {
      args,
      clearEnv: true,
      env: { PATH: Deno.env.get("PATH") ?? "" },
    }).output();
    const text = new TextDecoder().decode(output.stdout) +
      new TextDecoder().decode(output.stderr);
    assert(output.success, `${args.join(" ")}\n${text}`);
    assertStringIncludes(text, '"ok": true');
  }
});

Deno.test("v0.1 fixture capability uses descriptor values, not object identity", async () => {
  const module = await import("./examples/v0_1_fixtures.ts");
  const reconstructed = { ...module.FIXTURE_SYNTHESIS_DESCRIPTOR };
  assertEquals(module.fixtureCapability(reconstructed).supportsSynthesis, true);
});

Deno.test("v0.1 examples do not contain raw credential patterns", async () => {
  const files = [
    "examples/basic-direct.ts",
    "examples/adaptive-direct.ts",
    "examples/setup-generated-config.ts",
    "examples/v0_1_smoke.ts",
    "examples/v0_1_fixtures.ts",
  ];
  const rawSecretPattern =
    /(sk-[A-Za-z0-9_-]{8,}|gh[opsu]_[A-Za-z0-9_]{8,}|Bearer\s+[A-Za-z0-9._-]{8,}|Basic\s+[A-Za-z0-9+/=]{8,}|(?:api[_-]?key|token|password|secret)\s*[:=]\s*["'][^"'\s]{4,}["'])/i;

  for (const file of files) {
    const source = await Deno.readTextFile(file);
    assert(!rawSecretPattern.test(source), file);
    assert(!source.includes("--allow-net"), file);
  }
});

Deno.test("v0.1 release docs mention explicit non-goals and verification", async () => {
  const release = await Deno.readTextFile("docs/release-v0.1.md");
  const checklist = await Deno.readTextFile("docs/release-checklist-v0.1.md");

  for (
    const required of [
      "No real `agent_chat` production runtime",
      "No hidden fallback behavior",
      "No Supabase migration changes",
      "No OAuth login flow or automatic API-key setup",
      "deno task smoke:v0.1",
      "gitleaks git --log-opts",
    ]
  ) {
    assertStringIncludes(release, required);
  }
  assertStringIncludes(
    checklist,
    "no GitHub checks are not reported".replace("no ", ""),
  );
  assertStringIncludes(checklist, "feature branch deleted after merge");
});

Deno.test("setup CLI --write writes config only to requested path", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-setup-write-" });
  const requestedPath = `${dir}/generated/fusion-router.config.json`;
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      `${Deno.cwd()}/setup.ts`,
      "--profile=direct-http-openai",
      `--write=${requestedPath}`,
    ],
    cwd: dir,
    clearEnv: true,
    env: { PATH: Deno.env.get("PATH") ?? "" },
  }).output();
  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const written = JSON.parse(await Deno.readTextFile(requestedPath));
  assertEquals(written.profile, "direct-http-openai");
  await assertRejects(
    () => Deno.stat(`${dir}/fusion-router.config.json`),
    Deno.errors.NotFound,
  );
});

Deno.test("doctor accepts generated minimal config", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-doctor-setup-" });
  await Deno.writeTextFile(
    `${dir}/fusion-router.config.json`,
    JSON.stringify(generateFusionRouterConfig({ profile: "minimal-direct" })),
  );
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(`${Deno.cwd()}/doctor.ts`),
    cwd: dir,
    clearEnv: true,
    env: isolatedDoctorEnv(),
  }).output();
  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const report = JSON.parse(text);
  const setupProfile = report.checks.find((item: { name: string }) =>
    item.name === "setup_profile"
  );
  assertEquals(setupProfile.detail, "known profile: minimal-direct");
  assertEquals(report.ok, true);
});

Deno.test("doctor warns on generated agent_chat config while route still fails closed", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-doctor-agent-" });
  const config = generateFusionRouterConfig({
    profile: "minimal-direct",
    routingMode: "agent_chat",
    experimentalAgentChat: true,
  });
  await Deno.writeTextFile(
    `${dir}/fusion-router.config.json`,
    JSON.stringify(config),
  );
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(`${Deno.cwd()}/doctor.ts`),
    cwd: dir,
    clearEnv: true,
    env: isolatedDoctorEnv(),
  }).output();
  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const report = JSON.parse(text);
  const modeCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_effective_mode"
  );
  assertEquals(modeCheck.severity, "warn");
  assertEquals(modeCheck.detail, "agent_chat from config; implemented=false");

  const loaded = await loadFusionRouterConfig(
    `${dir}/fusion-router.config.json`,
  );
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: loaded.routingMode,
  });
  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );
  assertEquals(error.code, "routing_mode_not_implemented");
  assertEquals(adapter.calls, 0);
});

Deno.test("valid config direct loads and resolves as config source", async () => {
  const path = await writeConfigFile(`{
  "routing": {
    "mode": "direct"
  }
}`);
  const config = await loadFusionRouterConfig(path);
  const adapter = new CountingAdapter();
  let envCalls = 0;
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: config.routingMode,
    routingModeEnvProvider: () => {
      envCalls += 1;
      throw new Error("env provider should not run for valid config mode");
    },
  });

  assertEquals(config, { routingMode: "direct" });
  assertEquals(router.resolveRoutingModeForRequest(), {
    mode: "direct",
    source: "config",
  });

  const result = await router.route("hello");

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
  assertEquals(envCalls, 0);
});

Deno.test("valid config agent_chat loads and route fails closed before adapter execution", async () => {
  const path = await writeConfigFile(`{
  "routing": {
    "mode": "agent_chat"
  }
}`);
  const config = await loadFusionRouterConfig(path);
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: config.routingMode,
    routingModeEnvProvider: () => "direct",
  });

  assertEquals(config, { routingMode: "agent_chat" });
  assertEquals(router.resolveRoutingModeForRequest(), {
    mode: "agent_chat",
    source: "config",
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.code, "routing_mode_not_implemented");
  assertEquals(error.details, {
    routingMode: {
      mode: "agent_chat",
      source: "config",
      implemented: false,
    },
  });
  assertEquals(adapter.calls, 0);
});

Deno.test("malformed config JSON fails closed with sanitized RouterError", async () => {
  const leakedValue = ["config", "token", "fixture", "value"].join("-");
  const path = await writeConfigFile(`{
  "routing": {
    "mode": "direct",
    "token": "${leakedValue}"
`);

  const error = await assertRejects(
    () => loadFusionRouterConfig(path),
    RouterError,
  );

  const surface = JSON.stringify({
    message: error.message,
    details: error.details,
  });
  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_config_json");
  assert(!surface.includes(leakedValue));
});

Deno.test("invalid config routing.mode string fails closed", async () => {
  const invalidMode = "unknown-mode";
  const path = await writeConfigFile(JSON.stringify({
    routing: { mode: invalidMode },
  }));

  const error = await assertRejects(
    () => loadFusionRouterConfig(path),
    RouterError,
  );

  const surface = JSON.stringify({
    message: error.message,
    details: error.details,
  });
  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
  assert(!surface.includes(invalidMode));
});

Deno.test("empty config routing.mode string fails closed", async () => {
  const path = await writeConfigFile(JSON.stringify({ routing: { mode: "" } }));

  const error = await assertRejects(
    () => loadFusionRouterConfig(path),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
});

Deno.test("non-string config routing.mode fails closed", async () => {
  const path = await writeConfigFile(JSON.stringify({
    routing: { mode: { nested: "direct" } },
  }));

  const error = await assertRejects(
    () => loadFusionRouterConfig(path),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
});

Deno.test("wrong config shape fails closed", async () => {
  const path = await writeConfigFile(JSON.stringify({ routingMode: "direct" }));

  const error = await assertRejects(
    () => loadFusionRouterConfig(path),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_config_shape");
});

Deno.test("request mode overrides loaded config mode", async () => {
  const path = await writeConfigFile(JSON.stringify({
    routing: { mode: "agent_chat" },
  }));
  const config = await loadFusionRouterConfig(path);
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: config.routingMode,
    routingModeEnvProvider: () => "agent_chat",
  });

  assertEquals(
    router.resolveRoutingModeForRequest({ routingMode: "direct" }),
    { mode: "direct", source: "request" },
  );

  const result = await router.route("hello", { routingMode: "direct" });

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("loaded config mode overrides env mode and does not read env", async () => {
  const path = await writeConfigFile(
    JSON.stringify({ routing: { mode: "direct" } }),
  );
  const config = await loadFusionRouterConfig(path);
  const adapter = new CountingAdapter();
  let envCalls = 0;
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: config.routingMode,
    routingModeEnvProvider: () => {
      envCalls += 1;
      return "agent_chat";
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

Deno.test("invalid config mode fails closed and overrides lower-precedence valid env", async () => {
  const adapter = new CountingAdapter();
  let envCalls = 0;
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: "not-a-mode",
    routingModeEnvProvider: () => {
      envCalls += 1;
      return "direct";
    },
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
  assertEquals(adapter.calls, 0);
  assertEquals(envCalls, 0);
});

Deno.test("invalid loaded config fails before producing router input", async () => {
  const path = await writeConfigFile(
    JSON.stringify({ routing: { mode: "auto" } }),
  );

  const error = await assertRejects(
    () => loadFusionRouterConfig(path),
    RouterError,
  );

  assertEquals(error.code, "invalid_routing_mode");
});

Deno.test("agent_chat from loaded config does not call adapters", async () => {
  const path = await writeConfigFile(JSON.stringify({
    routing: { mode: "agent_chat" },
  }));
  const config = await loadFusionRouterConfig(path);
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: config.routingMode,
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.code, "routing_mode_not_implemented");
  assertEquals(adapter.calls, 0);
});

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
  assertEquals(error.details, {
    routingMode: {
      mode: "agent_chat",
      source: "request",
      implemented: false,
    },
  });
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
  assert(!JSON.stringify(error.details).includes("auto"));
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
  assert(!JSON.stringify(error.details).includes("auto"));
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
    assertEquals(error.details, {
      routingMode: {
        mode: "agent_chat",
        source: "env",
        implemented: false,
      },
    });
    assertEquals(adapter.calls, 0);
  });
});

Deno.test("routing mode invalid env value fails closed before adapter execution", async () => {
  const invalidEnvMode = "auto-env-fixture";
  await withRoutingModeEnv(invalidEnvMode, async () => {
    const adapter = new CountingAdapter();
    const router = buildRouter(adapter, staticOkSynthesis());

    const error = await assertRejects(
      () => router.route("hello"),
      RouterError,
    );

    assertEquals(error.status, 4400);
    assertEquals(error.code, "invalid_routing_mode");
    assert(!error.message.includes(invalidEnvMode));
    assert(!JSON.stringify(error.details).includes(invalidEnvMode));
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

  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
    "returned empty stdout",
  );
  const fallbackReason = fallbackReasonFromError(error, {
    boundary: "provider",
  });
  assertEquals(fallbackReason, "malformed_provider_response");
  assertEquals(isFallbackAllowed(fallbackReason), false);
});

Deno.test("malformed provider response does not become fallback success", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
printf ''
`);

  const descriptor = {
    provider: "Fixture",
    model: "empty-stdout",
    authMode: "session",
    transport: "processAdapter",
    client: "FixtureCLI",
  } as const;
  const synthesisAdapter = staticOkSynthesis();
  const synthesis = synthesisAdapter.descriptor;
  const adapter = createProcessAdapter({
    descriptor,
    buildInvocation: () => ({ command: script }),
  });
  const registry = new ProviderCapabilityRegistry([
    {
      ...descriptor,
      supportsSynthesis: false,
      supportsStructuredJson: false,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
    {
      ...synthesis,
      supportsSynthesis: true,
      supportsStructuredJson: true,
      estimatedCostUsd: 0.01,
      enabled: true,
    },
  ]);
  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter,
    minSuccessfulAdapters: 1,
    timeoutMs: 10_000,
    directRoutingPolicy: createCapabilityDirectRoutingPolicy(),
    providerRegistry: registry,
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.code, "consensus_insufficient");
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
  assertEquals((error.details as { routingMode?: unknown }).routingMode, {
    mode: "direct",
    source: "default",
    implemented: true,
  });
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
  assertEquals((error.details as { routingMode?: unknown }).routingMode, {
    mode: "direct",
    source: "default",
    implemented: true,
  });
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
  const sourceFiles = [
    "router.ts",
    "src/runtime.ts",
    "src/router.ts",
    "src/audit/supabase-audit.ts",
    "src/telemetry/buffered-batch-sink.ts",
  ];
  for (const file of sourceFiles) {
    const source = await Deno.readTextFile(file);
    assert(
      !/Deno\.env\.(get|has)\([^)]*SUPABASE.*SERVICE.*ROLE/i.test(source),
      file,
    );
  }
});

function isolatedDoctorEnv(
  env: Record<string, string> = {},
): Record<string, string> {
  return { PATH: Deno.env.get("PATH") ?? "", ...env };
}

function doctorArgs(path = "doctor.ts"): string[] {
  return ["run", "--allow-env", "--allow-run", "--allow-read", path];
}

Deno.test("public compatibility barrel preserves core exports", async () => {
  assertPublicTypeSmoke();
  const api = await import("./router.ts");
  for (
    const name of [
      "FusionRouter",
      "RouterError",
      "ProcessExecutionError",
      "RoutingModeSchema",
      "parseRoutingMode",
      "resolveRoutingMode",
      "describeRoutingModeDecision",
      "loadFusionRouterConfig",
      "createProcessAdapter",
      "createCodexCliAdapter",
      "createClaudeCodeAdapter",
      "createGeminiCliAdapter",
      "createGrokCliAdapter",
      "createDevinCliAdapter",
      "createClineCliAdapter",
      "createZcodeGlmAdapter",
      "createOpenAIDirectAdapter",
      "createAnthropicDirectAdapter",
      "createCapabilityDirectRoutingPolicy",
      "createDefaultProviderCapabilityRegistry",
      "createSafeProviderUnavailableFallbackPolicy",
      "createBufferedBatchSink",
      "createBufferedTelemetrySink",
      "createOtlpHttpTelemetrySink",
      "createSupabaseAuditHandler",
      "createSupabaseAuditSink",
      "ModelOutputSchema",
      "FinalSynthesisSchema",
      "CoFailureTelemetrySchema",
      "ProviderCapabilityRegistry",
      "fallbackReasonFromError",
      "isFallbackAllowed",
      "InMemoryBudgetManager",
    ]
  ) {
    assert(api[name as keyof typeof api] !== undefined, name);
  }
});

Deno.test("public compatibility barrel preserves the full legacy export surface", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: ["doc", "--json", "router.ts"],
  }).output();
  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const doc = JSON.parse(text) as {
    nodes: Record<string, { symbols?: Array<{ name?: string }> }>;
  };
  const exportedNames = new Set(
    Object.values(doc.nodes).flatMap((node) =>
      (node.symbols ?? []).map((symbol) => symbol.name).filter((name) =>
        typeof name === "string"
      )
    ),
  );
  for (const name of LEGACY_PUBLIC_EXPORT_NAMES) {
    assert(exportedNames.has(name), name);
  }
});

Deno.test("redactSecrets replaces overlapping secrets longest first", () => {
  const text = "token=abcd and prefix=abc";
  const redacted = redactSecrets(text, ["abc", "abcd"]);
  assertEquals(redacted, "token=[REDACTED] and prefix=[REDACTED]");
  assert(!redacted.includes("d and"));
});

Deno.test("FusionRouter rejects invalid quorum values", () => {
  const modelAdapter = new CountingAdapter();
  const synthesisAdapter = staticOkSynthesis();
  for (const value of [Number.NaN, 0, 1.5]) {
    try {
      new FusionRouter({
        modelAdapters: [modelAdapter],
        synthesisAdapter,
        minSuccessfulAdapters: value,
      });
      throw new Error("expected constructor to reject invalid quorum");
    } catch (error) {
      assert(error instanceof Error);
      assertStringIncludes(error.message, "minSuccessfulAdapters");
    }
  }
});

Deno.test("audit sink enforces fail-closed must-accept semantics over caller overrides", async () => {
  const sink = createSupabaseAuditSink({
    flushHandler: () => {},
    overflowPolicy: "drop_oldest",
    deliveryMode: "best_effort",
  });

  const accepted = sink({
    eventType: "fixture.first",
    actorType: "ai_assistant",
    decision: "allow",
  });
  assert(accepted instanceof Promise);
  await accepted;
  await sink.close({ force: true, maxDurationMs: 50 });
});

Deno.test("doctor masks endpoint query and fragment credentials", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(),
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
    args: doctorArgs(),
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
    args: doctorArgs(),
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

Deno.test("doctor fails closed on common Supabase admin/service key aliases", async () => {
  const credentialFixture = ["runtime", "admin", "fixture"].join("-");
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(),
    clearEnv: true,
    env: isolatedDoctorEnv({
      SUPABASE_ADMIN_KEY: credentialFixture,
    }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(!output.success, text);
  assertStringIncludes(text, "supabase_service_role_absent");
  assertStringIncludes(text, "SUPABASE_ADMIN_KEY");
  assert(!text.includes(credentialFixture));
});

Deno.test("doctor treats unconfigured Supabase audit as informational", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(),
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

Deno.test("doctor reports absent config and default direct readiness", async () => {
  const dir = await Deno.makeTempDir({ prefix: "fusion-router-doctor-empty-" });
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(`${Deno.cwd()}/doctor.ts`),
    cwd: dir,
    clearEnv: true,
    env: isolatedDoctorEnv(),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const report = JSON.parse(text);
  const configCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_config_file"
  );
  const modeCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_effective_mode"
  );
  assertStringIncludes(configCheck.detail, "absent or empty");
  assertEquals(modeCheck.detail, "direct from default; implemented=true");
});

Deno.test("doctor reports valid config and config-over-env precedence without leaking env", async () => {
  const dir = await Deno.makeTempDir({
    prefix: "fusion-router-doctor-config-",
  });
  await Deno.writeTextFile(
    `${dir}/fusion-router.config.json`,
    JSON.stringify({ routing: { mode: "direct" } }),
  );
  const hiddenEnvValue = "agent_chat";
  const unrelatedSecretEnvValue = "doctor-secret-fixture";
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(`${Deno.cwd()}/doctor.ts`),
    cwd: dir,
    clearEnv: true,
    env: isolatedDoctorEnv({
      [ROUTING_MODE_ENV]: hiddenEnvValue,
      FUSION_ROUTER_UNUSED_MARKER: unrelatedSecretEnvValue,
    }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const report = JSON.parse(text);
  const configCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_config_file"
  );
  const precedenceCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_config_env_precedence"
  );
  assertEquals(configCheck.detail, "valid: routing.mode=direct");
  assertStringIncludes(
    precedenceCheck.detail,
    "config routing.mode takes precedence",
  );
  assert(!text.includes(unrelatedSecretEnvValue));
});

Deno.test("doctor fails closed on invalid env routing mode without raw value", async () => {
  const hiddenInvalidValue = "auto-secret-fixture";
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(),
    clearEnv: true,
    env: isolatedDoctorEnv({ [ROUTING_MODE_ENV]: hiddenInvalidValue }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(!output.success, text);
  assertStringIncludes(text, "routing_mode_env");
  assertStringIncludes(text, "raw value hidden");
  assert(!text.includes(hiddenInvalidValue));
});

Deno.test("doctor warns when agent_chat is selected because runtime is not implemented", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: doctorArgs(),
    clearEnv: true,
    env: isolatedDoctorEnv({ [ROUTING_MODE_ENV]: "agent_chat" }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(output.success, text);
  const report = JSON.parse(text);
  const modeCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_effective_mode"
  );
  assertEquals(modeCheck.ok, false);
  assertEquals(modeCheck.severity, "warn");
  assertEquals(modeCheck.detail, "agent_chat from env; implemented=false");
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

Deno.test("process adapter bounds children that ignore SIGTERM", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
trap "" TERM
sleep 5
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "ignores-term",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    defaultTimeoutMs: 50,
    buildInvocation: () => ({ command: script }),
  });

  const startedAt = Date.now();
  const error = await assertRejects(
    () => adapter.invoke("hello", new AbortController().signal),
    ProcessExecutionError,
    "timed out",
  );
  assertEquals(error.codeName, "timeout");
  assert(Date.now() - startedAt < 2_000);
});

Deno.test("plain process output may begin with Error outside zcode wrapper", async () => {
  const script = await makeScript(`#!/usr/bin/env bash
echo 'Error: this is valid model content'
`);

  const adapter = createProcessAdapter({
    descriptor: {
      provider: "Fixture",
      model: "error-content",
      authMode: "session",
      transport: "processAdapter",
      client: "FixtureCLI",
    },
    buildInvocation: () => ({ command: script }),
  });

  const output = await adapter.invoke("hello", new AbortController().signal);
  assertEquals(output.content, "Error: this is valid model content");
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

Deno.test("direct HTTP adapter normalizes invalid retry maxAttempts to one attempt", async () => {
  let attempts = 0;
  const adapter = createOpenAIDirectAdapter({
    apiKeyProvider: () => "openai-key",
    retryPolicy: { maxAttempts: 0, baseDelayMs: 0, maxDelayMs: 0 },
    fetchFn: () => {
      attempts += 1;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" } }],
            model: "gpt-fixture",
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
  assertEquals(output.content, "ok");
  assertEquals(attempts, 1);
});

Deno.test("circuit breaker rejects invalid options", () => {
  for (
    const options of [
      { failureThreshold: 0, cooldownMs: 1_000 },
      { failureThreshold: 1.5, cooldownMs: 1_000 },
      { failureThreshold: 1, cooldownMs: Number.NaN },
      { failureThreshold: 1, cooldownMs: -1 },
    ]
  ) {
    try {
      new CircuitBreaker(options);
      throw new Error("expected invalid circuit breaker options to reject");
    } catch (error) {
      assert(error instanceof Error);
    }
  }
});

Deno.test("budget manager allows decimal spend that exactly reaches limit", () => {
  const budget = new InMemoryBudgetManager(0.3);
  budget.consume("first", 0.1);
  budget.consume("second", 0.2);
  assert(Math.abs(budget.snapshot().remainingUsd) < 1e-8);
});

Deno.test("OpenAI direct HTTP synthesis parses JSON content", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const synthesisAdapter = createOpenAIDirectSynthesisAdapter({
    apiKeyProvider: () => "openai-synth-key",
    fetchFn: (_input, init) => {
      capturedBody = JSON.parse(String(init?.body));
      return Promise.resolve(
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
      );
    },
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
  assertEquals(capturedBody?.response_format, { type: "json_object" });
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
