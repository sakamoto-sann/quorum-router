type RouteCandidate = {
  route: string;
  agent: "Grok" | "GLM";
  move: string;
  plan: string;
  clarity: number;
  safety: number;
  tempo: number;
  finalScore: number;
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
  excerpt: [
    "1. Grok ▲P-76   opens the bishop diagonal",
    "1... GLM △P-34  mirrors the center fight",
    "2. Grok ▲P-26   prepares rook pressure",
    "2... GLM △P-84  challenges the file",
  ],
};

const candidates: RouteCandidate[] = [
  {
    route: "grok_attack",
    agent: "Grok",
    move: "▲P-25",
    plan: "Push rook-side pressure immediately.",
    clarity: 0.78,
    safety: 0.62,
    tempo: 0.86,
    finalScore: 0.75,
  },
  {
    route: "glm_counter_watch",
    agent: "GLM",
    move: "△P-85",
    plan: "Expect the counter-push and test whether Grok has overextended.",
    clarity: 0.70,
    safety: 0.76,
    tempo: 0.72,
    finalScore: 0.73,
  },
  {
    route: "balanced_development",
    agent: "Grok",
    move: "▲S-68",
    plan:
      "Develop silver first; keep the attack while reducing bishop-file risk.",
    clarity: 0.86,
    safety: 0.90,
    tempo: 0.80,
    finalScore: 0.87,
  },
];

const selected =
  candidates.toSorted((left, right) => right.finalScore - left.finalScore)[0];

const reason =
  "Balanced development keeps Grok's attack alive while respecting GLM's counterplay.";
const outDirDisplayPath = "../../out/examples";
const traceFileName = "best-route-game-trace.json";
const summaryFileName = "best-route-game-summary.md";
const tracePath = `${outDirDisplayPath}/${traceFileName}`;
const summaryPath = `${outDirDisplayPath}/${summaryFileName}`;

function fixed(value: number): string {
  return value.toFixed(2);
}

function row(candidate: RouteCandidate): string {
  return [
    candidate.route.padEnd(20),
    candidate.agent.padEnd(6),
    candidate.move.padEnd(8),
    fixed(candidate.clarity).padEnd(8),
    fixed(candidate.safety).padEnd(8),
    fixed(candidate.tempo).padEnd(7),
    fixed(candidate.finalScore),
  ].join("  ");
}

async function writeArtifacts() {
  const repoRoot = new URL("../../", import.meta.url);
  const outDir = new URL("out/examples/", repoRoot);
  await Deno.mkdir(outDir, { recursive: true });

  const trace = {
    mode: "best_route",
    demo: "Mini Shogi Opening Excerpt",
    game,
    route_candidates: candidates,
    scores: candidates.map((candidate) => ({
      route: candidate.route,
      agent: candidate.agent,
      move: candidate.move,
      clarity: candidate.clarity,
      safety: candidate.safety,
      tempo: candidate.tempo,
      final_score: candidate.finalScore,
    })),
    selected_route: selected.route,
    selected_agent: selected.agent,
    selected_move: selected.move,
    fadeout_note:
      "Only the opening excerpt is shown; the match continues after fadeout.",
    reason,
    external_model_call: false,
    external_api_call: false,
    deterministic_fixture_note:
      "Grok and GLM are fixture labels only. No external Grok/GLM model/API call was made.",
  };

  await Deno.writeTextFile(
    new URL(traceFileName, outDir),
    `${JSON.stringify(trace, null, 2)}\n`,
  );

  await Deno.writeTextFile(
    new URL(summaryFileName, outDir),
    [
      "# Best Route Shogi excerpt summary",
      "",
      "- Mode: `best_route`",
      "- Fixture agents: `Grok` vs `GLM`",
      "- Selected route: `balanced_development`",
      "- Next move: `Grok ▲S-68`",
      "- Fadeout: match continues after the opening excerpt",
      "- External model/API calls: none",
      "- Fixture: deterministic and repeatable",
      "",
    ].join("\n"),
  );
}

console.log("Fusion Router v0.1 Public RC");
console.log("Mode: best_route");
console.log("Demo: Mini Shogi Opening Excerpt");
console.log("Fixture agents: Grok vs GLM");
console.log("");
console.log("Board:");
for (const line of game.board) {
  console.log(`  ${line}`);
}
console.log("");
console.log("Opening excerpt:");
for (const line of game.excerpt) {
  console.log(`  ${line}`);
}
console.log("");
console.log("Routes evaluated:");
console.log(
  `  ${
    [
      "route".padEnd(20),
      "agent".padEnd(6),
      "move".padEnd(8),
      "clarity".padEnd(8),
      "safety".padEnd(8),
      "tempo".padEnd(7),
      "final_score",
    ].join("  ")
  }`,
);
for (const candidate of candidates) {
  console.log(`  ${row(candidate)}`);
}
console.log("");
console.log("Selected route:");
console.log(`  ${selected.route}`);
console.log("");
console.log("Next move:");
console.log(`  ${selected.agent} ${selected.move}`);
console.log("");
console.log("Why:");
console.log(`  ${reason}`);
console.log("");
console.log("Fadeout preview:");
console.log("  Match continues after this opening excerpt...");
console.log("");
console.log("Trace:");
console.log(`  ${tracePath}`);
console.log("");
console.log(
  "No external Grok/GLM model/API call was made. This is a deterministic demo fixture.",
);

await writeArtifacts();
console.log(`Summary: ${summaryPath}`);
