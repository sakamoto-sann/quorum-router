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

Deno.test("Best Route shogi demo stays route-comparison only", async () => {
  const stdout = await runDemo("examples/best-route-game");
  assertStringIncludes(stdout, "Mode: best_route");
  assertStringIncludes(stdout, "Mini Shogi Opening Excerpt");
  assertStringIncludes(stdout, "Fixture agents: Grok vs GLM");
  assertStringIncludes(stdout, "Routes evaluated:");
  assertStringIncludes(stdout, "Selected route:\n  balanced_development");
  assertStringIncludes(stdout, "Next move:\n  Grok ▲S-68");
  assertStringIncludes(stdout, "Fadeout preview:");
  assertEquals(stdout.includes("Mode: agent_chat"), false);

  const traceText = await Deno.readTextFile(
    "out/examples/best-route-game-trace.json",
  );
  const trace = JSON.parse(traceText);
  assertEquals(trace.mode, "best_route");
  assertEquals(trace.selected_route, "balanced_development");
  assertEquals(trace.selected_agent, "Grok");
  assertEquals(trace.selected_move, "▲S-68");
  assertEquals(trace.external_model_call, false);
  assertEquals(trace.external_api_call, false);
});

Deno.test("Agent Chat shogi demo stays explicit opt-in excerpt only", async () => {
  const stdout = await runDemo("examples/agent-chat-game");
  assertStringIncludes(stdout, "Mode: agent_chat");
  assertStringIncludes(stdout, "experimental explicit opt-in");
  assertStringIncludes(stdout, "Mini Shogi Opening Excerpt");
  assertStringIncludes(stdout, "Fixture agents: Grok vs GLM");
  assertStringIncludes(stdout, "1. Grok:");
  assertStringIncludes(stdout, "1... GLM:");
  assertStringIncludes(stdout, "3... GLM:");
  assertStringIncludes(stdout, "Fadeout:");
  assertStringIncludes(stdout, "Match continues after this opening excerpt");
  assertEquals(stdout.includes("Routes evaluated:"), false);

  const traceText = await Deno.readTextFile(
    "out/examples/agent-chat-game-trace.json",
  );
  const trace = JSON.parse(traceText);
  assertEquals(trace.mode, "agent_chat");
  assertEquals(trace.explicit_opt_in, true);
  assertEquals(trace.status, "experimental");
  assertEquals(trace.fixture_agents, ["Grok", "GLM"]);
  assertEquals(trace.external_model_call, false);
  assertEquals(trace.external_api_call, false);
});
