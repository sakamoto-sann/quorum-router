import { z } from "zod";
import type { SynthesisAdapter } from "./contracts.ts";
import type {
  FinalSynthesis,
  ModelOutput,
  ProviderDescriptor,
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
  const judge = StructuredJudgeResultSchema.parse(
    await args.judgeAdapter.judge(args.prompt, args.outputs, args.signal),
  );
  const candidateLabels = new Set(
    args.outputs.map((output) => `${output.provider}/${output.model}`),
  );
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
  const final = await args.synthesisAdapter.synthesize(
    args.prompt,
    [...args.outputs, judgeOutput],
    args.signal,
  );
  const allowedFinalSources = new Set([
    ...candidateLabels,
    `${judgeOutput.provider}/${judgeOutput.model}`,
  ]);
  const unknownFinalSource = final.sources.find((source) =>
    !allowedFinalSources.has(source)
  );
  if (unknownFinalSource) {
    throw new Error(
      `Fusion synthesis referenced an unknown source: ${unknownFinalSource}`,
    );
  }
  return { judge, final };
}
