import {
  createCapabilityDirectRoutingPolicy,
  createInMemoryAgentChatAuditSink,
  FusionRouter,
  generateFusionRouterConfig,
  loadFusionRouterConfigValue,
  ProviderCapabilityRegistry,
  providerDescriptorKey,
  RouterError,
  runAgentChatSimulator,
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

async function smokeBasicDirect() {
  const adapter = new FixtureModelAdapter();
  const synthesis = new FixtureSynthesisAdapter();
  const router = new FusionRouter({
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
  const generated = generateFusionRouterConfig({ profile: "minimal-direct" });
  const loaded = loadFusionRouterConfigValue(generated);
  const adapter = new FixtureModelAdapter();
  const router = new FusionRouter({
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
  const router = new FusionRouter({
    modelAdapters: [adapter],
    synthesisAdapter: new FixtureSynthesisAdapter(),
    minSuccessfulAdapters: 1,
    routingMode: "agent_chat",
    routingModeEnvProvider: () => undefined,
  });
  await assertRejects(
    () => router.route("agent_chat must remain unavailable"),
    RouterError,
    "not implemented",
  );
  assertEquals(adapter.calls, 0);
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
      agentChatSimulatorDecision: agentChat.decision.decision,
      doctorOk: doctor.ok,
    },
  },
  null,
  2,
));
