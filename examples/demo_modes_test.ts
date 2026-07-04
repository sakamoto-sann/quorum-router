import { assertEquals, assertStringIncludes } from "@std/assert";

async function runDemo(cwd: string): Promise<string> {
  const command = new Deno.Command("deno", {
    args: ["task", "demo"],
    cwd,
    stdout: "piped",
    stderr: "piped",
  });
  const output = await command.output();
  const stdout = new TextDecoder().decode(output.stdout);
  const stderr = new TextDecoder().decode(output.stderr);
  assertEquals(output.code, 0, stderr || stdout);
  return stdout;
}

Deno.test("Best Route Game demo stays route-comparison only", async () => {
  const stdout = await runDemo("examples/best-route-game");
  assertStringIncludes(stdout, "Mode: best_route");
  assertStringIncludes(stdout, "Selected route:");
  assertStringIncludes(stdout, "Final answer:\n  Door C");
  assertEquals(stdout.includes("Commander:"), false);
  assertEquals(stdout.includes("Red Team:"), false);

  const traceText = await Deno.readTextFile(
    "out/examples/best-route-game-trace.json",
  );
  const trace = JSON.parse(traceText);
  assertEquals(trace.mode, "best_route");
  assertEquals(trace.selected_route, "structured_direct");
  assertEquals(trace.final_answer, "Door C");
  assertEquals(trace.external_model_call, false);
  assertEquals(trace.external_api_call, false);
});

Deno.test("Agent Chat Game demo stays explicit opt-in conversation only", async () => {
  const stdout = await runDemo("examples/agent-chat-game");
  assertStringIncludes(stdout, "Mode: agent_chat");
  assertStringIncludes(stdout, "experimental explicit opt-in");
  assertStringIncludes(stdout, "Commander:");
  assertStringIncludes(stdout, "Reviewer:");
  assertStringIncludes(stdout, "Red Team:");
  assertStringIncludes(stdout, "Final answer: Door C");
  assertEquals(stdout.includes("Score table:"), false);

  const traceText = await Deno.readTextFile(
    "out/examples/agent-chat-game-trace.json",
  );
  const trace = JSON.parse(traceText);
  assertEquals(trace.mode, "agent_chat");
  assertEquals(trace.explicit_opt_in, true);
  assertEquals(trace.status, "experimental");
  assertEquals(trace.final_answer, "Door C");
  assertEquals(trace.external_model_call, false);
  assertEquals(trace.external_api_call, false);
});
