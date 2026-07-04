#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const VERSION = "0.1.3";
const SUPPORTED_TEMPLATES = new Set(["basic"]);

function usage() {
  return `create-fusion-router ${VERSION}

Usage:
  create-fusion-router <dir>
  create-fusion-router <dir> --template basic
  create-fusion-router <dir> --force
  create-fusion-router --help
  create-fusion-router --version

Creates a local Fusion Router evaluation demo. The scaffold does not fetch remote
code, install dependencies, ask for credentials, write secrets, enable process
adapters, or configure live runtime services.`;
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

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from)) {
      copyRecursive(path.join(from, entry), path.join(to, entry));
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
  if (isNonEmptyDirectory(targetDir) && !parsed.force) {
    throw new Error(
      `refusing to overwrite non-empty directory: ${targetDir}\n` +
        "Pass --force to overwrite template files in this directory.",
    );
  }

  const templateDir = path.join(__dirname, "..", "templates", parsed.template);
  fs.mkdirSync(targetDir, { recursive: true });
  copyRecursive(templateDir, targetDir);

  console.log(`Created Fusion Router evaluation demo in ${targetDir}`);
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${path.relative(process.cwd(), targetDir) || "."}`);
  console.log("  deno task check");
  console.log("  deno task smoke");
  console.log("");
  console.log(
    "Note: deno task smoke imports Fusion Router from the published v0.1.2 Git tag and requires network access to raw.githubusercontent.com.",
  );
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : String(error));
  process.exit(1);
}
