import { FusionRouter } from "../router.ts";
import {
  FixtureModelAdapter,
  FixtureSynthesisAdapter,
} from "./v0_1_fixtures.ts";

const adapter = new FixtureModelAdapter();
const synthesis = new FixtureSynthesisAdapter();
const router = new FusionRouter({
  modelAdapters: [adapter],
  synthesisAdapter: synthesis,
  minSuccessfulAdapters: 1,
  timeoutMs: 1_000,
  routingModeEnvProvider: () => undefined,
});

const result = await router.route("hello safe direct router");

console.log(JSON.stringify(
  {
    ok: true,
    example: "basic-direct",
    adapterCalls: adapter.calls,
    synthesisCalls: synthesis.calls,
    result,
  },
  null,
  2,
));
