import { callEnvFallback } from "./auth_env_fallback.ts";
import type { ModelInventoryEntry, ProviderResult } from "./schema.ts";
import { callWrapper } from "./wrapper_client.ts";

export async function callProvider(
  entry: ModelInventoryEntry,
  prompt: string,
): Promise<ProviderResult> {
  return entry.source === "env_fallback"
    ? await callEnvFallback(prompt)
    : await callWrapper(entry, prompt);
}
