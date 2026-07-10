import type { ActionProposal } from "./execution.ts";

export type PreparedAction = { argv: string[]; cleanup(): Promise<void> };
export interface ActionRunner {
  prepare(proposal: ActionProposal): Promise<PreparedAction>;
}

export type RepoActionRunnerOptions = {
  worker?: string;
  commandAllowlist?: string[][];
  maxFileBytes?: number;
  maxContentBytes?: number;
  maxOutputBytes?: number;
  timeoutMs?: number;
};

type RunnerPayload = {
  schemaVersion: "quorum-router.repo-action.v1";
  repoRoot: string;
  proposal: ActionProposal;
  commandAllowlist: string[][];
  limits: {
    maxFileBytes: number;
    maxContentBytes: number;
    maxOutputBytes: number;
    timeoutMs: number;
  };
};

export class RepoActionRunner implements ActionRunner {
  readonly #repoRoot: string;
  readonly #worker: string;
  readonly #allowlist: string[][];
  readonly #limits: RunnerPayload["limits"];

  private constructor(repoRoot: string, input: RepoActionRunnerOptions) {
    this.#repoRoot = repoRoot;
    this.#worker = input.worker ??
      new URL("./repo-action-worker.ts", import.meta.url).pathname;
    this.#allowlist = (input.commandAllowlist ?? []).map((argv) => [...argv]);
    this.#limits = {
      maxFileBytes: input.maxFileBytes ?? 1024 * 1024,
      maxContentBytes: input.maxContentBytes ?? 1024 * 1024,
      maxOutputBytes: input.maxOutputBytes ?? 256 * 1024,
      timeoutMs: input.timeoutMs ?? 30_000,
    };
  }

  static async create(
    repoRoot: string,
    input: RepoActionRunnerOptions = {},
  ): Promise<RepoActionRunner> {
    return new RepoActionRunner(await Deno.realPath(repoRoot), input);
  }

  async prepare(proposal: ActionProposal): Promise<PreparedAction> {
    const tempDir = await Deno.makeTempDir({ prefix: "quorum-router-action-" });
    const payloadPath = `${tempDir}/action.json`;
    const payload: RunnerPayload = {
      schemaVersion: "quorum-router.repo-action.v1",
      repoRoot: this.#repoRoot,
      proposal,
      commandAllowlist: this.#allowlist,
      limits: this.#limits,
    };
    const payloadText = JSON.stringify(payload);
    const payloadDigest = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(payloadText),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("");
    try {
      await Deno.writeTextFile(payloadPath, payloadText, {
        mode: 0o600,
        createNew: true,
      });
      await Deno.chmod(payloadPath, 0o600);
    } catch (error) {
      await Deno.remove(tempDir, { recursive: true }).catch(() => undefined);
      throw error;
    }
    let cleaned = false;
    const allowedExecutables = [
      ...new Set(
        this.#allowlist.map((argv) => argv[0]).filter(Boolean),
      ),
    ];
    return {
      argv: [
        Deno.execPath(),
        "run",
        "--quiet",
        `--allow-read=${this.#repoRoot},${payloadPath}`,
        `--allow-write=${this.#repoRoot}`,
        ...(allowedExecutables.length > 0
          ? [`--allow-run=${allowedExecutables.join(",")}`]
          : []),
        this.#worker,
        payloadPath,
        `sha256:${payloadDigest}`,
      ],
      cleanup: async () => {
        if (cleaned) return;
        cleaned = true;
        await Deno.remove(tempDir, { recursive: true }).catch(() => undefined);
      },
    };
  }
}
