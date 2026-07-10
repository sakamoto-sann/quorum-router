import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import type { ActionProposal } from "../agent-runtime/execution.ts";
import {
  type ProcessResult,
  type ProcessRunner,
  SafeLoopCliClient,
} from "./cli-client.ts";
import {
  SafeLoopApprovalRequiredError,
  type SafeLoopExecuteRequest,
  type SafeLoopRequest,
} from "./types.ts";

class FakeRunner implements ProcessRunner {
  calls: string[][] = [];
  constructor(readonly result: (argv: string[]) => Promise<ProcessResult>) {}
  async run(argv: string[]): Promise<ProcessResult> {
    this.calls.push(argv);
    return await this.result(argv);
  }
}

async function fixture(
  classification: ActionProposal["classification"] = "read_only",
) {
  const root = await Deno.makeTempDir({ prefix: "safeloop-client-test-" });
  const repo = `${root}/repo`;
  const runRoot = `${root}/runs`;
  const policyRoot = `${root}/policies`;
  await Promise.all([
    Deno.mkdir(repo),
    Deno.mkdir(runRoot),
    Deno.mkdir(policyRoot),
  ]);
  const policyRef = `${policyRoot}/policy.json`;
  await Deno.writeTextFile(policyRef, "{}");
  const proposal = classification === "repo_write"
    ? {
      id: "action",
      kind: "write_file",
      classification,
      path: "x.txt",
      content: "x",
      proposedBy: "coder",
    } as const
    : {
      id: "action",
      kind: "read_file",
      classification,
      path: "README.md",
      proposedBy: "coder",
    } as const;
  const request: SafeLoopRequest = {
    proposal,
    taskId: "task",
    runId: "run-1",
    repo,
    runRoot,
    argv: ["worker", "payload"],
    policyVersion: "p1",
    policyRef,
    requestedBy: "quorum-coder",
    expectedArtifactScope: ["run.json"],
  };
  return { root, repo, runRoot, policyRoot, policyRef, request };
}

function client(
  input: { runner: ProcessRunner; approvalDb: string; policyRoot: string },
) {
  return new SafeLoopCliClient({
    binary: "/bin/safeloop",
    runner: input.runner,
    approvalDb: input.approvalDb,
    signingKeyFile: "/private/operator.key",
    policyRoot: input.policyRoot,
  });
}

Deno.test("SafeLoop CLI invokes execute-request once and strictly accepts a bound verified receipt", async () => {
  const f = await fixture();
  try {
    const runDir = `${f.runRoot}/run-1`;
    await Deno.mkdir(runDir);
    await Deno.writeTextFile(`${runDir}/run.json`, "{}");
    const runner = new FakeRunner(async (argv) => {
      const request = JSON.parse(
        await Deno.readTextFile(argv[argv.indexOf("--request") + 1]),
      ) as SafeLoopExecuteRequest;
      return {
        code: 0,
        stderr: "",
        stdout: JSON.stringify({
          schema_version: "safeloop.execution-receipt.v1",
          status: "verified",
          request_run_id: request.run_id,
          run_id: request.run_id,
          run_dir: runDir,
          exit_code: 0,
          verification: { artifacts: "valid", anchor: "valid" },
          artifact_refs: [`${runDir}/run.json`],
          binding: {
            action_digest: request.action_digest,
            policy_version: request.policy_version,
            policy_ref: request.policy_ref,
            approval_id: null,
            approval_status: null,
          },
          rollback_available: false,
        }),
      };
    });
    const receipt = await client({
      runner,
      approvalDb: `${f.root}/approvals.db`,
      policyRoot: f.policyRoot,
    }).execute(f.request);
    assertEquals(receipt.status, "verified");
    assertEquals(runner.calls.length, 1);
    assertEquals(
      runner.calls[0].filter((value) => value === "execute-request").length,
      1,
    );
    assert(runner.calls[0].includes("--json"));
    assert(
      !runner.calls[0].some((value) =>
        value.includes("worker") || value.includes("content")
      ),
    );
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});

Deno.test("SafeLoop preparation resolves approval only after exact digest and ignores model approvedBy", async () => {
  const f = await fixture("repo_write");
  try {
    let seen: Readonly<SafeLoopExecuteRequest> | undefined;
    const prepared = await client({
      runner: new FakeRunner(() => Promise.reject(new Error("unused"))),
      approvalDb: `${f.root}/db`,
      policyRoot: f.policyRoot,
    }).prepare({
      ...f.request,
      approvalResolver: (request) => {
        seen = request;
        return { status: "approved", approvalId: "approval-1" };
      },
    });
    assert(seen?.action_digest.match(/^sha256:[0-9a-f]{64}$/));
    assertEquals(prepared.request.approval_id, "approval-1");
    assertEquals("approvedBy" in prepared.request, false);
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});

Deno.test("SafeLoop write without exact approval returns structured approval-required state", async () => {
  const f = await fixture("repo_write");
  try {
    const error = await assertRejects(() =>
      client({
        runner: new FakeRunner(() => Promise.reject(new Error("unused"))),
        approvalDb: `${f.root}/db`,
        policyRoot: f.policyRoot,
      }).prepare(f.request)
    );
    assert(error instanceof SafeLoopApprovalRequiredError);
    assertEquals(error.code, "approval_required");
    assert(error.prepared.request.action_digest.startsWith("sha256:"));
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});

Deno.test("SafeLoop nonzero structured errors are sanitized and fail closed", async () => {
  const f = await fixture();
  try {
    const runner = new FakeRunner(() =>
      Promise.resolve({
        code: 2,
        stdout: JSON.stringify({
          schema_version: "safeloop.execution-error.v1",
          status: "error",
          error: { code: "approval_required", message: "approval missing" },
        }),
        stderr: "secret stderr",
      })
    );
    const error = await assertRejects(() =>
      client({ runner, approvalDb: `${f.root}/db`, policyRoot: f.policyRoot })
        .execute(f.request)
    );
    assert(error instanceof Error);
    assertStringIncludes(error.message, "approval_required");
    assert(!error.message.includes("secret stderr"));
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});

Deno.test("SafeLoop rejects receipt run directory outside configured root", async () => {
  const f = await fixture();
  try {
    const outside = `${f.root}/outside`;
    await Deno.mkdir(outside);
    const preparedClient = client({
      runner: new FakeRunner(async (argv) => {
        const request = JSON.parse(
          await Deno.readTextFile(argv[argv.indexOf("--request") + 1]),
        ) as SafeLoopExecuteRequest;
        return {
          code: 0,
          stderr: "",
          stdout: JSON.stringify({
            schema_version: "safeloop.execution-receipt.v1",
            status: "verified",
            request_run_id: request.run_id,
            run_id: request.run_id,
            run_dir: outside,
            exit_code: 0,
            verification: { artifacts: "valid", anchor: "valid" },
            artifact_refs: [`${outside}/run.json`],
            binding: {
              action_digest: request.action_digest,
              policy_version: request.policy_version,
              policy_ref: request.policy_ref,
              approval_id: null,
              approval_status: null,
            },
            rollback_available: false,
          }),
        };
      }),
      approvalDb: `${f.root}/db`,
      policyRoot: f.policyRoot,
    });
    await assertRejects(
      () => preparedClient.execute(f.request),
      Error,
      "escaped",
    );
  } finally {
    await Deno.remove(f.root, { recursive: true });
  }
});
