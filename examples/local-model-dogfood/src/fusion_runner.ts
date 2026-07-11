import type { SynthesisAdapter } from "../../../src/contracts.ts";
import {
  runStructuredFusion,
  type StructuredJudgeAdapter,
  type StructuredJudgeResult,
  StructuredJudgeResultSchema,
} from "../../../src/fusion.ts";
import {
  type FinalSynthesis,
  FinalSynthesisSchema,
  type ModelOutput,
  ProviderDescriptorSchema,
} from "../../../src/schemas.ts";
import { invokeSelected, runBestRoute } from "./best_route_runner.ts";
import type { ProviderResult } from "./schema.ts";

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  const candidate = fenced ?? trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("Fusion model returned no JSON object");
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }
}

function sourceLines(outputs: ModelOutput[]): string {
  return outputs.map((output, index) =>
    `${index + 1}. [${output.provider}/${output.model}]\n${output.content}`
  ).join("\n\n");
}

function toModelOutput(result: ProviderResult): ModelOutput {
  return {
    provider: result.provider,
    model: result.model,
    content: result.raw_content,
    latencyMs: 0,
  };
}

class HermesWrapperJudgeAdapter implements StructuredJudgeAdapter {
  readonly descriptor = ProviderDescriptorSchema.parse({
    provider: "QuorumRouter",
    model: "wrapper-structured-judge",
    authMode: "session",
    transport: "processAdapter",
    client: "HermesBridgeJudge",
  });

  async judge(
    prompt: string,
    outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<StructuredJudgeResult> {
    const judgePrompt = [
      "You are the Structured Judge stage of QuorumRouter Fusion.",
      "Analyze the candidate answers; do not merely select the longest answer.",
      "Evaluate factual support, logic, practical usefulness, omissions, and contradictions.",
      "Return only JSON with exactly these keys:",
      "agreements: string[]",
      "disagreements: {issue:string, positions:{source:string,claim:string}[], resolution?:string}[]",
      "strengths: {source:string,strength:string}[]",
      "rejectedClaims: {source:string,claim:string,reason:string}[]",
      "uncertainties: string[]",
      "additionalChecks: string[]",
      "Every source must be a provider/model label from the supplied candidates.",
      `Original user task:\n${prompt}`,
      `Independent candidate answers:\n${sourceLines(outputs)}`,
    ].join("\n\n");
    const result = await invokeSelected(judgePrompt);
    return StructuredJudgeResultSchema.parse(
      parseJsonObject(result.results[0].raw_content),
    );
  }
}

class HermesWrapperSynthesisAdapter implements SynthesisAdapter {
  readonly descriptor = ProviderDescriptorSchema.parse({
    provider: "QuorumRouter",
    model: "wrapper-editor",
    authMode: "session",
    transport: "processAdapter",
    client: "HermesBridgeEditor",
  });

  async synthesize(
    prompt: string,
    outputs: ModelOutput[],
    _signal: AbortSignal,
  ): Promise<FinalSynthesis> {
    const editorPrompt = [
      "You are the Editor stage of QuorumRouter Fusion.",
      "The final upstream item is the Structured Judge report; all preceding items are independent candidate answers.",
      "Use the Judge report critically. Do not adopt rejected or unsupported claims.",
      "Return only JSON with exactly these keys: synthesis, reasoning, consensusModel, sources.",
      "synthesis must be a useful standalone final answer organized as:",
      "1. Integrated conclusion",
      "2. Agreements",
      "3. Disagreements and resolution",
      "4. Rejected claims and reasons",
      "5. Uncertainties and additional checks",
      `Set consensusModel to ${this.descriptor.provider}/${this.descriptor.model}.`,
      `Original user task:\n${prompt}`,
      `Candidate answers and Structured Judge report:\n${sourceLines(outputs)}`,
    ].join("\n\n");
    const result = await invokeSelected(editorPrompt);
    return FinalSynthesisSchema.parse(
      parseJsonObject(result.results[0].raw_content),
    );
  }
}

export async function runHermesStructuredFusion(prompt: string) {
  const candidates = await runBestRoute(prompt);
  const outputs = candidates.results.map(toModelOutput);
  const controller = new AbortController();
  const result = await runStructuredFusion({
    prompt,
    outputs,
    judgeAdapter: new HermesWrapperJudgeAdapter(),
    synthesisAdapter: new HermesWrapperSynthesisAdapter(),
    signal: controller.signal,
  });
  return {
    ...result,
    candidates: outputs,
    candidateTracePath: candidates.tracePath,
  };
}
