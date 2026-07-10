import { redact, summarize } from "./redact.ts";
import type { ProviderResult } from "./schema.ts";
import { readRouterEnv } from "./env.ts";

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`local model dogfood blocked: missing ${name}`);
  return value;
}

export function chatCompletionsUrl(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(
      "local model dogfood blocked: QUORUM_ROUTER_PROVIDER_BASE_URL must be a valid URL",
    );
  }
  if (url.pathname.endsWith("/chat/completions")) return url.toString();
  url.pathname = `${url.pathname.replace(/\/$/, "")}/chat/completions`;
  return url.toString();
}

export async function callEnvFallback(prompt: string): Promise<ProviderResult> {
  const baseUrl = requiredEnv("QUORUM_ROUTER_PROVIDER_BASE_URL");
  const credential = requiredEnv("QUORUM_ROUTER_PROVIDER_API_KEY");
  const model = requiredEnv("QUORUM_ROUTER_PROVIDER_MODEL");
  const provider = readRouterEnv("QUORUM_ROUTER_PROVIDER_LABEL")?.trim() ||
    "OpenAI-compatible env fallback";
  const response = await fetch(chatCompletionsUrl(baseUrl), {
    method: "POST",
    signal: AbortSignal.timeout(120_000),
    headers: {
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });
  if (!response.ok) {
    const body = redact(await response.text().catch(() => ""), [credential]);
    throw new Error(
      `local model dogfood blocked: env fallback HTTP ${response.status}${
        body ? `: ${body.slice(0, 300)}` : ""
      }`,
    );
  }
  const json = await response.json() as {
    choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
  };
  const content = json.choices?.[0]?.message?.content ??
    json.choices?.[0]?.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error(
      "local model dogfood blocked: env fallback returned unexpected response shape",
    );
  }
  return {
    provider,
    model,
    response_received: true,
    schema_valid: true,
    response_summary: summarize(content),
    raw_content: content,
  };
}
