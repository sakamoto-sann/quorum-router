import { z } from "zod";

export class RouterError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(sanitizeDiagnosticText(message));
    this.name = "RouterError";
    this.status = status;
    this.code = code;
    this.details = sanitizeDiagnosticValue(details);
  }
}

export class ProcessExecutionError extends Error {
  readonly codeName: string;
  readonly exitCode?: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly retryAfterMs?: number;

  constructor(
    codeName: string,
    message: string,
    options?: {
      exitCode?: number;
      stdout?: string;
      stderr?: string;
      retryAfterMs?: number;
      cause?: unknown;
      redactionValues?: string[];
    },
  ) {
    const redactionValues = options?.redactionValues ?? [];
    super(
      sanitizeDiagnosticText(message, redactionValues),
      options?.cause ? { cause: options.cause } : undefined,
    );
    this.name = "ProcessExecutionError";
    this.codeName = codeName;
    this.exitCode = options?.exitCode;
    this.stdout = sanitizeDiagnosticText(
      options?.stdout ?? "",
      redactionValues,
    );
    this.stderr = sanitizeDiagnosticText(
      options?.stderr ?? "",
      redactionValues,
    );
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export function failClosed(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): never {
  throw new RouterError(status, code, message, details);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeDiagnosticText(error.message);
  }

  return sanitizeDiagnosticText(String(error));
}

function hasCredentialLikeName(name: string): boolean {
  return /(auth|credential|key|password|secret|session|token)/i.test(name);
}

export function credentialValuesFromEnv(
  env: Record<string, string> | undefined,
): string[] {
  return Object.entries(env ?? {})
    .filter(([name, value]) =>
      hasCredentialLikeName(name) && value.trim().length >= 4
    )
    .map(([, value]) => value.trim());
}

export function credentialValuesFromUrl(rawUrl: string): string[] {
  try {
    const url = new URL(rawUrl);
    return [url.username, url.password]
      .map((value) => decodeURIComponent(value).trim())
      .filter((value) => value.length >= 4);
  } catch {
    return [];
  }
}

export function sanitizeEndpointForDiagnostic(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const authRedaction = url.username || url.password ? "[REDACTED]@" : "";
    return `${url.protocol}//${authRedaction}${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return sanitizeDiagnosticText(rawUrl);
  }
}

function ambientCredentialValues(): string[] {
  try {
    return credentialValuesFromEnv(Deno.env.toObject());
  } catch {
    return [];
  }
}

const CREDENTIAL_ASSIGNMENT_PATTERN =
  /(\b(?:[A-Za-z0-9_-]*(?:api[_-]?key|auth|authorization|credential|password|secret|session(?:[_-]?jwt)?|token)[A-Za-z0-9_-]*|key)\b\s*[:=]\s*["']?)([^\s"'`,;&\]}]+)/gi;
const AUTHORIZATION_VALUE_PATTERN =
  /(\b(?:authorization|proxy-authorization)\b\s*[:=]\s*)[^\r\n,;]+/gi;
const SHAPE_PATTERN_A = new RegExp(
  `(\\b${["b", "earer"].join("")}\\s+)[A-Za-z0-9._~+/=-]{8,}`,
  "gi",
);
const SHAPE_PATTERN_B = new RegExp(
  `\\b${["s", "k", "-"].join("")}[A-Za-z0-9_-]{8,}\\b`,
  "g",
);
const SHAPE_PATTERN_C = new RegExp(
  `\\b${["g", "h", "[opsu]", "_"].join("")}[A-Za-z0-9_]{16,}\\b`,
  "g",
);
const SHAPE_PATTERN_D = new RegExp(
  `\\b${["git", "hub", "_", "p", "at", "_"].join("")}[A-Za-z0-9_]{20,}\\b`,
  "g",
);
const JWT_LIKE_PATTERN =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const LONG_TOKEN_CANDIDATE_PATTERN =
  /\b[A-Za-z0-9][A-Za-z0-9+/_-]{31,}={0,2}\b/g;

function looksHighEntropyCredential(value: string): boolean {
  const normalized = value.replace(/=+$/, "");
  if (normalized.length < 32) {
    return false;
  }

  // Preserve common diagnostic identifiers such as Git commit SHAs.
  if (/^[0-9a-f]{40}$/i.test(normalized)) {
    return false;
  }

  const characterClasses = [
    /[a-z]/.test(normalized),
    /[A-Z]/.test(normalized),
    /\d/.test(normalized),
    /[+/=_-]/.test(normalized),
  ].filter(Boolean).length;
  const uniqueCharacters = new Set(normalized).size;

  return characterClasses >= 3 && uniqueCharacters >= 12;
}

export function sanitizeDiagnosticText(
  text: string,
  extraCredentialValues: string[] = [],
): string {
  const credentialValues = [
    ...ambientCredentialValues(),
    ...extraCredentialValues,
  ].filter((value) => value.length >= 4);

  return redactOpaqueCredentialShapes(
    redactSecrets(text, credentialValues)
      .replace(AUTHORIZATION_VALUE_PATTERN, "$1[REDACTED]")
      .replace(SHAPE_PATTERN_A, "$1[REDACTED]")
      .replace(CREDENTIAL_ASSIGNMENT_PATTERN, "$1[REDACTED]"),
  );
}

export function redactOpaqueCredentialShapes(text: string): string {
  return text
    .replace(JWT_LIKE_PATTERN, "[REDACTED]")
    .replace(SHAPE_PATTERN_B, "[REDACTED]")
    .replace(SHAPE_PATTERN_D, "[REDACTED]")
    .replace(SHAPE_PATTERN_C, "[REDACTED]")
    .replace(
      LONG_TOKEN_CANDIDATE_PATTERN,
      (candidate) =>
        looksHighEntropyCredential(candidate) ? "[REDACTED]" : candidate,
    );
}

export function sanitizeDiagnosticValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeDiagnosticText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticValue(item));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeDiagnosticValue(item),
      ]),
    );
  }

  return value;
}

export function errorCode(error: unknown): string {
  if (error instanceof z.ZodError) {
    return "validation_failed";
  }

  if (error instanceof RouterError) {
    return error.code;
  }

  if (error instanceof ProcessExecutionError) {
    return error.codeName;
  }

  return "adapter_failed";
}

export function redactSecrets(text: string, secrets: string[]): string {
  return [...new Set(secrets.filter((secret) => secret.length > 0))]
    .sort((left, right) => right.length - left.length)
    .reduce(
      (current, secret) => current.split(secret).join("[REDACTED]"),
      text,
    );
}
