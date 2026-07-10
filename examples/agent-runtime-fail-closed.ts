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
  RouterError,
  runAgentRuntime,
} from "../router.ts";
import { FixtureSynthesisAdapter } from "./v0_1_fixtures.ts";
import { assertEquals, assertRejects } from "@std/assert";

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
    provider: "Fixture",
    model: `runtime-${role}`,
    authMode: "session",
    transport: "processAdapter",
    client: `AgentRuntime/${role}`,
  };
}

class TextRoleAdapter implements ModelAdapter {
  readonly descriptor: ProviderDescriptor;
  constructor(
    readonly role: AgentRuntimeRole,
    private readonly content: string,
  ) {
    this.descriptor = descriptor(role);
  }
  invoke(_prompt: string, _signal: AbortSignal): Promise<ModelOutput> {
    return Promise.resolve({
      provider: this.descriptor.provider,
      model: this.descriptor.model,
      latencyMs: 1,
      content: this.content,
    });
  }
}

function bus(ids = {
  ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
  runId: "agent-runtime-fail-closed-run",
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

function json(
  status: string,
  content: string,
  extra: Record<string, unknown> = {},
) {
  return JSON.stringify({
    status,
    content,
    objection: null,
    finalAnswer: null,
    budgetUsd: 0,
    ...extra,
  });
}

function config(
  overrides: Partial<Record<AgentRuntimeRole, string>>,
): AgentRuntimeConfig {
  const outputs: Record<AgentRuntimeRole, string> = {
    commander: json("plan", "Plan."),
    coder: json("result", "Result."),
    reviewer: json("pass", "Review passed."),
    red_team: json("pass", "Red-team passed."),
    closeout: json("ready", "Ready.", { finalAnswer: "Ready answer." }),
    ...overrides,
  };
  const busIds = {
    ...DEFAULT_AGENT_RUNTIME_BUS_IDS,
    runId: `agent-runtime-fail-closed-${
      Object.keys(overrides).join("-") || "default"
    }`,
  };
  return {
    enabled: true,
    experimental: true,
    bus: bus(busIds),
    busIds,
    commander,
    roles: Object.entries(outputs).map(([role, content]) => ({
      role: role as AgentRuntimeRole,
      required: true,
      adapter: new TextRoleAdapter(role as AgentRuntimeRole, content),
    })),
    limits: { maxTurns: 5, maxDurationMs: 10_000, maxBudgetUsd: 0 },
  };
}

const objection = await runAgentRuntime({
  prompt: "object example",
  config: config({
    reviewer: json("object", "Review objected.", {
      objection: "Missing test.",
    }),
    closeout: json("not_ready", "Blocked by reviewer."),
  }),
});
assertEquals(objection.ok, false);
assertEquals(objection.decision.decision, "not_ready");

const malformedError = await assertRejects(
  () =>
    runAgentRuntime({
      prompt: "malformed example",
      config: config({ coder: "not-json" }),
    }),
  RouterError,
);
assertEquals(malformedError.status, 4401);
assertEquals(malformedError.code, "agent_runtime_malformed_role_output");

const gatedRouter = new QuorumRouter({
  modelAdapters: [new TextRoleAdapter("coder", json("result", "unused"))],
  synthesisAdapter: new FixtureSynthesisAdapter(),
  minSuccessfulAdapters: 1,
  routingModeEnvProvider: () => undefined,
  agentRuntime: config({}),
});
const missingOptInError = await assertRejects(
  () => gatedRouter.route("missing opt-in", { routingMode: "agent_chat" }),
  RouterError,
);
assertEquals(missingOptInError.status, 4401);
assertEquals(missingOptInError.code, "agent_runtime_opt_in_required");

console.log(JSON.stringify(
  {
    ok: true,
    objectionDecision: objection.decision.decision,
    turns: objection.runtimeSummary.turns,
    finalAnswer: objection.finalAnswer ?? null,
    events: objection.events.length,
    messages: objection.messages.length,
    malformedFailsClosed: true,
    missingOptInFailsClosed: true,
  },
  null,
  2,
));
