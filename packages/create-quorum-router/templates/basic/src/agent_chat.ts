import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_session.ts";
import { callEnvFallback } from "./auth_env_fallback.ts";
import { preparePromptWithContext } from "./context.ts";
import { readRouterEnv } from "./env.ts";
import { redact, summarize } from "./redact.ts";
import { readProviderSelectionRequest } from "./provider_registry.ts";
import {
  type AgentChatTurn,
  assertAgentChatOptIn,
  assertOptIn,
  type ModelInventoryEntry,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { selectInvokableCandidates, selectionHonored } from "./best_route.ts";
import { buildTrace, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";

const DEFAULT_MAX_TURNS = 6;
const MAX_ALLOWED_TURNS = 12;
const MAX_TRANSCRIPT_CHARS = 12_000;

export type AgentChatProgress =
  | { type: "start"; agents: Array<{ provider: string; model: string }> }
  | { type: "turn"; turn: AgentChatTurn }
  | { type: "complete"; turnCount: number };

function maxTurns(): number {
  const raw = Deno.env.get("QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS")?.trim();
  if (!raw) return DEFAULT_MAX_TURNS;
  const parsed = Number(raw);
  if (
    !Number.isSafeInteger(parsed) || parsed < 2 || parsed > MAX_ALLOWED_TURNS
  ) {
    throw new Error(
      `QuorumRouter blocked: QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS must be an integer from 2 to ${MAX_ALLOWED_TURNS}`,
    );
  }
  return parsed;
}

function distinctAgents(
  candidates: ModelInventoryEntry[],
): ModelInventoryEntry[] {
  const seen = new Set<string>();
  const distinct: ModelInventoryEntry[] = [];
  for (const candidate of candidates) {
    const identity =
      `${candidate.provider.toLowerCase()}/${candidate.model.toLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    distinct.push(candidate);
  }
  return distinct;
}

function transcriptText(turns: AgentChatTurn[]): string {
  const text = turns.map((turn) =>
    `Round ${turn.round} — ${turn.provider}/${turn.model}${
      turn.reply_to
        ? ` replying to ${turn.reply_to.provider}/${turn.reply_to.model}`
        : ""
    }:\n${turn.content}`
  ).join("\n\n");
  return text.length <= MAX_TRANSCRIPT_CHARS
    ? text
    : text.slice(text.length - MAX_TRANSCRIPT_CHARS);
}

function turnPrompt(args: {
  originalPrompt: string;
  turns: AgentChatTurn[];
  speaker: ModelInventoryEntry;
  peer: ModelInventoryEntry;
  round: number;
  totalRounds: number;
}): string {
  const prior = transcriptText(args.turns) || "No prior turns.";
  return [
    "You are participating in a bounded cross-model Agent Chat.",
    `You are ${args.speaker.provider}/${args.speaker.model}.`,
    `The other participant is ${args.peer.provider}/${args.peer.model}.`,
    `This is round ${args.round} of ${args.totalRounds}.`,
    "This is a text-only discussion. Do not use tools, inspect files, run commands, or modify the workspace.",
    "Read the prior transcript. Respond directly to the other model's latest argument.",
    "Disagree when warranted, explain why, revise your position when persuaded, and move toward a concrete conclusion.",
    "Do not impersonate the other model. Do not add speaker labels. Keep the response under 900 characters.",
    "",
    `USER TASK:\n${args.originalPrompt}`,
    "",
    `PRIOR TRANSCRIPT:\n${prior}`,
  ].join("\n");
}

async function invoke(
  candidate: ModelInventoryEntry,
  prompt: string,
): Promise<ProviderResult> {
  return candidate.source === "env_fallback"
    ? await callEnvFallback(prompt)
    : await callWrapper(candidate, prompt);
}

export async function runAgentChat(
  prompt: string,
  onProgress?: (progress: AgentChatProgress) => void,
): Promise<{ tracePath: string; turns: AgentChatTurn[] }> {
  assertAgentChatOptIn();
  assertOptIn();
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const request = readProviderSelectionRequest();
  const inventory = await discoverInventoryWithModelListing(authMode, request);
  const candidates = selectInvokableCandidates(
    invokableEntries(inventory),
    authMode,
    request,
    inventory.entries,
  );
  const candidatePool = distinctAgents(candidates);
  if (candidatePool.length < 2) {
    throw new Error(
      "QuorumRouter blocked: live agent-chat requires at least two distinct invokable provider/model identities. Run `deno task models:list` and authenticate a second provider.",
    );
  }
  if (!candidatePool.every((agent) => selectionHonored(request, agent))) {
    throw new Error(
      "QuorumRouter blocked: agent-chat provider selection was not honored",
    );
  }

  const prepared = await preparePromptWithContext(prompt);
  const rounds = maxTurns();
  const agents: ModelInventoryEntry[] = [];
  const turns: AgentChatTurn[] = [];
  const results: ProviderResult[] = [];
  const errors: string[] = [];
  let announced = false;
  const announce = () => {
    if (announced || agents.length < 2) return;
    announced = true;
    onProgress?.({
      type: "start",
      agents: agents.map(({ provider, model }) => ({ provider, model })),
    });
    for (const turn of turns) onProgress?.({ type: "turn", turn });
  };

  for (let index = 0; index < rounds; index += 1) {
    let speaker: ModelInventoryEntry;
    let result: ProviderResult;
    if (agents.length < 2) {
      const unused = candidatePool.filter((candidate) =>
        !agents.some((agent) =>
          agent.provider === candidate.provider &&
          agent.model === candidate.model
        )
      );
      let selected: ModelInventoryEntry | undefined;
      let selectedResult: ProviderResult | undefined;
      for (const candidate of unused) {
        const peer = agents.at(-1) ??
          unused.find((entry) => entry !== candidate) ?? candidate;
        try {
          selectedResult = await invoke(
            candidate,
            turnPrompt({
              originalPrompt: prepared.prompt,
              turns,
              speaker: candidate,
              peer,
              round: index + 1,
              totalRounds: rounds,
            }),
          );
          selected = candidate;
          break;
        } catch (error) {
          errors.push(
            `${candidate.provider}/${candidate.model}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      if (!selected || !selectedResult) {
        throw new Error(
          `QuorumRouter blocked: could not establish two working Agent Chat participants: ${
            errors.join("; ")
          }`,
        );
      }
      agents.push(selected);
      speaker = selected;
      result = selectedResult;
    } else {
      speaker = agents[index % agents.length];
      const peer = agents[(index + 1) % agents.length];
      result = await invoke(
        speaker,
        turnPrompt({
          originalPrompt: prepared.prompt,
          turns,
          speaker,
          peer,
          round: index + 1,
          totalRounds: rounds,
        }),
      );
    }
    if (
      result.provider !== speaker.provider || result.model !== speaker.model
    ) {
      throw new Error(
        `QuorumRouter blocked: agent identity changed during dialogue (expected=${speaker.provider}/${speaker.model} actual=${result.provider}/${result.model})`,
      );
    }
    const content = summarize(redact(result.raw_content), 900);
    const previous = turns.at(-1);
    const turn: AgentChatTurn = {
      round: index + 1,
      provider: result.provider,
      model: result.model,
      reply_to: previous
        ? {
          provider: previous.provider,
          model: previous.model,
          round: previous.round,
        }
        : undefined,
      content,
    };
    const alreadyAnnounced = announced;
    turns.push(turn);
    results.push({
      ...result,
      raw_content: content,
      response_summary: content,
    });
    announce();
    if (alreadyAnnounced) onProgress?.({ type: "turn", turn });
  }

  const trace = await buildTrace({
    command: "agent-chat",
    mode: "agent_chat",
    authMode,
    prompt: prepared.prompt,
    promptContext: prepared.context,
    results,
    agentChat: true,
    agentChatTurns: turns,
    errors,
    providerSelectionHonored: true,
    fallbackUsed: agents.some((agent) => agent.source === "env_fallback"),
  });
  const tracePath = await writeTrace("agent-chat-trace", trace);
  onProgress?.({ type: "complete", turnCount: turns.length });
  return { tracePath, turns };
}
