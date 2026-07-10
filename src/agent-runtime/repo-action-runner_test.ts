import { assert, assertEquals } from "@std/assert";
import { RepoActionRunner } from "./repo-action-runner.ts";
import type { ActionProposal } from "./execution.ts";

async function invoke(argv: string[]) {
  return await new Deno.Command(argv[0], {
    args: argv.slice(1),
    stdout: "piped",
    stderr: "piped",
  }).output();
}

Deno.test("RepoActionRunner writes and exact-patches atomically without action content in argv", async () => {
  const repo = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "repo-runner-test-" }),
  );
  try {
    const runner = await RepoActionRunner.create(repo);
    const write = await runner.prepare({
      id: "write",
      kind: "write_file",
      classification: "repo_write",
      proposedBy: "coder",
      path: "result.txt",
      content: "secret-content",
    });
    const payloadPath = write.argv.at(-2)!;
    assert(write.argv.at(-1)?.startsWith("sha256:"));
    assert(!write.argv.some((arg) => arg.includes("secret-content")));
    assertEquals((await Deno.stat(payloadPath)).mode! & 0o777, 0o600);
    assert((await invoke(write.argv)).success);
    await write.cleanup();
    try {
      await Deno.stat(payloadPath);
      throw new Error("payload was not cleaned");
    } catch (error) {
      assert(error instanceof Deno.errors.NotFound);
    }
    const patch = await runner.prepare({
      id: "patch",
      kind: "patch_file",
      classification: "repo_write",
      proposedBy: "coder",
      path: "result.txt",
      find: "secret",
      replace: "safe",
    });
    assert((await invoke(patch.argv)).success);
    await patch.cleanup();
    assertEquals(await Deno.readTextFile(`${repo}/result.txt`), "safe-content");
  } finally {
    await Deno.remove(repo, { recursive: true });
  }
});

Deno.test("RepoActionRunner binds the private payload bytes into approved argv", async () => {
  const repo = await Deno.realPath(await Deno.makeTempDir());
  const runner = await RepoActionRunner.create(repo);
  const action = await runner.prepare({
    id: "bound-write",
    kind: "write_file",
    classification: "repo_write",
    proposedBy: "coder",
    path: "bound.txt",
    content: "approved",
  });
  try {
    const payloadPath = action.argv.at(-2)!;
    const payload = JSON.parse(await Deno.readTextFile(payloadPath));
    payload.proposal.content = "tampered";
    await Deno.writeTextFile(payloadPath, JSON.stringify(payload));
    const result = await invoke(action.argv);
    assert(!result.success);
    assertEquals(
      await Deno.stat(`${repo}/bound.txt`).then(() => true).catch(() => false),
      false,
    );
  } finally {
    await action.cleanup();
    await Deno.remove(repo, { recursive: true });
  }
});

Deno.test("RepoActionRunner blocks traversal, symlink escape, ambiguous patch, and non-allowlisted command", async () => {
  const base = await Deno.realPath(
    await Deno.makeTempDir({ prefix: "repo-runner-escape-" }),
  );
  const repo = `${base}/repo`;
  const outside = `${base}/outside`;
  await Deno.mkdir(repo);
  await Deno.mkdir(outside);
  await Deno.writeTextFile(`${repo}/same.txt`, "x x");
  await Deno.symlink(outside, `${repo}/link`);
  const runner = await RepoActionRunner.create(repo, {
    commandAllowlist: [["git", "status", "--short"]],
  });
  const proposals: ActionProposal[] = [
    {
      id: "traversal",
      kind: "write_file",
      classification: "repo_write",
      proposedBy: "coder",
      path: "../outside/pwned",
      content: "x",
    },
    {
      id: "symlink",
      kind: "write_file",
      classification: "repo_write",
      proposedBy: "coder",
      path: "link/pwned",
      content: "x",
    },
    {
      id: "ambiguous",
      kind: "patch_file",
      classification: "repo_write",
      proposedBy: "coder",
      path: "same.txt",
      find: "x",
      replace: "y",
    },
    {
      id: "command",
      kind: "run_command",
      classification: "shell_write",
      proposedBy: "coder",
      command: ["git", "status"],
    },
  ];
  try {
    for (const proposal of proposals) {
      const action = await runner.prepare(proposal);
      try {
        assert(
          !(await invoke(action.argv)).success,
          `${proposal.id} should fail closed`,
        );
      } finally {
        await action.cleanup();
      }
    }
    try {
      await Deno.stat(`${outside}/pwned`);
      throw new Error("escape succeeded");
    } catch (error) {
      assert(error instanceof Deno.errors.NotFound);
    }
  } finally {
    await Deno.remove(base, { recursive: true });
  }
});
