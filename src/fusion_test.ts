import { assertEquals, assertRejects } from "@std/assert";
import { runStructuredFusion } from "./fusion.ts";
import type { StructuredJudgeAdapter } from "./fusion.ts";
import type { SynthesisAdapter } from "./contracts.ts";
import type { ModelOutput } from "./schemas.ts";

const descriptor = {
  provider: "Fixture",
  model: "judge-editor",
  authMode: "session" as const,
  transport: "processAdapter" as const,
  client: "fixture",
};

Deno.test("structured fusion judges before synthesis and binds the report", async () => {
  const calls: string[] = [];
  const judgeAdapter: StructuredJudgeAdapter = {
    descriptor,
    judge: (_prompt, outputs) => {
      calls.push(`judge:${outputs.length}`);
      return Promise.resolve({
        agreements: ["Shared claim"],
        disagreements: [{
          issue: "Trade-off",
          positions: [
            { source: "A/a", claim: "Fast" },
            { source: "B/b", claim: "Safe" },
          ],
          resolution: "Measure both",
        }],
        strengths: [{ source: "A/a", strength: "Concrete" }],
        rejectedClaims: [{
          source: "B/b",
          claim: "Unsupported",
          reason: "No evidence",
        }],
        uncertainties: ["Unknown cost"],
        additionalChecks: ["Benchmark"],
      });
    },
  };
  const synthesisAdapter: SynthesisAdapter = {
    descriptor,
    synthesize: (_prompt, outputs) => {
      calls.push(`synthesize:${outputs.length}`);
      const judge = outputs.at(-1);
      if (!judge?.model.endsWith(":structured-judge")) {
        throw new Error("judge report missing");
      }
      return Promise.resolve({
        synthesis: "Integrated answer",
        reasoning: "Used structured judge report",
        consensusModel: "Fixture/judge-editor",
        sources: outputs.map((output) => `${output.provider}/${output.model}`),
      });
    },
  };
  const outputs: ModelOutput[] = [
    { provider: "A", model: "a", content: "one", latencyMs: 1 },
    { provider: "B", model: "b", content: "two", latencyMs: 1 },
  ];
  const result = await runStructuredFusion({
    prompt: "test",
    outputs,
    judgeAdapter,
    synthesisAdapter,
    signal: new AbortController().signal,
  });
  assertEquals(calls, ["judge:2", "synthesize:3"]);
  assertEquals(result.final.synthesis, "Integrated answer");
  assertEquals(result.judge.rejectedClaims[0].reason, "No evidence");
  assertEquals(
    result.decision_report.outcome,
    "structured_synthesis_with_recorded_disagreement",
  );
  assertEquals(result.decision_report.candidate_sources, ["A/a", "B/b"]);
  assertEquals(
    result.decision_report.evidence.disagreements[0].issue,
    "Trade-off",
  );
});

Deno.test("structured fusion reports no recorded disagreement without claiming semantic consensus", async () => {
  const outputs: ModelOutput[] = [
    { provider: "A", model: "a", content: "one", latencyMs: 1 },
    { provider: "B", model: "b", content: "two", latencyMs: 1 },
  ];
  const result = await runStructuredFusion({
    prompt: "test",
    outputs,
    judgeAdapter: {
      descriptor,
      judge: () =>
        Promise.resolve({
          agreements: ["Shared claim"],
          disagreements: [],
          strengths: [],
          rejectedClaims: [],
          uncertainties: [],
          additionalChecks: [],
        }),
    },
    synthesisAdapter: {
      descriptor,
      synthesize: (_prompt, candidates) =>
        Promise.resolve({
          synthesis: "Integrated answer",
          reasoning: "No disagreement was recorded",
          consensusModel: "Fixture/judge-editor",
          sources: candidates.map((candidate) =>
            `${candidate.provider}/${candidate.model}`
          ),
        }),
    },
    signal: new AbortController().signal,
  });

  assertEquals(
    result.decision_report.outcome,
    "structured_synthesis_without_recorded_disagreement",
  );
  assertEquals("split" in result.decision_report, false);
  assertEquals("winner" in result.decision_report, false);
});

Deno.test("structured fusion rejects duplicate candidate source labels", async () => {
  let judgeCalled = false;
  await assertRejects(
    () =>
      runStructuredFusion({
        prompt: "test",
        outputs: [
          { provider: "A", model: "a", content: "one", latencyMs: 1 },
          { provider: "A", model: "a", content: "two", latencyMs: 1 },
        ],
        judgeAdapter: {
          descriptor,
          judge: () => {
            judgeCalled = true;
            return Promise.resolve({
              agreements: [],
              disagreements: [],
              strengths: [],
              rejectedClaims: [],
              uncertainties: [],
              additionalChecks: [],
            });
          },
        },
        synthesisAdapter: {
          descriptor,
          synthesize: () => {
            throw new Error("must not run");
          },
        },
        signal: new AbortController().signal,
      }),
    Error,
    "unique provider/model",
  );
  assertEquals(judgeCalled, false);
});

Deno.test("structured fusion rejects fewer than two candidates before judge", async () => {
  let called = false;
  await assertRejects(
    () =>
      runStructuredFusion({
        prompt: "test",
        outputs: [{ provider: "A", model: "a", content: "one", latencyMs: 1 }],
        judgeAdapter: {
          descriptor,
          judge: () => {
            called = true;
            throw new Error("must not run");
          },
        },
        synthesisAdapter: {
          descriptor,
          synthesize: () => {
            throw new Error("must not run");
          },
        },
        signal: new AbortController().signal,
      }),
    Error,
    "at least two",
  );
  assertEquals(called, false);
});
