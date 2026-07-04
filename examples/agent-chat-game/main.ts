type RoleTurn = {
  role: "Commander" | "Solver" | "Reviewer" | "Red Team" | "Closeout";
  text: string;
};

const game = {
  title: "Three Doors Puzzle",
  prompt: [
    "Three doors: A, B, C.",
    "Find the treasure.",
  ],
  clues: [
    "Clue 1 makes Door B look plausible at first.",
    "Clue 2 contradicts Door B.",
    "Door C is the only answer that avoids the trap.",
  ],
};

const turns: RoleTurn[] = [
  {
    role: "Commander",
    text: "Let's list the clues and possible contradictions.",
  },
  {
    role: "Solver",
    text: "Door B looks plausible at first.",
  },
  {
    role: "Reviewer",
    text: "Door B conflicts with clue 2.",
  },
  {
    role: "Red Team",
    text: "Check if Door C is the only answer that avoids the trap.",
  },
  {
    role: "Closeout",
    text: "Final answer: Door C.",
  },
];

const finalAnswer = "Door C";
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
    demo: "Agent Chat Game",
    game,
    role_turns: turns,
    final_answer: finalAnswer,
    correction_made_by_reviewer_red_team:
      "Solver's Door B candidate was rejected because Reviewer found a clue-2 conflict and Red Team checked Door C against the trap.",
    external_model_call: false,
    external_api_call: false,
    deterministic_fixture_note:
      "No external model/API call was made. This deterministic fixture exists for repeatable demo recording.",
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
      "# Agent Chat Game summary",
      "",
      "- Mode: `agent_chat`",
      "- Status: experimental explicit opt-in",
      "- Final answer: `Door C`",
      "- Correction: Reviewer rejects Door B; Red Team checks Door C against the trap.",
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
console.log("Demo: Agent Chat Game");
console.log("");
console.log("Game:");
for (const line of game.prompt) {
  console.log(`  ${line}`);
}
console.log("");
for (const turn of turns) {
  console.log(`${turn.role}:`);
  console.log(`  ${turn.text}`);
  console.log("");
}
console.log("Final:");
console.log(`  ${finalAnswer}`);
console.log("");
console.log("Trace:");
console.log(`  ${tracePath}`);
console.log("");
console.log(
  "No external model/API call was made. This is a deterministic demo fixture.",
);

await writeArtifacts();
console.log(`Summary: ${summaryPath}`);
