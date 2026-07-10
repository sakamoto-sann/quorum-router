export type ProviderId = "grok" | "devin" | "openai" | "localqwen" | "glm";
export type ProviderMode = "http_openai_compatible" | "cli";

export type ExternalProviderConfig = {
  id: ProviderId;
  providerLabel: string;
  providerMode: ProviderMode;
  model: string;
  baseUrl?: string;
  credential?: string;
  command?: string;
  args?: string[];
};

export type PublicExternalProviderConfig =
  & Omit<
    ExternalProviderConfig,
    "credential"
  >
  & {
    credentialPresent: boolean;
  };

export type ExternalProviderResult = {
  responseReceived: true;
  schemaValid: true;
  providerId: ProviderId;
  providerLabel: string;
  providerMode: ProviderMode;
  model: string;
  responseSummary: string;
  rawContent: string;
};

const CONFIG_PATH = "provider_config.json";
const EXAMPLE_CONFIG_PATH = "provider_config.example.json";
const MAX_SUMMARY_LENGTH = 500;
const DEFAULT_PROVIDER_TIMEOUT_MS = 120_000;
const DEFAULT_MATRIX: ProviderId[] = [
  "grok",
  "devin",
  "openai",
  "localqwen",
  "glm",
];

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function firstEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = env(name);
    if (value) return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
}

async function readJsonIfPresent(
  path: string,
): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await Deno.readTextFile(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return {};
    throw error;
  }
  try {
    return asRecord(JSON.parse(text));
  } catch (error) {
    throw new Error(
      `invalid JSON in ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function stringField(
  record: Record<string, unknown>,
  ...names: string[]
): string | undefined {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function nestedRecord(
  root: Record<string, unknown>,
  id: ProviderId,
): Record<string, unknown> {
  const providers = asRecord(root.providers);
  return asRecord(providers[id]);
}

function validateHttpBaseUrl(raw: string, envName: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `external dogfood blocked: ${envName} must be a valid URL`,
    );
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(
      "external dogfood blocked: provider base URL must use http or https",
    );
  }
  if (
    url.protocol === "http:" &&
    !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)
  ) {
    throw new Error(
      "external dogfood blocked: plain HTTP provider base URL is allowed only for localhost development endpoints",
    );
  }
  return url.toString().replace(/\/$/, "");
}

function providerTimeoutMs(): number {
  const raw = env("QUORUM_ROUTER_PROVIDER_TIMEOUT_MS");
  if (!raw) return DEFAULT_PROVIDER_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      "external dogfood blocked: QUORUM_ROUTER_PROVIDER_TIMEOUT_MS must be a positive number",
    );
  }
  return Math.floor(parsed);
}

function splitProviderList(raw: string | undefined): ProviderId[] {
  const values = (raw ?? DEFAULT_MATRIX.join(","))
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const ids: ProviderId[] = [];
  for (const value of values) {
    if (!["grok", "devin", "openai", "localqwen", "glm"].includes(value)) {
      throw new Error(`external dogfood blocked: unknown provider '${value}'`);
    }
    ids.push(value as ProviderId);
  }
  if (ids.length === 0) {
    throw new Error("external dogfood blocked: no providers selected");
  }
  return [...new Set(ids)];
}

export function selectedProviderIds(matrix: boolean): ProviderId[] {
  if (matrix) return splitProviderList(env("QUORUM_ROUTER_EXTERNAL_PROVIDERS"));
  return splitProviderList(env("QUORUM_ROUTER_EXTERNAL_PROVIDER") ?? "openai")
    .slice(0, 1);
}

function commandExists(command: string): boolean {
  if (command.includes("/") || command.includes("\\")) {
    try {
      return Deno.statSync(command).isFile;
    } catch {
      return false;
    }
  }

  const path = Deno.env.get("PATH") ?? "";
  const extensions = Deno.build.os === "windows"
    ? (Deno.env.get("PATHEXT") ?? ".EXE;.CMD;.BAT").split(";")
    : [""];
  for (const dir of path.split(Deno.build.os === "windows" ? ";" : ":")) {
    if (!dir) continue;
    for (const ext of extensions) {
      try {
        if (Deno.statSync(`${dir}/${command}${ext}`).isFile) return true;
      } catch {
        // keep scanning PATH
      }
    }
  }
  return false;
}

function cliConfig(
  id: ProviderId,
  providerLabel: string,
  model: string,
  command: string,
  args: string[],
): ExternalProviderConfig {
  if (!commandExists(command)) {
    throw new Error(
      `external dogfood blocked: missing ${command} command for ${providerLabel}`,
    );
  }
  return { id, providerLabel, providerMode: "cli", model, command, args };
}

function httpConfig(
  id: ProviderId,
  providerLabel: string,
  model: string,
  baseUrl: string,
  credential: string | undefined,
  credentialEnvName: string,
  baseUrlEnvName: string,
): ExternalProviderConfig {
  if (!credential) {
    throw new Error(`external dogfood blocked: missing ${credentialEnvName}`);
  }
  return {
    id,
    providerLabel,
    providerMode: "http_openai_compatible",
    model,
    baseUrl: validateHttpBaseUrl(baseUrl, baseUrlEnvName),
    credential,
  };
}

export async function loadExternalProviderConfig(
  id: ProviderId,
): Promise<ExternalProviderConfig> {
  const fileConfig = await readJsonIfPresent(CONFIG_PATH);
  const exampleConfig = Object.keys(fileConfig).length > 0
    ? {}
    : await readJsonIfPresent(EXAMPLE_CONFIG_PATH);
  const merged = { ...exampleConfig, ...fileConfig };
  const providerConfig = {
    ...nestedRecord(exampleConfig, id),
    ...nestedRecord(fileConfig, id),
  };

  if (id === "grok") {
    const mode = firstEnv("QUORUM_ROUTER_GROK_MODE") ??
      stringField(providerConfig, "mode") ?? "cli";
    if (mode === "http") {
      return httpConfig(
        id,
        stringField(providerConfig, "provider_label", "providerLabel") ??
          "Grok",
        firstEnv("QUORUM_ROUTER_GROK_MODEL") ??
          stringField(providerConfig, "model") ?? "grok-4",
        firstEnv("QUORUM_ROUTER_GROK_BASE_URL") ??
          stringField(providerConfig, "base_url", "baseUrl") ??
          "https://api.x.ai/v1",
        firstEnv("QUORUM_ROUTER_GROK_API_KEY", "XAI_API_KEY", "GROK_API_KEY"),
        "QUORUM_ROUTER_GROK_API_KEY or XAI_API_KEY",
        "QUORUM_ROUTER_GROK_BASE_URL",
      );
    }
    const command = firstEnv("QUORUM_ROUTER_GROK_COMMAND") ??
      stringField(providerConfig, "command") ?? "grok";
    return cliConfig(id, "Grok CLI", "grok-cli", command, [
      "-p",
      "__PROMPT__",
      "--output-format",
      "plain",
      "--permission-mode",
      "plan",
      "--disable-web-search",
    ]);
  }

  if (id === "devin") {
    const command = firstEnv("QUORUM_ROUTER_DEVIN_COMMAND") ??
      stringField(providerConfig, "command") ?? "devin";
    return cliConfig(id, "Devin CLI", "devin-cli", command, [
      "-p",
      "__PROMPT__",
    ]);
  }

  if (id === "localqwen") {
    const command = firstEnv("QUORUM_ROUTER_LOCALQWEN_COMMAND") ??
      stringField(providerConfig, "command") ?? "qwen";
    const model = firstEnv("QUORUM_ROUTER_LOCALQWEN_MODEL") ??
      stringField(providerConfig, "model") ?? "qwen3-coder-max";
    return cliConfig(id, "Local Qwen CLI", model, command, [
      "-p",
      "__PROMPT__",
      "--model",
      model,
    ]);
  }

  if (id === "glm") {
    const mode = firstEnv("QUORUM_ROUTER_GLM_MODE") ??
      stringField(providerConfig, "mode") ?? "http";
    if (mode === "cli") {
      const command = firstEnv("QUORUM_ROUTER_GLM_COMMAND") ??
        stringField(providerConfig, "command") ?? "zcode-headless";
      const model = firstEnv("QUORUM_ROUTER_GLM_MODEL") ??
        stringField(providerConfig, "model") ?? "glm-zcode";
      return cliConfig(id, "GLM CLI", model, command, [
        "--cwd",
        "__CWD__",
        "--mode",
        "plan",
        "--prompt",
        "__PROMPT__",
      ]);
    }
    return httpConfig(
      id,
      stringField(providerConfig, "provider_label", "providerLabel") ??
        "GLM OpenAI-compatible",
      firstEnv("QUORUM_ROUTER_GLM_MODEL") ??
        stringField(providerConfig, "model") ?? "glm-4.5",
      firstEnv("QUORUM_ROUTER_GLM_BASE_URL") ??
        stringField(providerConfig, "base_url", "baseUrl") ??
        "https://open.bigmodel.cn/api/paas/v4",
      firstEnv(
        "QUORUM_ROUTER_GLM_API_KEY",
        "GLM_API_KEY",
        "ZHIPUAI_API_KEY",
        "BIGMODEL_API_KEY",
      ),
      "QUORUM_ROUTER_GLM_API_KEY or GLM_API_KEY",
      "QUORUM_ROUTER_GLM_BASE_URL",
    );
  }

  const openAiMode = firstEnv("QUORUM_ROUTER_OPENAI_MODE") ??
    stringField(providerConfig, "mode") ?? "http";
  if (openAiMode === "cli") {
    const command = firstEnv("QUORUM_ROUTER_OPENAI_COMMAND") ??
      stringField(providerConfig, "command") ?? "codex";
    const model = firstEnv("QUORUM_ROUTER_OPENAI_MODEL") ??
      stringField(providerConfig, "model") ?? "codex-cli";
    return cliConfig(id, "OpenAI Codex CLI", model, command, [
      "exec",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--cd",
      "__CWD__",
      "__PROMPT__",
    ]);
  }

  return httpConfig(
    id,
    firstEnv("QUORUM_ROUTER_PROVIDER_LABEL") ??
      stringField(providerConfig, "provider_label", "providerLabel") ??
      stringField(merged, "provider_label", "providerLabel") ??
      "OpenAI-compatible provider",
    firstEnv("QUORUM_ROUTER_PROVIDER_MODEL", "QUORUM_ROUTER_OPENAI_MODEL") ??
      stringField(providerConfig, "model") ?? stringField(merged, "model") ??
      "gpt-4o-mini",
    firstEnv(
      "QUORUM_ROUTER_PROVIDER_BASE_URL",
      "QUORUM_ROUTER_OPENAI_BASE_URL",
    ) ?? stringField(providerConfig, "base_url", "baseUrl") ??
      stringField(merged, "base_url", "baseUrl") ?? "https://api.openai.com/v1",
    firstEnv(
      "QUORUM_ROUTER_PROVIDER_API_KEY",
      "QUORUM_ROUTER_OPENAI_API_KEY",
      "OPENAI_API_KEY",
    ),
    "QUORUM_ROUTER_PROVIDER_API_KEY or QUORUM_ROUTER_OPENAI_API_KEY or OPENAI_API_KEY",
    "QUORUM_ROUTER_PROVIDER_BASE_URL or QUORUM_ROUTER_OPENAI_BASE_URL",
  );
}

export async function loadExternalProviderConfigs(
  ids: ProviderId[],
): Promise<ExternalProviderConfig[]> {
  const configs: ExternalProviderConfig[] = [];
  const errors: string[] = [];
  for (const id of ids) {
    try {
      configs.push(await loadExternalProviderConfig(id));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
  return configs;
}

export function publicConfig(
  config: ExternalProviderConfig,
): PublicExternalProviderConfig {
  const { credential: _credential, ...rest } = config;
  return { ...rest, credentialPresent: config.credential !== undefined };
}

export function redactSecrets(text: string, secrets: string[]): string {
  let redacted = text;
  for (
    const redactionValue of secrets.filter((value) => value.length > 0).sort((
      a,
      b,
    ) => b.length - a.length)
  ) {
    redacted = redacted.split(redactionValue).join("[REDACTED]");
  }
  return redacted;
}

function allSecrets(configs: ExternalProviderConfig[]): string[] {
  return configs.flatMap((config) =>
    config.credential ? [config.credential] : []
  );
}

function externalChatCompletionsUrl(baseUrl: string): string {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function responseContent(json: unknown): string {
  const root = asRecord(json);
  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("missing choices[0]");
  }
  const first = asRecord(choices[0]);
  const message = asRecord(first.message);
  const content = message.content ?? first.text;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("missing choices[0].message.content");
  }
  return content.trim();
}

function summarize(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_SUMMARY_LENGTH
    ? `${collapsed.slice(0, MAX_SUMMARY_LENGTH)}…`
    : collapsed;
}

async function callHttpProvider(
  config: ExternalProviderConfig,
  prompt: string,
): Promise<string> {
  if (!config.baseUrl || !config.credential) {
    throw new Error(
      `external dogfood blocked: ${config.providerLabel} HTTP config is incomplete`,
    );
  }
  const response = await fetch(externalChatCompletionsUrl(config.baseUrl), {
    method: "POST",
    signal: AbortSignal.timeout(providerTimeoutMs()),
    headers: {
      authorization: `Bearer ${config.credential}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = redactSecrets(await response.text().catch(() => ""), [
      config.credential,
    ]);
    throw new Error(
      body
        ? `external dogfood blocked: ${config.providerLabel} HTTP ${response.status}: ${
          body.slice(0, 500)
        }`
        : `external dogfood blocked: ${config.providerLabel} HTTP ${response.status}`,
    );
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw new Error(
      `external dogfood blocked: ${config.providerLabel} returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return responseContent(json);
}

async function callCliProvider(
  config: ExternalProviderConfig,
  prompt: string,
): Promise<string> {
  if (!config.command || !config.args) {
    throw new Error(
      `external dogfood blocked: ${config.providerLabel} CLI config is incomplete`,
    );
  }
  const args = config.args.map((arg) => {
    if (arg === "__PROMPT__") return prompt;
    if (arg === "__CWD__") return Deno.cwd();
    return arg;
  });
  const output = await new Deno.Command(config.command, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();
  const stdout = new TextDecoder().decode(output.stdout).trim();
  const stderr = new TextDecoder().decode(output.stderr).trim();
  if (output.code !== 0) {
    throw new Error(
      `external dogfood blocked: ${config.providerLabel} exited ${output.code}: ${
        summarize(stderr || stdout)
      }`,
    );
  }
  if (!stdout) {
    throw new Error(
      `external dogfood blocked: ${config.providerLabel} returned empty stdout`,
    );
  }
  return stdout;
}

export async function callExternalProviderOnce(
  config: ExternalProviderConfig,
  prompt: string,
): Promise<ExternalProviderResult> {
  const content = config.providerMode === "cli"
    ? await callCliProvider(config, prompt)
    : await callHttpProvider(config, prompt);
  const redactedContent = redactSecrets(
    content,
    config.credential ? [config.credential] : [],
  );
  return {
    responseReceived: true,
    schemaValid: true,
    providerId: config.id,
    providerLabel: config.providerLabel,
    providerMode: config.providerMode,
    model: config.model,
    responseSummary: summarize(redactedContent),
    rawContent: redactedContent,
  };
}

export function redactionOk(
  value: unknown,
  configs: ExternalProviderConfig[],
): boolean {
  const text = JSON.stringify(value);
  return allSecrets(configs).every((redactionValue) =>
    redactionValue.length === 0 || !text.includes(redactionValue)
  );
}
