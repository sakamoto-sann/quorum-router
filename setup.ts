import { runSetupCli } from "./src/setup/cli.ts";

try {
  await runSetupCli();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  Deno.exit(1);
}
