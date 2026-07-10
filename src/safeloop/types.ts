import type { ActionProposal } from "../agent-runtime/execution.ts";

export type SafeLoopCapability = {
  supported: boolean;
  approvalPreflight: boolean;
  reason?: string;
};

export type SafeLoopReadiness = {
  available: boolean;
  repoMutation: SafeLoopCapability;
  shellMutation: SafeLoopCapability;
};

export type SafeLoopApprovalResolution =
  | { status: "approved"; approvalId: string }
  | { status: "approval_required"; code: string; message: string };

export type SafeLoopApprovalResolver = (
  request: Readonly<SafeLoopExecuteRequest>,
) => SafeLoopApprovalResolution | Promise<SafeLoopApprovalResolution>;

export type SafeLoopRequest = {
  proposal: ActionProposal;
  taskId: string;
  runId: string;
  repo: string;
  runRoot: string;
  argv: string[];
  policyVersion: string;
  policyRef: string;
  requestedBy: string;
  expectedArtifactScope: string[];
  timeoutSeconds?: number;
  approvalResolver?: SafeLoopApprovalResolver;
  signal?: AbortSignal;
};

export type SafeLoopExecuteRequest = {
  schema_version: "safeloop.execute-request.v1";
  task_id: string;
  run_id: string;
  repo_root: string;
  run_root: string;
  mutation_class: "read_only" | "repo_write" | "shell_write";
  argv: string[];
  action_digest: string;
  policy_version: string;
  policy_ref: string;
  requested_by: string;
  approval_id: string | null;
  expected_artifact_scope: string[];
  timeout_seconds: number;
};

export type SafeLoopPreparedRequest = {
  proposal: ActionProposal;
  request: Readonly<SafeLoopExecuteRequest>;
  signal?: AbortSignal;
};

export type SafeLoopArtifact = { path: string };

export type SafeLoopExecutionReceipt = {
  schemaVersion: "safeloop.execution-receipt.v1";
  actionId: string;
  status: "verified";
  requestRunId: string;
  runId: string;
  runDirectory: string;
  exitCode: 0;
  artifacts: SafeLoopArtifact[];
  verification: { artifactsStatus: "valid" | "warning"; anchorStatus: "valid" };
  binding: {
    actionDigest: string;
    policyVersion: string;
    policyRef: string;
    approvalId: string | null;
    approvalStatus: "EXECUTED" | null;
  };
  rollbackAvailable: boolean;
};

export class SafeLoopApprovalRequiredError extends Error {
  readonly code: string;
  readonly prepared: SafeLoopPreparedRequest;
  constructor(
    code: string,
    message: string,
    prepared: SafeLoopPreparedRequest,
  ) {
    super(message);
    this.name = "SafeLoopApprovalRequiredError";
    this.code = code;
    this.prepared = prepared;
  }
}

export interface SafeLoopClient {
  readiness(): SafeLoopReadiness | Promise<SafeLoopReadiness>;
  execute(request: SafeLoopRequest): Promise<SafeLoopExecutionReceipt>;
}
