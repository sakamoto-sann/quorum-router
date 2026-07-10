import {
  discoverInventoryWithModelListing,
  invokableEntries,
} from "./auth_discovery.ts";
import { invokeSelected, runBestRoute } from "./best_route_runner.ts";
import { parseAuthMode, type ProviderResult } from "./schema.ts";
import { score } from "./trace.ts";
import { readRouterEnv } from "./env.ts";

type BridgeRequest = {
  operation: "health" | "route_once" | "best_route";
  prompt?: string;
};

const MAX_INPUT_BYTES = 120_000;
const MAX_RESPONSE_CHARS = 24_000;

function emit(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload));
}

export function boundedContent(content: string): {
  content: string;
  truncated: boolean;
} {
  if (content.length <= MAX_RESPONSE_CHARS) {
    return { content, truncated: false };
  }
  return {
    content: content.slice(0, MAX_RESPONSE_CHARS),
    truncated: true,
  };
}

async function readRequest(): Promise<BridgeRequest> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for await (const chunk of Deno.stdin.readable) {
    totalBytes += chunk.byteLength;
    if (totalBytes > MAX_INPUT_BYTES) {
      throw new Error("quorum-router Hermes bridge input exceeds 120000 bytes");
    }
    chunks.push(chunk);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(raw) as Partial<BridgeRequest>;
  if (
    !["health", "route_once", "best_route"].includes(parsed.operation ?? "")
  ) {
    throw new Error("quorum-router Hermes bridge operation is invalid");
  }
  if (parsed.operation !== "health" && !parsed.prompt?.trim()) {
    throw new Error("quorum-router Hermes bridge prompt is required");
  }
  return parsed as BridgeRequest;
}

function selectedResult(results: ProviderResult[]): ProviderResult {
  const ranked = results.map((result) => ({ result, row: score(result) }))
    .sort((a, b) => b.row.final_score - a.row.final_score);
  if (!ranked[0]) throw new Error("quorum-router returned no provider result");
  return ranked[0].result;
}

async function main(): Promise<void> {
  const request = await readRequest();
  if (request.operation === "health") {
    const authMode = parseAuthMode(readRouterEnv("QUORUM_ROUTER_AUTH_MODE"));
    const inventory = await discoverInventoryWithModelListing(authMode);
    const providers = inventory.entries.map((entry) => ({
      provider: entry.provider,
      model: entry.model,
      source: entry.source,
      available: entry.available,
      can_invoke: entry.can_invoke,
      blocked_reason: entry.blocked_reason,
    }));
    emit({
      ok: true,
      operation: "health",
      auth_mode: authMode,
      available_count: inventory.available_count,
      invokable_count: invokableEntries(inventory).length,
      providers,
      external_model_call_sent: false,
    });
    return;
  }

  const prompt = request.prompt!.trim();
  const routed = request.operation === "route_once"
    ? await invokeSelected(prompt)
    : await runBestRoute(prompt);
  const selected = selectedResult(routed.results);
  const bounded = boundedContent(selected.raw_content);
  emit({
    ok: true,
    operation: request.operation,
    provider: selected.provider,
    model: selected.model,
    content: bounded.content,
    truncated: bounded.truncated,
    candidates_called: routed.results.length,
    trace_path: routed.tracePath,
    schema_valid: routed.results.every((result) => result.schema_valid),
  });
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    emit({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    Deno.exit(1);
  }
}
