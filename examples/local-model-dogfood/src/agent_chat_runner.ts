import { discoverInventory, invokableEntries } from "./auth_discovery.ts";
import { callEnvFallback } from "./env_fallback_client.ts";
import { readRouterEnv } from "./env.ts";
import {
  assertAgentChatOptIn,
  assertOptIn,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { buildTrace, score, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";

export async function runAgentChat(
  prompt: string,
): Promise<{ tracePath: string }> {
  assertAgentChatOptIn();
  assertOptIn();
  const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
  const inventory = discoverInventory(authMode);
  const candidates = invokableEntries(inventory);
  if (candidates.length === 0) {
    throw new Error(
      "Local real model dogfood still blocked: agent-chat has no available invokable models",
    );
  }
  const selected = candidates[0];
  const agentPrompt =
    `Experimental agent_chat review. Label this as experimental and keep concise. Prompt: ${prompt}`;
  const result: ProviderResult = selected.source === "env_fallback"
    ? await callEnvFallback(agentPrompt)
    : await callWrapper(selected, agentPrompt);
  const row = score(result);
  const trace = await buildTrace({
    command: "agent-chat",
    mode: "agent_chat",
    authMode,
    prompt,
    results: [result],
    selected: row,
    scores: [row],
    agentChat: true,
  });
  const tracePath = await writeTrace("agent-chat-trace", trace);
  return { tracePath };
}
