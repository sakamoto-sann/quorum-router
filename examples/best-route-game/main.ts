type RouteCandidate = {
  route: string;
  answer: string;
  confidence: number;
  consistency: number;
  risk: "low" | "medium" | "high";
  finalScore: number;
};

const game = {
  title: "Three Doors Puzzle",
  prompt: [
    "Three doors: A, B, C.",
    "One has treasure.",
    "The clues are partially ambiguous.",
  ],
  clues: [
    "Clue 1: Door B is tempting because one sign points there.",
    "Clue 2: Door B conflicts with the consistency check.",
    "Clue 3: Door C is the only answer that satisfies every clue.",
  ],
};

const candidates: RouteCandidate[] = [
  {
    route: "fast_direct",
    answer: "Door B",
    confidence: 0.62,
    consistency: 0.40,
    risk: "low",
    finalScore: 0.62,
  },
  {
    route: "structured_direct",
    answer: "Door C",
    confidence: 0.78,
    consistency: 0.92,
    risk: "low",
    finalScore: 0.88,
  },
  {
    route: "guarded_direct",
    answer: "Door C",
    confidence: 0.73,
    consistency: 0.88,
    risk: "low",
    finalScore: 0.81,
  },
];

const selected =
  candidates.toSorted((left, right) =>
    right.finalScore - left.finalScore || right.consistency - left.consistency
  )[0];

const reason = "Highest clue-consistency score with low risk.";
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
    candidate.route.padEnd(18),
    candidate.answer.padEnd(8),
    fixed(candidate.confidence).padEnd(12),
    fixed(candidate.consistency).padEnd(13),
    candidate.risk.padEnd(6),
    fixed(candidate.finalScore),
  ].join("  ");
}

async function writeArtifacts() {
  const repoRoot = new URL("../../", import.meta.url);
  const outDir = new URL("out/examples/", repoRoot);
  await Deno.mkdir(outDir, { recursive: true });

  const trace = {
    mode: "best_route",
    demo: "Best Route Game",
    game,
    route_candidates: candidates,
    scores: candidates.map((candidate) => ({
      route: candidate.route,
      answer: candidate.answer,
      confidence: candidate.confidence,
      consistency: candidate.consistency,
      risk: candidate.risk,
      final_score: candidate.finalScore,
    })),
    selected_route: selected.route,
    final_answer: selected.answer,
    reason,
    external_model_call: false,
    external_api_call: false,
    deterministic_fixture_note:
      "No external model/API call was made. This deterministic fixture exists for repeatable demo recording.",
  };

  await Deno.writeTextFile(
    new URL(traceFileName, outDir),
    `${JSON.stringify(trace, null, 2)}\n`,
  );

  await Deno.writeTextFile(
    new URL(summaryFileName, outDir),
    [
      "# Best Route Game summary",
      "",
      "- Mode: `best_route`",
      "- Selected route: `structured_direct`",
      "- Final answer: `Door C`",
      `- Why: ${reason}`,
      "- External model/API calls: none",
      "- Fixture: deterministic and repeatable",
      "",
    ].join("\n"),
  );
}

console.log("Fusion Router v0.1 Public RC");
console.log("Mode: best_route");
console.log("Demo: Best Route Game");
console.log("");
console.log("Game:");
for (const line of game.prompt) {
  console.log(`  ${line}`);
}
console.log("");
console.log("Routes evaluated:");
for (const candidate of candidates) {
  console.log(`  ${candidate.route}`);
}
console.log("");
console.log("Score table:");
console.log(
  `  ${
    [
      "route".padEnd(18),
      "answer".padEnd(8),
      "confidence".padEnd(12),
      "consistency".padEnd(13),
      "risk".padEnd(6),
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
console.log("Final answer:");
console.log(`  ${selected.answer}`);
console.log("");
console.log("Why:");
console.log(`  ${reason}`);
console.log("");
console.log("Trace:");
console.log(`  ${tracePath}`);
console.log("");
console.log(
  "No external model/API call was made. This is a deterministic demo fixture.",
);

await writeArtifacts();
console.log(`Summary: ${summaryPath}`);
