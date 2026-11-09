/**
 * Keeps library-owned modules in the create-quorum-router template in sync.
 *
 * The scaffold must stay self-contained (it never fetches remote code), so it
 * ships copies of a few library modules. `src/` is the single source of truth
 * for those modules; the template copies are generated from it.
 *
 *   deno task scaffold:sync   rewrite the template copies from src/
 *   deno task scaffold:check  fail if any template copy drifted
 *
 * The drift check also runs in `deno task test` via scaffold_sync_test.ts.
 */
const TEMPLATE_SRC = "packages/create-quorum-router/templates/basic/src";

/** Library module -> template copy, relative to the repository root. */
export const SCAFFOLD_COPIES: ReadonlyArray<
  { source: string; target: string }
> = [
  {
    source: "src/calibration/calibration.ts",
    target: `${TEMPLATE_SRC}/calibration.ts`,
  },
  { source: "src/env.ts", target: `${TEMPLATE_SRC}/env.ts` },
];

export const REPO_ROOT: URL = new URL("../../", import.meta.url);

/** Expected content of a template copy: a do-not-edit header plus the source. */
export function generatedCopy(source: string, content: string): string {
  return `// Copied from the QuorumRouter library (${source}) by \`deno task scaffold:sync\`.\n// Edit the library source, not this copy.\n${content}`;
}

async function readOptional(path: URL): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

/** Returns the template copies whose content no longer matches their source. */
export async function findScaffoldDrift(
  root: URL = REPO_ROOT,
  copies = SCAFFOLD_COPIES,
): Promise<string[]> {
  const drifted: string[] = [];
  for (const { source, target } of copies) {
    const expected = generatedCopy(
      source,
      await Deno.readTextFile(new URL(source, root)),
    );
    if (await readOptional(new URL(target, root)) !== expected) {
      drifted.push(target);
    }
  }
  return drifted;
}

/** Rewrites drifted template copies and returns the ones it changed. */
export async function syncScaffold(
  root: URL = REPO_ROOT,
  copies = SCAFFOLD_COPIES,
): Promise<string[]> {
  const drifted = await findScaffoldDrift(root, copies);
  for (const { source, target } of copies) {
    if (!drifted.includes(target)) continue;
    await Deno.writeTextFile(
      new URL(target, root),
      generatedCopy(source, await Deno.readTextFile(new URL(source, root))),
    );
  }
  return drifted;
}

if (import.meta.main) {
  const check = Deno.args.includes("--check");
  const changed = check ? await findScaffoldDrift() : await syncScaffold();
  if (check && changed.length > 0) {
    console.error(
      `Scaffold copies drifted from src/: ${
        changed.join(", ")
      }\nRun: deno task scaffold:sync`,
    );
    Deno.exit(1);
  }
  console.log(
    changed.length === 0
      ? "Scaffold copies match src/."
      : `${check ? "Drifted" : "Updated"}: ${changed.join(", ")}`,
  );
}
