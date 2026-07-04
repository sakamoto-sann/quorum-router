type SampleTask = {
  id: string;
  category: string;
  task: string;
  recommendedMode: "best_route" | "agent_chat" | "human baseline";
  expectedValue: string;
};

const here = new URL(".", import.meta.url);
const tasksUrl = new URL("sample-tasks.json", here);
const templateUrl = new URL("../../docs/dogfood/dev-session-template.md", here);
const outDirUrl = new URL("../../out/dogfood/dev-sessions/", here);

const tasks = JSON.parse(await Deno.readTextFile(tasksUrl)) as SampleTask[];

function printTasks() {
  console.log("Available dev dogfood sample tasks:");
  for (const task of tasks) {
    console.log(`- ${task.id} [${task.recommendedMode}] ${task.task}`);
  }
}

if (Deno.args.includes("--list")) {
  printTasks();
  Deno.exit(0);
}

const requested = Deno.args.find((arg) => !arg.startsWith("--")) ??
  Deno.env.get("FUSION_ROUTER_DEV_TASK_ID") ??
  "DOC-001";
const maybeTask = tasks.find((candidate) => candidate.id === requested);

if (!maybeTask) {
  console.error(`Unknown task ID: ${requested}`);
  printTasks();
  Deno.exit(1);
}
const selectedTask = maybeTask as SampleTask;

const template = await Deno.readTextFile(templateUrl);
const now = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const safeId = selectedTask.id.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-");
const outputUrl = new URL(`${now}-${safeId}.md`, outDirUrl);

const prefilled = template
  .replace(/\| Date\s*\|\s*\|/, `| Date | ${new Date().toISOString()} |`)
  .replace(
    /\| Task source\s*\|\s*\|/,
    `| Task source | ${selectedTask.id} — ${selectedTask.category} |`,
  )
  .replace(
    /\| Mode tested\s*\|\s*\|/,
    `| Mode tested | ${selectedTask.recommendedMode} |`,
  )
  .replace(
    "Paste the exact real development task or decision here.",
    `${selectedTask.task}\n\nExpected value: ${selectedTask.expectedValue}`,
  );

await Deno.mkdir(outDirUrl, { recursive: true });
await Deno.writeTextFile(outputUrl, prefilled);

console.log("Created Fusion Router dev dogfood session log:");
console.log(`  ${new URL(outputUrl).pathname}`);
console.log("");
console.log("Selected task:");
console.log(`  ${selectedTask.id}: ${selectedTask.task}`);
console.log(`  Recommended mode: ${selectedTask.recommendedMode}`);
console.log("");
console.log("Next manual steps:");
console.log("  1. Fill tester/environment and human baseline fields.");
console.log("  2. Run or manually evaluate the real development task.");
console.log("  3. Paste Fusion Router output or routing analysis.");
console.log("  4. Score all seven metrics and classify launch impact.");
console.log("");
console.log("No network/API call was made. No credentials were read.");
