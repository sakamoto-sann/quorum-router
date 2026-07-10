type Proposal =
  | {
    id: string;
    kind: "read_file";
    classification: string;
    proposedBy: string;
    path: string;
  }
  | {
    id: string;
    kind: "write_file";
    classification: string;
    proposedBy: string;
    path: string;
    content: string;
  }
  | {
    id: string;
    kind: "patch_file";
    classification: string;
    proposedBy: string;
    path: string;
    find: string;
    replace: string;
  }
  | {
    id: string;
    kind: "run_command";
    classification: string;
    proposedBy: string;
    command: string[];
  };

type Payload = {
  schemaVersion: "quorum-router.repo-action.v1";
  repoRoot: string;
  proposal: Proposal;
  commandAllowlist: string[][];
  limits: {
    maxFileBytes: number;
    maxContentBytes: number;
    maxOutputBytes: number;
    timeoutMs: number;
  };
};

const fail = (message: string): never => {
  throw new Error(message);
};
const sameArgv = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

async function boundedStream(
  stream: ReadableStream<Uint8Array>,
  state: { total: number; limit: number },
  abort: () => void,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      state.total += value.length;
      if (state.total > state.limit) {
        abort();
        fail("command output exceeds configured bound");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

async function confinedPath(
  repo: string,
  relative: string,
  forWrite = false,
): Promise<string> {
  if (
    !relative || relative.includes("\0") || relative.startsWith("/") ||
    relative.split(/[\\/]/).includes("..")
  ) fail("unsafe repository path");
  const candidate = `${repo}/${relative}`;
  const parent = await Deno.realPath(
    candidate.substring(0, candidate.lastIndexOf("/")) || repo,
  );
  if (parent !== repo && !parent.startsWith(`${repo}/`)) {
    fail("repository path escaped through symlink");
  }
  if (!forWrite) {
    const real = await Deno.realPath(candidate);
    if (real !== repo && !real.startsWith(`${repo}/`)) {
      fail("repository path escaped through symlink");
    }
    return real;
  }
  try {
    const info = await Deno.lstat(candidate);
    if (info.isSymlink) fail("refusing to write through symlink");
    const real = await Deno.realPath(candidate);
    if (!real.startsWith(`${repo}/`)) fail("repository path escaped");
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  return candidate;
}

async function atomicWrite(
  path: string,
  content: string,
  maxBytes: number,
): Promise<void> {
  const bytes = new TextEncoder().encode(content);
  if (bytes.length > maxBytes) fail("action content exceeds configured bound");
  const temp = `${path}.quorum-router-${crypto.randomUUID()}.tmp`;
  try {
    await Deno.writeFile(temp, bytes, { createNew: true, mode: 0o600 });
    await Deno.rename(temp, path);
  } finally {
    await Deno.remove(temp).catch(() => undefined);
  }
}

async function main(): Promise<void> {
  if (Deno.args.length !== 2 || !/^sha256:[0-9a-f]{64}$/.test(Deno.args[1])) {
    fail("action payload path and digest are required");
  }
  if ((await Deno.stat(Deno.args[0])).size > 2 * 1024 * 1024) {
    fail("action payload exceeds configured bound");
  }
  const payloadText = await Deno.readTextFile(Deno.args[0]);
  if (payloadText.length > 2 * 1024 * 1024) {
    fail("action payload exceeds configured bound");
  }
  const actualDigest = `sha256:${
    Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(payloadText),
        ),
      ),
      (byte) => byte.toString(16).padStart(2, "0"),
    ).join("")
  }`;
  if (actualDigest !== Deno.args[1]) fail("action payload digest mismatch");
  const payload = JSON.parse(payloadText) as Payload;
  if (payload.schemaVersion !== "quorum-router.repo-action.v1") {
    fail("unsupported action payload schema");
  }
  const repo = await Deno.realPath(payload.repoRoot);
  const action = payload.proposal;
  const requiredClass = action.kind === "read_file"
    ? "read_only"
    : action.kind === "run_command"
    ? "shell_write"
    : "repo_write";
  if (action.classification !== requiredClass) {
    fail("action kind and mutation class do not match");
  }
  if (action.kind === "read_file") {
    const path = await confinedPath(repo, action.path);
    const data = await Deno.readFile(path);
    if (data.length > payload.limits.maxFileBytes) {
      fail("file exceeds configured bound");
    }
    await Deno.stdout.write(data);
    return;
  }
  if (action.kind === "write_file") {
    await atomicWrite(
      await confinedPath(repo, action.path, true),
      action.content,
      payload.limits.maxContentBytes,
    );
    return;
  }
  if (action.kind === "patch_file") {
    const path = await confinedPath(repo, action.path, true);
    const bytes = await Deno.readFile(path);
    if (bytes.length > payload.limits.maxFileBytes) {
      fail("file exceeds configured bound");
    }
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const first = content.indexOf(action.find);
    if (
      !action.find || first < 0 ||
      content.indexOf(action.find, first + action.find.length) >= 0
    ) fail("patch find must match exactly once");
    await atomicWrite(
      path,
      content.slice(0, first) + action.replace +
        content.slice(first + action.find.length),
      payload.limits.maxContentBytes,
    );
    return;
  }
  if (action.kind === "run_command") {
    if (
      !payload.commandAllowlist.some((allowed) =>
        sameArgv(allowed, action.command)
      )
    ) fail("command argv is not allowlisted");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      payload.limits.timeoutMs,
    );
    try {
      const child = new Deno.Command(action.command[0], {
        args: action.command.slice(1),
        cwd: repo,
        stdout: "piped",
        stderr: "piped",
        signal: controller.signal,
      }).spawn();
      const abort = () => {
        try {
          child.kill("SIGKILL");
        } catch { /* already exited */ }
      };
      const state = { total: 0, limit: payload.limits.maxOutputBytes };
      const [stdout, stderr, status] = await Promise.all([
        boundedStream(child.stdout, state, abort),
        boundedStream(child.stderr, state, abort),
        child.status,
      ]);
      await Deno.stdout.write(stdout);
      await Deno.stderr.write(stderr);
      if (!status.success) Deno.exit(status.code || 1);
    } finally {
      clearTimeout(timer);
    }
    return;
  }
  fail("unsupported action kind");
}

if (import.meta.main) await main();
