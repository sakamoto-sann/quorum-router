import {
  type AgentRuntimeConfig,
  type AgentRuntimeRole,
  type CommanderConfig,
  DEFAULT_AGENT_RUNTIME_BUS_IDS,
  InMemoryAgentBusStore,
  type ModelAdapter,
  type ModelOutput,
  type ProviderDescriptor,
  QuorumRouter,
} from "../router.ts";
import {
  FIXTURE_DIRECT_DESCRIPTOR,
  FixtureModelAdapter,
  FixtureSynthesisAdapter,
} from "./v0_1_fixtures.ts";

const commander: CommanderConfig = {
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

function descriptor(role: AgentRuntimeRole): ProviderDescriptor {
  return {
    ...FIXTURE_DIRECT_DESCRIPTOR,
    model: `runtime-${role}`,
    client: `AgentRuntime/${role}`,
  };
}

class JsonRoleAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  calls = 0;

  constructor(
    readonly role: AgentRuntimeRole,
    private readonly output: Record<string, unknown>,
  ) {
    this.descriptor = descriptor(role);
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

function bus(ids = {
  ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
  runId: "agent-runtime-basic-run",
}) {
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

function runtimeConfig(): AgentRuntimeConfig {
  const roleOutputs: Record<AgentRuntimeRole, Record<string, unknown>> = {
    commander: {
      status: "plan",
      content: "Plan a deterministic fixture implementation.",
      objection: null,
      finalAnswer: null,
      budgetUsd: 0,
    },
    coder: {
      status: "result",
      content: "Implemented deterministic fixture result.",
      objection: null,
      finalAnswer: null,
      budgetUsd: 0,
    },
    reviewer: {
      status: "pass",
      content: "Review passed.",
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
      content: "Ready for closeout.",
      objection: null,
      finalAnswer: "Experimental AgentRuntime completed successfully.",
      budgetUsd: 0,
    },
  };
  const busIds = {
    ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
    runId: "agent-runtime-basic-run",
  };
  return {
    enabled: true,
    experimental: true,
    bus: bus(busIds),
    busIds,
    commander,
    roles: Object.entries(roleOutputs).map(([role, output]) => ({
      role: role as AgentRuntimeRole,
      required: true,
      adapter: new JsonRoleAdapter(role as AgentRuntimeRole, output),
    })),
    limits: { maxTurns: 5, maxDurationMs: 10_000, maxBudgetUsd: 0 },
  };
}

const router = new QuorumRouter({
  modelAdapters: [new FixtureModelAdapter()],
  synthesisAdapter: new FixtureSynthesisAdapter(),
  minSuccessfulAdapters: 1,
  routingModeEnvProvider: () => undefined,
  agentRuntime: runtimeConfig(),
});

const runtime = await router.routeAgentRuntime("offline AgentRuntime example", {
  routingMode: "agent_chat",
  experimentalAgentRuntime: true,
});
const route = await router.route("offline AgentRuntime route example", {
  routingMode: "agent_chat",
  experimentalAgentRuntime: true,
});

console.log(JSON.stringify(
  {
    ok: runtime.ok,
    decision: runtime.decision.decision,
    turns: runtime.runtimeSummary.turns,
    finalAnswer: runtime.finalAnswer,
    routeSynthesis: route.synthesis,
    events: runtime.events.length,
    messages: runtime.messages.length,
  },
  null,
  2,
));
