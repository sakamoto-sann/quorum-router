import {
  generateEnvExample,
  generateQuorumRouterConfig,
  generateSetupReport,
  stringifyGeneratedQuorumRouterConfig,
} from "./config-generator.ts";
import {
  type SetupProfileName,
  SetupProfileNameSchema,
} from "./setup-schema.ts";

export type SetupCliResult = {
  profile: SetupProfileName;
  wroteConfig: boolean;
  configPath: string;
};

type ParsedSetupArgs = {
  profile: SetupProfileName;
  write: boolean;
  configPath: string;
  help: boolean;
};

const DEFAULT_CONFIG_PATH = "quorum-router.config.json";

function usage(): string {
  return `quorum-router setup (dry-run by default)\n\nUsage:\n  deno task setup -- [--profile NAME] [--write [PATH]]\n  deno run --allow-read --allow-write setup.ts [--profile NAME] [--write [PATH]]\n\nProfiles:\n  ${
    SetupProfileNameSchema.options.join("\n  ")
  }\n\nOptions:\n  --profile NAME   Select a built-in setup profile. Default: minimal-direct.\n  --write [PATH]   Write generated config JSON. Without PATH writes quorum-router.config.json.\n  --help           Show this help.\n`;
}

function parseArgs(args: string[]): ParsedSetupArgs {
  let profile: SetupProfileName = "minimal-direct";
  let write = false;
  let configPath = DEFAULT_CONFIG_PATH;
  let help = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--profile") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--profile requires a value");
      }
      const parsed = SetupProfileNameSchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`Unknown setup profile: ${value}`);
      }
      profile = parsed.data;
      index += 1;
      continue;
    }
    if (arg.startsWith("--profile=")) {
      const value = arg.slice("--profile=".length);
      const parsed = SetupProfileNameSchema.safeParse(value);
      if (!parsed.success) {
        throw new Error(`Unknown setup profile: ${value}`);
      }
      profile = parsed.data;
      continue;
    }
    if (arg === "--write") {
      write = true;
      const maybePath = args[index + 1];
      if (maybePath && !maybePath.startsWith("--")) {
        configPath = maybePath;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--write=")) {
      write = true;
      configPath = arg.slice("--write=".length) || DEFAULT_CONFIG_PATH;
      continue;
    }
    throw new Error(`Unknown setup option: ${arg}`);
  }

  return { profile, write, configPath, help };
}

function parentDirectory(path: string): string | undefined {
  const slashIndex = path.lastIndexOf("/");
  const backslashIndex = path.lastIndexOf("\\");
  const index = Math.max(slashIndex, backslashIndex);
  if (index <= 0) {
    return undefined;
  }
  if (index <= 2 && /^[A-Za-z]:/.test(path)) {
    return undefined;
  }
  return path.slice(0, index);
}

async function ensureParentDirectory(path: string): Promise<void> {
  const parent = parentDirectory(path);
  if (parent) {
    await Deno.mkdir(parent, { recursive: true });
  }
}

export async function runSetupCli(
  args: string[] = Deno.args,
): Promise<SetupCliResult> {
  const parsed = parseArgs(args);
  if (parsed.help) {
    console.log(usage());
    return {
      profile: parsed.profile,
      wroteConfig: false,
      configPath: parsed.configPath,
    };
  }

  const input = { profile: parsed.profile };
  const config = generateQuorumRouterConfig(input);
  const configJson = stringifyGeneratedQuorumRouterConfig(config);
  const envExample = generateEnvExample(input);
  const report = generateSetupReport(input, parsed.configPath);

  if (parsed.write) {
    await ensureParentDirectory(parsed.configPath);
    await Deno.writeTextFile(parsed.configPath, configJson);
  }

  console.log("# quorum-router.config.json");
  console.log(configJson.trimEnd());
  console.log("\n# env placeholder guidance");
  console.log(envExample.trimEnd());
  console.log("\n# setup report");
  console.log(JSON.stringify(report, null, 2));
  console.log(
    parsed.write
      ? `\nWrote config: ${parsed.configPath}`
      : "\nDry-run only: no files written. Pass --write to write config JSON.",
  );

  return {
    profile: parsed.profile,
    wroteConfig: parsed.write,
    configPath: parsed.configPath,
  };
}

if (import.meta.main) {
  try {
    await runSetupCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}
