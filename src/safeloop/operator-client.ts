import type {
  SafeLoopArtifact,
  SafeLoopClient,
  SafeLoopExecuteRequest,
  SafeLoopExecutionReceipt,
  SafeLoopReadiness,
  SafeLoopRequest,
} from "./types.ts";

export type SafeLoopOperatorPrompt = {
  requestPath: string;
  receiptPath: string;
  actionDigest: string;
  mutationClass: string;
};

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${
      Object.keys(value as JsonRecord).sort().map((key) =>
        `${JSON.stringify(key)}:${canonical((value as JsonRecord)[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value);
}

async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return `sha256:${
    Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0"))
      .join("")
  }`;
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export class SafeLoopOperatorClient implements SafeLoopClient {
  readonly #brokerDir: string;
  readonly #onOperatorRequired: (
    prompt: SafeLoopOperatorPrompt,
  ) => void | Promise<void>;
  readonly #pollIntervalMs: number;
  readonly #timeoutMs: number;
  readonly #maxReceiptBytes: number;

  constructor(input: {
    brokerDir: string;
    onOperatorRequired: (
      prompt: SafeLoopOperatorPrompt,
    ) => void | Promise<void>;
    pollIntervalMs?: number;
    timeoutMs?: number;
    maxReceiptBytes?: number;
  }) {
    this.#brokerDir = input.brokerDir;
    this.#onOperatorRequired = input.onOperatorRequired;
    this.#pollIntervalMs = input.pollIntervalMs ?? 500;
    this.#timeoutMs = input.timeoutMs ?? 10 * 60_000;
    this.#maxReceiptBytes = input.maxReceiptBytes ?? 256 * 1024;
  }

  readiness(): SafeLoopReadiness {
    const capability = { supported: true, approvalPreflight: true };
    return {
      available: true,
      repoMutation: capability,
      shellMutation: capability,
    };
  }

  async execute(input: SafeLoopRequest): Promise<SafeLoopExecutionReceipt> {
    if (
      !input.taskId || !input.runId || !input.requestedBy ||
      input.argv.length === 0
    ) {
      throw new Error("malformed SafeLoop operator request");
    }
    const repo = await Deno.realPath(input.repo);
    const runRoot = await Deno.realPath(input.runRoot);
    const brokerDir = await Deno.realPath(this.#brokerDir);
    if (brokerDir === repo || brokerDir.startsWith(`${repo}/`)) {
      throw new Error(
        "SafeLoop operator broker directory must be outside the repository",
      );
    }
    const base = {
      schema_version: "safeloop.execute-request.v1" as const,
      task_id: input.taskId,
      run_id: input.runId,
      repo_root: repo,
      run_root: runRoot,
      mutation_class: input.proposal.classification,
      argv: [...input.argv],
      policy_version: input.policyVersion,
      policy_ref: input.policyRef,
      requested_by: input.requestedBy,
      expected_artifact_scope: [...input.expectedArtifactScope],
      timeout_seconds: input.timeoutSeconds ?? 120,
    };
    if (
      !["read_only", "repo_write", "shell_write"].includes(base.mutation_class)
    ) {
      throw new Error("unsupported SafeLoop mutation class");
    }
    const request: SafeLoopExecuteRequest = {
      ...base,
      mutation_class: base
        .mutation_class as SafeLoopExecuteRequest["mutation_class"],
      action_digest: await digest(base),
      approval_id: null,
    };
    const id = crypto.randomUUID();
    const requestPath = `${brokerDir}/${id}.request.json`;
    const receiptPath = `${brokerDir}/${id}.receipt.json`;
    const tempPath = `${brokerDir}/.${id}.tmp`;
    const started = Date.now();
    try {
      await Deno.writeTextFile(tempPath, canonical(request), {
        mode: 0o600,
        createNew: true,
      });
      await Deno.chmod(tempPath, 0o600);
      await Deno.rename(tempPath, requestPath);
      await this.#onOperatorRequired({
        requestPath,
        receiptPath,
        actionDigest: request.action_digest,
        mutationClass: request.mutation_class,
      });
      while (Date.now() - started < this.#timeoutMs) {
        if (input.signal?.aborted) {
          throw new Error("SafeLoop operator wait aborted");
        }
        try {
          const stat = await Deno.lstat(receiptPath);
          if (
            stat.isSymlink || !stat.isFile || stat.size > this.#maxReceiptBytes
          ) {
            throw new Error("SafeLoop operator receipt file is unsafe");
          }
          const value = JSON.parse(await Deno.readTextFile(receiptPath));
          return await this.#parseReceipt(
            value,
            request,
            input.proposal.id,
            runRoot,
          );
        } catch (error) {
          if (error instanceof Deno.errors.NotFound) {
            await sleep(this.#pollIntervalMs);
            continue;
          }
          throw error;
        }
      }
      throw new Error("SafeLoop operator approval timed out");
    } finally {
      await Promise.all([
        Deno.remove(tempPath).catch(() => undefined),
        Deno.remove(requestPath).catch(() => undefined),
        Deno.remove(receiptPath).catch(() => undefined),
      ]);
    }
  }

  async #parseReceipt(
    value: unknown,
    request: SafeLoopExecuteRequest,
    actionId: string,
    runRoot: string,
  ): Promise<SafeLoopExecutionReceipt> {
    const receipt = asRecord(value);
    const verification = asRecord(receipt?.verification);
    const binding = asRecord(receipt?.binding);
    if (
      !receipt || receipt.schema_version !== "safeloop.execution-receipt.v1" ||
      receipt.status !== "verified" || receipt.exit_code !== 0 ||
      receipt.request_run_id !== request.run_id ||
      receipt.run_id !== request.run_id ||
      !verification ||
      !["valid", "warning"].includes(String(verification.artifacts)) ||
      verification.anchor !== "valid" || !binding ||
      binding.action_digest !== request.action_digest ||
      binding.policy_version !== request.policy_version ||
      binding.policy_ref !== request.policy_ref ||
      typeof binding.approval_id !== "string" || !binding.approval_id ||
      binding.approval_status !== "EXECUTED" ||
      !Array.isArray(receipt.artifact_refs) ||
      receipt.artifact_refs.length === 0 ||
      !receipt.artifact_refs.every((path) => typeof path === "string") ||
      receipt.rollback_available !== true
    ) throw new Error("invalid or unbound SafeLoop operator receipt");
    if (typeof receipt.run_dir !== "string") {
      throw new Error("invalid SafeLoop run directory");
    }
    const runDir = await Deno.realPath(receipt.run_dir);
    if (!runDir.startsWith(`${runRoot}/`)) {
      throw new Error("SafeLoop run directory escaped run root");
    }
    const artifactPaths = await Promise.all(
      (receipt.artifact_refs as string[]).map((path) => Deno.realPath(path)),
    );
    if (!artifactPaths.every((path) => path.startsWith(`${runDir}/`))) {
      throw new Error("SafeLoop artifact escaped run directory");
    }
    const artifacts: SafeLoopArtifact[] = artifactPaths.map((path) => ({
      path,
    }));
    return {
      schemaVersion: "safeloop.execution-receipt.v1",
      actionId,
      status: "verified",
      requestRunId: request.run_id,
      runId: request.run_id,
      runDirectory: runDir,
      exitCode: 0,
      artifacts,
      verification: {
        artifactsStatus: verification.artifacts as "valid" | "warning",
        anchorStatus: "valid",
      },
      binding: {
        actionDigest: request.action_digest,
        policyVersion: request.policy_version,
        policyRef: request.policy_ref,
        approvalId: binding.approval_id,
        approvalStatus: "EXECUTED",
      },
      rollbackAvailable: true,
    };
  }
}
