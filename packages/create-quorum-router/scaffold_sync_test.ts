import { assertEquals, assertStringIncludes } from "@std/assert";
import {
  findScaffoldDrift,
  generatedCopy,
  SCAFFOLD_COPIES,
  syncScaffold,
} from "./scaffold_sync.ts";

/** File URL for a native directory path; the URL setter escapes special characters. */
function directoryUrl(path: string): URL {
  const url = new URL("file:///");
  url.pathname = `${path.replaceAll("\\", "/")}/`;
  return url;
}

Deno.test("template copies of library modules match src/", async () => {
  // On failure run `deno task scaffold:sync` and commit the result.
  assertEquals(await findScaffoldDrift(), []);
});

Deno.test("scaffold sync rewrites drifted and missing copies only", async () => {
  const root = await Deno.makeTempDir();
  try {
    const rootUrl = directoryUrl(root);
    await Deno.mkdir(`${root}/src`);
    await Deno.mkdir(`${root}/out`);
    await Deno.writeTextFile(`${root}/src/a.ts`, "export const a = 1;\n");
    await Deno.writeTextFile(`${root}/src/b.ts`, "export const b = 2;\n");
    await Deno.writeTextFile(
      `${root}/out/a.ts`,
      generatedCopy("src/a.ts", "export const a = 1;\n"),
    );
    const copies = [
      { source: "src/a.ts", target: "out/a.ts" },
      { source: "src/b.ts", target: "out/b.ts" },
    ];

    assertEquals(await findScaffoldDrift(rootUrl, copies), ["out/b.ts"]);
    assertEquals(await syncScaffold(rootUrl, copies), ["out/b.ts"]);
    assertEquals(await findScaffoldDrift(rootUrl, copies), []);

    await Deno.writeTextFile(`${root}/out/a.ts`, "export const a = 99;\n");
    assertEquals(await findScaffoldDrift(rootUrl, copies), ["out/a.ts"]);
    await syncScaffold(rootUrl, copies);
    assertStringIncludes(
      await Deno.readTextFile(`${root}/out/a.ts`),
      "Edit the library source, not this copy.\nexport const a = 1;\n",
    );
  } finally {
    await Deno.remove(root, { recursive: true });
  }
});

Deno.test("every scaffold copy target ships in the npm tarball", async () => {
  const tarballFiles: string[] = JSON.parse(
    await Deno.readTextFile(new URL("./tarball-files.json", import.meta.url)),
  );
  for (const { target } of SCAFFOLD_COPIES) {
    const packaged = target.replace("packages/create-quorum-router/", "");
    assertEquals(tarballFiles.includes(packaged), true, packaged);
  }
});
