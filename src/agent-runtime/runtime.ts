import { errorMessage, failClosed, RouterError } from "../errors.ts";
import { redactAgentChatContent } from "../agent-chat/redaction.ts";
import type {
  AgentChatDecision,
  AgentChatMessage,
  AgentChatObjection,
  AgentChatPhase,
  AgentChatRole,
  AgentChatTranscript,
  AgentChatTurn,
} from "../agent-chat/types.ts";
import type {
  AgentBusEvent,
  AgentBusMessage,
  AgentBusStore,
} from "../agent-chat/bus/types.ts";
import { parseAgentRuntimeRoleOutput } from "./parser.ts";
import { buildAgentRuntimeRolePrompt } from "./prompts.ts";
import {
  AGENT_RUNTIME_ROLES,
  type AgentRuntimeBusIds,
  type AgentRuntimeConfig,
  agentRuntimeDescriptorMetadata,
  type AgentRuntimeLimits,
  type AgentRuntimeResult,
  type AgentRuntimeRole,
  type AgentRuntimeRoleBinding,
  DEFAULT_AGENT_RUNTIME_BUS_IDS,
  DEFAULT_AGENT_RUNTIME_LIMITS,
  type ParsedAgentRuntimeRoleOutput,
} from "./types.ts";

const ROLE_PHASE: Record<AgentRuntimeRole, AgentChatPhase> = {
  commander: "planning",
  coder: "coding",
  reviewer: "review",
  red_team: "red_team",
  closeout: "closeout",
};

const TRANSCRIPT_ROLE: Record<AgentRuntimeRole, AgentChatRole> = {
  commander: "planner",
  coder: "coder",
  reviewer: "reviewer",
  red_team: "red_team",
  closeout: "closeout",
};

const MESSAGE_ROUTE: Record<
  AgentRuntimeRole,
  { to: AgentRuntimeRole; messageType: AgentBusMessage["messageType"] }
> = {
  commander: { to: "coder", messageType: "task" },
  coder: { to: "reviewer", messageType: "result" },
  reviewer: { to: "commander", messageType: "objection" },
  red_team: { to: "commander", messageType: "objection" },
  closeout: { to: "commander", messageType: "closeout" },
};

function nowMs(): number {
  return Date.now();
}

function mergeBusIds(config: AgentRuntimeConfig): AgentRuntimeBusIds {
  if (!config.busIds?.teamId || !config.busIds.runId) {
    failClosed(
      4401,
      "agent_runtime_bus_ids_required",
      "AgentRuntime requires explicit per-run busIds.teamId and busIds.runId.",
      { missing: config.busIds?.teamId ? "runId" : "teamId" },
    );
  }
  return {
    teamId: config.busIds.teamId,
    runId: config.busIds.runId,
    roleAgentIds: {
      ...DEFAULT_AGENT_RUNTIME_BUS_IDS.roleAgentIds,
      ...config.busIds.roleAgentIds,
    },
  };
}

function normalizeAgentRuntimeLimits(
  input: Partial<AgentRuntimeLimits> = {},
): AgentRuntimeLimits {
  const maxTurns = input.maxTurns ?? DEFAULT_AGENT_RUNTIME_LIMITS.maxTurns;
  const maxDurationMs = input.maxDurationMs ??
    DEFAULT_AGENT_RUNTIME_LIMITS.maxDurationMs;
  const maxPromptChars = input.maxPromptChars ??
    DEFAULT_AGENT_RUNTIME_LIMITS.maxPromptChars;
  const maxRounds = input.maxRounds ?? DEFAULT_AGENT_RUNTIME_LIMITS.maxRounds;
  for (
    const [field, value] of Object.entries({
      maxTurns,
      maxDurationMs,
      maxPromptChars,
      maxRounds,
    })
  ) {
    if (!Number.isInteger(value) || Number(value) < 1) {
      failClosed(
        4400,
        "invalid_agent_runtime_limits",
        "AgentRuntime limits must be positive integers.",
        { field },
      );
    }
  }
  if (input.maxBudgetUsd !== undefined) {
    if (!Number.isFinite(input.maxBudgetUsd) || input.maxBudgetUsd < 0) {
      failClosed(
        4400,
        "invalid_agent_runtime_limits",
        "AgentRuntime budget limit must be finite and nonnegative.",
        { field: "maxBudgetUsd" },
      );
    }
  }
  return {
    maxTurns,
    maxDurationMs,
    maxPromptChars,
    maxRounds,
    ...(input.maxBudgetUsd === undefined
      ? {}
      : { maxBudgetUsd: input.maxBudgetUsd }),
  };
}

async function recordEvent(
  bus: AgentBusStore,
  ids: AgentRuntimeBusIds,
  eventType: string,
  role?: AgentRuntimeRole,
  payload: Record<string, unknown> = {},
): Promise<AgentBusEvent> {
  return await bus.recordEvent({
    teamId: ids.teamId,
    runId: ids.runId,
    ...(role === undefined ? {} : { agentId: ids.roleAgentIds[role] }),
    eventType,
    payload: {
      runtime: "agent_runtime",
      ...(role === undefined ? {} : { role }),
      ...payload,
    },
  });
}

async function failRuntime(
  bus: AgentBusStore | undefined,
  ids: AgentRuntimeBusIds | undefined,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
): Promise<never> {
  if (bus && ids) {
    await recordEvent(bus, ids, "agent_runtime.failed_closed", undefined, {
      code,
      ...details,
    });
  }
  failClosed(4401, code, message, details);
}

function requireConfig(config: AgentRuntimeConfig): void {
  if (
    config.enabled !== true ||
    (!config.execution && config.experimental !== true)
  ) {
    failClosed(
      4401,
      "agent_runtime_not_enabled",
      "Conversation AgentRuntime requires experimental=true; action execution requires an injected SafeLoop authority.",
      { enabled: config.enabled, experimental: config.experimental },
    );
  }
  if (!config.bus) {
    failClosed(
      4401,
      "agent_runtime_bus_required",
      "AgentRuntime requires an explicit AgentBusStore.",
    );
  }
}

async function validateRoleBindings(
  config: AgentRuntimeConfig,
  ids: AgentRuntimeBusIds,
): Promise<Map<AgentRuntimeRole, AgentRuntimeRoleBinding>> {
  const bindings = new Map<AgentRuntimeRole, AgentRuntimeRoleBinding>();
  for (const binding of config.roles) {
    if (bindings.has(binding.role)) {
      await failRuntime(
        config.bus,
        ids,
        "agent_runtime_duplicate_role",
        "AgentRuntime role bindings must be unique.",
        { role: binding.role },
      );
    }
    bindings.set(binding.role, binding);
  }
  for (const role of AGENT_RUNTIME_ROLES) {
    const binding = bindings.get(role);
    if (!binding || binding.required === false) {
      await failRuntime(
        config.bus,
        ids,
        "agent_runtime_required_role_missing",
        "AgentRuntime requires commander, coder, reviewer, red_team, and closeout role bindings.",
        { role },
      );
    }
  }
  return bindings;
}

function assertSignalNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    failClosed(
      4401,
      "agent_runtime_timeout",
      "AgentRuntime aborted before completion.",
    );
  }
}

async function invokeWithAbort(
  binding: AgentRuntimeRoleBinding,
  prompt: string,
  signal: AbortSignal,
): Promise<string> {
  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => {
      reject(
        new RouterError(
          4401,
          "agent_runtime_timeout",
          "AgentRuntime timed out or was aborted.",
        ),
      );
    };
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
  try {
    const output = await Promise.race([
      binding.adapter.invoke(prompt, signal),
      abortPromise,
    ]);
    return output.content;
  } finally {
    if (onAbort) {
      signal.removeEventListener("abort", onAbort);
    }
  }
}

function transcriptMessage(input: {
  role: AgentRuntimeRole;
  phase: AgentChatPhase;
  content: string;
  createdAtMs: number;
  turnIndex: number;
  binding: AgentRuntimeRoleBinding;
  status: string;
}): AgentChatTurn {
  const metadata = {
    runtimeRole: input.role,
    status: input.status,
    ...agentRuntimeDescriptorMetadata(input.binding.adapter.descriptor),
  };
  return {
    role: TRANSCRIPT_ROLE[input.role],
    phase: input.phase,
    content: redactAgentChatContent(input.content),
    createdAtMs: input.createdAtMs,
    redacted: true,
    metadata,
    turnIndex: input.turnIndex,
  };
}

function messageFromTurn(turn: AgentChatTurn): AgentChatMessage {
  return {
    role: turn.role,
    phase: turn.phase,
    content: turn.content,
    createdAtMs: turn.createdAtMs,
    redacted: turn.redacted,
    metadata: turn.metadata,
  };
}

function makeObjection(
  role: "reviewer" | "red_team",
  phase: "review" | "red_team",
  output: ParsedAgentRuntimeRoleOutput,
  createdAtMs: number,
  binding: AgentRuntimeRoleBinding,
): AgentChatObjection {
  return {
    role,
    phase,
    content: output.objection ?? output.content,
    createdAtMs,
    redacted: true,
    metadata: {
      runtimeRole: role,
      ...agentRuntimeDescriptorMetadata(binding.adapter.descriptor),
    },
  };
}

export async function runAgentRuntime(input: {
  prompt: string;
  config: AgentRuntimeConfig;
  signal?: AbortSignal;
}): Promise<AgentRuntimeResult> {
  requireConfig(input.config);
  const ids = mergeBusIds(input.config);
  const limits = normalizeAgentRuntimeLimits(input.config.limits);
  const maxPromptChars = limits.maxPromptChars ??
    DEFAULT_AGENT_RUNTIME_LIMITS.maxPromptChars;
  if (input.prompt.length > maxPromptChars) {
    await failRuntime(
      input.config.bus,
      ids,
      "agent_runtime_prompt_too_large",
      "AgentRuntime prompt exceeds maxPromptChars.",
      { maxPromptChars },
    );
  }
  const bindings = await validateRoleBindings(input.config, ids);
  const startedAtMs = nowMs();
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromParent, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), limits.maxDurationMs);

  const turns: AgentChatTurn[] = [];
  const transcriptMessages: AgentChatMessage[] = [];
  const objections: AgentChatObjection[] = [];
  const busMessages: AgentBusMessage[] = [];
  const busEvents: AgentBusEvent[] = [];
  const priorOutputs: Partial<
    Record<AgentRuntimeRole, ParsedAgentRuntimeRoleOutput>
  > = {};
  let budgetUsedUsd = 0;
  const receipts: AgentRuntimeResult["receipts"] = [];
  const artifacts: AgentRuntimeResult["artifacts"] = [];

  try {
    busEvents.push(
      await recordEvent(
        input.config.bus,
        ids,
        "agent_runtime.started",
        undefined,
        { promptChars: input.prompt.length },
      ),
    );

    const roleQueue: AgentRuntimeRole[] = [...AGENT_RUNTIME_ROLES];
    let fixRounds = 0;
    for (let roleIndex = 0; roleIndex < roleQueue.length; roleIndex++) {
      const role = roleQueue[roleIndex];
      assertSignalNotAborted(controller.signal);
      if (turns.length >= limits.maxTurns) {
        await failRuntime(
          input.config.bus,
          ids,
          "agent_runtime_max_turns_exceeded",
          "AgentRuntime max turns exceeded before required loop completed.",
          { maxTurns: limits.maxTurns, role },
        );
      }
      const binding = bindings.get(role)!;
      const phase = ROLE_PHASE[role];
      busEvents.push(
        await recordEvent(
          input.config.bus,
          ids,
          "agent_runtime.turn_started",
          role,
          { turn: turns.length + 1 },
        ),
      );
      const rolePrompt = buildAgentRuntimeRolePrompt({
        role,
        prompt: input.prompt,
        priorOutputs,
        reviewerPassed: priorOutputs.reviewer?.status === "pass",
        redTeamPassed: priorOutputs.red_team?.status === "pass",
      });
      if (rolePrompt.length > maxPromptChars) {
        await failRuntime(
          input.config.bus,
          ids,
          "agent_runtime_prompt_too_large",
          "AgentRuntime role prompt exceeds maxPromptChars.",
          { role, maxPromptChars, promptChars: rolePrompt.length },
        );
      }
      const parsed: ParsedAgentRuntimeRoleOutput = await (async () => {
        try {
          const raw = await invokeWithAbort(
            binding,
            rolePrompt,
            controller.signal,
          );
          return parseAgentRuntimeRoleOutput(role, raw);
        } catch (error) {
          if (error instanceof RouterError) {
            return await failRuntime(
              input.config.bus,
              ids,
              error.code,
              error.message,
              { role },
            );
          }
          return await failRuntime(
            input.config.bus,
            ids,
            "agent_runtime_adapter_failed",
            "AgentRuntime role adapter failed.",
            { role, cause: errorMessage(error) },
          );
        }
      })();

      priorOutputs[role] = parsed;
      if (role === "coder" && input.config.execution) {
        if (parsed.actions.length === 0) {
          await failRuntime(
            input.config.bus,
            ids,
            "agent_runtime_actions_required",
            "SafeLoop-backed coder output requires structured actions.",
          );
        }
        for (const proposal of parsed.actions) {
          try {
            const readiness = await input.config.execution.safeloop.readiness();
            if (!readiness.available) {
              throw new Error("SafeLoop authority is unavailable");
            }
            if (
              !["read_only", "repo_write", "shell_write"].includes(
                proposal.classification,
              )
            ) {
              throw new Error(
                `unsupported action classification: ${proposal.classification}`,
              );
            }
            const needed = proposal.classification === "repo_write"
              ? readiness.repoMutation
              : proposal.classification === "shell_write"
              ? readiness.shellMutation
              : undefined;
            if (needed && (!needed.supported || !needed.approvalPreflight)) {
              throw new Error(
                needed.reason ??
                  `SafeLoop capability unavailable: ${proposal.classification}`,
              );
            }
            const action = await input.config.execution.actionRunner.prepare(
              proposal,
            );
            try {
              const taskId = typeof input.config.execution.taskId === "function"
                ? input.config.execution.taskId(proposal)
                : input.config.execution.taskId;
              const runId = typeof input.config.execution.runId === "function"
                ? input.config.execution.runId(proposal, receipts.length)
                : input.config.execution.runId;
              const receipt = await input.config.execution.safeloop.execute({
                proposal,
                taskId,
                runId,
                repo: input.config.execution.repo,
                runRoot: input.config.execution.runRoot,
                argv: action.argv,
                policyVersion: input.config.execution.policyVersion,
                policyRef: input.config.execution.policyRef,
                requestedBy: input.config.execution.requestedBy,
                approvalResolver: input.config.execution.approvalResolver,
                expectedArtifactScope:
                  input.config.execution.expectedArtifactScope,
                timeoutSeconds: input.config.execution.timeoutSeconds,
                signal: controller.signal,
              });
              receipts.push(receipt);
              artifacts.push(...receipt.artifacts);
            } finally {
              await action.cleanup();
            }
          } catch (error) {
            await failRuntime(
              input.config.bus,
              ids,
              "agent_runtime_execution_failed",
              "AgentRuntime action execution failed closed.",
              { cause: errorMessage(error), actionId: proposal.id },
            );
          }
        }
      }
      budgetUsedUsd += parsed.budgetUsd;
      if (
        limits.maxBudgetUsd !== undefined && budgetUsedUsd > limits.maxBudgetUsd
      ) {
        await failRuntime(
          input.config.bus,
          ids,
          "agent_runtime_budget_exceeded",
          "AgentRuntime budget limit exceeded.",
          { role, budgetUsedUsd, maxBudgetUsd: limits.maxBudgetUsd },
        );
      }

      const createdAtMs = nowMs();
      const turn = transcriptMessage({
        role,
        phase,
        content: parsed.content,
        createdAtMs,
        turnIndex: turns.length,
        binding,
        status: parsed.status,
      });
      turns.push(turn);
      transcriptMessages.push(messageFromTurn(turn));

      const route = MESSAGE_ROUTE[role];
      const busMessage = await input.config.bus.sendMessage({
        teamId: ids.teamId,
        runId: ids.runId,
        fromAgentId: ids.roleAgentIds[role],
        toAgentId: ids.roleAgentIds[route.to],
        messageType: parsed.status === "object"
          ? "objection"
          : route.messageType,
        body: parsed.objection ?? parsed.finalAnswer ?? parsed.content,
        metadata: {
          runtime: "agent_runtime",
          role,
          status: parsed.status,
          descriptor: agentRuntimeDescriptorMetadata(
            binding.adapter.descriptor,
          ),
        },
      });
      busMessages.push(busMessage);
      busEvents.push(
        await recordEvent(
          input.config.bus,
          ids,
          "agent_runtime.turn_completed",
          role,
          { turn: turns.length, status: parsed.status },
        ),
      );

      if (role === "reviewer" && parsed.status === "pass") {
        busEvents.push(
          await recordEvent(
            input.config.bus,
            ids,
            "agent_runtime.review_passed",
            role,
          ),
        );
      }
      if (role === "red_team" && parsed.status === "pass") {
        busEvents.push(
          await recordEvent(
            input.config.bus,
            ids,
            "agent_runtime.red_team_passed",
            role,
          ),
        );
      }
      if (
        (role === "reviewer" || role === "red_team") &&
        parsed.status === "object"
      ) {
        const objection = makeObjection(
          role,
          phase as "review" | "red_team",
          parsed,
          createdAtMs,
          binding,
        );
        objections.push(objection);
        busEvents.push(
          await recordEvent(
            input.config.bus,
            ids,
            "agent_runtime.objection_raised",
            role,
            { objection: objection.content },
          ),
        );
        if (input.config.execution) {
          fixRounds++;
          if (fixRounds > limits.maxRounds) {
            await failRuntime(
              input.config.bus,
              ids,
              "agent_runtime_max_rounds_exceeded",
              "AgentRuntime objections exceeded max fix rounds.",
              { maxRounds: limits.maxRounds, role },
            );
          }
          roleQueue.splice(
            roleIndex + 1,
            roleQueue.length,
            "coder",
            "reviewer",
            "red_team",
            "closeout",
          );
        }
      }
    }

    const maybeCloseout = priorOutputs.closeout;
    if (!maybeCloseout) {
      await failRuntime(
        input.config.bus,
        ids,
        "agent_runtime_closeout_missing",
        "AgentRuntime closeout output missing.",
      );
    }
    const closeout = maybeCloseout as ParsedAgentRuntimeRoleOutput;
    const gatesPassed = priorOutputs.reviewer?.status === "pass" &&
      priorOutputs.red_team?.status === "pass";
    if (!gatesPassed && closeout.status === "ready") {
      await failRuntime(
        input.config.bus,
        ids,
        "agent_runtime_unsafe_closeout",
        "AgentRuntime closeout cannot be ready while objections are present.",
        {
          reviewer: priorOutputs.reviewer?.status,
          redTeam: priorOutputs.red_team?.status,
        },
      );
    }
    if (gatesPassed && closeout.status === "ready") {
      busEvents.push(
        await recordEvent(
          input.config.bus,
          ids,
          "agent_runtime.closeout_ready",
          "closeout",
        ),
      );
    }

    const completedAtMs = nowMs();
    const ready = gatesPassed && closeout.status === "ready" &&
      receipts.every((receipt) => receipt.status === "verified");
    const decision: AgentChatDecision = {
      decision: ready ? "ready" : "not_ready",
      reason: ready
        ? "AgentRuntime completed with reviewer and red_team pass."
        : "AgentRuntime completed but objections or closeout not_ready blocked readiness.",
      phase: "closeout",
      objections,
      closeout: {
        ready,
        summary: closeout.finalAnswer ?? closeout.content,
        createdAtMs: completedAtMs,
        redacted: true,
        metadata: { runtime: "agent_runtime", status: closeout.status },
      },
      metadata: {
        runtime: "agent_runtime",
        turns: turns.length,
        budgetUsedUsd,
      },
    };
    const transcript: AgentChatTranscript = {
      prompt: redactAgentChatContent(input.prompt),
      startedAtMs,
      completedAtMs,
      redacted: true,
      turns,
      messages: transcriptMessages,
      objections,
      decision,
      metadata: {
        runtime: "agent_runtime",
        mode: input.config.execution
          ? "safeloop_execution"
          : "read_only_conversation",
      },
    };
    return {
      ok: ready,
      decision,
      transcript,
      messages: busMessages,
      events: busEvents,
      receipts,
      artifacts,
      ...(ready && closeout.finalAnswer
        ? { finalAnswer: closeout.finalAnswer }
        : {}),
      runtimeSummary: {
        turns: turns.length,
        objections: objections.length,
        budgetUsedUsd,
        durationMs: completedAtMs - startedAtMs,
      },
    };
  } finally {
    clearTimeout(timeoutId);
    input.signal?.removeEventListener("abort", abortFromParent);
  }
}
