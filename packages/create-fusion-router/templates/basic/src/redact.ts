const REDACTION_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /session[_-]?id\s*[=:]\s*[0-9a-f]{8,}(?:-[0-9a-f]{4,})*/gi,
  /["']?authorization["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
  /["']?refresh[_-]?token["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
  /["']?access[_-]?token["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
  /["']?api[_-]?key["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
  /["']?session(?:\s+|[_-]?)id["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
  /["']?cookie["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
  /["']?password["']?\s*[:=]\s*["']?[^"'\n\r,}]+["']?/gi,
];

const SENSITIVE_ENV = [
  "FUSION_ROUTER_PROVIDER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
  "GROK_API_KEY",
  "GLM_API_KEY",
  "ZHIPUAI_API_KEY",
  "BIGMODEL_API_KEY",
];

export function knownSecretValues(): string[] {
  return SENSITIVE_ENV.flatMap((name) => {
    const value = Deno.env.get(name);
    return value && value.length >= 8 ? [value] : [];
  });
}

export function redact(text: string, extraSecrets: string[] = []): string {
  let safe = text;
  for (
    const secret of [...knownSecretValues(), ...extraSecrets].filter(Boolean)
      .sort((a, b) => b.length - a.length)
  ) {
    safe = safe.split(secret).join("[REDACTED]");
  }
  for (const pattern of REDACTION_PATTERNS) {
    safe = safe.replace(pattern, "[REDACTED]");
  }
  return safe;
}

export function summarize(text: string, max = 500): string {
  const collapsed = redact(text).replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

export function redactionOk(value: unknown): boolean {
  const text = JSON.stringify(value);
  const unescaped = text.replace(/\\"/g, '"');
  const unsafeKeyPattern =
    /["']?(authorization|refresh[_-]?token|access[_-]?token|cookie|password|session(?:\s+|[_-]?)id|api[_-]?key)["']?\s*[:=]/i;
  if (unsafeKeyPattern.test(text) || unsafeKeyPattern.test(unescaped)) {
    return false;
  }
  if (redact(text) !== text || redact(unescaped) !== unescaped) {
    return false;
  }
  for (const secret of knownSecretValues()) {
    if (secret && text.includes(secret)) return false;
  }
  return true;
}
