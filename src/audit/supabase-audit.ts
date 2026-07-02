import {
  boundedInteger,
  type BufferedBatchHandler,
  type BufferedBatchSink,
  type BufferedBatchSinkOptions,
  createBufferedBatchSink,
  TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  unrefBestEffort,
} from "../telemetry/buffered-batch-sink.ts";
import {
  credentialValuesFromUrl,
  errorMessage,
  ProcessExecutionError,
  sanitizeEndpointForDiagnostic,
} from "../errors.ts";
import {
  classifyDirectHttpFailure,
  type FetchLike,
  trimApiKey,
} from "../adapters/direct-http.ts";
import { classifyProcessFailure } from "../adapters/process.ts";

export type SupabaseAuditRecord = {
  eventType: string;
  actorType: "ai_assistant" | "user" | "system";
  actorId?: string;
  workflowId?: string;
  route?: string;
  decision: "allow" | "deny" | "error";
  reason?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type SupabaseAuditSinkOptions = BufferedBatchSinkOptions & {
  flushHandler: BufferedBatchHandler<SupabaseAuditRecord>;
};

export type SupabaseAuditHandlerOptions = {
  supabaseUrl: string;
  jwtProvider: () => string | undefined;
  anonKeyProvider: () => string | undefined;
  fetchFn?: FetchLike;
  timeoutMs?: number;
};

function compactObject(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}

function toSupabaseAuditRpcRecord(
  record: SupabaseAuditRecord,
): Record<string, unknown> {
  return compactObject({
    event_type: record.eventType,
    actor_type: record.actorType,
    workflow_id: record.workflowId,
    route: record.route,
    decision: record.decision,
    reason: record.reason,
    metadata: record.metadata,
  });
}

export function createSupabaseAuditHandler(
  options: SupabaseAuditHandlerOptions,
): BufferedBatchHandler<SupabaseAuditRecord> {
  const endpoint = new URL(
    "/rest/v1/rpc/insert_workflow_access_audit_batch",
    options.supabaseUrl,
  ).toString();
  const endpointForDiagnostics = sanitizeEndpointForDiagnostic(endpoint);
  const fetchFn = options.fetchFn ?? fetch;
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    5_000,
    TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  );
  const label = "Supabase audit RPC";

  return async (records, context) => {
    const jwt = trimApiKey(options.jwtProvider());
    const anonKey = trimApiKey(options.anonKeyProvider());
    const redactionValues = [
      ...(jwt ? [jwt] : []),
      ...(anonKey ? [anonKey] : []),
      ...credentialValuesFromUrl(endpoint),
    ];

    if (!jwt) {
      throw new ProcessExecutionError(
        "auth_failed",
        `${label} missing user/session JWT.`,
      );
    }

    if (!anonKey) {
      throw new ProcessExecutionError(
        "auth_failed",
        `${label} missing Supabase anon key.`,
      );
    }

    const requestTimeoutMs = Math.max(
      1,
      Math.min(timeoutMs, context.deadlineMs - Date.now()),
    );
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, requestTimeoutMs);
    unrefBestEffort(timeoutId);

    try {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "prefer": "return=minimal",
          "authorization": `Bearer ${jwt}`,
          "apikey": anonKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          records: records.map(toSupabaseAuditRpcRecord),
        }),
      });

      if (!response.ok) {
        throw await classifyDirectHttpFailure(
          response,
          label,
          redactionValues,
        );
      }
    } catch (error) {
      if (error instanceof ProcessExecutionError) {
        throw error;
      }

      const name = error instanceof Error ? error.name : "";
      if (timedOut || name === "AbortError") {
        throw new ProcessExecutionError(
          timedOut ? "timeout" : "aborted",
          `${label} request ${
            timedOut ? "timed out" : "was aborted"
          } for ${endpointForDiagnostics}.`,
          { cause: error, redactionValues },
        );
      }

      throw classifyProcessFailure(
        `${label} request failed for ${endpointForDiagnostics}: ${
          errorMessage(error)
        }`,
        "",
        "",
        undefined,
        redactionValues,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  };
}

export function createSupabaseAuditSink(
  options: SupabaseAuditSinkOptions,
): BufferedBatchSink<SupabaseAuditRecord> {
  return createBufferedBatchSink<SupabaseAuditRecord>(options.flushHandler, {
    ...options,
    name: "supabase_audit_sink",
    overflowPolicy: "fail_closed",
    deliveryMode: "must_accept",
  });
}
