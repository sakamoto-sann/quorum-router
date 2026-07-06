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
    const content = (fileOutput || stdout || stderr).trim();
    if (!content) {
      throw new Error(
        `Fusion Router blocked: ${entry.provider}/${entry.model} returned empty stdout`,
      );
    }
    return {
      provider: entry.provider,
      model: entry.model,
      response_received: true,
      schema_valid: true,
      response_summary: summarize(content),
      raw_content: content,
    };
  } finally {
    await Deno.remove(outPath).catch(() => undefined);
  }
}
