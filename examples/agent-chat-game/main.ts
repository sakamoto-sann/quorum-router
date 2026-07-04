type MatchTurn = {
  move: string;
  agent: "Grok" | "GLM";
  text: string;
};

const game = {
  title: "Mini Shogi Opening Excerpt",
  agents: {
    sente: "Grok",
    gote: "GLM",
  },
  note:
    "Grok and GLM are deterministic fixture agent labels; no external model/API call is made.",
  board: [
    "    5  4  3  2  1",
    "a   .  .  k  .  .",
    "b   .  b  .  r  .",
    "c   p  p  p  p  p",
    "d   P  P  P  P  P",
    "e   .  R  .  B  K",
  ],
};

const turns: MatchTurn[] = [
  {
    move: "1.",
    agent: "Grok",
    text: "▲P-76 — opens the bishop diagonal.",
  },
  {
    move: "1...",
    agent: "GLM",
    text: "△P-34 — mirrors the center fight.",
  },
  {
    move: "2.",
    agent: "Grok",
    text: "▲P-26 — prepares rook-side pressure.",
  },
  {
    move: "2...",
    agent: "GLM",
    text: "△P-84 — challenges the rook file.",
  },
  {
    move: "3.",
    agent: "Grok",
    text: "▲S-68 — develops instead of over-pushing.",
  },
  {
    move: "3...",
    agent: "GLM",
    text: "△P-85 — the counterattack starts; fade out before the full match.",
  },
];

const finalFrame = "Match continues after this opening excerpt...";
const outDirDisplayPath = "../../out/examples";
const traceFileName = "agent-chat-game-trace.json";
const summaryFileName = "agent-chat-game-summary.md";
const tracePath = `${outDirDisplayPath}/${traceFileName}`;
const summaryPath = `${outDirDisplayPath}/${summaryFileName}`;

async function writeArtifacts() {
  const repoRoot = new URL("../../", import.meta.url);
  const outDir = new URL("out/examples/", repoRoot);
  await Deno.mkdir(outDir, { recursive: true });

  const trace = {
    mode: "agent_chat",
    explicit_opt_in: true,
    status: "experimental",
    demo: "Mini Shogi Opening Excerpt",
    game,
    fixture_agents: ["Grok", "GLM"],
    role_turns: turns,
    fadeout_note: finalFrame,
    external_model_call: false,
    external_api_call: false,
    deterministic_fixture_note:
      "Grok and GLM are fixture labels only. No external Grok/GLM model/API call was made.",
    runtime_boundaries: [
      "agent_chat is experimental explicit opt-in only",
      "not Best Route mode",
      "not a production autonomous runtime",
      "no live Supabase Agent Bus runtime writes",
      "no service-role runtime",
    ],
  };

  await Deno.writeTextFile(
    new URL(traceFileName, outDir),
    `${JSON.stringify(trace, null, 2)}\n`,
  );

  await Deno.writeTextFile(
    new URL(summaryFileName, outDir),
    [
      "# Agent Chat Shogi excerpt summary",
      "",
      "- Mode: `agent_chat`",
      "- Status: experimental explicit opt-in",
      "- Fixture agents: `Grok` vs `GLM`",
      "- Shown excerpt: six opening half-moves",
      "- Fadeout: match continues after the opening excerpt",
      "- External model/API calls: none",
      "- Fixture: deterministic and repeatable",
      "- Boundary: not Best Route mode and not a production autonomous runtime",
      "",
    ].join("\n"),
  );
}

console.log("Fusion Router v0.1 Public RC");
console.log("Mode: agent_chat");
console.log("Status: experimental explicit opt-in");
console.log("Demo: Mini Shogi Opening Excerpt");
console.log("Fixture agents: Grok vs GLM");
console.log("");
console.log("Board:");
for (const line of game.board) {
  console.log(`  ${line}`);
}
console.log("");
console.log("Partial match:");
for (const turn of turns) {
  console.log(`${turn.move} ${turn.agent}:`);
  console.log(`  ${turn.text}`);
  console.log("");
}
console.log("Fadeout:");
console.log(`  ${finalFrame}`);
console.log("");
console.log("Trace:");
console.log(`  ${tracePath}`);
console.log("");
console.log(
  "No external Grok/GLM model/API call was made. This is a deterministic demo fixture.",
);

await writeArtifacts();
console.log(`Summary: ${summaryPath}`);
