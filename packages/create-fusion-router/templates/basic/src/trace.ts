import type {
  AuthMode,
  DogfoodTrace,
  PromptContextTrace,
  ProviderResult,
  ScoreRow,
} from "./schema.ts";
import { redactionOk, summarize } from "./redact.ts";

export const OUT_DIR = "out";

export function boundaries(agentChat = false): string[] {
  return [
    "deno task intake is the first real setup command before launch",
    "deno task smoke is fixture-only and not real provider dogfood",
    "Best Route/direct remains production-ready best-answer routing",
    agentChat
      ? "agent_chat experimental explicit opt-in only"
      : "agent_chat remains experimental explicit opt-in only",
    "no production autonomous runtime",
    "no live Supabase Agent Bus runtime writes",
    "no service-role runtime",
  ];
}

export async function promptHash(prompt: string): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(prompt),
  );
  return Array.from(new Uint8Array(bytes)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export function score(result: ProviderResult): ScoreRow {
  const text = result.response_summary;
  const clarity = text.length > 20 ? 4 : 2;
  const completeness = text.length > 120 ? 4 : 3;
  const risk =
    /secret|token|password|launch now|production autonomous/i.test(text)
      ? 1
      : 5;
  const instruction_fit = result.schema_valid && result.response_received
    ? 4
    : 1;
  const final_score = clarity + completeness + risk + instruction_fit;
  return {
    provider: result.provider,
    model: result.model,
    schema_valid: result.schema_valid,
    response_received: result.response_received,
    clarity,
    completeness,
    risk,
    instruction_fit,
    final_score,
  };
}

export async function buildTrace(args: {
  command: string;
  mode: DogfoodTrace["mode"];
  authMode: AuthMode;
  prompt?: string;
  promptContext?: PromptContextTrace;
  results?: ProviderResult[];
  selected?: ScoreRow;
  scores?: ScoreRow[];
  errors?: string[];
  agentChat?: boolean;
  requestedProviderLabel?: string;
  requestedModel?: string;
  providerSelectionHonored?: boolean;
  fallbackUsed?: boolean;
}): Promise<DogfoodTrace> {
  const responseSummary = args.results?.map((r) =>
    `[${r.provider}/${r.model}] ${r.response_summary}`
  ).join("\n");
  const trace: DogfoodTrace = {
    run_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    command: args.command,
    mode: args.mode,
    auth_mode: args.authMode,
    provider: args.selected?.provider ?? args.results?.[0]?.provider,
    model: args.selected?.model ?? args.results?.[0]?.model,
    requested_provider_label: args.requestedProviderLabel,
    requested_model: args.requestedModel,
    selected_provider: args.selected?.provider ?? args.results?.[0]?.provider,
    selected_model: args.selected?.model ?? args.results?.[0]?.model,
    provider_selection_honored: args.providerSelectionHonored ?? true,
    fallback_used: args.fallbackUsed ?? false,
    prompt_hash: args.prompt ? await promptHash(args.prompt) : undefined,
    prompt_summary: args.prompt ? summarize(args.prompt, 160) : undefined,
    prompt_context: args.promptContext,
    response_summary: responseSummary
      ? summarize(responseSummary, 800)
      : undefined,
    schema_valid: args.results
      ? args.results.every((r) => r.schema_valid)
      : true,
    redaction_ok: false,
    credential_value_present: false,
    sensitive_value_present: false,
    selected_route: args.selected
      ? {
        provider: args.selected.provider,
        model: args.selected.model,
        final_score: args.selected.final_score,
      }
      : undefined,
    score_table: args.scores,
    errors: args.errors ?? [],
    boundaries: boundaries(args.agentChat),
  };
  trace.redaction_ok = redactionOk(trace);
  return trace;
}

export async function writeTrace(
  name: string,
  trace: DogfoodTrace,
): Promise<string> {
  if (!trace.redaction_ok || !redactionOk(trace)) {
    throw new Error(
      "Fusion Router blocked: refusing to write trace that failed redaction checks",
    );
  }
  await Deno.mkdir(OUT_DIR, { recursive: true });
  const path = `${OUT_DIR}/${name}.json`;
  await Deno.writeTextFile(path, `${JSON.stringify(trace, null, 2)}\n`, {
    mode: 0o600,
  });
  await Deno.chmod(path, 0o600).catch(() => undefined);
  return path;
}
