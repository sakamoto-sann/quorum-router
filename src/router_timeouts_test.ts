import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import { QuorumRouter, silentRouterLogger } from "./router.ts";
import { RouterError } from "./errors.ts";
import type { ModelAdapter, SynthesisAdapter } from "./contracts.ts";
import type { DecisionReportAny } from "./schemas.ts";

function descriptor(model: string) {
  return {
    provider: "Fixture",
    model,
    authMode: "session",
    transport: "processAdapter",
    client: "FixtureCLI",
  } as const;
}

/** Answers after `delayMs`; when `ignoreAbort` is set it never stops early. */
function delayedAdapter(
  model: string,
  delayMs: number,
  options: { ignoreAbort?: boolean; onAbort?: () => void } = {},
): ModelAdapter {
  return {
    descriptor: descriptor(model),
    invoke: (_prompt, signal) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () =>
            resolve({
              content: `answer from ${model}`,
              provider: "Fixture",
              model,
              latencyMs: delayMs,
            }),
          delayMs,
        );
        signal.addEventListener("abort", () => {
          options.onAbort?.();
          if (!options.ignoreAbort) {
            clearTimeout(timer);
            reject(new Error("adapter aborted"));
          }
        }, { once: true });
        // Keep ignored timers from holding the test runner open.
        if (options.ignoreAbort) {
          Deno.unrefTimer(timer as unknown as number);
        }
      }),
  };
}

function echoSynthesis(delayMs = 0): SynthesisAdapter {
  return {
    descriptor: descriptor("synth"),
    synthesize: (_prompt, outputs, signal) =>
      new Promise((resolve, reject) => {
        if (signal.aborted) {
          reject(new Error("synthesis started with an aborted signal"));
          return;
        }
        const timer = setTimeout(
          () =>
            resolve({
              synthesis: "ok",
              reasoning: "fixture",
              consensusModel: "Fixture/synth",
              sources: outputs.map((o) => `${o.provider}/${o.model}`),
            }),
          delayMs,
        );
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("synthesis aborted"));
        }, { once: true });
      }),
  };
}

async function routeError(router: QuorumRouter): Promise<RouterError> {
  return await assertRejects(
    () => router.routeWithDecisionReport("prompt"),
    RouterError,
  );
}

function decisionReportOf(error: RouterError): DecisionReportAny {
  return (error.details as { decisionReport: DecisionReportAny })
    .decisionReport;
}

Deno.test("synthesis gets its own time budget after slow model execution", async () => {
  // Execution uses most of its 80ms limit; synthesis must still get a
  // fresh, unaborted signal and its own 200ms limit.
  const router = new QuorumRouter({
    modelAdapters: [delayedAdapter("fast", 1), delayedAdapter("slow", 60)],
    synthesisAdapter: echoSynthesis(40),
    minSuccessfulAdapters: 2,
    timeoutMs: 80,
    synthesisTimeoutMs: 200,
    logger: silentRouterLogger,
  });

  const result = await router.routeWithDecisionReport("prompt");
  assertEquals(result.final.sources, ["Fixture/fast", "Fixture/slow"]);
});

Deno.test("synthesis timeout fails closed with router_timeout", async () => {
  const router = new QuorumRouter({
    modelAdapters: [delayedAdapter("fast", 1)],
    synthesisAdapter: echoSynthesis(1_000),
    minSuccessfulAdapters: 1,
    timeoutMs: 1_000,
    synthesisTimeoutMs: 20,
    logger: silentRouterLogger,
  });

  const error = await routeError(router);
  assertEquals(error.code, "consensus_validation_failed");
  assert(
    String((error.details as { cause: string }).cause).includes(
      "20ms synthesis timeout",
    ),
  );
});

Deno.test("adapters that ignore abort cannot hang past timeoutMs", async () => {
  const router = new QuorumRouter({
    modelAdapters: [
      delayedAdapter("fast", 1),
      delayedAdapter("stuck", 60_000, { ignoreAbort: true }),
    ],
    synthesisAdapter: echoSynthesis(),
    minSuccessfulAdapters: 2,
    timeoutMs: 30,
    logger: silentRouterLogger,
  });

  const started = performance.now();
  const error = await routeError(router);
  assert(performance.now() - started < 5_000);
  assertEquals(error.code, "consensus_insufficient");
  assertEquals(decisionReportOf(error).failures, [{
    stage: "adapter_execution",
    provider: "Fixture",
    model: "stuck",
    code: "router_timeout",
  }]);
});

Deno.test("quorum grace stops stragglers once quorum is met", async () => {
  let stragglerAborted = false;
  const router = new QuorumRouter({
    modelAdapters: [
      delayedAdapter("a", 1),
      delayedAdapter("b", 5),
      delayedAdapter("slow", 60_000, {
        onAbort: () => {
          stragglerAborted = true;
        },
      }),
    ],
    synthesisAdapter: echoSynthesis(),
    minSuccessfulAdapters: 2,
    timeoutMs: 60_000,
    quorumGraceMs: 10,
    logger: silentRouterLogger,
  });

  const result = await router.routeWithDecisionReport("prompt");
  assert(stragglerAborted);
  assertEquals(result.final.sources, ["Fixture/a", "Fixture/b"]);
  assertEquals(result.decision_report.failures, [{
    stage: "adapter_execution",
    provider: "Fixture",
    model: "slow",
    code: "quorum_grace_elapsed",
  }]);
});

Deno.test("without quorumGraceMs the router waits for every model", async () => {
  const router = new QuorumRouter({
    modelAdapters: [
      delayedAdapter("a", 1),
      delayedAdapter("b", 1),
      delayedAdapter("later", 40),
    ],
    synthesisAdapter: echoSynthesis(),
    minSuccessfulAdapters: 2,
    timeoutMs: 5_000,
    logger: silentRouterLogger,
  });

  const result = await router.routeWithDecisionReport("prompt");
  assertEquals(result.final.sources.length, 3);
  assertEquals(result.decision_report.failures, []);
});

Deno.test("router progress messages go to the configured logger", async () => {
  const messages: string[] = [];
  const router = new QuorumRouter({
    modelAdapters: [delayedAdapter("a", 1)],
    synthesisAdapter: echoSynthesis(),
    minSuccessfulAdapters: 1,
    logger: { info: (message) => messages.push(message) },
  });

  await router.routeWithDecisionReport("prompt");
  assertEquals(messages.length, 2);
  assert(messages[0].startsWith("Starting parallel model execution"));
  assert(messages[1].includes("Fixture/synth"));
});

Deno.test("timeout options are validated", () => {
  const base = {
    modelAdapters: [delayedAdapter("a", 1)],
    synthesisAdapter: echoSynthesis(),
  };
  assertThrows(
    () => new QuorumRouter({ ...base, timeoutMs: 0 }),
    Error,
    "timeoutMs must be an integer >= 1.",
  );
  assertThrows(
    () => new QuorumRouter({ ...base, synthesisTimeoutMs: 1.5 }),
    Error,
    "synthesisTimeoutMs must be an integer >= 1.",
  );
  assertThrows(
    () => new QuorumRouter({ ...base, quorumGraceMs: -1 }),
    Error,
    "quorumGraceMs must be an integer >= 0.",
  );
  new QuorumRouter({ ...base, quorumGraceMs: 0 });
});
