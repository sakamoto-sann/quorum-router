import { redactAgentChatContent } from "../agent-chat/redaction.ts";
import type {
  SafeLoopClient,
  SafeLoopExecuteRequest,
  SafeLoopExecutionReceipt,
  SafeLoopPreparedRequest,
  SafeLoopReadiness,
  SafeLoopRequest,
} from "./types.ts";
import { SafeLoopApprovalRequiredError } from "./types.ts";

export type ProcessResult = { code: number; stdout: string; stderr: string };
export interface ProcessRunner {
  run(
    argv: string[],
    options: { signal: AbortSignal; maxOutputBytes: number },
  ): Promise<ProcessResult>;
}

async function boundedBytes(
  stream: ReadableStream<Uint8Array>,
  limit: number,
  abort: () => void,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        abort();
        throw new Error("SafeLoop CLI output exceeded configured bound");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export class DenoProcessRunner implements ProcessRunner {
  async run(
    argv: string[],
    options: { signal: AbortSignal; maxOutputBytes: number },
  ): Promise<ProcessResult> {
    if (argv.length === 0) throw new Error("process argv is required");
    let child: Deno.ChildProcess;
    try {
      child = new Deno.Command(argv[0], {
        args: argv.slice(1),
        stdout: "piped",
        stderr: "piped",
        signal: options.signal,
      }).spawn();
    } catch (cause) {
      throw new Error("SafeLoop CLI unavailable or process failed", { cause });
    }
    const abort = () => {
      try {
        child.kill("SIGKILL");
      } catch { /* already exited */ }
    };
    const [stdout, stderr, status] = await Promise.all([
      boundedBytes(child.stdout, options.maxOutputBytes, abort),
      boundedBytes(child.stderr, options.maxOutputBytes, abort),
      child.status,
    ]);
    if (stdout.length + stderr.length > options.maxOutputBytes) {
      throw new Error("SafeLoop CLI output exceeded configured bound");
    }
    const decode = new TextDecoder();
    return {
      code: status.code,
      stdout: decode.decode(stdout),
      stderr: decode.decode(stderr),
    };
  }
}

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : undefined;
const exactKeys = (value: RecordValue, keys: string[]) =>
  Object.keys(value).length === keys.length &&
  keys.every((key) => key in value);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${
      Object.keys(value as RecordValue).sort().map((key) =>
        `${JSON.stringify(key)}:${canonical((value as RecordValue)[key])}`
      ).join(",")
    }}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return `sha256:${
    Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0"))
      .join("")
  }`;
}

async function canonicalPath(path: string): Promise<string> {
  return await Deno.realPath(path);
}

function safeErrorText(value: unknown): string {
  return redactAgentChatContent(String(value ?? "SafeLoop request failed"))
    .slice(0, 512);
}

export class SafeLoopCliClient implements SafeLoopClient {
  readonly #binary: string;
  readonly #approvalDb: string;
  readonly #signingKeyFile: string;
  readonly #policyRoot: string;
  readonly #runner: ProcessRunner;
  readonly #timeoutMs: number;
  readonly #maxOutputBytes: number;

  constructor(input: {
    approvalDb: string;
    signingKeyFile: string;
    policyRoot: string;
    binary?: string;
    runner?: ProcessRunner;
    timeoutMs?: number;
    maxOutputBytes?: number;
  }) {
    this.#binary = input.binary ?? "safeloop";
    this.#approvalDb = input.approvalDb;
    this.#signingKeyFile = input.signingKeyFile;
    this.#policyRoot = input.policyRoot;
    this.#runner = input.runner ?? new DenoProcessRunner();
    this.#timeoutMs = input.timeoutMs ?? 60_000;
    this.#maxOutputBytes = input.maxOutputBytes ?? 256 * 1024;
  }

  readiness(): SafeLoopReadiness {
    const capability = { supported: true, approvalPreflight: true };
    return {
      available: true,
      repoMutation: capability,
      shellMutation: capability,
    };
  }

  async prepare(input: SafeLoopRequest): Promise<SafeLoopPreparedRequest> {
    if (
      !input.taskId || !input.runId || !input.requestedBy ||
      input.argv.length === 0
    ) {
      throw new Error("malformed SafeLoop request");
    }
    if (
      !(["read_only", "repo_write", "shell_write"] as string[]).includes(
        input.proposal.classification,
      )
    ) {
      throw new Error(
        `unsupported action classification: ${input.proposal.classification}`,
      );
    }
    const base = {
      schema_version: "safeloop.execute-request.v1" as const,
      task_id: input.taskId,
      run_id: input.runId,
      repo_root: await canonicalPath(input.repo),
      run_root: input.runRoot,
      mutation_class: input.proposal.classification as
        | "read_only"
        | "repo_write"
        | "shell_write",
      argv: [...input.argv],
      policy_version: input.policyVersion,
      policy_ref: input.policyRef,
      requested_by: input.requestedBy,
      expected_artifact_scope: [...input.expectedArtifactScope],
      timeout_seconds: input.timeoutSeconds ??
        Math.max(1, Math.ceil(this.#timeoutMs / 1000)),
    };
    const actionDigest = await sha256(base);
    let request: SafeLoopExecuteRequest = {
      ...base,
      action_digest: actionDigest,
      approval_id: null,
    };
    const prepared = (): SafeLoopPreparedRequest => ({
      proposal: input.proposal,
      request: Object.freeze(request),
      signal: input.signal,
    });
    if (input.proposal.classification !== "read_only") {
      if (!input.approvalResolver) {
        throw new SafeLoopApprovalRequiredError(
          "approval_required",
          "A pre-issued approval is required for this exact request.",
          prepared(),
        );
      }
      const resolution = await input.approvalResolver(prepared().request);
      if (resolution.status !== "approved") {
        throw new SafeLoopApprovalRequiredError(
          resolution.code,
          safeErrorText(resolution.message),
          prepared(),
        );
      }
      request = { ...request, approval_id: resolution.approvalId };
    }
    return prepared();
  }

  async execute(input: SafeLoopRequest): Promise<SafeLoopExecutionReceipt> {
    return await this.executePrepared(await this.prepare(input));
  }

  async executePrepared(
    prepared: SafeLoopPreparedRequest,
  ): Promise<SafeLoopExecutionReceipt> {
    const controller = new AbortController();
    const abort = () => controller.abort(prepared.signal?.reason);
    prepared.signal?.addEventListener("abort", abort, { once: true });
    if (prepared.signal?.aborted) abort();
    const timer = setTimeout(
      () => controller.abort(new Error("SafeLoop CLI timed out")),
      this.#timeoutMs,
    );
    const tempDir = await Deno.makeTempDir({
      prefix: "quorum-router-safeloop-",
    });
    const requestPath = `${tempDir}/request.json`;
    try {
      await Deno.writeTextFile(requestPath, canonical(prepared.request), {
        mode: 0o600,
        createNew: true,
      });
      await Deno.chmod(requestPath, 0o600);
      const result = await this.#runner.run([
        this.#binary,
        "execute-request",
        "--request",
        requestPath,
        "--approval-db",
        this.#approvalDb,
        "--signing-key-file",
        this.#signingKeyFile,
        "--policy-root",
        this.#policyRoot,
        "--json",
      ], { signal: controller.signal, maxOutputBytes: this.#maxOutputBytes });
      let parsed: unknown;
      try {
        parsed = JSON.parse(result.stdout);
      } catch {
        throw new Error("SafeLoop CLI returned malformed JSON");
      }
      if (result.code !== 0) {
        const error = record(record(parsed)?.error);
        const code = typeof error?.code === "string"
          ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80)
          : "cli_error";
        const message = typeof error?.message === "string"
          ? safeErrorText(error.message)
          : "SafeLoop request failed";
        throw new Error(`SafeLoop CLI failed closed (${code}): ${message}`);
      }
      return await this.#parseReceipt(parsed, prepared);
    } finally {
      clearTimeout(timer);
      prepared.signal?.removeEventListener("abort", abort);
      await Deno.remove(tempDir, { recursive: true }).catch(() => undefined);
    }
  }

  async #parseReceipt(
    value: unknown,
    prepared: SafeLoopPreparedRequest,
  ): Promise<SafeLoopExecutionReceipt> {
    const receipt = record(value);
    const keys = [
      "schema_version",
      "status",
      "request_run_id",
      "run_id",
      "run_dir",
      "exit_code",
      "verification",
      "artifact_refs",
      "binding",
      "rollback_available",
    ];
    if (
      !receipt || !exactKeys(receipt, keys) ||
      receipt.schema_version !== "safeloop.execution-receipt.v1" ||
      receipt.status !== "verified" || receipt.exit_code !== 0
    ) {
      throw new Error("invalid SafeLoop execution receipt");
    }
    const verification = record(receipt.verification);
    const binding = record(receipt.binding);
    const artifactRefs = receipt.artifact_refs;
    if (
      !verification || !exactKeys(verification, ["artifacts", "anchor"]) ||
      !["valid", "warning"].includes(String(verification.artifacts)) ||
      verification.anchor !== "valid" ||
      !binding ||
      !exactKeys(binding, [
        "action_digest",
        "policy_version",
        "policy_ref",
        "approval_id",
        "approval_status",
      ]) ||
      !Array.isArray(artifactRefs) || artifactRefs.length === 0 ||
      !artifactRefs.every((v) => typeof v === "string")
    ) {
      throw new Error("invalid SafeLoop receipt verification or binding");
    }
    const request = prepared.request;
    const requiresApproval = request.mutation_class !== "read_only";
    if (
      receipt.request_run_id !== request.run_id ||
      receipt.run_id !== request.run_id ||
      binding.action_digest !== request.action_digest ||
      binding.policy_version !== request.policy_version ||
      binding.policy_ref !== request.policy_ref ||
      binding.approval_id !== request.approval_id ||
      (requiresApproval
        ? binding.approval_status !== "EXECUTED"
        : binding.approval_status !== null)
    ) {
      throw new Error("SafeLoop receipt is not bound to the prepared request");
    }
    if (
      typeof receipt.run_dir !== "string" || !receipt.run_dir.startsWith("/")
    ) throw new Error("SafeLoop run_dir must be absolute");
    const root = await canonicalPath(request.run_root);
    const runDir = await canonicalPath(receipt.run_dir);
    if (runDir === root || !runDir.startsWith(`${root}/`)) {
      throw new Error("SafeLoop run_dir escaped configured runRoot");
    }
    const canonicalArtifacts = await Promise.all(
      artifactRefs.map((path) => canonicalPath(path)),
    );
    if (!canonicalArtifacts.every((path) => path.startsWith(`${runDir}/`))) {
      throw new Error("SafeLoop artifact reference escaped run_dir");
    }
    return {
      schemaVersion: "safeloop.execution-receipt.v1",
      actionId: prepared.proposal.id,
      status: "verified",
      requestRunId: request.run_id,
      runId: request.run_id,
      runDirectory: runDir,
      exitCode: 0,
      artifacts: canonicalArtifacts.map((path) => ({ path })),
      verification: {
        artifactsStatus: verification.artifacts as "valid" | "warning",
        anchorStatus: "valid",
      },
      binding: {
        actionDigest: request.action_digest,
        policyVersion: request.policy_version,
        policyRef: request.policy_ref,
        approvalId: request.approval_id,
        approvalStatus: binding.approval_status as "EXECUTED" | null,
      },
      rollbackAvailable: receipt.rollback_available === true,
    };
  }
}
