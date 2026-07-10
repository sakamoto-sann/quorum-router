import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_session.ts";
import { callEnvFallback } from "./auth_env_fallback.ts";
import { readRouterEnv } from "./env.ts";
import {
  assertAgentChatOptIn,
  assertOptIn,
  parseAuthMode,
  type ProviderResult,
} from "./schema.ts";
import { buildTrace, score, writeTrace } from "./trace.ts";
import { callWrapper } from "./wrapper_client.ts";
import { selectInvokableCandidates, selectionHonored } from "./best_route.ts";
import { readProviderSelectionRequest } from "./provider_registry.ts";
import { preparePromptWithContext } from "./context.ts";

export async function runAgentChat(
  prompt: string,
): Promise<{ tracePath: string }> {
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
  if (candidates.length === 0) {
    throw new Error(
      "OAuth/session-first provider unavailable. agent-chat has no usable provider and remains experimental explicit opt-in only. Next: deno task auth:login",
    );
  }
  const prepared = await preparePromptWithContext(prompt);
  const safePrompt = prepared.prompt;
  const selected = candidates[0];
  if (!selectionHonored(request, selected)) {
    throw new Error(
      `QuorumRouter blocked: agent-chat provider selection was not honored (selected=${selected.provider}/${selected.model})`,
    );
  }
  const agentPrompt =
    `Experimental agent_chat review. Label this as experimental and keep concise. Prompt: ${safePrompt}`;
  const result: ProviderResult = selected.source === "env_fallback"
    ? await callEnvFallback(agentPrompt)
    : await callWrapper(selected, agentPrompt);
  if (!selectionHonored(request, result)) {
    throw new Error(
      `QuorumRouter blocked: agent-chat provider selection was ignored after invocation (selected=${result.provider}/${result.model})`,
    );
  }
  const row = score(result);
  const trace = await buildTrace({
    command: "agent-chat",
    mode: "agent_chat",
    authMode,
    prompt: safePrompt,
    promptContext: prepared.context,
    results: [result],
    selected: row,
    scores: [row],
    requestedProviderLabel: request.providerLabel,
    requestedModel: request.model,
    providerSelectionHonored: selectionHonored(request, result),
    fallbackUsed: selected.source === "env_fallback",
    agentChat: true,
  });
  const tracePath = await writeTrace("agent-chat-trace", trace);
  return { tracePath };
}
