import { z } from "zod";
import { failClosed } from "../errors.ts";
import { redactAgentChatContent } from "../agent-chat/redaction.ts";
import {
  AgentRuntimeOutputStatuses,
  type AgentRuntimeRole,
  type ParsedAgentRuntimeRoleOutput,
} from "./types.ts";

const ActionBase = {
  id: z.string().trim().min(1),
  proposedBy: z.string().trim().min(1),
};
const ActionSchema = z.discriminatedUnion("kind", [
  z.object({
    ...ActionBase,
    kind: z.literal("read_file"),
    classification: z.literal("read_only"),
    path: z.string().min(1),
  }).strip(),
  z.object({
    ...ActionBase,
    kind: z.literal("write_file"),
    classification: z.literal("repo_write"),
    path: z.string().min(1),
    content: z.string(),
  }).strip(),
  z.object({
    ...ActionBase,
    kind: z.literal("patch_file"),
    classification: z.literal("repo_write"),
    path: z.string().min(1),
    find: z.string().min(1),
    replace: z.string(),
  }).strip(),
  z.object({
    ...ActionBase,
    kind: z.literal("run_command"),
    classification: z.literal("shell_write"),
    command: z.array(z.string().min(1)).min(1),
  }).strip(),
]);

const RoleOutputSchema = z.object({
  status: z.enum(AgentRuntimeOutputStatuses),
  content: z.string().trim().min(1),
  objection: z.string().trim().min(1).nullable().optional(),
  finalAnswer: z.string().trim().min(1).nullable().optional(),
  budgetUsd: z.number().finite().nonnegative().optional(),
  actions: z.array(ActionSchema).optional(),
}).passthrough();

function expectedStatusesForRole(role: AgentRuntimeRole): readonly string[] {
  switch (role) {
    case "commander":
      return ["plan"];
    case "coder":
      return ["result"];
    case "reviewer":
    case "red_team":
      return ["pass", "object"];
    case "closeout":
      return ["ready", "not_ready"];
  }
}

export function parseAgentRuntimeRoleOutput(
  role: AgentRuntimeRole,
  rawOutput: string,
): ParsedAgentRuntimeRoleOutput {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawOutput);
  } catch {
    failClosed(
      4401,
      "agent_runtime_malformed_role_output",
      "AgentRuntime role output was not valid JSON.",
      { role, rawOutput: redactAgentChatContent(rawOutput) },
    );
  }

  const parsed = RoleOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    failClosed(
      4401,
      "agent_runtime_malformed_role_output",
      "AgentRuntime role output failed schema validation.",
      {
        role,
        issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      },
    );
  }

  const output = parsed.data;
  const allowed = expectedStatusesForRole(role);
  if (!allowed.includes(output.status)) {
    failClosed(
      4401,
      "agent_runtime_unexpected_role_status",
      "AgentRuntime role returned a status that is unsafe for its role.",
      { role, status: output.status, allowed },
    );
  }

  if (output.status === "object" && !output.objection) {
    failClosed(
      4401,
      "agent_runtime_objection_required",
      "AgentRuntime object status requires an objection.",
      { role },
    );
  }

  if (output.status !== "object" && output.objection) {
    failClosed(
      4401,
      "agent_runtime_unsafe_objection",
      "AgentRuntime objections are only allowed with object status.",
      { role, status: output.status },
    );
  }

  if (role === "closeout" && output.status === "ready" && !output.finalAnswer) {
    failClosed(
      4401,
      "agent_runtime_final_answer_required",
      "AgentRuntime closeout ready status requires finalAnswer.",
      { role },
    );
  }

  if (
    output.finalAnswer && !(role === "closeout" && output.status === "ready")
  ) {
    failClosed(
      4401,
      "agent_runtime_unsafe_final_answer",
      "AgentRuntime finalAnswer is only allowed on closeout ready status.",
      { role, status: output.status },
    );
  }
  if (role !== "coder" && output.actions?.length) {
    failClosed(
      4401,
      "agent_runtime_unsafe_actions",
      "Only coder may propose actions.",
      { role },
    );
  }

  return {
    status: output.status,
    content: redactAgentChatContent(output.content),
    objection: output.objection
      ? redactAgentChatContent(output.objection)
      : null,
    finalAnswer: output.finalAnswer
      ? redactAgentChatContent(output.finalAnswer)
      : null,
    budgetUsd: output.budgetUsd ?? 0,
    actions: (output.actions ?? []) as ParsedAgentRuntimeRoleOutput["actions"],
  };
}
