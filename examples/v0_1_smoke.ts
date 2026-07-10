import {
  createCapabilityDirectRoutingPolicy,
  createInMemoryAgentChatAuditSink,
  DEFAULT_AGENT_RUNTIME_BUS_IDS,
  generateQuorumRouterConfig,
  InMemoryAgentBusStore,
  loadQuorumRouterConfigValue,
  ProviderCapabilityRegistry,
  providerDescriptorKey,
  QuorumRouter,
  RouterError,
  runAgentChatSimulator,
} from "../router.ts";
import type {
  AgentRuntimeConfig,
  AgentRuntimeRole,
  CommanderConfig,
  ModelAdapter,
  ModelOutput,
  ProviderDescriptor,
} from "../router.ts";
import { runDoctorChecks } from "../src/doctor/checks.ts";
import {
  FIXTURE_DIRECT_DESCRIPTOR,
  FIXTURE_DIRECT_REJECTED_DESCRIPTOR,
  FIXTURE_SYNTHESIS_DESCRIPTOR,
  fixtureCapability,
  FixtureModelAdapter,
  FixtureSynthesisAdapter,
} from "./v0_1_fixtures.ts";
import { assert, assertEquals, assertRejects } from "@std/assert";

const runtimeCommander: CommanderConfig = {
  enabled: true,
  mode: "agent_chat_future",
  selectionStrategy: "explicit",
  provider: "Fixture",
  model: "commander",
  authMode: "session",
  transport: "processAdapter",
  client: "AgentRuntimeFixture",
  local: false,
};

function runtimeDescriptor(role: AgentRuntimeRole): ProviderDescriptor {
  return {
    provider: "Fixture",
    model: `runtime-${role}`,
    authMode: "session",
    transport: "processAdapter",
    client: `AgentRuntime/${role}`,
  };
}

class RuntimeJsonAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  calls = 0;

  constructor(
    readonly role: AgentRuntimeRole,
    private readonly output: Record<string, unknown>,
  ) {
    this.descriptor = runtimeDescriptor(role);
  }

  invoke(_prompt: string, _signal: AbortSignal): Promise<ModelOutput> {
    this.calls += 1;
    return Promise.resolve({
      provider: this.descriptor.provider,
      model: this.descriptor.model,
      latencyMs: 1,
      content: JSON.stringify(this.output),
    });
  }
}

function makeRuntimeBus(ids = {
  ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
  runId: "agent-runtime-smoke-run",
}): InMemoryAgentBusStore {
  return new InMemoryAgentBusStore({
    teams: [{
      id: ids.teamId,
      ownerUserId: "fixture-user",
      name: "agent-runtime-fixture",
      createdAt: "2026-01-01T00:00:00.000Z",
    }],
    identities: Object.entries(ids.roleAgentIds).map(([role, id]) => ({
      id,
      teamId: ids.teamId,
      agentName: role,
      agentRole: role,
      runtimeType: "in-process-fixture",
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

function makeRuntimeConfig(): AgentRuntimeConfig {
  const outputs: Record<AgentRuntimeRole, Record<string, unknown>> = {
    commander: {
      status: "plan",
      content: "Plan the deterministic runtime smoke.",
      objection: null,
      finalAnswer: null,
      budgetUsd: 0,
    },
    coder: {
      status: "result",
      content: "Runtime smoke result produced.",
      objection: null,
      finalAnswer: null,
      budgetUsd: 0,
    },
    reviewer: {
      status: "pass",
      content: "Reviewer passed.",
      objection: null,
      finalAnswer: null,
      budgetUsd: 0,
    },
    red_team: {
      status: "pass",
      content: "Red-team passed.",
      objection: null,
      finalAnswer: null,
      budgetUsd: 0,
    },
    closeout: {
      status: "ready",
      content: "Closeout ready.",
      objection: null,
      finalAnswer: "AgentRuntime smoke completed.",
      budgetUsd: 0,
    },
  };
  const busIds = {
    ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
    runId: "agent-runtime-smoke-run",
  };
  return {
    enabled: true,
    experimental: true,
    bus: makeRuntimeBus(busIds),
    busIds,
    commander: runtimeCommander,
    roles: Object.entries(outputs).map(([role, output]) => ({
      role: role as AgentRuntimeRole,
      required: true,
      adapter: new RuntimeJsonAdapter(role as AgentRuntimeRole, output),
    })),
    limits: { maxTurns: 5, maxDurationMs: 10_000, maxBudgetUsd: 0 },
  };
}

async function smokeBasicDirect() {
  const adapter = new FixtureModelAdapter();
  const synthesis = new FixtureSynthesisAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: synthesis,
    minSuccessfulAdapters: 1,
    routingModeEnvProvider: () => undefined,
  });
  const result = await router.route("v0.1 smoke direct");
  assertEquals(adapter.calls, 1);
  assertEquals(synthesis.calls, 1);
  assertEquals(result.consensusModel, "Fixture/synthesis-static");
  return result;
}

function smokeAdaptiveDirect() {
  const registry = new ProviderCapabilityRegistry([
    fixtureCapability(FIXTURE_DIRECT_DESCRIPTOR),
    fixtureCapability(FIXTURE_DIRECT_REJECTED_DESCRIPTOR),
    fixtureCapability(FIXTURE_SYNTHESIS_DESCRIPTOR),
  ]);
  const policy = createCapabilityDirectRoutingPolicy({
    fallbackPolicy: "safe_provider_unavailable_only",
  });
  const decision = policy.decide({
    candidates: [FIXTURE_DIRECT_DESCRIPTOR, FIXTURE_DIRECT_REJECTED_DESCRIPTOR],
    synthesisCandidates: [FIXTURE_SYNTHESIS_DESCRIPTOR],
    providerRegistry: registry,
    readinessHints: {
      [providerDescriptorKey(FIXTURE_DIRECT_REJECTED_DESCRIPTOR)]: {
        authReady: false,
        reason: "fixture rejected by readiness hint",
      },
    },
  });
  assertEquals(decision.selectedAdapters, [FIXTURE_DIRECT_DESCRIPTOR]);
  assertEquals(decision.rejectedAdapters.length, 1);
  assertEquals(decision.synthesis, FIXTURE_SYNTHESIS_DESCRIPTOR);
  return decision;
}

async function smokeGeneratedConfig() {
  const generated = generateQuorumRouterConfig({ profile: "minimal-direct" });
  const loaded = loadQuorumRouterConfigValue(generated);
  const adapter = new FixtureModelAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: new FixtureSynthesisAdapter(),
    minSuccessfulAdapters: 1,
    routingMode: loaded.routingMode,
    routingModeEnvProvider: () => undefined,
  });
  const result = await router.route("v0.1 generated config");
  assertEquals(loaded.setupProfile, "minimal-direct");
  assertEquals(loaded.routingMode, "direct");
  assertEquals(adapter.calls, 1);
  return { loaded, result };
}

async function smokeAgentChatFailsClosed() {
  const adapter = new FixtureModelAdapter();
  const router = new QuorumRouter({
    modelAdapters: [adapter],
    synthesisAdapter: new FixtureSynthesisAdapter(),
    minSuccessfulAdapters: 1,
    routingMode: "agent_chat",
    routingModeEnvProvider: () => undefined,
  });
  const error = await assertRejects(
    () => router.route("agent_chat must remain explicitly gated"),
    RouterError,
  );
  assertEquals(error.code, "agent_runtime_opt_in_required");
  assertEquals(adapter.calls, 0);
}

async function smokeAgentRuntime() {
  const router = new QuorumRouter({
    modelAdapters: [new FixtureModelAdapter()],
    synthesisAdapter: new FixtureSynthesisAdapter(),
    minSuccessfulAdapters: 1,
    routingModeEnvProvider: () => undefined,
    agentRuntime: makeRuntimeConfig(),
  });
  const runtime = await router.routeAgentRuntime("v0.1 runtime smoke", {
    routingMode: "agent_chat",
    experimentalAgentRuntime: true,
  });
  assertEquals(runtime.ok, true);
  assertEquals(runtime.decision.decision, "ready");
  assertEquals(runtime.runtimeSummary.turns, 5);
  const route = await router.route("v0.1 runtime route smoke", {
    routingMode: "agent_chat",
    experimentalAgentRuntime: true,
  });
  assertEquals(route.synthesis, "AgentRuntime smoke completed.");
  return runtime;
}

function smokeAgentChatSimulator() {
  const audit = createInMemoryAgentChatAuditSink();
  const first = runAgentChatSimulator({
    prompt: "standalone deterministic smoke",
    auditSink: audit.sink,
  });
  const second = runAgentChatSimulator({
    prompt: "standalone deterministic smoke",
  });
  assertEquals(first.decision, second.decision);
  assertEquals(first.transcript.messages, second.transcript.messages);
  assert(audit.events.length > 0);
  return first;
}

async function smokeDoctor() {
  const report = await runDoctorChecks({ checkCliCommands: false });
  assertEquals(report.ok, true);
  assert(report.checks.some((check) => check.name === "cli_commands"));
  return report;
}

const basicDirect = await smokeBasicDirect();
const adaptiveDirect = smokeAdaptiveDirect();
const generatedConfig = await smokeGeneratedConfig();
await smokeAgentChatFailsClosed();
const agentRuntime = await smokeAgentRuntime();
const agentChat = smokeAgentChatSimulator();
const doctor = await smokeDoctor();

console.log(JSON.stringify(
  {
    ok: true,
    checks: {
      basicDirect: basicDirect.consensusModel,
      adaptiveDirect: {
        selected: adaptiveDirect.selectedAdapters.length,
        rejected: adaptiveDirect.rejectedAdapters.length,
      },
      generatedConfig: {
        profile: generatedConfig.loaded.setupProfile,
        mode: generatedConfig.loaded.routingMode,
      },
      agentChatFailsClosed: true,
      agentRuntime: {
        ok: agentRuntime.ok,
        decision: agentRuntime.decision.decision,
        turns: agentRuntime.runtimeSummary.turns,
      },
      agentChatSimulatorDecision: agentChat.decision.decision,
      doctorOk: doctor.ok,
    },
  },
  null,
  2,
));
