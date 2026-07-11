import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_discovery.ts";
import { callEnvFallback } from "./env_fallback_client.ts";
import { readRouterEnv } from "./env.ts";
import { selectInvokableCandidates } from "./best_route_runner.ts";
import { redact, summarize } from "./redact.ts";
import {
  assertAgentChatOptIn,
  assertOptIn,
  type ModelInventoryEntry,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { buildTrace, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";

const DEFAULT_MAX_TURNS = 6;
const MAX_ALLOWED_TURNS = 12;
const MAX_TRANSCRIPT_CHARS = 12_000;

export type AgentChatTurn = {
  round: number;
  provider: string;
  model: string;
  reply_to?: { provider: string; model: string; round: number };
  content: string;
};

function maxTurns(): number {
  const raw = readRouterEnv("QUORUM_ROUTER_AGENT_CHAT_MAX_TURNS")?.trim();
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
  return candidates.filter((candidate) => {
    const identity =
      `${candidate.provider.toLowerCase()}/${candidate.model.toLowerCase()}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
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
  return [
    "You are participating in a bounded cross-model Agent Chat initiated by Hermes Agent.",
    `You are ${args.speaker.provider}/${args.speaker.model}.`,
    `The other participant is ${args.peer.provider}/${args.peer.model}.`,
    `This is round ${args.round} of ${args.totalRounds}.`,
    "Read the prior transcript and respond directly to the other model's latest argument.",
    "Disagree when warranted, explain why, revise when persuaded, and move toward a concrete conclusion.",
    "Do not impersonate the other model. Do not add speaker labels. Keep the response under 900 characters.",
    "",
    `USER TASK:\n${args.originalPrompt}`,
    "",
    `PRIOR TRANSCRIPT:\n${transcriptText(args.turns) || "No prior turns."}`,
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
): Promise<
  { tracePath: string; turns: AgentChatTurn[]; agents: ModelInventoryEntry[] }
> {
  assertAgentChatOptIn();
  assertOptIn();
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const inventory = await discoverInventoryWithModelListing(authMode);
  const candidatePool = distinctAgents(
    selectInvokableCandidates(invokableEntries(inventory)),
  );
  if (candidatePool.length < 2) {
    throw new Error(
      "QuorumRouter blocked: live agent-chat requires at least two distinct invokable provider/model identities",
    );
  }

  const rounds = maxTurns();
  const agents: ModelInventoryEntry[] = [];
  const turns: AgentChatTurn[] = [];
  const results: ProviderResult[] = [];
  const errors: string[] = [];

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
        const peer = agents.at(-1) ?? unused.find((entry) =>
          entry !== candidate
        ) ?? candidate;
        try {
          selectedResult = await invoke(
            candidate,
            turnPrompt({
              originalPrompt: prompt,
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
          originalPrompt: prompt,
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
    const previous = turns.at(-1);
    const content = summarize(redact(result.raw_content), 900);
    turns.push({
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
    });
    results.push({
      ...result,
      raw_content: content,
      response_summary: content,
    });
  }

  const trace = await buildTrace({
    command: "agent-chat",
    mode: "agent_chat",
    authMode,
    prompt,
    results,
    errors,
    agentChat: true,
  });
  const tracePath = await writeTrace("agent-chat-trace", trace);
  return { tracePath, turns, agents };
}
