type GitHubTreeItem = {
  path?: string;
  type?: string;
  size?: number;
};

type GitHubRepoMeta = {
  default_branch?: string;
  full_name?: string;
  description?: string | null;
};

const MAX_CONTEXT_CHARS = 28_000;
const MAX_FILE_CHARS = 6_000;
const MAX_FILES = 18;

const CODE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".yml",
  ".yaml",
  ".sql",
  ".toml",
  ".lock",
]);

function extension(path: string): string {
  const index = path.lastIndexOf(".");
  return index >= 0 ? path.slice(index).toLowerCase() : "";
}

function shouldIncludePath(path: string): boolean {
  if (
    path.includes("node_modules/") || path.includes("/dist/") ||
    path.includes("/out/") || path.includes("/.git/") ||
    path.endsWith("deno.lock")
  ) return false;
  if (["README.md", "deno.json", "package.json"].includes(path)) return true;
  if (
    path.startsWith("src/") || path.startsWith("packages/") ||
    path.startsWith("docs/")
  ) {
    return CODE_EXTENSIONS.has(extension(path));
  }
  return CODE_EXTENSIONS.has(extension(path)) && path.split("/").length <= 2;
}

function priority(path: string): number {
  if (path === "README.md") return 0;
  if (path === "deno.json" || path === "package.json") return 1;
  if (path.endsWith("router.ts") || path.endsWith("src/router.ts")) return 2;
  if (path.includes("src/") && path.endsWith(".ts")) return 3;
  if (path.startsWith("packages/create-fusion-router/")) return 4;
  if (path.startsWith("docs/")) return 6;
  return 8;
}

export function findGitHubRepoUrl(
  prompt: string,
): { owner: string; repo: string; url: string } | undefined {
  const match = prompt.match(
    /https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/,
  );
  if (!match) return undefined;
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
    url: `https://github.com/${match[1]}/${match[2].replace(/\.git$/, "")}`,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "accept": "application/vnd.github+json",
      "user-agent": "fusion-router-generated-scaffold",
    },
  });
  if (!response.ok) {
    throw new Error(
      `GitHub context fetch failed ${response.status} for ${url}`,
    );
  }
  return await response.json() as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "user-agent": "fusion-router-generated-scaffold" },
  });
  if (!response.ok) {
    throw new Error(`GitHub raw fetch failed ${response.status} for ${url}`);
  }
  return await response.text();
}

function truncate(text: string, limit: number): string {
  return text.length <= limit
    ? text
    : `${text.slice(0, limit)}\n...[truncated]`;
}

export async function buildGitHubRepoContext(
  prompt: string,
): Promise<string | undefined> {
  const repoUrl = findGitHubRepoUrl(prompt);
  if (!repoUrl) return undefined;

  const meta = await fetchJson<GitHubRepoMeta>(
    `https://api.github.com/repos/${repoUrl.owner}/${repoUrl.repo}`,
  );
  const branch = meta.default_branch ?? "main";
  const tree = await fetchJson<{ tree?: GitHubTreeItem[] }>(
    `https://api.github.com/repos/${repoUrl.owner}/${repoUrl.repo}/git/trees/${
      encodeURIComponent(branch)
    }?recursive=1`,
  );
  const files = (tree.tree ?? [])
    .filter((item) =>
      item.type === "blob" && item.path && shouldIncludePath(item.path)
    )
    .sort((a, b) =>
      priority(a.path!) - priority(b.path!) || a.path!.localeCompare(b.path!)
    )
    .slice(0, MAX_FILES);

  const sections: string[] = [];
  sections.push(`# GitHub repo context fetched by Fusion Router`);
  sections.push(
    `repo: ${meta.full_name ?? `${repoUrl.owner}/${repoUrl.repo}`}`,
  );
  if (meta.description) sections.push(`description: ${meta.description}`);
  sections.push(`default_branch: ${branch}`);
  sections.push(`files_included: ${files.map((file) => file.path).join(", ")}`);

  let used = sections.join("\n").length;
  for (const file of files) {
    const path = file.path!;
    const rawUrl =
      `https://raw.githubusercontent.com/${repoUrl.owner}/${repoUrl.repo}/${
        encodeURIComponent(branch)
      }/${path.split("/").map(encodeURIComponent).join("/")}`;
    try {
      const text = truncate(await fetchText(rawUrl), MAX_FILE_CHARS);
      const section = `\n\n## ${path}\n\n\`\`\`text\n${text}\n\`\`\``;
      if (used + section.length > MAX_CONTEXT_CHARS) break;
      sections.push(section);
      used += section.length;
    } catch (error) {
      const section = `\n\n## ${path}\n[fetch failed: ${
        error instanceof Error ? error.message : String(error)
      }]`;
      if (used + section.length > MAX_CONTEXT_CHARS) break;
      sections.push(section);
      used += section.length;
    }
  }
  return sections.join("\n");
}

export async function enrichPromptWithUrlContext(
  prompt: string,
): Promise<string> {
  const context = await buildGitHubRepoContext(prompt);
  if (!context) return prompt;
  return `${prompt}\n\n${context}\n\nReview the fetched repository context above now. Do not say you will clone, browse, or read it later; the bounded context is already included. Give concrete findings from the included files and say what is missing if the context is incomplete.`;
}
