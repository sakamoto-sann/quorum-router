import type { ModelInventory } from "./schema.ts";
import { discoverInventoryWithModelListing } from "./auth_session.ts";
import { OUT_DIR } from "./trace.ts";

export async function writeInventory(
  inventory: ModelInventory,
  outDir: string = OUT_DIR,
): Promise<void> {
  await Deno.mkdir(outDir, { recursive: true });
  await Deno.writeTextFile(
    `${outDir}/model-inventory.json`,
    `${JSON.stringify(inventory, null, 2)}\n`,
    { mode: 0o600 },
  );
  const lines = [
    "# QuorumRouter model inventory",
    "",
    `Generated: ${inventory.generated_at}`,
    `Auth mode: ${inventory.auth_mode}`,
    `Available: ${inventory.available_count}`,
    `Blocked: ${inventory.blocked_count}`,
    `Env fallback configured: ${inventory.env_fallback_configured}`,
    `Env fallback used: ${inventory.env_fallback_used}`,
    "",
    "| provider | model | listed_models | source | auth | available | can_list_models | can_invoke | blocked_reason | list_blocked_reason |",
    "| --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |",
    ...inventory.entries.map((entry) =>
      `| ${entry.provider} | ${entry.model} | ${
        (entry.listed_models ?? []).join(", ")
      } | ${entry.source} | ${entry.auth_mode} | ${entry.available} | ${entry.can_list_models} | ${entry.can_invoke} | ${
        entry.blocked_reason ?? ""
      } | ${entry.list_blocked_reason ?? ""} |`
    ),
    "",
  ];
  await Deno.writeTextFile(
    `${outDir}/model-inventory.md`,
    `${lines.join("\n")}\n`,
    { mode: 0o600 },
  );
}

export async function inventoryCommand(
  outDir: string = OUT_DIR,
): Promise<ModelInventory> {
  const inventory = await discoverInventoryWithModelListing();
  await writeInventory(inventory, outDir);
  return inventory;
}

export function printInventoryTable(inventory: ModelInventory): void {
  console.log("Provider        Status       Auth        Models");
  for (const entry of inventory.entries) {
    const status = entry.available ? "discovered" : "blocked";
    const models = entry.listed_models?.length
      ? entry.listed_models.join(", ")
      : entry.model;
    console.log(
      `${entry.provider.padEnd(15)} ${status.padEnd(12)} ${
        String(entry.auth_mode).padEnd(11)
      } ${models}`,
    );
  }
  console.log(
    "Status note: discovered means command/config present; live authentication is not verified.",
  );
}
