import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_session.ts";
import { callEnvFallback } from "./auth_env_fallback.ts";
import {
  assertAgentChatOptIn,
  assertOptIn,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { buildTrace, score, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";
import { selectInvokableCandidates } from "./best_route.ts";

export async function runAgentChat(
  prompt: string,
): Promise<{ tracePath: string }> {
  assertAgentChatOptIn();
  assertOptIn();
  const safePrompt = prompt.slice(0, 4000);
  const authMode = parseAuthMode(Deno.env.get("FUSION_ROUTER_AUTH_MODE"));
  const inventory = await discoverInventoryWithModelListing(authMode);
  const candidates = selectInvokableCandidates(
    invokableEntries(inventory),
    authMode,
  );
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. agent-chat has no usable provider and remains experimental explicit opt-in only. Next: deno task auth:login",
    );
  }
  const selected = candidates[0];
  const agentPrompt =
    `Experimental agent_chat review. Label this as experimental and keep concise. Prompt: ${safePrompt}`;
  const result: ProviderResult = selected.source === "env_fallback"
    ? await callEnvFallback(agentPrompt)
    : await callWrapper(selected, agentPrompt);
  const row = score(result);
  const trace = await buildTrace({
    command: "agent-chat",
    mode: "agent_chat",
    authMode,
    prompt: safePrompt,
    results: [result],
    selected: row,
    scores: [row],
    agentChat: true,
  });
  const tracePath = await writeTrace("agent-chat-trace", trace);
  return { tracePath };
}
