import {
  AGENT_BUS_MESSAGE_TYPES,
  AGENT_CHAT_ROLES,
  AGENT_RUNTIME_ROLES,
  AgentChatAuditMilestone,
  AgentChatMessageSchema,
  AgentChatObjectionSchema,
  AgentChatRoleSchema,
  CircuitBreaker,
  CodexStructuredSynthesisAdapter,
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
  DEFAULT_AGENT_RUNTIME_BUS_IDS,
  describeRoutingModeDecision,
  fallbackReasonFromError,
  FinalSynthesis,
  FinalSynthesisSchema,
  FusionRouter,
  generateEnvExample,
  generateFusionRouterConfig,
  generateQuorumRouterConfig,
  generateSetupReport,
  InMemoryAgentBusStore,
  InMemoryBudgetManager,
  isFallbackAllowed,
  loadFusionRouterConfigValue,
  loadQuorumRouterConfig,
  loadQuorumRouterConfigText,
  loadQuorumRouterConfigValue,
  ModelAdapter,
  ModelOutput,
  normalizeAgentChatLimits,
  parseRoutingMode,
  ProcessExecutionError,
  PromptCachePolicySchema,
  ProviderCapabilityRegistry,
  QuorumRouter,
  readRouterEnv,
  redactAgentChatContent,
  redactSecrets,
  RepoActionRunner,
  resolveRoutingMode,
  RouterError,
  ROUTING_MODE_ENV,
  runAgentChatSimulator,
  SafeLoopOperatorClient,
  sanitizeDiagnosticText,
  selectCommander,
  SynthesisAdapter,
} from "./router.ts";
import type {
  AgentRuntimeConfig,
  AgentRuntimeRole,
  CommanderConfig,
  DirectRoutingDecision,
  ProviderDescriptor,
} from "./router.ts";
import type {
  AgentBusConfig as SmokeAgentBusConfig,
  AgentBusDirective as SmokeAgentBusDirective,
  AgentBusEvent as SmokeAgentBusEvent,
  AgentBusHistoryQuery as SmokeAgentBusHistoryQuery,
  AgentBusIdentity as SmokeAgentBusIdentity,
  AgentBusMessage as SmokeAgentBusMessage,
  AgentBusMessageType as SmokeAgentBusMessageType,
  AgentBusRecordEventInput as SmokeAgentBusRecordEventInput,
  AgentBusSendMessageInput as SmokeAgentBusSendMessageInput,
  AgentBusStore as SmokeAgentBusStore,
  AgentBusTeam as SmokeAgentBusTeam,
  AgentBusUnreadQuery as SmokeAgentBusUnreadQuery,
  AgentChatDecision as SmokeAgentChatDecision,
  AgentChatLimits as SmokeAgentChatLimits,
  AgentChatMessage as SmokeAgentChatMessage,
  AgentChatRole as SmokeAgentChatRole,
  AgentChatRunConfig as SmokeAgentChatRunConfig,
  AgentChatTranscript as SmokeAgentChatTranscript,
  AgentRuntimeConfig as SmokeAgentRuntimeConfig,
  AgentRuntimeLimits as SmokeAgentRuntimeLimits,
  AgentRuntimeResult as SmokeAgentRuntimeResult,
  AgentRuntimeRole as SmokeAgentRuntimeRole,
  AgentRuntimeRoleBinding as SmokeAgentRuntimeRoleBinding,
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
  CommanderConfig as SmokeCommanderConfig,
  CommanderDescriptor as SmokeCommanderDescriptor,
  CommanderMode as SmokeCommanderMode,
  CommanderRole as SmokeCommanderRole,
  CommanderSelectionInput as SmokeCommanderSelectionInput,
  CommanderSelectionResult as SmokeCommanderSelectionResult,
  CommanderSelectionStrategy as SmokeCommanderSelectionStrategy,
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
  GeminiCliAdapterOptions as SmokeGeminiCliAdapterOptions,
  GeneratedQuorumRouterConfig as SmokeGeneratedQuorumRouterConfig,
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
  QuorumRouterConfig as SmokeQuorumRouterConfig,
  QuorumRouterOptions as SmokeQuorumRouterOptions,
  QuorumRouterRouteOptions as SmokeQuorumRouterRouteOptions,
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
  SmokeAgentBusConfig,
  SmokeAgentBusDirective,
  SmokeAgentBusEvent,
  SmokeAgentBusHistoryQuery,
  SmokeAgentBusIdentity,
  SmokeAgentBusMessage,
  SmokeAgentBusMessageType,
  SmokeAgentBusRecordEventInput,
  SmokeAgentBusSendMessageInput,
  SmokeAgentBusStore,
  SmokeAgentBusTeam,
  SmokeAgentBusUnreadQuery,
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
  SmokeCommanderConfig,
  SmokeCommanderDescriptor,
  SmokeCommanderMode,
  SmokeCommanderRole,
  SmokeCommanderSelectionInput,
  SmokeCommanderSelectionResult,
  SmokeCommanderSelectionStrategy,
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
  SmokeAgentRuntimeConfig,
  SmokeAgentRuntimeLimits,
  SmokeAgentRuntimeResult,
  SmokeAgentRuntimeRole,
  SmokeAgentRuntimeRoleBinding,
  SmokeFallbackPolicy,
  SmokeFallbackPolicyDecision,
  SmokeFallbackReason,
  SmokeFallbackReasonContext,
  SmokeQuorumRouterConfig,
  SmokeQuorumRouterOptions,
  SmokeQuorumRouterRouteOptions,
  SmokeGeminiCliAdapterOptions,
  SmokeGrokCliAdapterOptions,
  SmokeGeneratedQuorumRouterConfig,
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

const _customDirectiveTypeSmoke: SmokeAgentBusDirective = {
  type: "custom.needs_policy_gate",
  reason: "custom directives must use a non-overlapping namespace",
};

const LEGACY_PUBLIC_EXPORT_NAMES = [
  "AGENT_BUS_MESSAGE_TYPES",
  "AGENT_BUS_RPC",
  "AgentBusConfig",
  "AgentBusDirective",
  "AgentBusEvent",
  "AgentBusEventType",
  "AgentBusHistoryQuery",
  "AgentBusIdentity",
  "AgentBusIdentityStatus",
  "AgentBusJsonPrimitive",
  "AgentBusJsonValue",
  "AgentBusMember",
  "AgentBusMemberRole",
  "AgentBusMessage",
  "AgentBusMessageType",
  "AgentBusMetadata",
  "AgentBusRecordEventInput",
  "AgentBusRun",
  "AgentBusRunStatus",
  "AgentBusSendMessageInput",
  "AgentBusStore",
  "AgentBusTeam",
  "AgentBusUnreadQuery",
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
  "CommanderConfig",
  "CommanderConfigSchema",
  "CommanderDescriptor",
  "CommanderMode",
  "CommanderRole",
  "CommanderSelectionInput",
  "CommanderSelectionResult",
  "CommanderSelectionStrategy",
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
  "DEFAULT_AGENT_BUS_CONFIG",
  "ExplicitRoutingModeSource",
  "FallbackPolicy",
  "FallbackPolicyDecision",
  "FallbackReason",
  "FallbackReasonContext",
  "FetchLike",
  "FinalSynthesis",
  "FinalSynthesisSchema",
  "FlushableTelemetrySink",
  "QuorumRouter",
  "QuorumRouterConfig",
  "QuorumRouterConfigFileSchema",
  "QuorumRouterOptions",
  "QuorumRouterRouteOptions",
  "GeminiCliAdapterOptions",
  "GeneratedQuorumRouterConfig",
  "GeneratedQuorumRouterConfigSchema",
  "GrokCliAdapterOptions",
  "InMemoryAgentBusStore",
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
  "fromSupabaseEventRow",
  "fromSupabaseMessageRow",
  "generateEnvExample",
  "generateQuorumRouterConfig",
  "generateSetupReport",
  "profileInput",
  "runSetupCli",
  "SetupProfileNameSchema",
  "SetupWizardInputSchema",
  "stringifyGeneratedQuorumRouterConfig",
  "describeRoutingModeDecision",
  "flushTelemetrySink",
  "isFallbackAllowed",
  "isRoutingModeImplemented",
  "loadQuorumRouterConfig",
  "loadQuorumRouterConfigText",
  "loadQuorumRouterConfigValue",
  "normalizeAgentChatLimits",
  "parseRoutingMode",
  "toSupabaseRecordEventRpcArgs",
  "toSupabaseSendMessageRpcArgs",
  "redactAgentChatContent",
  "resolveRoutingMode",
  "runAgentChatSimulator",
  "selectCommander",
] as const;

async function makeScript(content: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-test-" });
  const path = `${dir}/script.sh`;
  await Deno.writeTextFile(path, content);
  await Deno.chmod(path, 0o755);
  return path;
}

function parentDir(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}

async function readPathCapture(path: string): Promise<
  Array<{ schemaPath: string; outputPath: string; schemaMode: string }>
> {
  const text = await Deno.readTextFile(path);
  return text.trim().split("\n").map((line) => {
    const [schemaPath, outputPath, schemaMode = ""] = line.split("|");
    return { schemaPath, outputPath, schemaMode };
  });
}

async function makeCodexStructuredFixtureScript(): Promise<string> {
  return await makeScript(`#!/usr/bin/env bash
set -euo pipefail
schema_path=""
output_path=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output-schema)
      schema_path="$2"
      shift 2
      ;;
    --output-last-message)
      output_path="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$schema_path" ]; then
  exit 0
fi

mode=""
if mode_value=$(stat -c '%a' "$schema_path" 2>/dev/null); then
  mode="$mode_value"
elif mode_value=$(stat -f '%Lp' "$schema_path" 2>/dev/null); then
  mode="$mode_value"
fi
printf '%s|%s|%s\n' "$schema_path" "$output_path" "$mode" >> "$QUORUM_ROUTER_CAPTURE_PATH"

if [ "\${QUORUM_ROUTER_FAIL_SYNTH:-0}" = "1" ]; then
  exit 1
fi

cat > "$output_path" <<'JSON'
{"synthesis":"ok","reasoning":"fixture structured synthesis","consensusModel":"OpenAI/gpt-5.5","sources":["Fixture/good"]}
JSON
`);
}

async function writeConfigFile(content: string): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-config-test-" });
  const path = `${dir}/quorum-router.config.json`;
  await Deno.writeTextFile(path, content);
  return path;
}

function makeAgentBusStore(): InMemoryAgentBusStore {
  return new InMemoryAgentBusStore({
    teams: [
      {
        id: "team-a",
        ownerUserId: "user-a",
        name: "primary",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "team-b",
        ownerUserId: "user-b",
        name: "secondary",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    identities: [
      {
        id: "agent-a",
        teamId: "team-a",
        agentName: "commander",
        agentRole: "commander",
        runtimeType: "manual",
        status: "idle",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "agent-b",
        teamId: "team-a",
        agentName: "reviewer",
        agentRole: "reviewer",
        runtimeType: "manual",
        status: "idle",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "agent-x",
        teamId: "team-b",
        agentName: "other",
        agentRole: "reviewer",
        runtimeType: "manual",
        status: "idle",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    runs: [
      {
        id: "run-a",
        teamId: "team-a",
        commanderAgentId: "agent-a",
        routingMode: "agent_chat",
        status: "running",
        startedAt: "2026-01-01T00:00:00.000Z",
        metadata: {},
      },
    ],
  });
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
    agentRuntime?: AgentRuntimeConfig;
  } = {},
): QuorumRouter {
  return new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter,
    minSuccessfulAdapters: 1,
    timeoutMs: 10_000,
    routingMode: options.routingMode,
    routingModeEnvProvider: options.routingModeEnvProvider,
    agentRuntime: options.agentRuntime,
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

const TEST_RUNTIME_COMMANDER: CommanderConfig = {
  enabled: true,
  mode: "agent_chat_future",
  selectionStrategy: "explicit",
  provider: "Fixture",
  model: "commander",
  authMode: "session",
  transport: "processAdapter",
  client: "RuntimeTestCommander",
  local: false,
};

class RuntimeRoleAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  calls = 0;
  prompts: string[] = [];

  constructor(
    readonly role: AgentRuntimeRole,
    private readonly output: string | string[],
    private readonly behavior: "ok" | "throw" | "never" = "ok",
  ) {
    this.descriptor = fixtureDescriptor(
      "Fixture",
      `runtime-${role}`,
      `RuntimeTest/${role}`,
    );
  }

  invoke(prompt: string, signal: AbortSignal): Promise<ModelOutput> {
    this.calls += 1;
    this.prompts.push(prompt);
    if (this.behavior === "throw") {
      return Promise.reject(new Error(`adapter failed for ${this.role}`));
    }
    if (this.behavior === "never") {
      return new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(new RouterError(4401, "agent_runtime_timeout", "aborted")),
          { once: true },
        );
      });
    }
    return Promise.resolve({
      provider: this.descriptor.provider,
      model: this.descriptor.model,
      content: Array.isArray(this.output)
        ? this.output[Math.min(this.calls - 1, this.output.length - 1)]
        : this.output,
      latencyMs: 1,
    });
  }
}

function runtimeJson(
  status: string,
  content: string,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    status,
    content,
    objection: null,
    finalAnswer: null,
    budgetUsd: 0,
    ...extra,
  });
}

let runtimeRunSequence = 0;

function makeRuntimeBus(
  ids: typeof DEFAULT_AGENT_RUNTIME_BUS_IDS,
): InMemoryAgentBusStore {
  return new InMemoryAgentBusStore({
    teams: [{
      id: ids.teamId,
      ownerUserId: "fixture-user",
      name: "runtime-test-team",
      createdAt: "2026-01-01T00:00:00.000Z",
    }],
    identities: Object.entries(ids.roleAgentIds).map(([role, id]) => ({
      id,
      teamId: ids.teamId,
      agentName: role,
      agentRole: role,
      runtimeType: "in-process-test",
      status: "idle" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
    })),
    runs: [{
      id: ids.runId,
      teamId: ids.teamId,
      commanderAgentId: ids.roleAgentIds.commander,
      routingMode: "agent_chat",
      status: "running",
      startedAt: "2026-01-01T00:00:00.000Z",
      metadata: {},
    }],
  });
}

function makeAgentRuntimeConfig(input: {
  outputs?: Partial<Record<AgentRuntimeRole, string | string[]>>;
  omitRoles?: AgentRuntimeRole[];
  duplicateRole?: AgentRuntimeRole;
  disabled?: boolean;
  experimental?: boolean;
  limits?: AgentRuntimeConfig["limits"];
  behavior?: Partial<Record<AgentRuntimeRole, "ok" | "throw" | "never">>;
  execution?: AgentRuntimeConfig["execution"];
} = {}): AgentRuntimeConfig & {
  adaptersByRole: Map<AgentRuntimeRole, RuntimeRoleAdapter>;
} {
  const outputs: Record<AgentRuntimeRole, string | string[]> = {
    commander: runtimeJson("plan", "Plan the work."),
    coder: runtimeJson("result", "Implemented result."),
    reviewer: runtimeJson("pass", "Review passed."),
    red_team: runtimeJson("pass", "Red-team passed."),
    closeout: runtimeJson("ready", "Closeout ready.", {
      finalAnswer: "Runtime final answer.",
    }),
    ...input.outputs,
  };
  const omitted = new Set(input.omitRoles ?? []);
  const adaptersByRole = new Map<AgentRuntimeRole, RuntimeRoleAdapter>();
  const roles = AGENT_RUNTIME_ROLES.filter((role) => !omitted.has(role)).map(
    (role) => {
      const adapter = new RuntimeRoleAdapter(
        role,
        outputs[role],
        input.behavior?.[role] ?? "ok",
      );
      adaptersByRole.set(role, adapter);
      return { role, required: true, adapter };
    },
  );
  if (input.duplicateRole) {
    roles.push({
      role: input.duplicateRole,
      required: true,
      adapter: new RuntimeRoleAdapter(
        input.duplicateRole,
        outputs[input.duplicateRole],
      ),
    });
  }
  const runId = `agent-runtime-test-run-${++runtimeRunSequence}`;
  const busIds = {
    ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
    runId,
  };
  return {
    enabled: input.disabled ? false : true,
    experimental: input.experimental ?? true,
    bus: makeRuntimeBus(busIds),
    busIds,
    commander: TEST_RUNTIME_COMMANDER,
    roles,
    limits: {
      maxTurns: 5,
      maxDurationMs: 10_000,
      maxBudgetUsd: 0,
      ...input.limits,
    },
    ...(input.execution ? { execution: input.execution } : {}),
    adaptersByRole,
  };
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
  runAgentChatSimulator({
    prompt: "audit secret=abc123 Bearer token-fixture",
    auditSink: audit.sink,
  });
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
  assertStringIncludes(
    String(audit.events[0].metadata.prompt),
    "secret=[REDACTED]",
  );
  assertStringIncludes(
    String(audit.events[0].metadata.prompt),
    "Bearer [REDACTED]",
  );
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

Deno.test("agent_chat route without explicit runtime opt-in fails closed before adapter execution", async () => {
  const adapter = new CountingAdapter();
  const runtime = makeAgentRuntimeConfig();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    agentRuntime: runtime,
  });
  const error = await assertRejects(
    () => router.route("hello", { routingMode: "agent_chat" }),
    RouterError,
  );
  assertEquals(error.status, 4401);
  assertEquals(error.code, "agent_runtime_opt_in_required");
  assertEquals(adapter.calls, 0);
  assertEquals(runtime.adaptersByRole.get("commander")?.calls, 0);
});

Deno.test("agent_chat route with explicit opt-in succeeds through experimental AgentRuntime", async () => {
  const adapter = new CountingAdapter();
  const runtime = makeAgentRuntimeConfig();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    agentRuntime: runtime,
  });
  const result = await router.route("hello", {
    routingMode: "agent_chat",
    experimentalAgentRuntime: true,
  });
  assertEquals(result.synthesis, "Runtime final answer.");
  assertEquals(result.consensusModel, "AgentRuntime/experimental");
  assertEquals(adapter.calls, 0);
  assertEquals(runtime.adaptersByRole.get("commander")?.calls, 1);
});

Deno.test("missing runtime config fails closed before adapter execution", async () => {
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis());
  const error = await assertRejects(
    () =>
      router.route("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_config_required");
  assertEquals(adapter.calls, 0);
});

Deno.test("AgentRuntime config defaults are disabled in generated config", () => {
  const config = generateQuorumRouterConfig({ profile: "minimal-direct" });
  assertEquals(config.agentRuntime, {
    enabled: false,
    experimental: false,
    transport: "inMemory",
  });
});

Deno.test("AgentRuntime missing required role fails before adapter execution", async () => {
  const runtime = makeAgentRuntimeConfig({ omitRoles: ["red_team"] });
  const error = await assertRejects(
    () =>
      new QuorumRouter({
        modelAdapters: [new CountingAdapter()],
        synthesisAdapter: staticOkSynthesis(),
        minSuccessfulAdapters: 1,
        agentRuntime: runtime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_required_role_missing");
  assertEquals(runtime.adaptersByRole.get("commander")?.calls, 0);
});

Deno.test("AgentRuntime duplicate role binding fails closed", async () => {
  const runtime = makeAgentRuntimeConfig({ duplicateRole: "coder" });
  const router = buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    agentRuntime: runtime,
  });
  const error = await assertRejects(
    () =>
      router.routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_duplicate_role");
  assertEquals(runtime.adaptersByRole.get("commander")?.calls, 0);
});

Deno.test("runAgentRuntime completes five-turn loop and records transcript bus messages events", async () => {
  const runtime = makeAgentRuntimeConfig();
  const router = buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    agentRuntime: runtime,
  });
  const result = await router.routeAgentRuntime("hello", {
    routingMode: "agent_chat",
    experimentalAgentRuntime: true,
  });
  assertEquals(result.ok, true);
  assertEquals(result.decision.decision, "ready");
  assertEquals(result.runtimeSummary.turns, 5);
  assertEquals(result.runtimeSummary.objections, 0);
  assertEquals(result.finalAnswer, "Runtime final answer.");
  assertEquals(result.transcript.turns.length, 5);
  assertEquals(result.transcript.messages.length, 5);
  for (const message of result.transcript.messages) {
    AgentChatMessageSchema.parse(message);
    assertEquals("turnIndex" in message, false);
  }
  assertEquals(result.messages.length, 5);
  assert(
    result.messages.every((message) => message.runId === runtime.busIds?.runId),
  );
  assert(
    result.events.some((event) => event.eventType === "agent_runtime.started"),
  );
  assert(
    result.events.some((event) =>
      event.eventType === "agent_runtime.closeout_ready"
    ),
  );
  const commanderTurn = result.transcript.turns[0];
  assertEquals(commanderTurn.role, "planner");
  assertEquals(commanderTurn.metadata.runtimeRole, "commander");
  assertEquals(commanderTurn.metadata.provider, "Fixture");
});

Deno.test("reviewer objection blocks closeout ready and records objection", async () => {
  const runtime = makeAgentRuntimeConfig({
    outputs: {
      reviewer: runtimeJson("object", "Review blocked.", {
        objection: "Needs tests.",
      }),
      closeout: runtimeJson("not_ready", "Blocked by reviewer."),
    },
  });
  const result = await buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    agentRuntime: runtime,
  }).routeAgentRuntime("hello", {
    routingMode: "agent_chat",
    experimentalAgentRuntime: true,
  });
  assertEquals(result.ok, false);
  assertEquals(result.decision.decision, "not_ready");
  assertEquals(result.runtimeSummary.objections, 1);
  assert(
    result.events.some((event) =>
      event.eventType === "agent_runtime.objection_raised"
    ),
  );
});

Deno.test("red-team objection blocks closeout ready", async () => {
  const runtime = makeAgentRuntimeConfig({
    outputs: {
      red_team: runtimeJson("object", "Risk blocked.", {
        objection: "Unsafe behavior.",
      }),
      closeout: runtimeJson("not_ready", "Blocked by red-team."),
    },
  });
  const result = await buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    agentRuntime: runtime,
  }).routeAgentRuntime("hello", {
    routingMode: "agent_chat",
    experimentalAgentRuntime: true,
  });
  assertEquals(result.ok, false);
  assertEquals(result.runtimeSummary.objections, 1);
});

Deno.test("production AgentRuntime fixes reviewer objection then re-reviews latest verified artifacts", async () => {
  const persisted: unknown[] = [];
  const action = (id: string) =>
    runtimeJson("result", `Applied ${id}.`, {
      actions: [{
        id,
        kind: "read_file",
        classification: "read_only",
        path: "README.md",
        proposedBy: "coder",
      }],
    });
  const runtime = makeAgentRuntimeConfig({
    outputs: {
      coder: [action("initial"), action("fix")],
      reviewer: [
        runtimeJson("object", "Needs a fix.", { objection: "Fix it." }),
        runtimeJson("pass", "Fixed artifacts pass."),
      ],
    },
    limits: { maxTurns: 8, maxRounds: 2 },
    execution: {
      repo: "/repo",
      runRoot: "/runs",
      taskId: "task",
      runId: (_proposal, index) => `run-${index}`,
      policyVersion: "p1",
      policyRef: "/policies/policy.json",
      requestedBy: "quorum-coder",
      expectedArtifactScope: ["run.json"],
      actionRunner: {
        prepare: (proposal) =>
          Promise.resolve({
            argv: ["fake-runner", proposal.id],
            cleanup: () => Promise.resolve(),
          }),
      },
      safeloop: {
        readiness: () => ({
          available: true,
          repoMutation: { supported: false, approvalPreflight: false },
          shellMutation: { supported: false, approvalPreflight: false },
        }),
        execute: (request) => {
          const receipt = {
            schemaVersion: "safeloop.execution-receipt.v1" as const,
            actionId: request.proposal.id,
            status: "verified" as const,
            requestRunId: request.runId,
            runId: request.runId,
            runDirectory: `/runs/${request.proposal.id}`,
            exitCode: 0 as const,
            artifacts: [{ path: request.proposal.id }],
            verification: {
              artifactsStatus: "valid" as const,
              anchorStatus: "valid" as const,
            },
            binding: {
              actionDigest: "sha256:test",
              policyVersion: "p1",
              policyRef: "/policies/policy.json",
              approvalId: null,
              approvalStatus: null,
            },
            rollbackAvailable: false,
          };
          persisted.push(receipt);
          return Promise.resolve(receipt);
        },
      },
    },
  });
  const result = await buildRouter(new CountingAdapter(), staticOkSynthesis(), {
    agentRuntime: runtime,
  }).routeAgentRuntime("hello", { routingMode: "agent_chat" });
  assertEquals(result.ok, true);
  assertEquals(result.receipts.length, 2);
  assertEquals(result.artifacts.map((artifact) => artifact.path), [
    "initial",
    "fix",
  ]);
  assertEquals(persisted.length, 2);
  assertEquals(runtime.adaptersByRole.get("reviewer")?.calls, 2);
});

Deno.test({
  name:
    "real SafeLoop execute-request E2E applies approved coder write and approved fix before closeout",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const safeloopBinary = Deno.env.get("SAFELOOP_E2E_BINARY");
    if (!safeloopBinary) return;
    const base = await Deno.realPath(
      await Deno.makeTempDir({ prefix: "quorum-safeloop-e2e-" }),
    );
    try {
      const repo = `${base}/repo`;
      const runRoot = `${base}/runs`;
      const policyRoot = `${base}/policies`;
      const privateRoot = `${base}/private`;
      const brokerDir = `${base}/broker`;
      await Promise.all([
        Deno.mkdir(repo),
        Deno.mkdir(runRoot),
        Deno.mkdir(policyRoot),
        Deno.mkdir(privateRoot),
        Deno.mkdir(brokerDir),
      ]);
      const git = await new Deno.Command("git", {
        args: ["init", "--quiet", repo],
      }).output();
      assert(git.success);
      const keyFile = `${privateRoot}/operator.key`;
      await Deno.writeFile(
        keyFile,
        crypto.getRandomValues(new Uint8Array(32)),
        { mode: 0o600, createNew: true },
      );
      const unsignedPolicy = `${privateRoot}/policy-input.json`;
      await Deno.writeTextFile(
        unsignedPolicy,
        JSON.stringify({
          schema_version: "safeloop.execution-policy.v1",
          policy_version: "qr-e2e-v1",
          policy_id: "quorum-router-e2e",
          mutation_classes: {
            read_only: { allow: true, require_approval: false },
            repo_write: { allow: true, require_approval: true },
            shell_write: { allow: true, require_approval: true },
          },
        }),
        { mode: 0o600 },
      );
      const signed = await new Deno.Command(safeloopBinary, {
        args: [
          "sign-execution-policy",
          "--input",
          unsignedPolicy,
          "--policy-root",
          policyRoot,
          "--output",
          "quorum.json",
          "--signing-key-file",
          keyFile,
        ],
        stdout: "piped",
        stderr: "piped",
      }).output();
      assert(signed.success, new TextDecoder().decode(signed.stderr));
      const policyRef = `${policyRoot}/quorum.json`;
      const approvalDb = `${privateRoot}/approvals.sqlite3`;
      let operatorPrompts = 0;
      const operatorClient = new SafeLoopOperatorClient({
        brokerDir,
        pollIntervalMs: 10,
        timeoutMs: 10_000,
        async onOperatorRequired(prompt) {
          operatorPrompts += 1;
          const approved = await new Deno.Command(safeloopBinary, {
            args: [
              "operator-execute",
              "--request",
              prompt.requestPath,
              "--expected-digest",
              prompt.actionDigest,
              "--receipt",
              prompt.receiptPath,
              "--approval-db",
              approvalDb,
              "--signing-key-file",
              keyFile,
              "--policy-root",
              policyRoot,
              "--approved-by",
              "human-reviewer",
              "--json",
            ],
            stdout: "piped",
            stderr: "piped",
          }).output();
          assert(approved.success, new TextDecoder().decode(approved.stderr));
        },
      });
      const actionRunner = await RepoActionRunner.create(repo);
      const runtime = makeAgentRuntimeConfig({
        outputs: {
          coder: [
            runtimeJson("result", "Created the file.", {
              actions: [{
                id: "initial-write",
                kind: "write_file",
                classification: "repo_write",
                path: "result.txt",
                content: "first\n",
                proposedBy: "quorum-coder",
                approvedBy: "model-forged",
              }],
            }),
            runtimeJson("result", "Applied the requested fix.", {
              actions: [{
                id: "approved-fix",
                kind: "patch_file",
                classification: "repo_write",
                path: "result.txt",
                find: "first",
                replace: "fixed",
                proposedBy: "quorum-coder",
              }],
            }),
          ],
          reviewer: [
            runtimeJson("object", "The first version needs correction.", {
              objection: "Replace first with fixed.",
            }),
            runtimeJson("pass", "The verified fixed artifact passes."),
          ],
          red_team: runtimeJson(
            "pass",
            "The confined execution evidence passes.",
          ),
          closeout: runtimeJson("ready", "All gates passed.", {
            finalAnswer: "SafeLoop-backed change is ready.",
          }),
        },
        limits: { maxTurns: 8, maxRounds: 2, maxDurationMs: 30_000 },
        execution: {
          safeloop: operatorClient,
          repo,
          runRoot,
          taskId: (proposal) => proposal.id,
          runId: (_proposal, index) => `qr-e2e-${index}`,
          policyVersion: "qr-e2e-v1",
          policyRef,
          requestedBy: "quorum-coder",

          expectedArtifactScope: [
            "run.json",
            "timeline.jsonl",
            "execution-precommit.json",
          ],
          timeoutSeconds: 10,
          actionRunner,
        },
      });
      const result = await buildRouter(
        new CountingAdapter(),
        staticOkSynthesis(),
        { agentRuntime: runtime },
      ).routeAgentRuntime("Write and review result.txt", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      });
      assertEquals(result.ok, true);
      assertEquals(result.finalAnswer, "SafeLoop-backed change is ready.");
      assertEquals(result.receipts.length, 2);
      assert(
        result.receipts.every((receipt) =>
          receipt.status === "verified" && receipt.exitCode === 0 &&
          receipt.binding.approvalStatus === "EXECUTED"
        ),
      );
      assertEquals(await Deno.readTextFile(`${repo}/result.txt`), "fixed\n");
      assertEquals(runtime.adaptersByRole.get("reviewer")?.calls, 2);
      assertEquals(operatorPrompts, 2);
    } finally {
      await Deno.remove(base, { recursive: true });
    }
  },
});

Deno.test("production AgentRuntime halts after configured max fix rounds", async () => {
  const runtime = makeAgentRuntimeConfig({
    outputs: {
      coder: runtimeJson("result", "Attempted fix.", {
        actions: [{
          id: "read",
          kind: "read_file",
          classification: "read_only",
          path: "README.md",
          proposedBy: "coder",
        }],
      }),
      reviewer: runtimeJson("object", "Still blocked.", {
        objection: "Still unsafe.",
      }),
    },
    limits: { maxTurns: 10, maxRounds: 1 },
    execution: {
      repo: "/repo",
      runRoot: "/runs",
      taskId: "task",
      runId: "run",
      policyVersion: "p1",
      policyRef: "/policies/policy.json",
      requestedBy: "quorum-coder",
      expectedArtifactScope: ["run.json"],
      actionRunner: {
        prepare: () =>
          Promise.resolve({
            argv: ["fake-runner"],
            cleanup: () => Promise.resolve(),
          }),
      },
      safeloop: {
        readiness: () => ({
          available: true,
          repoMutation: { supported: false, approvalPreflight: false },
          shellMutation: { supported: false, approvalPreflight: false },
        }),
        execute: (request) =>
          Promise.resolve({
            schemaVersion: "safeloop.execution-receipt.v1",
            actionId: request.proposal.id,
            status: "verified",
            requestRunId: request.runId,
            runId: request.runId,
            runDirectory: "/runs/read",
            exitCode: 0,
            artifacts: [{ path: "read" }],
            verification: {
              artifactsStatus: "valid",
              anchorStatus: "valid",
            },
            binding: {
              actionDigest: "sha256:test",
              policyVersion: "p1",
              policyRef: "/policies/policy.json",
              approvalId: null,
              approvalStatus: null,
            },
            rollbackAvailable: false,
          }),
      },
    },
  });
  const error = await assertRejects(() =>
    buildRouter(new CountingAdapter(), staticOkSynthesis(), {
      agentRuntime: runtime,
    })
      .routeAgentRuntime("hello", { routingMode: "agent_chat" })
  );
  assert(error instanceof RouterError);
  assertEquals(error.code, "agent_runtime_max_rounds_exceeded");
});

Deno.test("malformed role JSON fails closed", async () => {
  const runtime = makeAgentRuntimeConfig({ outputs: { coder: "not-json" } });
  const error = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: runtime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_malformed_role_output");
});

Deno.test("unexpected role status, unsafe objection, and unsafe final answer fail closed", async () => {
  const unexpectedRuntime = makeAgentRuntimeConfig({
    outputs: {
      commander: runtimeJson("object", "Unsafe commander objection.", {
        objection: "Stop.",
      }),
    },
  });
  const unexpected = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: unexpectedRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(unexpected.code, "agent_runtime_unexpected_role_status");

  const unsafeRuntime = makeAgentRuntimeConfig({
    outputs: {
      reviewer: runtimeJson("pass", "Pass but unsafe objection.", {
        objection: "contradiction",
      }),
    },
  });
  const unsafe = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: unsafeRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(unsafe.code, "agent_runtime_unsafe_objection");

  const unsafeFinalRuntime = makeAgentRuntimeConfig({
    outputs: {
      coder: runtimeJson("result", "Result with stray final answer.", {
        finalAnswer: "not allowed here",
      }),
    },
  });
  const unsafeFinal = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: unsafeFinalRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(unsafeFinal.code, "agent_runtime_unsafe_final_answer");
});

Deno.test("negative and NaN budgets fail closed", async () => {
  for (const budgetUsd of [-1, Number.NaN]) {
    const runtime = makeAgentRuntimeConfig({
      outputs: { coder: runtimeJson("result", "Result.", { budgetUsd }) },
    });
    const error = await assertRejects(
      () =>
        buildRouter(new CountingAdapter(), staticOkSynthesis(), {
          agentRuntime: runtime,
        }).routeAgentRuntime("hello", {
          routingMode: "agent_chat",
          experimentalAgentRuntime: true,
        }),
      RouterError,
    );
    assertEquals(error.code, "agent_runtime_malformed_role_output");
  }
});

Deno.test("max turns and budget are enforced", async () => {
  const maxTurnsRuntime = makeAgentRuntimeConfig({ limits: { maxTurns: 4 } });
  const turnsError = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: maxTurnsRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(turnsError.code, "agent_runtime_max_turns_exceeded");

  const budgetRuntime = makeAgentRuntimeConfig({
    outputs: { coder: runtimeJson("result", "Result.", { budgetUsd: 0.02 }) },
    limits: { maxBudgetUsd: 0.01 },
  });
  const budgetError = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: budgetRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(budgetError.code, "agent_runtime_budget_exceeded");
});

Deno.test("actual role prompt length is enforced after prior outputs", async () => {
  const runtime = makeAgentRuntimeConfig({
    outputs: { commander: runtimeJson("plan", "x".repeat(2_000)) },
    limits: { maxPromptChars: 1_000 },
  });
  const error = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: runtime,
      }).routeAgentRuntime("small prompt", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_prompt_too_large");
  assertEquals(runtime.adaptersByRole.get("commander")?.calls, 1);
  assertEquals(runtime.adaptersByRole.get("coder")?.calls, 0);
});

Deno.test("timeout and adapter exception fail closed", async () => {
  const timeoutRuntime = makeAgentRuntimeConfig({
    behavior: { coder: "never" },
    limits: { maxDurationMs: 1 },
  });
  const timeoutError = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: timeoutRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(timeoutError.code, "agent_runtime_timeout");

  const throwRuntime = makeAgentRuntimeConfig({ behavior: { coder: "throw" } });
  const adapterError = await assertRejects(
    () =>
      buildRouter(new CountingAdapter(), staticOkSynthesis(), {
        agentRuntime: throwRuntime,
      }).routeAgentRuntime("hello", {
        routingMode: "agent_chat",
        experimentalAgentRuntime: true,
      }),
    RouterError,
  );
  assertEquals(adapterError.code, "agent_runtime_adapter_failed");
});

Deno.test("direct route remains unchanged with runtime config present", async () => {
  const directAdapter = new CountingAdapter();
  const runtime = makeAgentRuntimeConfig();
  const router = buildRouter(directAdapter, staticOkSynthesis(), {
    agentRuntime: runtime,
  });
  const result = await router.route("hello", { routingMode: "direct" });
  assertEquals(result.synthesis, "ok");
  assertEquals(directAdapter.calls, 1);
  assertEquals(runtime.adaptersByRole.get("commander")?.calls, 0);
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
  assertEquals(openAiDirect.promptCaching, {
    supported: true,
    providerManaged: true,
  });
  const anthropicDirect = registry.require({
    provider: "Anthropic",
    model: "claude-3-5-haiku-latest",
    authMode: "apiKey",
    transport: "directHttp",
    client: "AnthropicMessagesAPI",
  });
  assertEquals(anthropicDirect.promptCaching?.ttlSeconds, [300]);
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
  const router = new QuorumRouter({
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
  const router = new QuorumRouter({
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
  const router = new QuorumRouter({
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
  const config = await loadQuorumRouterConfig(configPath);
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
    prefix: "quorum-router-config-missing-",
  });
  const config = await loadQuorumRouterConfig(
    `${dir}/quorum-router.config.json`,
  );

  assertEquals(config, {});
  assertEquals(resolveRoutingMode({ configMode: config.routingMode }), {
    mode: "direct",
    source: "default",
  });
});

Deno.test("QuorumRouter exports are canonical and Fusion aliases remain compatible", () => {
  assertEquals(FusionRouter, QuorumRouter);
  assertEquals(generateFusionRouterConfig, generateQuorumRouterConfig);
  assertEquals(loadFusionRouterConfigValue, loadQuorumRouterConfigValue);
  const generated = generateQuorumRouterConfig({ profile: "minimal-direct" });
  assertEquals(generated.setup.generatedBy, "quorum-router setup");
  assertEquals(
    loadQuorumRouterConfigValue({
      ...generated,
      setup: { ...generated.setup, generatedBy: "fusion-router setup" },
    }).routingMode,
    "direct",
  );
});

Deno.test("canonical router env takes precedence over deprecated legacy env", () => {
  const canonicalName = "QUORUM_ROUTER_TEST_PRECEDENCE";
  const legacyName = "FUSION_ROUTER_TEST_PRECEDENCE";
  const oldCanonical = Deno.env.get(canonicalName);
  const oldLegacy = Deno.env.get(legacyName);
  try {
    Deno.env.set(legacyName, "legacy");
    Deno.env.delete(canonicalName);
    assertEquals(readRouterEnv(canonicalName), "legacy");
    Deno.env.set(canonicalName, "canonical");
    assertEquals(readRouterEnv(canonicalName), "canonical");
  } finally {
    oldCanonical === undefined
      ? Deno.env.delete(canonicalName)
      : Deno.env.set(canonicalName, oldCanonical);
    oldLegacy === undefined
      ? Deno.env.delete(legacyName)
      : Deno.env.set(legacyName, oldLegacy);
  }
});

Deno.test("generated scaffold env fallback prefers canonical with isolated subprocess env", async () => {
  const module =
    `${Deno.cwd()}/packages/create-quorum-router/templates/basic/src/env.ts`;
  const script = `import { readRouterEnv } from ${
    JSON.stringify(module)
  }; console.log(JSON.stringify({value:readRouterEnv("QUORUM_ROUTER_PROVIDER_MODEL")}));`;
  const run = async (env: Record<string, string>) => {
    const output = await new Deno.Command(Deno.execPath(), {
      args: ["eval", script],
      clearEnv: true,
      env,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(output.success, new TextDecoder().decode(output.stderr));
    return JSON.parse(new TextDecoder().decode(output.stdout));
  };
  assertEquals(
    await run({
      FUSION_ROUTER_PROVIDER_MODEL: "legacy",
      OTHER_VALUE: "hidden",
    }),
    { value: "legacy" },
  );
  assertEquals(
    await run({
      QUORUM_ROUTER_PROVIDER_MODEL: "canonical",
      FUSION_ROUTER_PROVIDER_MODEL: "legacy",
    }),
    { value: "canonical" },
  );
});

Deno.test("minimal-direct profile generates valid config", async () => {
  const config = generateQuorumRouterConfig({ profile: "minimal-direct" });
  assertEquals(config.profile, "minimal-direct");
  assertEquals(config.routing.mode, "direct");
  assertEquals(config.providers, []);
  assertEquals(config.persistence.mode, "none");
  assertEquals(config.adaptiveDirect.enabled, false);

  const path = await writeConfigFile(JSON.stringify(config));
  const loaded = await loadQuorumRouterConfig(path);
  assertEquals(loaded.routingMode, "direct");
  assertEquals(loaded.setupProfile, "minimal-direct");
});

Deno.test("direct-http-openai profile emits only placeholders, not raw secrets", () => {
  const config = generateQuorumRouterConfig({ profile: "direct-http-openai" });
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
  const config = generateQuorumRouterConfig({ profile: "supabase-audit" });
  const envExample = generateEnvExample({ profile: "supabase-audit" });
  const report = generateSetupReport({ profile: "supabase-audit" });
  const surface = JSON.stringify({ config, envExample, report });

  assertEquals(config.persistence.mode, "supabaseAuditRpc");
  assertStringIncludes(envExample, "QUORUM_ROUTER_SUPABASE_URL=");
  assertStringIncludes(envExample, "QUORUM_ROUTER_SUPABASE_ANON_KEY=");
  assertStringIncludes(envExample, "QUORUM_ROUTER_SUPABASE_SESSION_JWT=");
  assert(!surface.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert(!surface.includes("QUORUM_ROUTER_SUPABASE_SERVICE_ROLE_KEY"));
});

Deno.test("adaptive-direct profile enables policy config safely", () => {
  const config = generateQuorumRouterConfig({ profile: "adaptive-direct" });
  assertEquals(config.adaptiveDirect.enabled, true);
  assertEquals(
    config.adaptiveDirect.fallbackPolicy,
    "safe_provider_unavailable_only",
  );
  assertEquals(config.adaptiveDirect.budgetLimitUsd, 0.25);
  assert(config.providers.length >= 2);
});

Deno.test("generated config value and text loaders match file loader", async () => {
  const generated = generateQuorumRouterConfig({ profile: "minimal-direct" });
  const fromValue = loadQuorumRouterConfigValue(generated);
  const fromText = loadQuorumRouterConfigText(JSON.stringify(generated));
  const fromFile = await loadQuorumRouterConfig(
    await writeConfigFile(JSON.stringify(generated)),
  );

  assertEquals(fromValue, fromText);
  assertEquals(fromValue, fromFile);
  assertEquals(fromValue.routingMode, "direct");
  assertEquals(fromValue.setupProfile, "minimal-direct");
});

Deno.test("generated minimal-direct config can construct fixture router", async () => {
  const loaded = loadQuorumRouterConfigValue(
    generateQuorumRouterConfig({ profile: "minimal-direct" }),
  );
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
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
  const generated = generateQuorumRouterConfig({ profile: "adaptive-direct" });
  const loaded = loadQuorumRouterConfigValue(generated);
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
  const router = new QuorumRouter({
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
  const loaded = loadQuorumRouterConfigValue(generateQuorumRouterConfig({
    profile: "minimal-direct",
    routingMode: "agent_chat",
    experimentalAgentChat: true,
  }));
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  await assertRejects(
    () => router.route("agent_chat stays unavailable"),
    RouterError,
    "experimentalAgentRuntime",
  );
  assertEquals(adapter.calls, 0);
});

Deno.test("commander config defaults disabled across generated direct profiles", () => {
  const profiles = [
    "minimal-direct",
    "direct-http-openai",
    "direct-http-anthropic",
    "adaptive-direct",
    "cli-oauth",
    "supabase-audit",
  ] as const;

  for (const profile of profiles) {
    const generated = generateQuorumRouterConfig({ profile });
    assertEquals(generated.commander, {
      enabled: false,
      mode: "direct_synthesis",
      selectionStrategy: "first_eligible_synthesis",
      local: false,
    });
    assertEquals(generated.routing.mode, "direct");
  }
});

Deno.test("loading config with commander namespace does not change routing.mode", () => {
  const loaded = loadQuorumRouterConfigValue({
    routing: { mode: "direct" },
    commander: {
      enabled: true,
      mode: "direct_synthesis",
      selectionStrategy: "explicit",
      provider: "OpenAI",
      model: "gpt-5.5",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
    },
  });

  assertEquals(loaded.routingMode, "direct");
  assertEquals(loaded.commander?.enabled, true);
  assertEquals(loaded.commander?.provider, "OpenAI");
});

Deno.test("explicit commander descriptor validates against provider registry", () => {
  const result = selectCommander({
    commander: {
      enabled: true,
      mode: "direct_synthesis",
      selectionStrategy: "explicit",
      provider: "OpenAI",
      model: "gpt-5.5",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
      local: false,
    },
    synthesisCandidates: [],
    providerRegistry: createDefaultProviderCapabilityRegistry(),
  });

  assertEquals(result.selected, true);
  assertEquals(result.commander.role, "commander");
  assertEquals(result.descriptor?.provider, "OpenAI");
  assertEquals(result.descriptor?.model, "gpt-5.5");
});

Deno.test("explicit unknown commander descriptor fails closed", () => {
  const error = assertThrows(
    () =>
      selectCommander({
        commander: {
          enabled: true,
          mode: "direct_synthesis",
          selectionStrategy: "explicit",
          provider: "UnknownAI",
          model: "unknown-command-model",
          authMode: "oauth",
          transport: "processAdapter",
          client: "UnknownClient",
          local: false,
        },
        synthesisCandidates: [],
        providerRegistry: createDefaultProviderCapabilityRegistry(),
      }),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_commander_selection");
});

Deno.test("local commander placeholder validates only as local/local/localModel", () => {
  const valid = selectCommander({
    commander: {
      enabled: true,
      mode: "direct_synthesis",
      selectionStrategy: "explicit",
      provider: "Local",
      model: "local-command-model",
      authMode: "local",
      transport: "localModel",
      local: true,
    },
    synthesisCandidates: [],
  });

  assertEquals(valid.selected, true);
  assertEquals(valid.descriptor, undefined);
  assertEquals(valid.commander.local, true);

  const error = assertThrows(
    () =>
      selectCommander({
        commander: {
          enabled: true,
          mode: "direct_synthesis",
          selectionStrategy: "explicit",
          provider: "Local",
          model: "local-command-model",
          authMode: "oauth",
          transport: "localModel",
          local: true,
        },
        synthesisCandidates: [],
      }),
    RouterError,
  );
  assertEquals(error.code, "invalid_commander_local_placeholder");

  const nonExplicitStrategies = [
    "first_eligible_synthesis",
    "highest_capability_score",
  ] as const;
  const localLikeConfigs = [
    { name: "provider", provider: "Local" as const },
    { name: "local flag", local: true },
    { name: "auth mode", authMode: "local" as const },
    { name: "transport", transport: "localModel" as const },
  ] as const;

  for (const selectionStrategy of nonExplicitStrategies) {
    for (const localLike of localLikeConfigs) {
      const error = assertThrows(
        () =>
          selectCommander({
            commander: {
              enabled: true,
              mode: "direct_synthesis",
              selectionStrategy,
              provider: "OpenAI",
              model: "gpt-5.5",
              authMode: "oauth",
              transport: "processAdapter",
              local: false,
              ...localLike,
            },
            synthesisCandidates: [],
          }),
        RouterError,
        undefined,
        `${selectionStrategy} accepts invalid local-like ${localLike.name} config`,
      );
      assertEquals(error.status, 4400);
      assertEquals(error.code, "commander_local_requires_explicit_selection");
    }
  }
});

Deno.test("setup validation fails closed for invalid commander combinations", () => {
  const unknown = assertThrows(
    () =>
      generateQuorumRouterConfig({
        profile: "minimal-direct",
        commander: {
          enabled: true,
          mode: "direct_synthesis",
          selectionStrategy: "explicit",
          provider: "UnknownAI",
          model: "unknown-command-model",
          authMode: "oauth",
          transport: "processAdapter",
          client: "UnknownClient",
        },
      }),
    RouterError,
  );
  assertEquals(unknown.code, "invalid_setup_commander_combination");

  const invalidLocal = assertThrows(
    () =>
      generateQuorumRouterConfig({
        profile: "minimal-direct",
        commander: {
          enabled: true,
          mode: "direct_synthesis",
          selectionStrategy: "explicit",
          provider: "Local",
          model: "local-command-model",
          authMode: "oauth",
          transport: "localModel",
          local: true,
        },
      }),
    RouterError,
  );
  assertEquals(invalidLocal.code, "invalid_setup_commander_local_placeholder");
});

Deno.test("first_eligible_synthesis selects deterministic synthesis-capable candidate", () => {
  const anthropic: ProviderDescriptor = {
    provider: "Anthropic",
    model: "claude-3-5-haiku-latest",
    authMode: "apiKey",
    transport: "directHttp",
    client: "AnthropicMessagesAPI",
  };
  const codex: ProviderDescriptor = {
    provider: "OpenAI",
    model: "gpt-5.5",
    authMode: "oauth",
    transport: "processAdapter",
    client: "CodexCLI",
  };
  const openaiDirect: ProviderDescriptor = {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    authMode: "apiKey",
    transport: "directHttp",
    client: "OpenAIChatCompletions",
  };

  const result = selectCommander({
    commander: {
      enabled: true,
      mode: "direct_synthesis",
      selectionStrategy: "first_eligible_synthesis",
      local: false,
    },
    synthesisCandidates: [anthropic, codex, openaiDirect],
    providerRegistry: createDefaultProviderCapabilityRegistry(),
  });

  assertEquals(result.selected, true);
  assertEquals(result.descriptor, codex);
});

Deno.test("highest_capability_score is deterministic and stable", () => {
  const codex: ProviderDescriptor = {
    provider: "OpenAI",
    model: "gpt-5.5",
    authMode: "oauth",
    transport: "processAdapter",
    client: "CodexCLI",
  };
  const openaiDirect: ProviderDescriptor = {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    authMode: "apiKey",
    transport: "directHttp",
    client: "OpenAIChatCompletions",
  };

  const input = {
    commander: {
      enabled: true,
      mode: "direct_synthesis" as const,
      selectionStrategy: "highest_capability_score" as const,
      local: false,
    },
    synthesisCandidates: [codex, openaiDirect],
    providerRegistry: createDefaultProviderCapabilityRegistry(),
  };
  const first = selectCommander(input);
  const second = selectCommander({
    ...input,
    synthesisCandidates: [...input.synthesisCandidates].reverse(),
  });

  assertEquals(first.selected, true);
  assertEquals(first.descriptor, openaiDirect);
  assertEquals(second.descriptor, openaiDirect);
});

Deno.test("agent_chat future commander selection remains future-only", () => {
  const result = selectCommander({
    commander: {
      enabled: true,
      mode: "agent_chat_future",
      selectionStrategy: "explicit",
      provider: "OpenAI",
      model: "gpt-5.5",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
      local: false,
    },
    synthesisCandidates: [],
  });

  assertEquals(result.selected, false);
  assertStringIncludes(result.reason, "future-only");
  assertEquals(result.commander.role, "commander");
});

Deno.test("direct route works without Agent Bus config", async () => {
  const loaded = loadQuorumRouterConfigValue({ routing: { mode: "direct" } });
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route("best-answer direct path");

  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("generated direct config keeps Agent Bus disabled", () => {
  const generated = generateQuorumRouterConfig({ profile: "minimal-direct" });
  const loaded = loadQuorumRouterConfigValue(generated);

  assertEquals(generated.routing.mode, "direct");
  assertEquals(generated.agentBus.enabled, false);
  assertEquals(generated.agentBus.transport, "supabase");
  assertEquals(generated.agentBus.realtimeWakeup, false);
  assertEquals(loaded.routingMode, "direct");
  assertEquals(loaded.agentBus?.enabled, false);
});

Deno.test("direct route still works with commander config present", async () => {
  const loaded = loadQuorumRouterConfigValue({
    routing: { mode: "direct" },
    commander: {
      enabled: true,
      mode: "direct_synthesis",
      selectionStrategy: "explicit",
      provider: "OpenAI",
      model: "gpt-5.5",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
    },
  });
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route(
    "best-answer direct path with commander config",
  );

  assertEquals(loaded.commander?.enabled, true);
  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("Agent Bus config namespace does not change routing.mode=direct behavior", async () => {
  const loaded = loadQuorumRouterConfigValue({
    routing: { mode: "direct" },
    agentBus: { enabled: true, transport: "supabase", realtimeWakeup: false },
  });
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  const result = await router.route("direct with coordination config present");

  assertEquals(loaded.agentBus?.enabled, true);
  assertEquals(result.synthesis, "ok");
  assertEquals(adapter.calls, 1);
});

Deno.test("agent_chat with Agent Bus config still fails closed before adapter execution", async () => {
  const loaded = loadQuorumRouterConfigValue({
    routing: { mode: "agent_chat" },
    agentBus: { enabled: true, transport: "supabase", realtimeWakeup: false },
  });
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  await assertRejects(
    () => router.route("agent_chat remains unavailable with bus config"),
    RouterError,
    "experimentalAgentRuntime",
  );
  assertEquals(loaded.agentBus?.enabled, true);
  assertEquals(adapter.calls, 0);
});

Deno.test("agent_chat with commander and Agent Bus config still fails closed before adapter execution", async () => {
  const loaded = loadQuorumRouterConfigValue({
    routing: { mode: "agent_chat" },
    agentBus: { enabled: true, transport: "supabase", realtimeWakeup: false },
    commander: {
      enabled: true,
      mode: "agent_chat_future",
      selectionStrategy: "explicit",
      provider: "OpenAI",
      model: "gpt-5.5",
      authMode: "oauth",
      transport: "processAdapter",
      client: "CodexCLI",
    },
  });
  const adapter = new CountingAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: staticOkSynthesis(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });

  await assertRejects(
    () => router.route("agent_chat remains unavailable with bus and commander"),
    RouterError,
    "experimentalAgentRuntime",
  );
  assertEquals(loaded.commander?.mode, "agent_chat_future");
  assertEquals(loaded.agentBus?.enabled, true);
  assertEquals(adapter.calls, 0);
});

Deno.test("in-memory Agent Bus send unread markRead and history are deterministic", async () => {
  const bus = makeAgentBusStore();
  const first = await bus.sendMessage({
    teamId: "team-a",
    runId: "run-a",
    fromAgentId: "agent-a",
    toAgentId: "agent-b",
    messageType: "task",
    body: "review this",
  });
  const second = await bus.sendMessage({
    teamId: "team-a",
    runId: "run-a",
    fromAgentId: "agent-b",
    toAgentId: "agent-a",
    messageType: "result",
    body: "ready",
  });

  assertEquals(first.id, "message-000001");
  assertEquals(second.id, "message-000002");
  assertEquals(
    (await bus.unread({ teamId: "team-a", agentId: "agent-b" })).map((
      message,
    ) => message.id),
    [first.id],
  );
  await bus.markRead(first.id);
  assertEquals(await bus.unread({ teamId: "team-a", agentId: "agent-b" }), []);
  assertEquals(
    (await bus.history({ teamId: "team-a", runId: "run-a" })).map((message) =>
      message.id
    ),
    [first.id, second.id],
  );
});

Deno.test("in-memory Agent Bus seeded generated IDs do not collide", async () => {
  const bus = new InMemoryAgentBusStore({
    teams: [
      {
        id: "team-a",
        ownerUserId: "user-a",
        name: "primary",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    identities: [
      {
        id: "agent-a",
        teamId: "team-a",
        agentName: "commander",
        agentRole: "commander",
        runtimeType: "manual",
        status: "idle",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    messages: [
      {
        id: "message-000003",
        teamId: "team-a",
        fromAgentId: "agent-a",
        messageType: "text",
        body: "seeded",
        metadata: {},
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    events: [
      {
        id: "event-000004",
        teamId: "team-a",
        eventType: "seeded",
        payload: {},
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const message = await bus.sendMessage({
    teamId: "team-a",
    fromAgentId: "agent-a",
    body: "new",
  });
  const event = await bus.recordEvent({
    teamId: "team-a",
    eventType: "new",
  });

  assertEquals(message.id, "message-000005");
  assertEquals(event.id, "event-000006");
});

Deno.test("in-memory Agent Bus enforces same-team invariants", async () => {
  const bus = makeAgentBusStore();

  await assertRejects(
    () =>
      bus.sendMessage({
        teamId: "team-a",
        runId: "run-a",
        fromAgentId: "agent-x",
        toAgentId: "agent-b",
        body: "cross-team sender",
      }),
    RouterError,
    "Agent bus contract validation failed.",
  );
  await assertRejects(
    () =>
      bus.recordEvent({
        teamId: "team-a",
        runId: "run-a",
        agentId: "agent-x",
        eventType: "agent_chat.blocked",
      }),
    RouterError,
    "Agent bus contract validation failed.",
  );
});

Deno.test("in-memory Agent Bus rejects unknown message types", async () => {
  const bus = makeAgentBusStore();

  await assertRejects(
    () =>
      bus.sendMessage({
        teamId: "team-a",
        runId: "run-a",
        fromAgentId: "agent-a",
        toAgentId: "agent-b",
        messageType: "unknown" as never,
        body: "bad type",
      }),
    RouterError,
    "Agent bus contract validation failed.",
  );
  assert(!AGENT_BUS_MESSAGE_TYPES.includes("unknown" as never));
});

Deno.test("directive records are stored but not executed", async () => {
  const bus = makeAgentBusStore();
  const customDirective: SmokeAgentBusDirective = {
    type: "custom.operator_note",
    reason: "custom directive records are allowed but never executed here",
  };
  const directive = await bus.sendMessage({
    teamId: "team-a",
    runId: "run-a",
    fromAgentId: "agent-a",
    toAgentId: "agent-b",
    messageType: "directive",
    body: JSON.stringify({
      type: "missing_dependency",
      dependency: "supabase_realtime",
      reason: "subscriber not enabled",
    }),
    metadata: { directive: { type: "start_monitor", teamId: "team-a" } },
  });

  assertEquals(directive.messageType, "directive");
  assertEquals(customDirective.type, "custom.operator_note");
  assertEquals(bus.snapshotEvents(), []);
  assertEquals(
    (await bus.history({ teamId: "team-a", runId: "run-a" }))[0].id,
    directive.id,
  );
});

Deno.test("Agent Bus metadata is sanitized and redacted", async () => {
  const bus = makeAgentBusStore();
  const credentialKey = ["to", "ken"].join("");
  const nestedCredentialKey = ["pass", "word"].join("");
  const message = await bus.sendMessage({
    teamId: "team-a",
    runId: "run-a",
    fromAgentId: "agent-a",
    toAgentId: "agent-b",
    body: "authorization=abc123 keep summary",
    metadata: {
      [credentialKey]: "abc123",
      nested: { [nestedCredentialKey]: "abc123", count: 2 },
      unsafe: () => "nope",
    },
  });

  assertStringIncludes(message.body, "authorization=[REDACTED]");
  assertEquals(message.metadata[credentialKey], "[REDACTED]");
  assertEquals(message.metadata.nested, {
    [nestedCredentialKey]: "[REDACTED]",
    count: 2,
  });
  assertEquals(message.metadata.unsafe, "[SANITIZED]");
});

Deno.test("Agent Bus returned message metadata is deeply cloned", async () => {
  const bus = makeAgentBusStore();
  const message = await bus.sendMessage({
    teamId: "team-a",
    runId: "run-a",
    fromAgentId: "agent-a",
    body: "nested clone",
    metadata: { nested: { ok: true }, list: [{ value: "stored" }] },
  });

  (message.metadata.nested as Record<string, unknown>).ok = false;
  ((message.metadata.list as unknown[])[0] as Record<string, unknown>).value =
    "mutated";

  const [stored] = await bus.history({ teamId: "team-a", runId: "run-a" });
  assertEquals(stored?.metadata.nested, { ok: true });
  assertEquals(stored?.metadata.list, [{ value: "stored" }]);
});

Deno.test("Agent Bus event log is append-only and cloned on read", async () => {
  const bus = makeAgentBusStore();
  const first = await bus.recordEvent({
    teamId: "team-a",
    runId: "run-a",
    agentId: "agent-a",
    eventType: "agent_chat.started",
    payload: { ok: true },
  });
  const before = bus.snapshotEvents();
  await bus.recordEvent({
    teamId: "team-a",
    runId: "run-a",
    agentId: "agent-b",
    eventType: "agent_chat.closeout_ready",
    payload: { ready: true },
  });

  assertEquals(before.map((event) => event.id), [first.id]);
  assertEquals(bus.snapshotEvents().map((event) => event.eventType), [
    "agent_chat.started",
    "agent_chat.closeout_ready",
  ]);

  (first.payload as Record<string, unknown>).ok = false;
  (before[0]?.payload as Record<string, unknown>).ok = false;
  assertEquals(bus.snapshotEvents()[0]?.payload, { ok: true });
});

Deno.test("Supabase Agent Bus migration declares RLS for all tables", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );
  for (
    const table of [
      "fusion_agent_teams",
      "fusion_agent_members",
      "fusion_agent_identities",
      "fusion_agent_runs",
      "fusion_agent_messages",
      "fusion_agent_events",
    ]
  ) {
    assertStringIncludes(
      sql,
      `alter table public.${table} enable row level security;`,
    );
  }
});

Deno.test("Supabase Agent Bus migration avoids privileged runtime policy requirements", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );

  assert(!/service[_-]?role/i.test(sql));
  assertStringIncludes(sql, "to authenticated");
  assertStringIncludes(sql, "auth.uid()");
});

Deno.test("Supabase Agent Bus migration revokes direct table endpoint privileges", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );

  for (
    const table of [
      "fusion_agent_teams",
      "fusion_agent_members",
      "fusion_agent_identities",
      "fusion_agent_runs",
      "fusion_agent_messages",
      "fusion_agent_events",
    ]
  ) {
    assertStringIncludes(
      sql,
      `revoke all privileges on table public.${table} from public, anon, authenticated;`,
    );
  }
});

Deno.test("Supabase Agent Bus RPC execute grants are authenticated only", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );

  for (
    const signature of [
      "public.fusion_agent_send_message(uuid, uuid, uuid, uuid, text, text, jsonb)",
      "public.fusion_agent_mark_message_read(uuid)",
      "public.fusion_agent_unread_messages(uuid, uuid, integer)",
      "public.fusion_agent_history(uuid, uuid, integer)",
      "public.fusion_agent_record_event(uuid, uuid, uuid, text, jsonb)",
    ]
  ) {
    const revoke = `revoke execute on function ${signature} from public, anon;`;
    const grant = `grant execute on function ${signature} to authenticated;`;
    assertStringIncludes(sql, revoke);
    assertStringIncludes(sql, grant);
    assert(sql.indexOf(revoke) < sql.indexOf(grant));
  }
  assert(!sql.includes("security invoker"));
});

Deno.test("Supabase Agent Bus RPC functions validate team agent and run relations", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );

  for (
    const fn of [
      "fusion_agent_send_message",
      "fusion_agent_mark_message_read",
      "fusion_agent_unread_messages",
      "fusion_agent_history",
      "fusion_agent_record_event",
    ]
  ) {
    assertStringIncludes(sql, `function public.${fn}`);
  }
  assertStringIncludes(sql, "fusion_agent_is_team_member(p_team_id)");
  assertStringIncludes(sql, "fusion_agent_is_team_operator(p_team_id)");
  assertStringIncludes(
    sql,
    "fusion_agent_identity_in_team(p_from_agent_id, p_team_id)",
  );
  assertStringIncludes(
    sql,
    "fusion_agent_identity_in_team(p_to_agent_id, p_team_id)",
  );
  assertStringIncludes(sql, "fusion_agent_run_in_team(p_run_id, p_team_id)");
  assertStringIncludes(sql, "least(greatest(coalesce(p_limit, 50), 1), 100)");
  assertStringIncludes(sql, "least(greatest(coalesce(p_limit, 100), 1), 500)");
});

Deno.test("Supabase Agent Bus migration requires non-null direct message sender", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );
  const policyStart = sql.indexOf(
    "create policy fusion_agent_messages_operator_insert",
  );
  const policyEnd = sql.indexOf(";", policyStart);
  assert(policyStart >= 0);
  const policy = sql.slice(policyStart, policyEnd);

  assertStringIncludes(policy, "from_agent_id is not null");
  assertStringIncludes(
    policy,
    "public.fusion_agent_identity_in_team(from_agent_id, team_id)",
  );
});

Deno.test("Supabase Agent Bus migration removes broad direct message update policy", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );

  assertStringIncludes(
    sql,
    "drop policy if exists fusion_agent_messages_member_update_read on public.fusion_agent_messages;",
  );
  assert(
    !sql.includes("create policy fusion_agent_messages_member_update_read"),
  );
});

Deno.test("Supabase Agent Bus mark-read RPC is the only read-state mutation path", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );
  const functionStart = sql.indexOf(
    "create or replace function public.fusion_agent_mark_message_read",
  );
  const functionEnd = sql.indexOf("$$;", functionStart);
  assert(functionStart >= 0);
  assert(functionEnd > functionStart);
  const markReadFunction = sql.slice(functionStart, functionEnd);

  assertStringIncludes(markReadFunction, "security definer");
  assertStringIncludes(
    markReadFunction,
    "not public.fusion_agent_is_team_member(v_team_id)",
  );
  assertStringIncludes(
    markReadFunction,
    "set read_at = coalesce(read_at, now())",
  );
  assertEquals(
    (sql.match(/set read_at = coalesce\(read_at, now\(\)\)/g) ?? []).length,
    1,
  );
  assert(!/create policy fusion_agent_messages_[\s\S]*for update/i.test(sql));
});

Deno.test("Supabase Agent Bus migration has inbox history and event indexes", async () => {
  const sql = await Deno.readTextFile(
    "supabase/migrations/20260702194000_fusion_agent_bus.sql",
  );

  assertStringIncludes(
    sql,
    "fusion_agent_messages(team_id, run_id, created_at desc)",
  );
  assertStringIncludes(
    sql,
    "fusion_agent_messages(team_id, to_agent_id, read_at, created_at desc)",
  );
  assertStringIncludes(
    sql,
    "fusion_agent_events(team_id, run_id, created_at desc)",
  );
  assertStringIncludes(
    sql,
    "fusion_agent_events(team_id, event_type, created_at desc)",
  );
});

Deno.test("public docs mention direct best-answer remains default", async () => {
  const docs = [
    await Deno.readTextFile("README.md"),
    await Deno.readTextFile("docs/supabase-agent-bus.md"),
    await Deno.readTextFile("docs/release-v0.1.md"),
  ].join("\n");

  assertStringIncludes(docs, "direct = best-answer routing path");
  assertStringIncludes(docs, "production-ready baseline");
  assertStringIncludes(docs, "do not change default direct routing");
});

Deno.test("security docs state license runtime posture and non-goals", async () => {
  const readme = await Deno.readTextFile("README.md");
  const security = await Deno.readTextFile("docs/security.md");
  const normalizedSecurity = security.replace(/\s+/g, " ");
  assertStringIncludes(readme, "docs/security.md");
  for (
    const phrase of [
      "MIT-licensed open source",
      "Commercial and production use are permitted under the MIT License",
      "direct` is the production-ready best-answer routing path",
      "Conversation-only `agent_chat` / AgentRuntime is explicit opt-in",
      "production-capable, bounded local repository execution slice",
      "no live Supabase Agent Bus runtime client/writes",
      "no Supabase Realtime subscriber",
      "no service-role runtime",
      "Process adapters execute explicit configured CLI adapters",
      "Do not expose untrusted public traffic without external rate limiting",
      "Budget and circuit breaker state is currently in-memory",
    ]
  ) {
    assertStringIncludes(normalizedSecurity, phrase);
  }
});

Deno.test("public docs state commander is role not model", async () => {
  const docs = [
    await Deno.readTextFile("docs/commander-role.md"),
    await Deno.readTextFile("README.md"),
    await Deno.readTextFile("docs/agent-chat-protocol.md"),
  ].join("\n");

  assertStringIncludes(docs, "Commander is a role, not a model");
  assertStringIncludes(docs, "commander = role");
  assertStringIncludes(docs, "provider/model/client = implementation");
  assertStringIncludes(
    docs,
    "does not automatically replace `synthesisAdapter`",
  );
});

Deno.test("commander docs and examples contain no raw secrets", async () => {
  const surface = [
    await Deno.readTextFile("docs/commander-role.md"),
    await Deno.readTextFile("README.md"),
    await Deno.readTextFile("docs/release-v0.1.md"),
  ].join("\n");

  assert(!/sk-[A-Za-z0-9_-]{8,}/.test(surface));
  assert(!/api[_-]?key\s*[:=]\s*[A-Za-z0-9_-]{8,}/i.test(surface));
  assert(!/bearer\s+[A-Za-z0-9._-]{8,}/i.test(surface));
  assertStringIncludes(surface, "No API-key storage");
});

Deno.test("generated supabase-audit config emits no service-role placeholders", () => {
  const generated = generateQuorumRouterConfig({ profile: "supabase-audit" });
  const envExample = generateEnvExample({ profile: "supabase-audit" });
  const surface = JSON.stringify(generated) + envExample;

  assert(!/SERVICE_ROLE|SERVICE_KEY|ADMIN_KEY|JWT_SECRET/i.test(surface));
  assertStringIncludes(surface, "QUORUM_ROUTER_SUPABASE_ANON_KEY=");
  assertStringIncludes(surface, "QUORUM_ROUTER_SUPABASE_SESSION_JWT=");
});

Deno.test("unknown setup profile fails closed", () => {
  const error = assertThrows(
    () => generateQuorumRouterConfig({ profile: "unknown" as never }),
    RouterError,
  );
  assertEquals(error.status, 4400);
  assertEquals(error.code, "unknown_setup_profile");
});

Deno.test("invalid provider/auth/transport setup combo fails closed", () => {
  const error = assertThrows(
    () =>
      generateQuorumRouterConfig({
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
    generateQuorumRouterConfig({ profile: "adaptive-direct" }),
  );
  const second = JSON.stringify(
    generateQuorumRouterConfig({ profile: "adaptive-direct" }),
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
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-setup-dryrun-" });
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
    () => Deno.stat(`${dir}/quorum-router.config.json`),
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
    "examples/agent-runtime-basic.ts",
    "examples/agent-runtime-fail-closed.ts",
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
      "No live Supabase Agent Bus runtime client/writes",
      "No OAuth login flow or automatic API-key setup",
      "deno task smoke:v0.1",
      "gitleaks git --log-opts",
      "experimentalAgentRuntime: true",
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
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-setup-write-" });
  const requestedPath = `${dir}/generated/quorum-router.config.json`;
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
    () => Deno.stat(`${dir}/quorum-router.config.json`),
    Deno.errors.NotFound,
  );
});

Deno.test("doctor accepts generated minimal config", async () => {
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-doctor-setup-" });
  await Deno.writeTextFile(
    `${dir}/quorum-router.config.json`,
    JSON.stringify(generateQuorumRouterConfig({ profile: "minimal-direct" })),
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
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-doctor-agent-" });
  const config = generateQuorumRouterConfig({
    profile: "minimal-direct",
    routingMode: "agent_chat",
    experimentalAgentChat: true,
  });
  await Deno.writeTextFile(
    `${dir}/quorum-router.config.json`,
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

  const loaded = await loadQuorumRouterConfig(
    `${dir}/quorum-router.config.json`,
  );
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: loaded.routingMode,
  });
  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_opt_in_required");
  assertEquals(adapter.calls, 0);
});

Deno.test("valid config direct loads and resolves as config source", async () => {
  const path = await writeConfigFile(`{
  "routing": {
    "mode": "direct"
  }
}`);
  const config = await loadQuorumRouterConfig(path);
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
  const config = await loadQuorumRouterConfig(path);
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

  assertEquals(error.code, "agent_runtime_opt_in_required");
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
    () => loadQuorumRouterConfig(path),
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
    () => loadQuorumRouterConfig(path),
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
    () => loadQuorumRouterConfig(path),
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
    () => loadQuorumRouterConfig(path),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_routing_mode");
});

Deno.test("wrong config shape fails closed", async () => {
  const path = await writeConfigFile(JSON.stringify({ routingMode: "direct" }));

  const error = await assertRejects(
    () => loadQuorumRouterConfig(path),
    RouterError,
  );

  assertEquals(error.status, 4400);
  assertEquals(error.code, "invalid_config_shape");
});

Deno.test("request mode overrides loaded config mode", async () => {
  const path = await writeConfigFile(JSON.stringify({
    routing: { mode: "agent_chat" },
  }));
  const config = await loadQuorumRouterConfig(path);
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
  const config = await loadQuorumRouterConfig(path);
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
    () => loadQuorumRouterConfig(path),
    RouterError,
  );

  assertEquals(error.code, "invalid_routing_mode");
});

Deno.test("agent_chat from loaded config does not call adapters", async () => {
  const path = await writeConfigFile(JSON.stringify({
    routing: { mode: "agent_chat" },
  }));
  const config = await loadQuorumRouterConfig(path);
  const adapter = new CountingAdapter();
  const router = buildRouter(adapter, staticOkSynthesis(), {
    routingMode: config.routingMode,
  });

  const error = await assertRejects(
    () => router.route("hello"),
    RouterError,
  );

  assertEquals(error.code, "agent_runtime_opt_in_required");
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

  assertEquals(error.code, "agent_runtime_opt_in_required");
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
  assertEquals(error.code, "agent_runtime_opt_in_required");
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

    assertEquals(error.code, "agent_runtime_opt_in_required");
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
  const router = new QuorumRouter({
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

  const router = new QuorumRouter({
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
printf 'auth=%s\n' "$QUORUM_ROUTER_TEST_AUTH"
>&2 printf 'credential=%s\n' "$QUORUM_ROUTER_TEST_AUTH"
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
        env: { QUORUM_ROUTER_TEST_AUTH: leakFixture },
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
  const router = new QuorumRouter({
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

Deno.test("codex structured synthesis temp files are unique restrictive and cleaned after success", async () => {
  const captureDir = await Deno.makeTempDir({
    prefix: "quorum-router-temp-capture-",
  });
  const capturePath = `${captureDir}/paths.txt`;
  const command = await makeCodexStructuredFixtureScript();
  const adapter = new CodexStructuredSynthesisAdapter({
    command,
    auth: {
      env: { QUORUM_ROUTER_CAPTURE_PATH: capturePath },
      readinessCheck: { command, args: ["status"] },
    },
    defaultTimeoutMs: 5_000,
  });
  const outputs: ModelOutput[] = [{
    provider: "Fixture",
    model: "good",
    content: "validated upstream output",
    latencyMs: 1,
  }];

  const first = await adapter.synthesize(
    "hello",
    outputs,
    new AbortController().signal,
  );
  const second = await adapter.synthesize(
    "hello again",
    outputs,
    new AbortController().signal,
  );

  assertEquals(first.synthesis, "ok");
  assertEquals(second.synthesis, "ok");
  const captures = await readPathCapture(capturePath);
  assertEquals(captures.length, 2);
  assert(captures[0].schemaPath !== captures[1].schemaPath);
  assert(captures[0].outputPath !== captures[1].outputPath);

  for (const capture of captures) {
    assertStringIncludes(capture.schemaPath, "quorum-router-codex-");
    assertStringIncludes(capture.outputPath, "quorum-router-codex-");
    if (capture.schemaMode) {
      assertEquals(capture.schemaMode, "600");
    }
    assertEquals(await pathExists(parentDir(capture.schemaPath)), false);
  }
});

Deno.test("codex structured synthesis temp files are cleaned after adapter failure", async () => {
  const captureDir = await Deno.makeTempDir({
    prefix: "quorum-router-temp-fail-",
  });
  const capturePath = `${captureDir}/paths.txt`;
  const command = await makeCodexStructuredFixtureScript();
  const adapter = new CodexStructuredSynthesisAdapter({
    command,
    auth: {
      env: {
        QUORUM_ROUTER_CAPTURE_PATH: capturePath,
        QUORUM_ROUTER_FAIL_SYNTH: "1",
      },
      readinessCheck: { command, args: ["status"] },
    },
    defaultTimeoutMs: 5_000,
  });

  await assertRejects(
    () =>
      adapter.synthesize("hello", [{
        provider: "Fixture",
        model: "good",
        content: "validated upstream output",
        latencyMs: 1,
      }], new AbortController().signal),
    RouterError,
    "Consensus stage failed validation.",
  );

  const [capture] = await readPathCapture(capturePath);
  assert(capture.schemaPath !== capture.outputPath);
  if (capture.schemaMode) {
    assertEquals(capture.schemaMode, "600");
  }
  assertEquals(await pathExists(parentDir(capture.schemaPath)), false);
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
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-retry-" });
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
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-auth-" });
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
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-circuit-" });
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
    serviceName: "quorum-router-test",
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
    "quorum-router-test",
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
    serviceName: "quorum-router-test",
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
    serviceName: "quorum-router-test",
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
  return [
    "run",
    "--allow-env",
    "--allow-run",
    "--allow-read",
    path,
    "--json",
  ];
}

Deno.test("public compatibility barrel preserves core exports", async () => {
  assertPublicTypeSmoke();
  const api = await import("./router.ts");
  for (
    const name of [
      "QuorumRouter",
      "RouterError",
      "ProcessExecutionError",
      "RoutingModeSchema",
      "parseRoutingMode",
      "resolveRoutingMode",
      "describeRoutingModeDecision",
      "loadQuorumRouterConfig",
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

Deno.test("diagnostic redaction catches non-standard and encoded credentials", () => {
  const nonStandardToken = ["fixture", "nonstandard", "credential"].join("-");
  const openAiStyle = ["sk", "abcdefghijklmnopqrstuvwxyz123456"].join("-");
  const githubClassic = ["gho", "abcdefghijklmnopqrstuvwxyz1234567890"].join(
    "_",
  );
  const githubPat = [
    "github",
    "pat",
    "11ABCDEFGHIJKLMNOPQRSTuvwx_abcdefghijklmnopqrstuvwxyz1234567890",
  ].join("_");
  const jwtLike = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI",
    "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI",
    "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  ].join(".");
  const highEntropy = "Aa1_Bb2-Cc3_Dd4-Ee5_Ff6-Gg7_Hh8-Ii9";
  const customAuthorization = "Digest nonceabc responsexyz";
  const diagnostic = [
    `opaqueCredential=${nonStandardToken}`,
    `url=https://example.test/callback?token=${openAiStyle}&next=ok`,
    `authorization: Bearer ${githubClassic}`,
    `proxy-authorization: ${customAuthorization}`,
    `password=${githubPat}`,
    "key=short-api-key-value",
    "monkey=banana",
    `jwt=${jwtLike}`,
    `blob=${highEntropy}`,
    "mode direct retry after 1s code 4401 ok",
  ].join("\n");

  const redacted = sanitizeDiagnosticText(diagnostic);

  for (
    const raw of [
      nonStandardToken,
      openAiStyle,
      githubClassic,
      githubPat,
      jwtLike,
      highEntropy,
      customAuthorization,
      "short-api-key-value",
    ]
  ) {
    assert(!redacted.includes(raw), raw);
  }
  assertStringIncludes(redacted, "opaqueCredential=[REDACTED]");
  assertStringIncludes(redacted, "token=[REDACTED]");
  assertStringIncludes(redacted, "authorization:");
  assertStringIncludes(redacted, "[REDACTED]");
  assertStringIncludes(redacted, "key=[REDACTED]");
  assertStringIncludes(redacted, "monkey=banana");
  assertStringIncludes(redacted, "mode direct retry after 1s code 4401 ok");
});

Deno.test("QuorumRouter rejects invalid quorum values", () => {
  const modelAdapter = new CountingAdapter();
  const synthesisAdapter = staticOkSynthesis();
  for (const value of [Number.NaN, 0, 1.5]) {
    try {
      new QuorumRouter({
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
      QUORUM_ROUTER_SUPABASE_SERVICE_ROLE_KEY: credentialFixture,
    }),
  }).output();

  const text = new TextDecoder().decode(output.stdout) +
    new TextDecoder().decode(output.stderr);
  assert(!output.success, text);
  assertStringIncludes(text, "supabase_service_role_absent");
  assertStringIncludes(text, "QUORUM_ROUTER_SUPABASE_SERVICE_ROLE_KEY");
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

Deno.test("doctor default output aggregates provider inventory and core checks", async () => {
  const output = await new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-run",
      "--allow-read",
      `${Deno.cwd()}/doctor.ts`,
    ],
    clearEnv: true,
    env: isolatedDoctorEnv(),
  }).output();
  assertEquals(output.code, 0);
  const text = new TextDecoder().decode(output.stdout);
  assertStringIncludes(text, "| provider | model | wrapper | auth |");
  assertStringIncludes(text, "Core checks");
  assertStringIncludes(
    text,
    "Live authentication is confirmed only by an explicit opt-in invocation",
  );
});

Deno.test("doctor reports absent config and default direct readiness", async () => {
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-doctor-empty-" });
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
    prefix: "quorum-router-doctor-config-",
  });
  await Deno.writeTextFile(
    `${dir}/quorum-router.config.json`,
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
      QUORUM_ROUTER_UNUSED_MARKER: unrelatedSecretEnvValue,
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

Deno.test("doctor prefers canonical config file over deprecated legacy filename", async () => {
  const dir = await Deno.makeTempDir({ prefix: "quorum-router-config-order-" });
  await Deno.writeTextFile(
    `${dir}/quorum-router.config.json`,
    JSON.stringify({ routing: { mode: "direct" } }),
  );
  await Deno.writeTextFile(
    `${dir}/fusion-router.config.json`,
    JSON.stringify({ routing: { mode: "agent_chat" } }),
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
  const configCheck = report.checks.find((item: { name: string }) =>
    item.name === "routing_config_file"
  );
  assertEquals(configCheck.detail, "valid: routing.mode=direct");
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

Deno.test("doctor warns when agent_chat is selected because runtime requires opt-in", async () => {
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
            usage: {
              prompt_tokens: 120,
              completion_tokens: 20,
              prompt_tokens_details: { cached_tokens: 80 },
            },
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
  assertEquals(output.usage, {
    inputTokens: 120,
    outputTokens: 20,
    cacheReadInputTokens: 80,
    uncachedInputTokens: 40,
    cacheHit: true,
  });
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
            usage: {
              input_tokens: 30,
              output_tokens: 12,
              cache_creation_input_tokens: 100,
              cache_read_input_tokens: 200,
            },
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
  assertEquals(output.usage, {
    inputTokens: 30,
    outputTokens: 12,
    cacheCreationInputTokens: 100,
    cacheReadInputTokens: 200,
    uncachedInputTokens: 30,
    cacheHit: true,
  });
});

Deno.test("Anthropic prompt caching is explicit and read-only", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const adapter = createAnthropicDirectAdapter({
    endpoint: "https://fixture.test/anthropic-cache",
    apiKeyProvider: () => "anthropic-cache-fixture",
    fetchFn: (_input, init) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Promise.resolve(
        new Response(
          JSON.stringify({
            model: "claude-fixture",
            content: [{ type: "text", text: "cached response" }],
            usage: { input_tokens: 5, output_tokens: 2 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    },
  });

  await adapter.invoke(
    "stable read-only context",
    new AbortController().signal,
    {
      cache: { enabled: true, payloadClass: "read_only", ttlSeconds: 300 },
    },
  );

  const messages = capturedBody?.messages as Array<Record<string, unknown>>;
  const content = messages[0].content as Array<Record<string, unknown>>;
  assertEquals(content[0].cache_control, { type: "ephemeral" });

  for (const payloadClass of ["mutation", "approval", "credential"] as const) {
    await assertRejects(
      () =>
        adapter.invoke("sensitive", new AbortController().signal, {
          cache: { enabled: true, payloadClass },
        }),
      Error,
      `${payloadClass} payloads cannot enable prompt caching`,
    );
  }
});

Deno.test("prompt cache policy and TTL fail closed", async () => {
  assertEquals(PromptCachePolicySchema.parse({}), {
    enabled: false,
    payloadClass: "read_only",
  });
  const adapter = createAnthropicDirectAdapter({
    apiKeyProvider: () => "unused-fixture",
    fetchFn: () => Promise.resolve(new Response("should not run")),
  });
  await assertRejects(
    () =>
      adapter.invoke("hello", new AbortController().signal, {
        cache: { enabled: true, ttlSeconds: 3600 },
      }),
    Error,
    "Unsupported prompt cache TTL 3600",
  );
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

async function readJsonRecord(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await Deno.readTextFile(path)) as Record<string, unknown>;
}

function stringArray(value: unknown): string[] {
  assert(Array.isArray(value));
  return value.map(String);
}

function assertNoExactTargetSha(text: string) {
  for (
    const sha of [
      "e806b7e6c3df04c57e3181ee6182ec7d1cad9891",
      "56a4356e108e9d1c8530bdb4e00d4049b2efd9cf",
      "bb6f82f0003daf97734eb3bdc9a6ed81646c306f",
    ]
  ) {
    assert(!text.includes(sha), `unexpected hardcoded target SHA: ${sha}`);
  }
}

Deno.test("create-quorum-router package files and metadata are release-safe", async () => {
  const requiredFiles = [
    "packages/create-quorum-router/package.json",
    "packages/create-quorum-router/bin/create-quorum-router.js",
    "packages/create-quorum-router/README.md",
    "packages/create-quorum-router/LICENSE",
    "packages/create-quorum-router/templates/basic/gitignore",
    "packages/create-quorum-router/templates/basic/README.md",
    "packages/create-quorum-router/templates/basic/deno.json",
    "packages/create-quorum-router/templates/basic/main.ts",
    "packages/create-quorum-router/templates/basic/router.config.example.json",
    "packages/create-quorum-router/templates/basic/src/cli.ts",
    "packages/create-quorum-router/templates/basic/src/env.ts",
    "packages/create-quorum-router/templates/basic/src/intake.ts",
    "packages/create-quorum-router/templates/basic/src/auth.ts",
    "packages/create-quorum-router/templates/basic/src/auth_oauth.ts",
    "packages/create-quorum-router/templates/basic/src/auth_session.ts",
    "packages/create-quorum-router/templates/basic/src/auth_env_fallback.ts",
    "packages/create-quorum-router/templates/basic/src/provider_registry.ts",
    "packages/create-quorum-router/templates/basic/src/model_inventory.ts",
    "packages/create-quorum-router/templates/basic/src/wrapper_client.ts",
    "packages/create-quorum-router/templates/basic/src/provider_client.ts",
    "packages/create-quorum-router/templates/basic/src/best_route.ts",
    "packages/create-quorum-router/templates/basic/src/agent_chat.ts",
    "packages/create-quorum-router/templates/basic/src/context.ts",
    "packages/create-quorum-router/templates/basic/src/trace.ts",
    "packages/create-quorum-router/templates/basic/src/redact.ts",
    "packages/create-quorum-router/templates/basic/src/schema.ts",
    "packages/create-quorum-router/templates/basic/src/fixture_smoke.ts",
    "packages/create-quorum-router/templates/basic/out/.gitkeep",
  ];
  for (const file of requiredFiles) {
    assert((await Deno.stat(file)).isFile, `${file} must exist`);
    if (
      file.includes("/templates/") || file.endsWith("create-quorum-router.js")
    ) {
      const text = await Deno.readTextFile(file);
      const staleBranding = file.endsWith("/src/env.ts")
        ? /(Fusion Router|fusion-router|create-fusion-router)/
        : /(Fusion Router|fusion-router|create-fusion-router|FUSION_ROUTER)/;
      assert(
        !staleBranding.test(text),
        `${file} must not emit stale public branding`,
      );
    }
  }

  const packageJson = await readJsonRecord(
    "packages/create-quorum-router/package.json",
  );
  assertEquals(packageJson.name, "create-quorum-router");
  assertEquals(packageJson.version, "0.1.4");
  assertEquals(packageJson.license, "MIT");
  const bin = packageJson.bin as Record<string, unknown>;
  assertEquals(bin["create-quorum-router"], "bin/create-quorum-router.js");
  const files = stringArray(packageJson.files);
  for (const entry of ["bin", "templates", "README.md", "LICENSE"]) {
    assert(files.includes(entry), `files must include ${entry}`);
  }
  const scripts = packageJson.scripts as Record<string, unknown> | undefined;
  assertEquals(scripts?.postinstall, undefined);

  const templateDenoJson = await readJsonRecord(
    "packages/create-quorum-router/templates/basic/deno.json",
  );
  const imports = templateDenoJson.imports as Record<string, unknown>;
  assertEquals(templateDenoJson.lock, false);
  assertEquals(imports.zod, "https://deno.land/x/zod@v3.23.8/mod.ts");
  const templateTasks = templateDenoJson.tasks as Record<string, unknown>;
  assertStringIncludes(String(templateTasks.check), "main.ts src/*.ts");
  assert(!String(templateTasks.smoke).includes("--allow-env"));
  for (
    const task of [
      "intake",
      "auth:status",
      "auth:login",
      "auth:logout",
      "models:list",
      "health",
      "route:once",
      "best-route",
      "agent-chat",
    ]
  ) {
    assert(task in templateTasks, `missing generated task ${task}`);
  }
  assertStringIncludes(String(templateTasks.intake), "intake");
  assertStringIncludes(String(templateTasks["auth:status"]), "auth:status");
  assertStringIncludes(String(templateTasks["auth:login"]), "auth:login");
  assertStringIncludes(String(templateTasks["auth:logout"]), "auth:logout");
  assertStringIncludes(String(templateTasks["models:list"]), "models:list");
  assertStringIncludes(String(templateTasks.health), "health");
  assertStringIncludes(String(templateTasks.intake), "--allow-run");
  assertStringIncludes(String(templateTasks["models:list"]), "--allow-run");
  assertStringIncludes(String(templateTasks["route:once"]), "route:once");
  assertStringIncludes(String(templateTasks["best-route"]), "best-route");
  assertStringIncludes(String(templateTasks["agent-chat"]), "agent-chat");
  assertStringIncludes(String(templateTasks["agent-chat"]), "--allow-run");
  assert(!("external:check" in templateTasks));
  assert(!("external:once" in templateTasks));
  assert(!("external:matrix" in templateTasks));
  const templateCli = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/src/cli.ts",
  );
  const templateBestRoute = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/src/best_route.ts",
  );
  const templateAgentChat = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/src/agent_chat.ts",
  );
  const templateSchema = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/src/schema.ts",
  );
  const templateContext = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/src/context.ts",
  );
  assertStringIncludes(templateSchema, "RUN_EXTERNAL_MODEL_DOGFOOD");
  assertStringIncludes(templateSchema, "RUN_EXPERIMENTAL_AGENT_CHAT");
  assertStringIncludes(
    templateBestRoute,
    "OAuth/session-first provider unavailable",
  );
  assertStringIncludes(templateCli, "QUORUM_ROUTER_AUTH_MODE");
  assertStringIncludes(templateBestRoute, "preparePromptWithContext");
  assertStringIncludes(templateAgentChat, "preparePromptWithContext");
  assertStringIncludes(templateContext, "prompt_truncated");
  assertStringIncludes(templateContext, "files_included");
  const rootDenoJson = await readJsonRecord("deno.json");
  const rootTasks = rootDenoJson.tasks as Record<string, unknown>;
  assert(!String(rootTasks.test).includes("external:once"));
  assert(!String(rootTasks.check).includes("external:once"));
  assert(!String(rootTasks.test).includes("external:matrix"));
  assert(!String(rootTasks.check).includes("external:matrix"));
});

Deno.test("generated route prompt context fetches GitHub repository files safely", async () => {
  const { extractGitHubRepo, preparePromptWithContext } = await import(
    "./packages/create-quorum-router/templates/basic/src/context.ts"
  );
  const detected = extractGitHubRepo(
    "https://github.com/sakamoto-sann/quorum-routerこれ のレビューをしてください",
  );
  assertEquals(detected?.owner, "sakamoto-sann");
  assertEquals(detected?.repo, "quorum-router");

  const source = "export const meaning = 42;\n";
  const fetchFn = (async (input: string | URL | Request) => {
    const url = String(input);
    await Promise.resolve();
    if (url.endsWith("/repos/sakamoto-sann/quorum-router")) {
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
      });
    }
    if (url.includes("/git/trees/main?recursive=1")) {
      return new Response(
        JSON.stringify({
          truncated: false,
          tree: [
            {
              path: "README.md",
              type: "blob",
              size: 12,
              url: "https://api.github.com/blob/readme",
            },
            {
              path: "src/empty.ts",
              type: "blob",
              size: 0,
              url: "https://api.github.com/blob/empty",
            },
            {
              path: "src/router.ts",
              type: "blob",
              size: source.length,
              url: "https://api.github.com/blob/router",
            },
            {
              path: "assets/logo.png",
              type: "blob",
              size: 10,
              url: "https://api.github.com/blob/logo",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/readme")) {
      return new Response(
        JSON.stringify({
          encoding: "base64",
          content: btoa("# QuorumRouter\n"),
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/empty")) {
      return new Response(
        JSON.stringify({ encoding: "base64", content: "" }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/router")) {
      return new Response(
        JSON.stringify({ encoding: "base64", content: btoa(source) }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const prepared = await preparePromptWithContext(
    "https://github.com/sakamoto-sann/quorum-routerこれ のレビューをしてください",
    { fetchFn },
  );
  assert(prepared.context.prompt_has_context);
  assertEquals(prepared.context.github_repo, "sakamoto-sann/quorum-router");
  assertEquals(prepared.context.files_included, [
    "README.md",
    "src/empty.ts",
    "src/router.ts",
  ]);
  assertStringIncludes(prepared.prompt, "untrusted data");
  assertStringIncludes(prepared.prompt, JSON.stringify("src/router.ts"));
  assertStringIncludes(prepared.prompt, JSON.stringify(source).slice(1, -1));
});

Deno.test("generated prompt context skips oversized candidates and preserves context after long user prompt", async () => {
  const { preparePromptWithContext } = await import(
    "./packages/create-quorum-router/templates/basic/src/context.ts"
  );
  const largeText = "a".repeat(24_000);
  const fetchFn = (async (input: string | URL | Request) => {
    const url = String(input);
    await Promise.resolve();
    if (url.endsWith("/repos/sakamoto-sann/quorum-router")) {
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
      });
    }
    if (url.includes("/git/trees/main?recursive=1")) {
      return new Response(
        JSON.stringify({
          truncated: false,
          tree: [
            {
              path: "LICENSE",
              type: "blob",
              size: 24_000,
              url: "https://api.github.com/blob/license",
            },
            {
              path: "README.md",
              type: "blob",
              size: 24_000,
              url: "https://api.github.com/blob/readme-large",
            },
            {
              path: "package.json",
              type: "blob",
              size: 18,
              url: "https://api.github.com/blob/package",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/license") || url.endsWith("/blob/readme-large")) {
      return new Response(
        JSON.stringify({ encoding: "base64", content: btoa(largeText) }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/package")) {
      return new Response(
        JSON.stringify({ encoding: "base64", content: btoa('{"ok":true}\n') }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const prepared = await preparePromptWithContext(
    `${"x".repeat(70_000)} https://github.com/sakamoto-sann/quorum-router`,
    { fetchFn },
  );
  assert(prepared.context.prompt_has_context);
  assert(prepared.context.prompt_truncated);
  assertEquals(prepared.context.files_included.includes("package.json"), true);
  assertStringIncludes(prepared.prompt, "Repository file data JSON");
  assertStringIncludes(prepared.prompt, JSON.stringify("package.json"));
  assertStringIncludes(prepared.prompt, "original prompt truncated");
});

Deno.test("generated prompt context falls back and traces truncation", async () => {
  const { preparePromptWithContext } = await import(
    "./packages/create-quorum-router/templates/basic/src/context.ts"
  );
  const longPrompt = `${
    "x".repeat(61_000)
  } https://github.com/sakamoto-sann/quorum-router`;
  const prepared = await preparePromptWithContext(longPrompt, {
    fetchFn: (async () => {
      await Promise.resolve();
      return new Response("rate limited", { status: 429 });
    }) as typeof fetch,
  });
  assert(!prepared.context.prompt_has_context);
  assertEquals(prepared.prompt.length, 60_000);
  assert(prepared.context.prompt_truncated);
  assertStringIncludes(prepared.context.context_fetch_error ?? "", "HTTP 429");
});

Deno.test("generated prompt context rejects off-host blob URLs and oversized blobs", async () => {
  const { assertGitHubApiUrl, preparePromptWithContext } = await import(
    "./packages/create-quorum-router/templates/basic/src/context.ts"
  );

  let threw = false;
  try {
    assertGitHubApiUrl("http://169.254.169.254/latest/meta-data/");
  } catch {
    threw = true;
  }
  assert(threw);

  threw = false;
  try {
    assertGitHubApiUrl("https://evil.example/steal");
  } catch {
    threw = true;
  }
  assert(threw);
  assertEquals(
    assertGitHubApiUrl("https://api.github.com/repos/o/r"),
    "https://api.github.com/repos/o/r",
  );

  const requested: string[] = [];
  const small = "ok\n";
  const fetchFn = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    await Promise.resolve();
    if (url.endsWith("/repos/sakamoto-sann/quorum-router")) {
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
      });
    }
    if (url.includes("/git/trees/main?recursive=1")) {
      return new Response(
        JSON.stringify({
          truncated: false,
          tree: [
            {
              path: "evil.ts",
              type: "blob",
              size: 10,
              url: "https://evil.example/blob/evil",
            },
            {
              path: "huge.ts",
              type: "blob",
              size: 10,
              url: "https://api.github.com/blob/huge",
            },
            {
              path: "ok.ts",
              type: "blob",
              size: small.length,
              url: "https://api.github.com/blob/ok",
            },
          ],
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/huge")) {
      return new Response(
        JSON.stringify({
          encoding: "base64",
          content: btoa("H".repeat(50_000)),
        }),
        { status: 200 },
      );
    }
    if (url.endsWith("/blob/ok")) {
      return new Response(
        JSON.stringify({ encoding: "base64", content: btoa(small) }),
        { status: 200 },
      );
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  const prepared = await preparePromptWithContext(
    "https://github.com/sakamoto-sann/quorum-router review",
    { fetchFn },
  );
  assert(prepared.context.prompt_has_context);
  assertEquals(prepared.context.files_included, ["ok.ts"]);
  assertEquals(
    requested.some((url) => url.includes("evil.example")),
    false,
    "off-host blob URL must not be fetched with GitHub auth headers",
  );
  assertStringIncludes(prepared.prompt, JSON.stringify("ok.ts"));
});

type NpmPackResult = { files: Array<{ path: string }> };

function normalizeNpmPackResult(raw: unknown): NpmPackResult {
  const packed = Array.isArray(raw)
    ? raw[0]
    : raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)["create-quorum-router"]
    : undefined;
  assert(
    packed && typeof packed === "object" &&
      Array.isArray((packed as NpmPackResult).files),
    `unexpected npm pack JSON: ${JSON.stringify(raw)}`,
  );
  return packed as NpmPackResult;
}

Deno.test("npm pack JSON normalization accepts npm 10 and npm 11 shapes", () => {
  const packed: NpmPackResult = { files: [{ path: "package.json" }] };
  assertEquals(normalizeNpmPackResult([packed]), packed);
  assertEquals(
    normalizeNpmPackResult({ "create-quorum-router": packed }),
    packed,
  );
  assertThrows(
    () => normalizeNpmPackResult({ unexpected: packed }),
    Error,
    "unexpected npm pack JSON",
  );
});

Deno.test("create-quorum-router npm tarball contents are constrained", async () => {
  const npmProbe = await new Deno.Command("npm", {
    args: ["--version"],
    stdout: "null",
    stderr: "null",
  }).output();
  if (npmProbe.code !== 0) {
    console.warn("skipping create-quorum-router tarball test: npm not found");
    return;
  }

  const pack = await new Deno.Command("npm", {
    args: ["pack", "--dry-run", "--json"],
    cwd: "packages/create-quorum-router",
    env: { NPM_CONFIG_CACHE: await Deno.makeTempDir() },
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(pack.code, 0, new TextDecoder().decode(pack.stderr));
  const raw = JSON.parse(new TextDecoder().decode(pack.stdout)) as unknown;
  const packed = normalizeNpmPackResult(raw);
  const actual = packed.files.map((file) => file.path).sort();
  assertEquals(actual, [
    "LICENSE",
    "README.md",
    "bin/create-quorum-router.js",
    "package.json",
    "templates/basic/README.md",
    "templates/basic/deno.json",
    "templates/basic/gitignore",
    "templates/basic/main.ts",
    "templates/basic/out/.gitkeep",
    "templates/basic/router.config.example.json",
    "templates/basic/src/agent_chat.ts",
    "templates/basic/src/auth.ts",
    "templates/basic/src/auth_env_fallback.ts",
    "templates/basic/src/auth_oauth.ts",
    "templates/basic/src/auth_session.ts",
    "templates/basic/src/best_route.ts",
    "templates/basic/src/cli.ts",
    "templates/basic/src/context.ts",
    "templates/basic/src/env.ts",
    "templates/basic/src/fixture_smoke.ts",
    "templates/basic/src/intake.ts",
    "templates/basic/src/model_inventory.ts",
    "templates/basic/src/provider_client.ts",
    "templates/basic/src/provider_registry.ts",
    "templates/basic/src/redact.ts",
    "templates/basic/src/schema.ts",
    "templates/basic/src/trace.ts",
    "templates/basic/src/wrapper_client.ts",
  ]);
});

Deno.test("create-quorum-router docs state license and runtime boundaries", async () => {
  const packageReadme = await Deno.readTextFile(
    "packages/create-quorum-router/README.md",
  );
  const normalizedPackageReadme = packageReadme.replace(/\s+/g, " ");
  assertStringIncludes(
    normalizedPackageReadme,
    "MIT",
  );
  assertStringIncludes(normalizedPackageReadme, "open source");
  assertStringIncludes(
    normalizedPackageReadme,
    "Commercial and production use are permitted",
  );

  const templateReadme = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/README.md",
  );
  assertStringIncludes(templateReadme, "MIT-licensed open source");
  assertStringIncludes(templateReadme, "No service-role runtime");
  assertStringIncludes(templateReadme, "No live Supabase runtime writes");
  assertStringIncludes(templateReadme, "v0.1.4");
  assertStringIncludes(templateReadme, "deno --version");
  assert(!templateReadme.includes("v0.1.2"));
  assert(!templateReadme.includes("v0.1.3"));
  assertStringIncludes(templateReadme, "fixture-only");
  assertStringIncludes(
    templateReadme,
    "intake is the first real setup command",
  );
  assertStringIncludes(templateReadme, "auth:status");
  assertStringIncludes(templateReadme, "auth:login");
  assertStringIncludes(templateReadme, "auth:logout");
  assertStringIncludes(templateReadme, "models:list");
  assertStringIncludes(templateReadme, "health");
  assertStringIncludes(templateReadme, "route:once");
  assertStringIncludes(templateReadme, "GitHub repository URL");
  assertStringIncludes(templateReadme, "best-route");
  assertStringIncludes(templateReadme, "agent-chat");
  assertStringIncludes(templateReadme, "OAuth/session/wrapper-first");
  assertStringIncludes(templateReadme, "private/manual only");
  assertStringIncludes(templateReadme, "fails closed");
  assertStringIncludes(templateReadme, "QUORUM_ROUTER_AUTH_MODE=env");
  assert(!templateReadme.includes("external:check"));
  assert(!templateReadme.includes("external:once"));
  assert(!templateReadme.includes("external:matrix"));
});

Deno.test("create-quorum-router CLI is static safe and functional", async () => {
  const cli =
    `${Deno.cwd()}/packages/create-quorum-router/bin/create-quorum-router.js`;
  const cliText = await Deno.readTextFile(cli);
  assert(cliText.startsWith("#!/usr/bin/env node"));
  assertStringIncludes(cliText, "--help");
  assert(!cliText.includes("postinstall"));
  assert(!cliText.includes("process.env"));
  assert(!cliText.includes("fetch("));
  assert(!cliText.includes("https://"));
  assert(!cliText.includes("http://"));
  assertStringIncludes(cliText, "Deno was not found on PATH");
  assertStringIncludes(cliText, "deno.com/install");

  const nodeProbe = await new Deno.Command("node", {
    args: ["--version"],
    stdout: "null",
    stderr: "null",
  }).output();
  if (nodeProbe.code !== 0) {
    console.warn(
      "skipping create-quorum-router functional test: node not found",
    );
    return;
  }

  const help = await new Deno.Command("node", {
    args: [cli, "--help"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(help.code, 0);
  assertStringIncludes(new TextDecoder().decode(help.stdout), "Usage:");

  const version = await new Deno.Command("node", {
    args: [cli, "--version"],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assertEquals(version.code, 0);
  assertEquals(new TextDecoder().decode(version.stdout).trim(), "0.1.4");

  const tempDir = await Deno.makeTempDir();
  try {
    const create = await new Deno.Command("node", {
      args: [cli, "demo", "--template", "basic"],
      cwd: tempDir,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(create.code, 0);
    for (
      const file of [
        ".gitignore",
        "README.md",
        "deno.json",
        "main.ts",
        "router.config.example.json",
        "src/cli.ts",
        "src/context.ts",
        "src/intake.ts",
        "src/auth.ts",
        "src/auth_oauth.ts",
        "src/auth_session.ts",
        "src/auth_env_fallback.ts",
        "src/provider_registry.ts",
        "src/model_inventory.ts",
        "src/wrapper_client.ts",
        "src/provider_client.ts",
        "src/best_route.ts",
        "src/agent_chat.ts",
        "src/trace.ts",
        "src/redact.ts",
        "src/schema.ts",
        "src/fixture_smoke.ts",
        "out/.gitkeep",
      ]
    ) {
      assert((await Deno.stat(`${tempDir}/demo/${file}`)).isFile);
    }
    const generatedGitignore = await Deno.readTextFile(
      `${tempDir}/demo/.gitignore`,
    );
    for (
      const ignored of [
        ".env",
        ".quorum-router/",
        "router.config.local.json",
        "provider_config.json",
        "out/",
      ]
    ) {
      assertStringIncludes(generatedGitignore, ignored);
    }
    await assertRejects(() => Deno.stat(`${tempDir}/demo/.env`));
    await assertRejects(() => Deno.stat(`${tempDir}/demo/.quorum-router`));

    const generatedDenoJson = JSON.parse(
      await Deno.readTextFile(`${tempDir}/demo/deno.json`),
    ) as Record<string, unknown>;
    const generatedImports = generatedDenoJson.imports as Record<
      string,
      unknown
    >;
    assertEquals(
      generatedImports.zod,
      "https://deno.land/x/zod@v3.23.8/mod.ts",
    );

    const check = await new Deno.Command("deno", {
      args: ["task", "check"],
      cwd: `${tempDir}/demo`,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(check.code, 0, new TextDecoder().decode(check.stderr));

    const noProviderPath = Deno.execPath().replace(/[/\\][^/\\]+$/, "");
    const cleanEnv: Record<string, string> = { PATH: noProviderPath };
    for (const key of ["HOME", "DENO_DIR", "TMPDIR"]) {
      const value = Deno.env.get(key);
      if (value) cleanEnv[key] = value;
    }

    const smoke = await new Deno.Command("deno", {
      args: ["task", "smoke"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const smokeOutput = new TextDecoder().decode(smoke.stdout) +
      new TextDecoder().decode(smoke.stderr);
    assertEquals(smoke.code, 0, smokeOutput);
    assertStringIncludes(smokeOutput, "fixtureOnly");

    const intake = await new Deno.Command("deno", {
      args: ["task", "intake"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const intakeOutput = new TextDecoder().decode(intake.stdout) +
      new TextDecoder().decode(intake.stderr);
    assertEquals(intake.code, 0, intakeOutput);
    assertStringIncludes(intakeOutput, "QuorumRouter intake");
    assertStringIncludes(intakeOutput, "Provider request sent: false");
    assertStringIncludes(intakeOutput, "Credential values printed: false");
    assertStringIncludes(intakeOutput, "deno task auth:login");

    const authStatus = await new Deno.Command("deno", {
      args: ["task", "auth:status"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const authStatusOutput = new TextDecoder().decode(authStatus.stdout) +
      new TextDecoder().decode(authStatus.stderr);
    assertEquals(authStatus.code, 0, authStatusOutput);
    assertStringIncludes(authStatusOutput, "Credential values printed: false");
    assertStringIncludes(authStatusOutput, "Next action: deno task auth:login");

    const authLogin = await new Deno.Command("deno", {
      args: ["task", "auth:login"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const authLoginOutput = new TextDecoder().decode(authLogin.stdout) +
      new TextDecoder().decode(authLogin.stderr);
    assert(authLogin.code !== 0);
    assertStringIncludes(
      authLoginOutput,
      "OAuth/session login is not configured",
    );
    assert(!authLoginOutput.includes("credential-fixture-value"));

    const modelsList = await new Deno.Command("deno", {
      args: ["task", "models:list"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const modelsListOutput = new TextDecoder().decode(modelsList.stdout) +
      new TextDecoder().decode(modelsList.stderr);
    assertEquals(modelsList.code, 0, modelsListOutput);
    assertStringIncludes(modelsListOutput, "Generation endpoint called: false");
    assert(!modelsListOutput.includes("credential-fixture-value"));

    const health = await new Deno.Command("deno", {
      args: ["task", "health"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const healthOutput = new TextDecoder().decode(health.stdout) +
      new TextDecoder().decode(health.stderr);
    assertEquals(health.code, 0, healthOutput);
    assertStringIncludes(healthOutput, "Provider request sent: false");

    const routeWithoutOptIn = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "hello"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: cleanEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const routeWithoutOptInOutput =
      new TextDecoder().decode(routeWithoutOptIn.stdout) +
      new TextDecoder().decode(routeWithoutOptIn.stderr);
    assert(routeWithoutOptIn.code !== 0);
    assertStringIncludes(
      routeWithoutOptInOutput,
      "RUN_EXTERNAL_MODEL_DOGFOOD=1",
    );

    const routeNoSession = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "hello"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...cleanEnv,
        RUN_EXTERNAL_MODEL_DOGFOOD: "1",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const routeNoSessionOutput =
      new TextDecoder().decode(routeNoSession.stdout) +
      new TextDecoder().decode(routeNoSession.stderr);
    assert(routeNoSession.code !== 0);
    assertStringIncludes(
      routeNoSessionOutput,
      "OAuth/session-first provider unavailable",
    );
    assert(!routeNoSessionOutput.includes("credential-fixture-value"));

    const bestRouteNoProvider = await new Deno.Command("deno", {
      args: ["task", "best-route", "--prompt", "hello"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...cleanEnv,
        RUN_EXTERNAL_MODEL_DOGFOOD: "1",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const bestRouteNoProviderOutput =
      new TextDecoder().decode(bestRouteNoProvider.stdout) +
      new TextDecoder().decode(bestRouteNoProvider.stderr);
    assert(bestRouteNoProvider.code !== 0);
    assertStringIncludes(
      bestRouteNoProviderOutput,
      "OAuth/session-first provider unavailable",
    );

    const agentChatWithoutExperimental = await new Deno.Command("deno", {
      args: ["task", "agent-chat", "--prompt", "hello"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: { ...cleanEnv, RUN_EXTERNAL_MODEL_DOGFOOD: "1" },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const agentChatOutput =
      new TextDecoder().decode(agentChatWithoutExperimental.stdout) +
      new TextDecoder().decode(agentChatWithoutExperimental.stderr);
    assert(agentChatWithoutExperimental.code !== 0);
    assertStringIncludes(agentChatOutput, "RUN_EXPERIMENTAL_AGENT_CHAT=1");

    const exampleConfig = await Deno.readTextFile(
      `${tempDir}/demo/router.config.example.json`,
    );
    assert(!/api[_-]?key|secret|token/i.test(exampleConfig));

    await Deno.mkdir(`${tempDir}/non-empty`);
    await Deno.writeTextFile(`${tempDir}/non-empty/file.txt`, "keep");
    const refused = await new Deno.Command("node", {
      args: [cli, "non-empty"],
      cwd: tempDir,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(refused.code !== 0);
    assertStringIncludes(
      new TextDecoder().decode(refused.stderr),
      "refusing to overwrite non-empty directory",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("generated demo documents fixture-only smoke and external dogfood gate", async () => {
  const readme = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/README.md",
  );
  const main = await Deno.readTextFile(
    "packages/create-quorum-router/templates/basic/main.ts",
  );
  const normalizedReadme = readme.replace(/\s+/g, " ");
  assertStringIncludes(
    normalizedReadme,
    "deno task intake` is the first real setup command",
  );
  assert(!normalizedReadme.includes("v0.1.2"));
  assert(!main.includes("v0.1.2"));
  assertStringIncludes(normalizedReadme, "fixture-only");
  assertStringIncludes(
    normalizedReadme,
    "does **not** call a real provider API",
  );
  assertStringIncludes(normalizedReadme, "deno task intake");
  assertStringIncludes(normalizedReadme, "models:list");
  assertStringIncludes(normalizedReadme, "health");
  assertStringIncludes(normalizedReadme, "RUN_EXTERNAL_MODEL_DOGFOOD=1");
  assertStringIncludes(normalizedReadme, "auth:status");
  assertStringIncludes(normalizedReadme, "auth:login");
  assertStringIncludes(normalizedReadme, "route:once");
  assertStringIncludes(normalizedReadme, "best-route");
  assertStringIncludes(normalizedReadme, "agent-chat");
  assertStringIncludes(normalizedReadme, "OAuth/session/wrapper-first");
  assertStringIncludes(normalizedReadme, "QUORUM_ROUTER_AUTH_MODE=env");
});

Deno.test("generated scaffold redaction guard rejects redaction-pattern leaks", async () => {
  const redactModule = await import(
    `./packages/create-quorum-router/templates/basic/src/redact.ts?${Date.now()}`
  ) as { redactionOk(value: unknown): boolean; redact(text: string): string };
  const fixtureAuthHeader = ["Authorization", "Bearer", "redaction-fixture"]
    .join(" ");
  assertEquals(
    redactModule.redactionOk({ errors: [fixtureAuthHeader] }),
    false,
  );
  assertStringIncludes(
    redactModule.redact(fixtureAuthHeader),
    "[REDACTED]",
  );
});

Deno.test("generated route:once honors forced Grok provider/model and rejects noisy wrapper output", async () => {
  const cli =
    `${Deno.cwd()}/packages/create-quorum-router/bin/create-quorum-router.js`;
  const tempDir = await Deno.makeTempDir();
  try {
    const create = await new Deno.Command("node", {
      args: [cli, "demo", "--template", "basic"],
      cwd: tempDir,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(create.code, 0, new TextDecoder().decode(create.stderr));

    const fakeBin = `${tempDir}/bin`;
    await Deno.mkdir(fakeBin, { recursive: true });
    const fakeGrok = `${fakeBin}/grok`;
    await Deno.writeTextFile(
      fakeGrok,
      [
        "#!/bin/sh",
        'if [ "$1" = "models" ]; then',
        "  printf '* grok-composer-2.5-fast (default)\\n'",
        "  printf -- '- grok-build\\n'",
        "  exit 0",
        "fi",
        'for arg do printf \'%s\\n\' "$arg" >> "$HOME/grok-args.txt"; done',
        "if read stdin_line; then",
        "  printf 'unexpected stdin: %s\\n' \"$stdin_line\" >&2",
        "  exit 12",
        "fi",
        'case " $* " in',
        '  *"stdout auth failure"*)',
        "    printf 'not logged in\\n'",
        "    ;;",
        '  *"valid stdout auth phrase"*)',
        "    printf 'Not logged in users are redirected to the login page.\\n'",
        "    ;;",
        '  *"auto route should prefer list verified grok"*)',
        "    printf 'Grok default fixture answer with enough content for auto route.\\n'",
        "    ;;",
        '  *"auto route should fall back after grok failure"*)',
        "    printf 'fixture quota exhausted\\n' >&2",
        "    exit 14",
        "    ;;",
        '  *"--model grok-build"*)',
        "    printf 'Grok build fixture answer with enough content for schema validation.\\n'",
        "    ;;",
        '  *"--model grok-composer-2.5-fast"*)',
        "    printf 'Grok composer fixture answer with enough content for schema validation.\\n'",
        "    ;;",
        "  *)",
        "    printf 'missing forced grok model in argv: %s\\n' \"$*\" >&2",
        "    exit 13",
        "    ;;",
        "esac",
      ].join("\n") + "\n",
      { mode: 0o700 },
    );
    await Deno.chmod(fakeGrok, 0o700);

    const fakeCodex = `${fakeBin}/codex`;
    await Deno.writeTextFile(
      fakeCodex,
      [
        "#!/bin/sh",
        "printf 'codex was invoked\\n' >> \"$HOME/codex-called.txt\"",
        'case " $* " in',
        '  *"live multi model dialogue"*)',
        "    printf 'Codex read the prior Grok turn and challenges its missing verification step.\\n'",
        "    exit 0",
        "    ;;",
        '  *"auto route should fall back after grok failure"*)',
        "    printf 'Codex fallback fixture answer.\\n'",
        "    exit 0",
        "    ;;",
        "esac",
        "printf 'Reading additional input from stdin...\\n'",
        "printf 'OpenAI Codex v0.136.0\\n'",
        "printf 'ERROR rmcp::transport::worker AuthRequiredError\\n' >&2",
        "exit 0",
      ].join("\n") + "\n",
      { mode: 0o700 },
    );
    await Deno.chmod(fakeCodex, 0o700);

    const baseEnv = {
      PATH: `${fakeBin}:${Deno.env.get("PATH") ?? ""}`,
      HOME: tempDir,
      TMPDIR: tempDir,
      RUN_EXTERNAL_MODEL_DOGFOOD: "1",
      QUORUM_ROUTER_AUTH_MODE: "wrapper",
    };

    await Deno.remove(`${tempDir}/grok-args.txt`).catch(() => {});
    const autoRoute = await new Deno.Command("deno", {
      args: [
        "task",
        "route:once",
        "--prompt",
        "auto route should prefer list verified grok",
      ],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: baseEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const autoRouteOutput = new TextDecoder().decode(autoRoute.stdout) +
      new TextDecoder().decode(autoRoute.stderr);
    assertEquals(autoRoute.code, 0, autoRouteOutput);
    assertStringIncludes(autoRouteOutput, "provider: xAI");
    assert(!autoRouteOutput.includes("provider: OpenAI"));
    await assertRejects(() => Deno.stat(`${tempDir}/codex-called.txt`));

    const fallbackRoute = await new Deno.Command("deno", {
      args: [
        "task",
        "route:once",
        "--prompt",
        "auto route should fall back after grok failure",
      ],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: baseEnv,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const fallbackRouteOutput = new TextDecoder().decode(fallbackRoute.stdout) +
      new TextDecoder().decode(fallbackRoute.stderr);
    assertEquals(fallbackRoute.code, 0, fallbackRouteOutput);
    assertStringIncludes(fallbackRouteOutput, "provider: OpenAI");
    assertStringIncludes(fallbackRouteOutput, "Codex fallback fixture answer.");
    await Deno.stat(`${tempDir}/codex-called.txt`);
    const fallbackTrace = JSON.parse(
      await Deno.readTextFile(`${tempDir}/demo/out/route-once-trace.json`),
    ) as Record<string, unknown>;
    assertEquals(fallbackTrace.selected_provider, "OpenAI");
    assertEquals(fallbackTrace.fallback_used, true);
    assertEquals(fallbackTrace.provider_selection_honored, true);
    const fallbackErrors = fallbackTrace.errors as string[];
    assertEquals(fallbackErrors.length, 1);
    assertStringIncludes(
      fallbackErrors[0],
      "xAI/grok-composer-2.5-fast exited 14",
    );
    await Deno.remove(`${tempDir}/codex-called.txt`);

    for (
      const [requestedModel, expectedModel] of [
        ["grok-build", "grok-build"],
        ["xai/grok-build", "grok-build"],
        ["grok-composer-2.5-fast", "grok-composer-2.5-fast"],
      ]
    ) {
      await Deno.remove(`${tempDir}/grok-args.txt`).catch(() => {});
      const once = await new Deno.Command("deno", {
        args: ["task", "route:once", "--prompt", "forced grok"],
        cwd: `${tempDir}/demo`,
        clearEnv: true,
        env: {
          ...baseEnv,
          QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
          QUORUM_ROUTER_PROVIDER_MODEL: requestedModel,
        },
        stdout: "piped",
        stderr: "piped",
      }).output();
      const combined = new TextDecoder().decode(once.stdout) +
        new TextDecoder().decode(once.stderr);
      assertEquals(once.code, 0, combined);
      assertStringIncludes(combined, "provider: xAI");
      assertStringIncludes(combined, `model: ${expectedModel}`);
      assertStringIncludes(combined, "response_received: true");
      assertStringIncludes(combined, "schema_valid: true");
      assertStringIncludes(combined, "redaction_ok: true");
      assertStringIncludes(combined, "credential_value_present: false");
      assertStringIncludes(combined, "sensitive_value_present: false");
      assert(!combined.includes("provider: OpenAI"));
      assert(!combined.includes("codex-cli"));

      const trace = JSON.parse(
        await Deno.readTextFile(`${tempDir}/demo/out/route-once-trace.json`),
      ) as Record<string, unknown>;
      assertEquals(trace.requested_provider_label, "grok-cli");
      assertEquals(trace.requested_model, requestedModel);
      assertEquals(trace.selected_provider, "xAI");
      assertEquals(trace.selected_model, expectedModel);
      assertEquals(trace.provider_selection_honored, true);
      assertEquals(trace.fallback_used, false);
      assertEquals(trace.redaction_ok, true);

      const grokArgLines = (await Deno.readTextFile(`${tempDir}/grok-args.txt`))
        .trim()
        .split("\n");
      assert(grokArgLines.includes("--model"));
      assert(grokArgLines.includes(expectedModel));
      if (expectedModel === "grok-build") {
        assert(grokArgLines.includes("--deny"));
        assert(grokArgLines.includes("*"));
        assert(grokArgLines.includes("--no-subagents"));
      } else {
        assert(!grokArgLines.includes("--deny"));
        assert(!grokArgLines.includes("--no-subagents"));
      }
    }

    const forcedAgentChat = await new Deno.Command("deno", {
      args: ["task", "agent-chat", "--prompt", "forced agent chat"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        RUN_EXPERIMENTAL_AGENT_CHAT: "1",
        QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
        QUORUM_ROUTER_PROVIDER_MODEL: "grok-composer-2.5-fast",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const forcedAgentChatOutput =
      new TextDecoder().decode(forcedAgentChat.stdout) +
      new TextDecoder().decode(forcedAgentChat.stderr);
    assert(forcedAgentChat.code !== 0, forcedAgentChatOutput);
    assertStringIncludes(
      forcedAgentChatOutput,
      "requires at least two distinct invokable provider/model identities",
    );
    await assertRejects(() =>
      Deno.stat(`${tempDir}/demo/out/agent-chat-trace.json`)
    );

    await assertRejects(() => Deno.stat(`${tempDir}/codex-called.txt`));

    const liveAgentChat = await new Deno.Command("deno", {
      args: ["task", "agent-chat", "--prompt", "live multi model dialogue"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        RUN_EXPERIMENTAL_AGENT_CHAT: "1",
        QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS: "2",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const liveAgentChatOutput = new TextDecoder().decode(liveAgentChat.stdout) +
      new TextDecoder().decode(liveAgentChat.stderr);
    assertEquals(liveAgentChat.code, 0, liveAgentChatOutput);
    assertStringIncludes(
      liveAgentChatOutput,
      "agents: xAI/grok-composer-2.5-fast ↔ OpenAI/codex-cli",
    );
    assertStringIncludes(liveAgentChatOutput, "Round 1");
    assertStringIncludes(liveAgentChatOutput, "Round 2");
    assertStringIncludes(
      liveAgentChatOutput,
      "replying to xAI/grok-composer-2.5-fast (round 1)",
    );
    const liveAgentChatTrace = JSON.parse(
      await Deno.readTextFile(`${tempDir}/demo/out/agent-chat-trace.json`),
    ) as {
      agent_chat_turns?: Array<Record<string, unknown>>;
      redaction_ok?: boolean;
    };
    assertEquals(liveAgentChatTrace.agent_chat_turns?.length, 2);
    assertEquals(liveAgentChatTrace.redaction_ok, true);
    assertEquals(liveAgentChatTrace.agent_chat_turns?.[1].reply_to, {
      provider: "xAI",
      model: "grok-composer-2.5-fast",
      round: 1,
    });
    await Deno.remove(`${tempDir}/codex-called.txt`);

    const stdoutAuthFailure = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "stdout auth failure"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
        QUORUM_ROUTER_PROVIDER_MODEL: "grok-build",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const stdoutAuthFailureOutput =
      new TextDecoder().decode(stdoutAuthFailure.stdout) +
      new TextDecoder().decode(stdoutAuthFailure.stderr);
    assert(stdoutAuthFailure.code !== 0);
    assertStringIncludes(
      stdoutAuthFailureOutput,
      "emitted CLI runtime/auth error noise",
    );

    const validStdoutAuthPhrase = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "valid stdout auth phrase"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
        QUORUM_ROUTER_PROVIDER_MODEL: "grok-build",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const validStdoutAuthPhraseOutput =
      new TextDecoder().decode(validStdoutAuthPhrase.stdout) +
      new TextDecoder().decode(validStdoutAuthPhrase.stderr);
    assertEquals(validStdoutAuthPhrase.code, 0, validStdoutAuthPhraseOutput);
    assertStringIncludes(
      validStdoutAuthPhraseOutput,
      "Not logged in users are redirected to the login page.",
    );

    const unknownProvider = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "unknown provider"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        QUORUM_ROUTER_PROVIDER_LABEL: "oauth_session",
        QUORUM_ROUTER_PROVIDER_MODEL: "grok-build",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const unknownProviderOutput =
      new TextDecoder().decode(unknownProvider.stdout) +
      new TextDecoder().decode(unknownProvider.stderr);
    assert(unknownProvider.code !== 0);
    assertStringIncludes(
      unknownProviderOutput,
      "requested provider/model unavailable",
    );
    assertStringIncludes(
      unknownProviderOutput,
      "Available candidates and blockers",
    );
    assert(!unknownProviderOutput.includes("provider: OpenAI"));

    const unknownModel = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "unknown model"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        QUORUM_ROUTER_PROVIDER_LABEL: "grok-cli",
        QUORUM_ROUTER_PROVIDER_MODEL: "not-a-real-grok-model",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const unknownModelOutput = new TextDecoder().decode(unknownModel.stdout) +
      new TextDecoder().decode(unknownModel.stderr);
    assert(unknownModel.code !== 0);
    assertStringIncludes(
      unknownModelOutput,
      "requested provider/model unavailable",
    );
    assert(!unknownModelOutput.includes("provider: OpenAI"));

    const wrapperWithEnvFallbackConfigured = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "env fallback should not run"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        QUORUM_ROUTER_PROVIDER_LABEL: "env-only-fixture",
        QUORUM_ROUTER_PROVIDER_MODEL: "env-only-model",
        QUORUM_ROUTER_PROVIDER_BASE_URL: "http://127.0.0.1:9/v1",
        ["QUORUM_ROUTER_PROVIDER_" + "API_KEY"]: "credential-fixture-value",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const wrapperFallbackOutput =
      new TextDecoder().decode(wrapperWithEnvFallbackConfigured.stdout) +
      new TextDecoder().decode(wrapperWithEnvFallbackConfigured.stderr);
    assert(wrapperWithEnvFallbackConfigured.code !== 0);
    assertStringIncludes(
      wrapperFallbackOutput,
      "requested provider/model unavailable",
    );
    assert(!wrapperFallbackOutput.includes("credential-fixture-value"));

    const noisyCodex = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "codex noise"],
      cwd: `${tempDir}/demo`,
      clearEnv: true,
      env: {
        ...baseEnv,
        QUORUM_ROUTER_PROVIDER_LABEL: "codex-cli",
        QUORUM_ROUTER_PROVIDER_MODEL: "codex-cli",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const noisyCodexOutput = new TextDecoder().decode(noisyCodex.stdout) +
      new TextDecoder().decode(noisyCodex.stderr);
    assert(noisyCodex.code !== 0);
    assertStringIncludes(noisyCodexOutput, "CLI runtime/auth error noise");
    assert(!noisyCodexOutput.includes("schema_valid: true"));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("generated scaffold writes redacted trace with explicit env fallback mock provider", async () => {
  const cli =
    `${Deno.cwd()}/packages/create-quorum-router/bin/create-quorum-router.js`;
  const tempDir = await Deno.makeTempDir();
  const abort = new AbortController();
  const server = Deno.serve({
    hostname: "127.0.0.1",
    port: 0,
    signal: abort.signal,
    onListen: () => {},
  }, async (request) => {
    const body = await request.json() as {
      messages?: Array<{ content?: string }>;
    };
    const content = body.messages?.[0]?.content ?? "missing prompt";
    return Response.json({
      model: "mock-external-model",
      choices: [{
        message: { content: `mock external response for: ${content}` },
      }],
    });
  });

  try {
    const create = await new Deno.Command("node", {
      args: [cli, "demo", "--template", "basic"],
      cwd: tempDir,
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(create.code, 0, new TextDecoder().decode(create.stderr));

    const port = (server.addr as Deno.NetAddr).port;
    const fixtureCredential = "credential-fixture-value";
    const genericProviderCredentialEnv = [
      "QUORUM",
      "ROUTER",
      "PROVIDER",
      "API",
      "KEY",
    ].join("_");
    const once = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "hello"],
      cwd: `${tempDir}/demo`,
      env: {
        RUN_EXTERNAL_MODEL_DOGFOOD: "1",
        QUORUM_ROUTER_AUTH_MODE: "env",
        QUORUM_ROUTER_PROVIDER_BASE_URL: `http://127.0.0.1:${port}/v1`,
        [genericProviderCredentialEnv]: fixtureCredential,
        QUORUM_ROUTER_PROVIDER_MODEL: "mock-external-model",
        QUORUM_ROUTER_PROVIDER_LABEL: "Mock OpenAI-compatible",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const combined = new TextDecoder().decode(once.stdout) +
      new TextDecoder().decode(once.stderr);
    assertEquals(once.code, 0, combined);
    assertStringIncludes(combined, "response_received: true");
    assert(!combined.includes(fixtureCredential));

    const trace = await Deno.readTextFile(
      `${tempDir}/demo/out/route-once-trace.json`,
    );
    assert(!trace.includes(fixtureCredential));
    const parsed = JSON.parse(trace) as Record<string, unknown>;
    assertEquals(parsed.schema_valid, true);
    assertEquals(parsed.redaction_ok, true);
    assertEquals(parsed.credential_value_present, false);
    assertEquals(parsed.sensitive_value_present, false);

    const bestRoute = await new Deno.Command("deno", {
      args: ["task", "best-route", "--prompt", "matrix prompt"],
      cwd: `${tempDir}/demo`,
      env: {
        RUN_EXTERNAL_MODEL_DOGFOOD: "1",
        QUORUM_ROUTER_AUTH_MODE: "env",
        QUORUM_ROUTER_PROVIDER_BASE_URL: `http://127.0.0.1:${port}/v1`,
        [genericProviderCredentialEnv]: fixtureCredential,
        QUORUM_ROUTER_PROVIDER_MODEL: "mock-external-model",
        QUORUM_ROUTER_PROVIDER_LABEL: "Mock OpenAI-compatible",
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const bestRouteCombined = new TextDecoder().decode(bestRoute.stdout) +
      new TextDecoder().decode(bestRoute.stderr);
    assertEquals(bestRoute.code, 0, bestRouteCombined);
    assertStringIncludes(bestRouteCombined, "models_called: 1");
    assert(!bestRouteCombined.includes(fixtureCredential));

    const bestRouteTrace = await Deno.readTextFile(
      `${tempDir}/demo/out/best-route-trace.json`,
    );
    assert(!bestRouteTrace.includes(fixtureCredential));
    const parsedBestRoute = JSON.parse(bestRouteTrace) as Record<
      string,
      unknown
    >;
    assertEquals(parsedBestRoute.schema_valid, true);
    assertEquals(parsedBestRoute.redaction_ok, true);

    const fakeBin = `${tempDir}/bin`;
    await Deno.mkdir(fakeBin, { recursive: true });
    const fakeGrok = `${fakeBin}/grok`;
    await Deno.writeTextFile(
      fakeGrok,
      [
        "#!/bin/sh",
        'if [ "$1" = "models" ]; then',
        "  printf '* fake-grok\\n'",
        "  exit 0",
        "fi",
        `printf 'wrapper credential visibility: %s\\n' \"\${${genericProviderCredentialEnv}:-missing}\"`,
      ].join("\n") + "\n",
      { mode: 0o700 },
    );
    await Deno.chmod(fakeGrok, 0o700);
    const wrapperCredential = "wrapper-credential-fixture";
    const wrapperOnce = await new Deno.Command("deno", {
      args: ["task", "route:once", "--prompt", "wrapper hello"],
      cwd: `${tempDir}/demo`,
      env: {
        PATH: `${fakeBin}:${Deno.env.get("PATH") ?? ""}`,
        HOME: tempDir,
        RUN_EXTERNAL_MODEL_DOGFOOD: "1",
        QUORUM_ROUTER_AUTH_MODE: "session",
        QUORUM_ROUTER_WRAPPER_PROVIDER_LABEL: "xAI",
        [genericProviderCredentialEnv]: wrapperCredential,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const wrapperCombined = new TextDecoder().decode(wrapperOnce.stdout) +
      new TextDecoder().decode(wrapperOnce.stderr);
    assertEquals(wrapperOnce.code, 0, wrapperCombined);
    assert(!wrapperCombined.includes(wrapperCredential));
    const wrapperTrace = await Deno.readTextFile(
      `${tempDir}/demo/out/route-once-trace.json`,
    );
    assert(!wrapperTrace.includes(wrapperCredential));
    assertStringIncludes(
      wrapperTrace,
      "wrapper credential visibility: missing",
    );
  } finally {
    abort.abort();
    await server.finished.catch(() => {});
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("install helper is dry-run safe and avoids credential/runtime setup", async () => {
  const script = await Deno.readTextFile("install.sh");
  assertStringIncludes(script, "--dry-run");
  assertStringIncludes(script, "--prefix");
  assertStringIncludes(script, "--ref");
  assert(!script.includes("sudo"));
  assert(!/service-role/i.test(script));
  assert(!/process adapter/i.test(script));
  assert(!/API[_-]?KEY|TOKEN|SECRET/.test(script));

  const tempDir = await Deno.makeTempDir();
  try {
    const dryRun = await new Deno.Command("sh", {
      args: ["install.sh", "--dry-run", "--prefix", tempDir, "--ref", "v0.1.2"],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assertEquals(dryRun.code, 0, new TextDecoder().decode(dryRun.stderr));
    assertStringIncludes(new TextDecoder().decode(dryRun.stdout), "dry-run");
    await assertRejects(() => Deno.stat(`${tempDir}/share/quorum-router`));
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("install and Product Hunt docs preserve license and security boundaries", async () => {
  const installDocs = await Deno.readTextFile("docs/install.md");
  const productHunt = await Deno.readTextFile("docs/product-hunt.md");
  for (const doc of [installDocs, productHunt]) {
    const normalized = doc.replace(/\s+/g, " ");
    assertStringIncludes(normalized, "MIT");
    assertStringIncludes(normalized, "open source");
    assertStringIncludes(normalized, "No service-role runtime");
    assertStringIncludes(normalized, "No live Supabase");
    assert(!/is open source/i.test(normalized));
  }
  assertStringIncludes(
    installDocs,
    "Production autonomous repository execution",
  );
  assertStringIncludes(
    productHunt,
    "real integration smoke now passes",
  );
  assertStringIncludes(productHunt, "sole policy, approval, execution");
  assertStringIncludes(installDocs, "npx --yes create-quorum-router@latest");
  assertStringIncludes(installDocs, "--dry-run");
  assertStringIncludes(installDocs, "Uninstall");
  assertStringIncludes(productHunt, "Maker comment draft");
  assertStringIncludes(
    productHunt.replace(/\s+/g, " "),
    "direct` = production-ready best-answer",
  );
});

Deno.test("README and v0.1.2 docs expose working install paths without hardcoded target SHA", async () => {
  const readme = await Deno.readTextFile("README.md");
  const normalizedMainReadme = readme.replace(/\s+/g, " ");
  assertStringIncludes(
    readme,
    "npx --yes github:sakamoto-sann/quorum-router#main",
  );
  assertStringIncludes(readme, "install.sh | sh -s -- --dry-run");
  assertStringIncludes(readme, "MIT");
  assertStringIncludes(normalizedMainReadme, "MIT-licensed open source");

  const release = await Deno.readTextFile("docs/release-v0.1.2.md");
  const checklist = await Deno.readTextFile("docs/release-checklist-v0.1.2.md");
  assertStringIncludes(
    release,
    "includes npm create package scaffold and install helper scripts",
  );
  assertStringIncludes(
    checklist,
    "Published `v0.1.2` tag points at that exact commit",
  );
  assertNoExactTargetSha([readme, release, checklist].join("\n"));
});
