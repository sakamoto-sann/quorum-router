import type { ModelInventoryEntry, ProviderResult } from "./schema.ts";
import { redact, summarize } from "./redact.ts";

export function buildWrapperArgs(
  entry: ModelInventoryEntry,
  prompt: string,
  outPath: string,
): string[] {
  const args = (entry.args_template ?? []).map((arg) =>
    arg === "__PROMPT__"
      ? prompt
      : arg === "__CWD__"
      ? Deno.cwd()
      : arg === "__OUT__"
      ? outPath
      : arg
  );
  if (entry.command === "grok" && entry.invocation_model) {
    if (entry.invocation_model === "grok-build") {
      const withoutPlanMode: string[] = [];
      for (let index = 0; index < args.length; index += 1) {
        if (args[index] === "--permission-mode" && args[index + 1] === "plan") {
          index += 1;
          continue;
        }
        withoutPlanMode.push(args[index]);
      }
      return [
        "--model",
        entry.invocation_model,
        ...withoutPlanMode,
        "--permission-mode",
        "bypassPermissions",
        "--deny",
        "*",
        "--no-subagents",
      ];
    }
    return ["--model", entry.invocation_model, ...args];
  }
  return args;
}

async function outputWithTimeout(
  child: Deno.ChildProcess,
  timeoutMs: number,
): Promise<Deno.CommandOutput> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let killId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      child.output(),
      new Promise<Deno.CommandOutput>((_, reject) => {
        timeoutId = setTimeout(() => {
          try {
            child.kill("SIGTERM");
          } catch { /* best effort */ }
          killId = setTimeout(() => {
            try {
              child.kill("SIGKILL");
            } catch { /* best effort */ }
            reject(
              new Error(
                "Fusion Router blocked: wrapper timed out after 120000ms",
              ),
            );
          }, 2_000);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (killId) clearTimeout(killId);
  }
}

function safeWrapperEnv(): Record<string, string> {
  const allowed = [
    "PATH",
    "HOME",
    "TMPDIR",
    "TMP",
    "TEMP",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "LANG",
    "LC_ALL",
    "TERM",
  ];
  const env: Record<string, string> = {};
  for (const name of allowed) {
    const value = Deno.env.get(name);
    if (value) env[name] = value;
  }
  return env;
}

const SHARED_RUNTIME_NOISE = [
  /AuthRequiredError/i,
  /rmcp::transport::worker/i,
];

const FATAL_CLI_NOISE = [
  ...SHARED_RUNTIME_NOISE,
  /authentication required/i,
  /not logged in/i,
  /^ERROR\s/mi,
];

const BANNER_OR_RUNTIME_LINE = [
  ...SHARED_RUNTIME_NOISE,
  /^Reading additional input from stdin\.?$/i,
  /^OpenAI Codex v\S+/i,
  /^ERROR\s/i,
];

function stripRuntimeNoise(text: string): string {
  return text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return !BANNER_OR_RUNTIME_LINE.some((pattern) => pattern.test(trimmed));
  }).join("\n").trim();
}

export function extractUsableWrapperContent(args: {
  provider: string;
  model: string;
  fileOutput: string;
  stdout: string;
  stderr: string;
}): string {
  const diagnosticSurface = args.stderr;
  const fatal = FATAL_CLI_NOISE.find((pattern) =>
    pattern.test(diagnosticSurface)
  );
  if (fatal) {
    throw new Error(
      `Fusion Router blocked: ${args.provider}/${args.model} emitted CLI runtime/auth error noise`,
    );
  }

  for (const candidate of [args.fileOutput, args.stdout]) {
    const cleaned = stripRuntimeNoise(candidate);
    if (cleaned.length > 0) return cleaned;
  }

  throw new Error(
    `Fusion Router blocked: ${args.provider}/${args.model} returned no usable model answer after sanitizing CLI banner/runtime output`,
  );
}

export async function callWrapper(
  entry: ModelInventoryEntry,
  prompt: string,
): Promise<ProviderResult> {
  if (!entry.command) {
    throw new Error(
      `Fusion Router blocked: ${entry.provider} has no command`,
    );
  }
  await Deno.mkdir("out", {
    recursive: true,
  });
  const outPath = `out/tmp-${crypto.randomUUID()}.txt`;
  try {
    const child = new Deno.Command(entry.command, {
      args: buildWrapperArgs(entry, prompt, outPath),
      cwd: Deno.cwd(),
      clearEnv: true,
      env: safeWrapperEnv(),
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const output = await outputWithTimeout(child, 120_000);
    const stdout = new TextDecoder().decode(output.stdout);
    const stderr = new TextDecoder().decode(output.stderr);
    const fileOutput = await Deno.readTextFile(outPath).catch(() => "");
    if (output.code !== 0) {
      throw new Error(
        `Fusion Router blocked: ${entry.provider}/${entry.model} exited ${output.code}: ${
          summarize(redact(stderr || stdout || fileOutput), 400)
        }`,
      );
    }
    const content = extractUsableWrapperContent({
      provider: entry.provider,
      model: entry.model,
      fileOutput,
      stdout,
      stderr,
    });
    return {
      provider: entry.provider,
      model: entry.model,
      model_id: entry.model_id,
      source: entry.source,
      command: entry.command,
      listed_models: entry.listed_models,
      response_received: true,
      schema_valid: true,
      response_summary: summarize(content),
      raw_content: content,
    };
  } finally {
    await Deno.remove(outPath).catch(() => undefined);
  }
}
