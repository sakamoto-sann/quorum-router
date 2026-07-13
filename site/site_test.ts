import { assert, assertEquals, assertMatch } from "@std/assert";

const root = new URL("../", import.meta.url);
const siteRoot = new URL("./site/", root);
const html = await Deno.readTextFile(new URL("index.html", siteRoot));
const css = await Deno.readTextFile(new URL("styles.css", siteRoot));
const script = await Deno.readTextFile(new URL("site.js", siteRoot));
const workflow = await Deno.readTextFile(
  new URL(".github/workflows/pages.yml", root),
);
const scaffold = JSON.parse(
  await Deno.readTextFile(
    new URL("packages/create-quorum-router/templates/basic/deno.json", root),
  ),
) as { tasks: Record<string, string> };
const scaffoldSchema = await Deno.readTextFile(
  new URL(
    "packages/create-quorum-router/templates/basic/src/schema.ts",
    root,
  ),
);

Deno.test("landing page exposes the public product contract", () => {
  assertMatch(html, /<h1[\s>]/);
  assertEquals((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert(html.includes("Route with evidence."));
  assert(html.includes("Execute only with permission."));
  assert(html.includes("Fail closed"));
  assert(html.includes("MIT"));
  assert(html.includes("advisory-only"));
  assert(html.includes("SafeLoop"));
  assert(html.includes("npx --yes create-quorum-router@latest my-router"));
});

Deno.test("landing page keeps demos on YouTube rather than in Git", () => {
  const demos = [
    "https://youtu.be/8GHw-9f1hjI",
    "https://youtu.be/RYmaAOSCkF8",
    "https://youtu.be/-878sG-VS7o",
  ];
  for (const demo of demos) assert(html.includes(demo));
  assertEquals(/\.(?:mp4|mov|webm|gif)[\"']/i.test(html), false);
});

Deno.test("displayed mode commands match generated tasks and opt-in gates", () => {
  const examples = [
    ["route:once", "RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task route:once"],
    ["best-route", "RUN_EXTERNAL_MODEL_DOGFOOD=1 deno task best-route"],
    [
      "agent-chat",
      "RUN_EXTERNAL_MODEL_DOGFOOD=1 RUN_AGENT_CHAT=1 deno task agent-chat",
    ],
  ] as const;
  for (const [task, command] of examples) {
    assert(task in scaffold.tasks, `missing generated task ${task}`);
    assert(html.includes(command), `missing exact public command ${command}`);
  }
  assert(scaffoldSchema.includes('Deno.env.get("RUN_EXTERNAL_MODEL_DOGFOOD")'));
  assert(scaffoldSchema.includes('Deno.env.get("RUN_AGENT_CHAT")'));
  assertEquals(html.includes("quorum route once"), false);
  assertEquals(html.includes("quorum best-route"), false);
  assertEquals(html.includes("quorum agent-chat"), false);
});

Deno.test("local page references and in-page anchors resolve", async () => {
  const localReferences = [
    ...html.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g),
  ].map((match) => match[1]);
  for (const reference of localReferences) {
    const stat = await Deno.stat(new URL(reference, siteRoot));
    assert(stat.isFile, `expected ${reference} to be a file`);
  }

  const ids = new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]),
  );
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map(
    (match) => match[1],
  );
  for (const anchor of anchors) {
    assert(ids.has(anchor), `missing in-page target #${anchor}`);
  }
});

Deno.test("external new-tab links are protected", () => {
  const links = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)];
  assert(links.length > 0);
  for (const [link] of links) {
    assertMatch(link, /rel="[^"]*noreferrer[^"]*"/);
  }
});

Deno.test("language, motion, and mobile accessibility remain explicit", () => {
  assert(html.includes('data-language="en"'));
  assert(html.includes('data-language="ja"'));
  assert(html.includes('class="skip-link"'));
  assert(css.includes("prefers-reduced-motion: reduce"));
  assert(css.includes("@media (max-width: 640px)"));
  assert(script.includes("navigator.clipboard.writeText"));
});

Deno.test("Pages workflow deploys only staged site files", () => {
  const pinnedActions = [
    "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
    "actions/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b",
    "actions/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa",
    "actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e",
  ];
  for (const action of pinnedActions) assert(workflow.includes(action));
  assertEquals(/uses:\s+[^\s]+@v\d+/u.test(workflow), false);
  assert(
    workflow.includes(
      "cp site/index.html site/styles.css site/site.js site/favicon.svg _site/",
    ),
  );
  assert(workflow.includes("pages: write"));
  assert(workflow.includes("id-token: write"));
  assertEquals(workflow.includes("docs/assets/launch"), false);
});
