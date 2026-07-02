import {
  createCapabilityDirectRoutingPolicy,
  ProviderCapabilityRegistry,
  providerDescriptorKey,
} from "../router.ts";
import {
  FIXTURE_DIRECT_DESCRIPTOR,
  FIXTURE_DIRECT_REJECTED_DESCRIPTOR,
  FIXTURE_SYNTHESIS_DESCRIPTOR,
  fixtureCapability,
} from "./v0_1_fixtures.ts";

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
      reason: "fixture demonstrates rejected candidate",
    },
  },
});

console.log(JSON.stringify(
  {
    ok: true,
    example: "adaptive-direct",
    selected: decision.selectedAdapters,
    rejected: decision.rejectedAdapters,
    synthesis: decision.synthesis,
    fallbackPolicy: decision.fallbackPolicy,
    budgetEstimatedUsd: decision.budgetEstimatedUsd,
  },
  null,
  2,
));
