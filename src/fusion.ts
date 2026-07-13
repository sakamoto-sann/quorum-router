import { z } from "zod";
import type { SynthesisAdapter } from "./contracts.ts";
import {
  type FinalSynthesis,
  FinalSynthesisSchema,
  type ModelOutput,
  type ProviderDescriptor,
} from "./schemas.ts";

export const JudgePositionSchema = z.object({
  source: z.string().min(1),
  claim: z.string().min(1),
});

export const JudgeDisagreementSchema = z.object({
  issue: z.string().min(1),
  positions: z.array(JudgePositionSchema).min(2),
  resolution: z.string().min(1).optional(),
});

export const JudgeStrengthSchema = z.object({
  source: z.string().min(1),
  strength: z.string().min(1),
});

export const JudgeRejectedClaimSchema = z.object({
  source: z.string().min(1),
  claim: z.string().min(1),
  reason: z.string().min(1),
});

export const StructuredJudgeResultSchema = z.object({
  agreements: z.array(z.string().min(1)),
  disagreements: z.array(JudgeDisagreementSchema),
  strengths: z.array(JudgeStrengthSchema),
  rejectedClaims: z.array(JudgeRejectedClaimSchema),
  uncertainties: z.array(z.string().min(1)),
  additionalChecks: z.array(z.string().min(1)),
});

export type StructuredJudgeResult = z.infer<typeof StructuredJudgeResultSchema>;

export const StructuredFusionDecisionReportSchema = z.object({
  schema_version: z.literal(
    "quorum-router.structured-decision-report.v1",
  ),
  outcome: z.enum([
    "structured_synthesis_with_recorded_disagreement",
    "structured_synthesis_without_recorded_disagreement",
  ]),
  candidate_sources: z.array(z.string().min(1)).min(2),
  judge_source: z.string().min(1),
  evidence: StructuredJudgeResultSchema,
}).superRefine((value, context) => {
  const candidates = new Set(value.candidate_sources);
  if (candidates.size !== value.candidate_sources.length) {
    context.addIssue({
      code: "custom",
      message: "candidate_sources must be unique",
    });
  }
  if (candidates.has(value.judge_source)) {
    context.addIssue({
      code: "custom",
      message: "judge_source must not collide with candidate_sources",
    });
  }
  const evidenceSources = [
    ...value.evidence.disagreements.flatMap((item) =>
      item.positions.map((position) => position.source)
    ),
    ...value.evidence.strengths.map((item) => item.source),
    ...value.evidence.rejectedClaims.map((item) => item.source),
  ];
  if (evidenceSources.some((source) => !candidates.has(source))) {
    context.addIssue({
      code: "custom",
      message: "evidence must reference only candidate_sources",
    });
  }
  if (
    value.evidence.disagreements.some((item) =>
      new Set(item.positions.map((position) => position.source)).size !==
        item.positions.length
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "disagreement positions must reference unique sources",
    });
  }
  const hasDisagreement = value.evidence.disagreements.length > 0;
  if (
    hasDisagreement !==
      (value.outcome === "structured_synthesis_with_recorded_disagreement")
  ) {
    context.addIssue({
      code: "custom",
      message: "outcome must match recorded disagreement evidence",
    });
  }
});

export type StructuredFusionDecisionReport = z.infer<
  typeof StructuredFusionDecisionReportSchema
>;

export interface StructuredJudgeAdapter {
  readonly descriptor: ProviderDescriptor;
  judge(
    prompt: string,
    outputs: ModelOutput[],
    signal: AbortSignal,
  ): Promise<StructuredJudgeResult>;
}

export type StructuredFusionResult = {
  judge: StructuredJudgeResult;
  final: FinalSynthesis;
  decision_report: StructuredFusionDecisionReport;
};

export async function runStructuredFusion(args: {
  prompt: string;
  outputs: ModelOutput[];
  judgeAdapter: StructuredJudgeAdapter;
  synthesisAdapter: SynthesisAdapter;
  signal: AbortSignal;
}): Promise<StructuredFusionResult> {
  if (args.outputs.length < 2) {
    throw new Error(
      "Structured Fusion requires at least two validated candidate outputs",
    );
  }
  const candidateLabels = new Set(
    args.outputs.map((output) => `${output.provider}/${output.model}`),
  );
  if (candidateLabels.size !== args.outputs.length) {
    throw new Error(
      "Structured Fusion requires unique provider/model candidate sources",
    );
  }
  const judge = StructuredJudgeResultSchema.parse(
    await args.judgeAdapter.judge(args.prompt, args.outputs, args.signal),
  );
  const duplicatePositionIssue = judge.disagreements.find((item) =>
    new Set(item.positions.map((position) => position.source)).size !==
      item.positions.length
  );
  if (duplicatePositionIssue) {
    throw new Error(
      `Structured Judge repeated a candidate source for disagreement: ${duplicatePositionIssue.issue}`,
    );
  }
  const judgeSources = [
    ...judge.disagreements.flatMap((item) =>
      item.positions.map((position) => position.source)
    ),
    ...judge.strengths.map((item) => item.source),
    ...judge.rejectedClaims.map((item) => item.source),
  ];
  const unknownJudgeSource = judgeSources.find((source) =>
    !candidateLabels.has(source)
  );
  if (unknownJudgeSource) {
    throw new Error(
      `Structured Judge referenced an unknown candidate source: ${unknownJudgeSource}`,
    );
  }
  const judgeOutput: ModelOutput = {
    provider: args.judgeAdapter.descriptor.provider,
    model: `${args.judgeAdapter.descriptor.model}:structured-judge`,
    content: JSON.stringify(judge),
    latencyMs: 0,
  };
  const judgeSource = `${judgeOutput.provider}/${judgeOutput.model}`;
  if (candidateLabels.has(judgeSource)) {
    throw new Error(
      `Structured Judge source collides with a candidate source: ${judgeSource}`,
    );
  }
  const final = FinalSynthesisSchema.parse(
    await args.synthesisAdapter.synthesize(
      args.prompt,
      [...args.outputs, judgeOutput],
      args.signal,
    ),
  );
  const allowedFinalSources = new Set([
    ...candidateLabels,
    judgeSource,
  ]);
  const unknownFinalSource = final.sources.find((source) =>
    !allowedFinalSources.has(source)
  );
  if (unknownFinalSource) {
    throw new Error(
      `Fusion synthesis referenced an unknown source: ${unknownFinalSource}`,
    );
  }
  const decisionReport = StructuredFusionDecisionReportSchema.parse({
    schema_version: "quorum-router.structured-decision-report.v1",
    outcome: judge.disagreements.length > 0
      ? "structured_synthesis_with_recorded_disagreement"
      : "structured_synthesis_without_recorded_disagreement",
    candidate_sources: [...candidateLabels],
    judge_source: judgeSource,
    evidence: judge,
  });
  return { judge, final, decision_report: decisionReport };
}
