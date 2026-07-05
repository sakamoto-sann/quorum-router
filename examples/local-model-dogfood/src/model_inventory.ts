import type { ModelInventory } from "./schema.ts";
import { discoverInventory } from "./auth_discovery.ts";
import { OUT_DIR } from "./trace.ts";

export async function writeInventory(inventory: ModelInventory): Promise<void> {
  await Deno.mkdir(OUT_DIR, { recursive: true });
  await Deno.writeTextFile(
    `${OUT_DIR}/model-inventory.json`,
    `${JSON.stringify(inventory, null, 2)}\n`,
    { mode: 0o600 },
  );
  const lines = [
    "# Local model inventory",
    "",
    `Generated: ${inventory.generated_at}`,
    `Auth mode: ${inventory.auth_mode}`,
    `Available: ${inventory.available_count}`,
    `Blocked: ${inventory.blocked_count}`,
    `Env fallback configured: ${inventory.env_fallback_configured}`,
    `Env fallback used: ${inventory.env_fallback_used}`,
    "",
    "| provider | model | source | auth | available | can_list_models | can_invoke | blocked_reason |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- |",
    ...inventory.entries.map((entry) =>
      `| ${entry.provider} | ${entry.model} | ${entry.source} | ${entry.auth_mode} | ${entry.available} | ${entry.can_list_models} | ${entry.can_invoke} | ${
        entry.blocked_reason ?? ""
      } |`
    ),
    "",
  ];
  await Deno.writeTextFile(
    `${OUT_DIR}/model-inventory.md`,
    `${lines.join("\n")}\n`,
    { mode: 0o600 },
  );
}

export async function inventoryCommand(): Promise<ModelInventory> {
  const inventory = discoverInventory();
  await writeInventory(inventory);
  return inventory;
}
