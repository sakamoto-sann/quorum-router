import { redactAgentChatContent } from "../agent-chat/redaction.ts";
import type {
  AgentRuntimeRole,
  ParsedAgentRuntimeRoleOutput,
} from "./types.ts";

const JSON_CONTRACT = `Return only strict JSON with this shape:
{
  "status": "plan|result|pass|object|ready|not_ready",
  "content": "non-empty text",
  "objection": null,
  "finalAnswer": null,
  "budgetUsd": 0
  ,"actions": []
}
Rules: no markdown fences; content must be non-empty; budgetUsd must be finite and nonnegative.`;

function summarizePrior(
  priorOutputs: Partial<Record<AgentRuntimeRole, ParsedAgentRuntimeRoleOutput>>,
): string {
  const entries = Object.entries(priorOutputs) as [
    AgentRuntimeRole,
    ParsedAgentRuntimeRoleOutput,
  ][];
  if (entries.length === 0) {
    return "No prior role outputs yet.";
  }
  return entries.map(([role, output]) => {
    return `${role}: status=${output.status}; content=${output.content}; objection=${
      output.objection ?? "none"
    }; finalAnswer=${output.finalAnswer ?? "none"}`;
  }).join("\n");
}

export function buildAgentRuntimeRolePrompt(input: {
  role: AgentRuntimeRole;
  prompt: string;
  priorOutputs: Partial<Record<AgentRuntimeRole, ParsedAgentRuntimeRoleOutput>>;
  reviewerPassed: boolean;
  redTeamPassed: boolean;
}): string {
  const task = redactAgentChatContent(input.prompt);
  const prior = summarizePrior(input.priorOutputs);
  const prefix =
    `You are the ${input.role} in the QuorumRouter AgentRuntime.\nTask: ${task}\n\nPrior role outputs:\n${prior}\n\n${JSON_CONTRACT}\n`;

  switch (input.role) {
    case "commander":
      return `${prefix}\nAs commander, produce a concise execution plan. Use status "plan". objection and finalAnswer must be null.`;
    case "coder":
      return `${prefix}\nAs coder, propose structured actions in actions. Allowed action kinds are read_file, write_file, patch_file, and run_command. You never execute tools or approve your own actions. Use status "result". objection and finalAnswer must be null.`;
    case "reviewer":
      return `${prefix}\nAs reviewer, return status "pass" if the coder result is acceptable; otherwise status "object" with a concrete objection. finalAnswer must be null.`;
    case "red_team":
      return `${prefix}\nAs red_team, return status "pass" if there is no safety/security objection; otherwise status "object" with a concrete objection. finalAnswer must be null.`;
    case "closeout":
      return `${prefix}\nAs closeout, use status "ready" with finalAnswer only if reviewerPassed=${input.reviewerPassed} and redTeamPassed=${input.redTeamPassed}. If either is false, use status "not_ready" and finalAnswer null.`;
  }
}
