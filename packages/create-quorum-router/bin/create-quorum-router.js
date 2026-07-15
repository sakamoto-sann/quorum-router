#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const VERSION = "0.1.19";
const SUPPORTED_TEMPLATES = new Set(["basic"]);

function usage() {
  return `create-quorum-router ${VERSION}

Usage:
  create-quorum-router <dir>
  create-quorum-router <dir> --template basic
  create-quorum-router <dir> --force
  create-quorum-router --help
  create-quorum-router --version

Creates a local QuorumRouter project scaffold. The scaffold does not fetch remote
code, install dependencies, ask for credentials, write secrets, enable process
adapters, or configure live runtime services. Fixture smoke is deterministic;
external provider dogfood and GitHub URL context fetching are explicit manual
opt-in paths.`;
}

function hasCommand(command) {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

function parseArgs(argv) {
  const args = [...argv];
  const options = { template: "basic", force: false, dir: undefined };
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--version" || arg === "-v") return { version: true };
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--template") {
      const template = args.shift();
      if (!template) throw new Error("--template requires a value");
      options.template = template;
      continue;
    }
    if (arg && arg.startsWith("--template=")) {
      options.template = arg.slice("--template=".length);
      continue;
    }
    if (arg && arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    if (options.dir) throw new Error(`unexpected extra argument: ${arg}`);
    options.dir = arg;
  }
  return options;
}

function rejectSymlink(destination) {
  try {
    if (fs.lstatSync(destination).isSymbolicLink()) {
      throw new Error(`refusing to write through symlink: ${destination}`);
    }
  } catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
}

function copyRecursive(from, to, targetRoot) {
  const relative = path.relative(targetRoot, to);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`refusing to write outside target directory: ${to}`);
  }
  rejectSymlink(to);
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      const targetEntry = entry === "gitignore" ? ".gitignore" : entry;
      copyRecursive(
        path.join(from, entry),
        path.join(to, targetEntry),
        targetRoot,
      );
    }
    return;
  }
  fs.copyFileSync(from, to);
}

function isNonEmptyDirectory(dir) {
  try {
    const stat = fs.statSync(dir);
    return stat.isDirectory() && fs.readdirSync(dir).length > 0;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    console.log(usage());
    return;
  }
  if (parsed.version) {
    console.log(VERSION);
    return;
  }
  if (!parsed.dir) {
    throw new Error("target directory is required\n\n" + usage());
  }
  if (!SUPPORTED_TEMPLATES.has(parsed.template)) {
    throw new Error(`unsupported template: ${parsed.template}`);
  }

  const targetDir = path.resolve(process.cwd(), parsed.dir);
  rejectSymlink(targetDir);
  if (isNonEmptyDirectory(targetDir) && !parsed.force) {
    throw new Error(
      `refusing to overwrite non-empty directory: ${targetDir}\n` +
        "Pass --force to overwrite template files in this directory.",
    );
  }

  const templateDir = path.join(__dirname, "..", "templates", parsed.template);
  fs.mkdirSync(targetDir, { recursive: true });
  copyRecursive(templateDir, targetDir, targetDir);
  fs.mkdirSync(path.join(targetDir, "out"), { recursive: true });
  fs.writeFileSync(path.join(targetDir, "out", ".gitkeep"), "");

  console.log(`Created QuorumRouter project in ${targetDir}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${path.relative(process.cwd(), targetDir) || "."}`);
  console.log("  deno task check");
  console.log("  deno task smoke");
  console.log("  deno task intake");
  console.log("  deno task auth:status");
  console.log("  deno task models:list");
  console.log("  deno task health");
  if (!hasCommand("deno")) {
    console.log("");
    console.log("Warning: Deno was not found on PATH.");
    console.log(
      "Install Deno before running the tasks above: brew install deno, or use the official installer at deno.com/install.",
    );
    console.log("Then verify with: deno --version");
  }
  console.log(
    "  # Optional one-shot real provider dogfood after live probe verifies authentication:",
  );
  console.log(
    '  RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once --prompt "Review this README for risky claims."',
  );
  console.log("  # Optional Best Route over local wrappers:");
  console.log(
    '  RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route --prompt "Choose the safest launch copy."',
  );
  console.log(
    "  # Optional conversation-only Agent Chat stays explicit opt-in:",
  );
  console.log(
    '  RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_AGENT_CHAT=1 deno task agent-chat --prompt "Review this launch plan."',
  );
  console.log("");
  console.log(
    "Note: deno task smoke is deterministic fixture-only and does not call a provider API.",
  );
  console.log(
    "Note: intake is the first real setup command; route:once/best-route are manual opt-in real provider dogfood; env fallback requires QUORUM_ROUTER_AUTH_MODE=env.",
  );
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
