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
