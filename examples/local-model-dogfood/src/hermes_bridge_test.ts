import { assertEquals } from "@std/assert";
import { boundedContent } from "./hermes_bridge.ts";

Deno.test("Hermes bridge preserves bounded responses", () => {
  assertEquals(boundedContent("ready"), {
    content: "ready",
    truncated: false,
  });
});

Deno.test("Hermes bridge truncates oversized responses", () => {
  const result = boundedContent("x".repeat(24_001));
  assertEquals(result.content.length, 24_000);
  assertEquals(result.truncated, true);
});

Deno.test("Hermes bridge rejects oversized stdin before JSON parsing", async () => {
  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env",
      "--allow-read",
      `${import.meta.dirname}/hermes_bridge.ts`,
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = child.stdin.getWriter();
  const chunk = new TextEncoder().encode("x".repeat(60_000));
  await writer.write(chunk);
  await writer.write(chunk);
  await writer.write(new TextEncoder().encode("x")).catch(() => undefined);
  await writer.close().catch(() => undefined);
  const output = await child.output();
  assertEquals(output.code, 1);
  const payload = JSON.parse(new TextDecoder().decode(output.stdout));
  assertEquals(payload.ok, false);
  assertEquals(
    payload.error,
    "quorum-router Hermes bridge input exceeds 120000 bytes",
  );
});
