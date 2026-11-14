import { assert, assertEquals, assertRejects } from "@std/assert";
import { callWrapper } from "./templates/basic/src/wrapper_client.ts";
import { discoverInventory } from "./templates/basic/src/auth_session.ts";
import type {
  McpIsolation,
  ModelInventoryEntry,
} from "./templates/basic/src/schema.ts";

const ALLOW_ENV = "QUORUM_ROUTER_ALLOW_UNISOLATED_CLIS";

async function withEnv<T>(
  values: Record<string, string | undefined>,
  fn: () => Promise<T> | T,
): Promise<T> {
  const saved = Object.keys(values).map((key) => [key, Deno.env.get(key)]);
  for (const [key, value] of Object.entries(values)) {
    value === undefined ? Deno.env.delete(key) : Deno.env.set(key, value);
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of saved) {
      value === undefined ? Deno.env.delete(key!) : Deno.env.set(key!, value);
    }
  }
}

async function fakeCli(dir: string, name: string, body: string) {
  const path = `${dir}/${name}`;
  await Deno.writeTextFile(path, `#!/bin/sh\n${body}\n`, { mode: 0o700 });
  return path;
}

function entry(
  command: string,
  mcpIsolation?: McpIsolation,
): ModelInventoryEntry {
  return {
    provider: "Fixture",
    auth_mode: "session",
    model: "fixture-cli",
    model_id: "fixture/fixture-cli",
    source: "local_cli",
    available: true,
    can_list_models: false,
    can_invoke: true,
    notes: [],
    command,
    args_template: [],
    prompt_transport: "stdin",
    ...(mcpIsolation ? { mcp_isolation: mcpIsolation } : {}),
  };
}

Deno.test({
  name: "CLIs without MCP isolation never start unless named in the allow list",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const dir = await Deno.makeTempDir();
    try {
      const marker = `${dir}/started`;
      const cli = await fakeCli(dir, "fake-cli", `: > "${marker}"; echo ran`);
      for (const isolation of [{ kind: "none" } as const, undefined]) {
        await withEnv({ [ALLOW_ENV]: undefined }, async () => {
          await assertRejects(
            () =>
              callWrapper(entry(cli, isolation), "hi", {
                outDir: `${dir}/out`,
              }),
            Error,
            `set ${ALLOW_ENV}=fake-cli to allow it`,
          );
        });
        assertEquals(await Deno.stat(marker).catch(() => null), null);
      }

      await withEnv({ [ALLOW_ENV]: "other, fake-cli" }, async () => {
        const result = await callWrapper(entry(cli, { kind: "none" }), "hi", {
          outDir: `${dir}/out`,
        });
        assertEquals(result.raw_content, "ran");
      });
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name:
    "workspace isolation runs the CLI in a private dir holding the override",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const dir = await Deno.makeTempDir();
    try {
      const cli = await fakeCli(
        dir,
        "fake-gemini",
        'printf "%s|" "$(pwd)"; cat .gemini/settings.json',
      );
      const result = await withEnv(
        { [ALLOW_ENV]: undefined },
        () =>
          callWrapper(
            entry(cli, {
              kind: "workspace_settings",
              files: { ".gemini/settings.json": '{ "mcpServers": {} }' },
            }),
            "hi",
            { outDir: `${dir}/out` },
          ),
      );
      const [cwd, settings] = result.raw_content.split("|");
      assertEquals(settings, '{ "mcpServers": {} }');
      assert(cwd.startsWith(await Deno.realPath(`${dir}/out`)), cwd);
      assertEquals(await Deno.stat(cwd).catch(() => null), null);
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});

Deno.test({
  name: "inventory blocks unisolated CLIs with the opt-in hint",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const dir = await Deno.makeTempDir();
    try {
      for (const name of ["claude", "grok"]) await fakeCli(dir, name, "exit 0");
      const byCommand = () =>
        Object.fromEntries(
          discoverInventory("auto").entries
            .filter((item) => item.command)
            .map((item) => [item.command, item]),
        );

      await withEnv({ PATH: dir, [ALLOW_ENV]: undefined }, () => {
        const entries = byCommand();
        assertEquals(entries.claude.can_invoke, true);
        assertEquals(entries.claude.mcp_isolation, { kind: "args" });
        assertEquals(entries.grok.available, true);
        assertEquals(entries.grok.can_invoke, false);
        assert(
          entries.grok.blocked_reason?.includes(`${ALLOW_ENV}=grok`),
          entries.grok.blocked_reason,
        );
      });
      await withEnv({ PATH: dir, [ALLOW_ENV]: "grok" }, () => {
        assertEquals(byCommand().grok.can_invoke, true);
      });
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});
