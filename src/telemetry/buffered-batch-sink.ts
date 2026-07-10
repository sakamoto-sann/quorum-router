import type { CoFailureTelemetry, TelemetryFailure } from "../schemas.ts";
import type { TelemetrySink } from "../contracts.ts";
import { readRouterEnv } from "../env.ts";
import {
  credentialValuesFromUrl,
  errorMessage,
  ProcessExecutionError,
  sanitizeDiagnosticText,
  sanitizeEndpointForDiagnostic,
} from "../errors.ts";

export type TelemetryFlushOptions = {
  maxDurationMs?: number;
  force?: boolean;
};

export type BufferedSinkOverflowPolicy = "drop_oldest" | "fail_closed";
export type BufferedSinkDeliveryMode = "best_effort" | "must_accept";

export type BufferedSinkFlushContext = {
  deadlineMs: number;
};

export type BufferedBatchHandler<TRecord> = (
  records: readonly TRecord[],
  context: BufferedSinkFlushContext,
) => void | Promise<void>;

export type BufferedBatchSinkStats = {
  queueSize: number;
  maxQueueSize: number;
  enqueued: number;
  delivered: number;
  rejected: number;
  droppedOldest: number;
  droppedAfterRetries: number;
  failedFlushes: number;
  closed: boolean;
};

export type BufferedBatchSink<TRecord> =
  & ((
    record: TRecord,
  ) => void | Promise<void>)
  & {
    flush: (options?: TelemetryFlushOptions) => Promise<void>;
    close: (options?: TelemetryFlushOptions) => Promise<void>;
    stats: () => BufferedBatchSinkStats;
  };

export type BufferedTelemetrySinkStats = BufferedBatchSinkStats;

export type FlushableTelemetrySink = BufferedBatchSink<CoFailureTelemetry>;

export type OtlpTelemetrySinkOptions = {
  endpoint: string;
  headers?: Record<string, string>;
  serviceName?: string;
  timeoutMs?: number;
};

export type BufferedBatchSinkOptions = {
  name?: string;
  maxQueueSize?: number;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  maxAttempts?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  defaultDrainMs?: number;
  registerUnloadHook?: boolean;
  overflowPolicy?: BufferedSinkOverflowPolicy;
  deliveryMode?: BufferedSinkDeliveryMode;
  now?: () => number;
};

export type BufferedTelemetrySinkOptions = BufferedBatchSinkOptions;

type BufferedBatchEntry<TRecord> = {
  record: TRecord;
  attempts: number;
  nextAttemptAt: number;
};

export const TELEMETRY_MAX_QUEUE_SIZE = 10_000;
export const TELEMETRY_MAX_BATCH_SIZE = 500;
export const TELEMETRY_MAX_FLUSH_INTERVAL_MS = 60_000;
export const TELEMETRY_MAX_ATTEMPTS = 10;
export const TELEMETRY_MAX_BASE_BACKOFF_MS = 60_000;
export const TELEMETRY_MAX_BACKOFF_MS = 300_000;
export const TELEMETRY_MAX_DRAIN_MS = 5_000;
export const TELEMETRY_MAX_HTTP_TIMEOUT_MS = 30_000;

export function positiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  return Number.isFinite(value) && value !== undefined && value > 0
    ? Math.floor(value)
    : fallback;
}

export function boundedInteger(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  return Math.min(positiveInteger(value, fallback), max);
}

export function boundedEnvInteger(
  name: string,
  fallback: number,
  max: number,
): number {
  const value = Number(readRouterEnv(name));
  return boundedInteger(value, fallback, max);
}

function toOtlpAttribute(
  key: string,
  value: string | number,
): Record<string, unknown> {
  if (typeof value === "number") {
    return { key, value: { intValue: value } };
  }

  return { key, value: { stringValue: value } };
}

function toOtlpLogPayload(
  telemetry: CoFailureTelemetry | readonly CoFailureTelemetry[],
  serviceName: string,
  timestampMs = Date.now(),
): Record<string, unknown> {
  const records: readonly CoFailureTelemetry[] = Array.isArray(telemetry)
    ? telemetry
    : [telemetry];
  const logRecords = records.map((record) => {
    const attributes: Record<string, unknown>[] = [
      toOtlpAttribute("fusion.total_adapters", record.totalAdapters),
      toOtlpAttribute("fusion.successful_adapters", record.successfulAdapters),
      toOtlpAttribute("fusion.failed_adapters", record.failedAdapters),
    ];

    record.failures.forEach((failure: TelemetryFailure, index: number) => {
      attributes.push(
        toOtlpAttribute(`fusion.failures.${index}.provider`, failure.provider),
      );
      attributes.push(
        toOtlpAttribute(`fusion.failures.${index}.model`, failure.model),
      );
      attributes.push(
        toOtlpAttribute(`fusion.failures.${index}.code`, failure.code),
      );
      attributes.push(
        toOtlpAttribute(`fusion.failures.${index}.message`, failure.message),
      );
    });

    return {
      timeUnixNano: `${timestampMs}000000`,
      severityText: "WARN",
      body: { stringValue: "co_failure_telemetry" },
      attributes,
    };
  });

  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            toOtlpAttribute("service.name", serviceName),
          ],
        },
        scopeLogs: [
          {
            scope: { name: "quorum-router" },
            logRecords,
          },
        ],
      },
    ],
  };
}

export function createOtlpHttpTelemetrySink(
  options: OtlpTelemetrySinkOptions,
): TelemetrySink {
  const handler = createOtlpTelemetryHandler(options);
  return (telemetry) => handler([telemetry], { deadlineMs: Date.now() + 500 });
}

export function createOtlpTelemetryHandler(
  options: OtlpTelemetrySinkOptions,
): BufferedBatchHandler<CoFailureTelemetry> {
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    500,
    TELEMETRY_MAX_HTTP_TIMEOUT_MS,
  );
  const endpointRedactionValues = credentialValuesFromUrl(options.endpoint);
  const endpointForDiagnostics = sanitizeDiagnosticText(
    sanitizeEndpointForDiagnostic(options.endpoint),
    endpointRedactionValues,
  );

  return async (records, context) => {
    const controller = new AbortController();
    const remainingDeadlineMs = context.deadlineMs - Date.now();
    const effectiveTimeoutMs = Math.max(
      1,
      Math.min(timeoutMs, remainingDeadlineMs),
    );
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);
    unrefBestEffort(timeoutId);

    let response: Response;
    try {
      response = await fetch(options.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(options.headers ?? {}),
        },
        signal: controller.signal,
        body: JSON.stringify(
          toOtlpLogPayload(
            records,
            options.serviceName ?? "quorum-router",
            Date.now(),
          ),
        ),
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new ProcessExecutionError(
          "timeout",
          `Telemetry sink timed out after ${timeoutMs}ms for ${endpointForDiagnostics}.`,
          { redactionValues: endpointRedactionValues },
        );
      }

      const safeCause = sanitizeDiagnosticText(
        error instanceof Error ? error.message : String(error),
        endpointRedactionValues,
      );
      throw new ProcessExecutionError(
        "telemetry_sink_failed",
        `Telemetry sink request failed for ${endpointForDiagnostics}: ${safeCause}`,
        { redactionValues: endpointRedactionValues },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new ProcessExecutionError(
        "telemetry_sink_failed",
        `Telemetry sink rejected payload with HTTP ${response.status} for ${endpointForDiagnostics}.`,
        { redactionValues: endpointRedactionValues },
      );
    }
  };
}

export function unrefBestEffort(timerId: ReturnType<typeof setTimeout>): void {
  try {
    Deno.unrefTimer(timerId as unknown as number);
  } catch {
    // best effort; older runtimes may not expose timer unref
  }
}

async function awaitWithDeadline<T>(
  operation: T | Promise<T>,
  timeoutMs: number,
): Promise<T> {
  if (timeoutMs <= 0) {
    throw new ProcessExecutionError(
      "timeout",
      "Buffered sink flush deadline exceeded.",
    );
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new ProcessExecutionError(
              "timeout",
              "Buffered sink flush deadline exceeded.",
            ),
          );
        }, timeoutMs);
        unrefBestEffort(timeoutId);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function isFlushableTelemetrySink(
  sink: TelemetrySink,
): sink is FlushableTelemetrySink {
  return typeof (sink as Partial<FlushableTelemetrySink>).flush ===
      "function" &&
    typeof (sink as Partial<FlushableTelemetrySink>).close === "function";
}

export async function flushTelemetrySink(
  sink: TelemetrySink | undefined,
  options: TelemetryFlushOptions = {},
): Promise<void> {
  if (sink && isFlushableTelemetrySink(sink)) {
    await sink.flush(options);
  }
}

export async function closeTelemetrySink(
  sink: TelemetrySink | undefined,
  options: TelemetryFlushOptions = {},
): Promise<void> {
  if (sink && isFlushableTelemetrySink(sink)) {
    await sink.close(options);
  }
}

function bufferedSinkError(
  name: string,
  message: string,
): ProcessExecutionError {
  return new ProcessExecutionError(
    "buffered_sink_failed",
    `${name}: ${message}`,
  );
}

export function createBufferedBatchSink<TRecord>(
  handler: BufferedBatchHandler<TRecord>,
  options: BufferedBatchSinkOptions = {},
): BufferedBatchSink<TRecord> {
  const name = options.name ?? "buffered_sink";
  const overflowPolicy = options.overflowPolicy ?? "drop_oldest";
  const deliveryMode = options.deliveryMode ?? "best_effort";
  const maxQueueSize = boundedInteger(
    options.maxQueueSize,
    1_000,
    TELEMETRY_MAX_QUEUE_SIZE,
  );
  const maxBatchSize = boundedInteger(
    options.maxBatchSize,
    30,
    TELEMETRY_MAX_BATCH_SIZE,
  );
  const flushIntervalMs = boundedInteger(
    options.flushIntervalMs,
    500,
    TELEMETRY_MAX_FLUSH_INTERVAL_MS,
  );
  const maxAttempts = boundedInteger(
    options.maxAttempts,
    5,
    TELEMETRY_MAX_ATTEMPTS,
  );
  const baseBackoffMs = boundedInteger(
    options.baseBackoffMs,
    250,
    TELEMETRY_MAX_BASE_BACKOFF_MS,
  );
  const maxBackoffMs = boundedInteger(
    options.maxBackoffMs,
    30_000,
    TELEMETRY_MAX_BACKOFF_MS,
  );
  const backoffMultiplier = Math.max(options.backoffMultiplier ?? 2, 1);
  const defaultDrainMs = boundedInteger(
    options.defaultDrainMs,
    200,
    TELEMETRY_MAX_DRAIN_MS,
  );
  const now = options.now ?? (() => Date.now());

  const queue: Array<BufferedBatchEntry<TRecord> | undefined> = new Array(
    maxQueueSize,
  );
  let queueHead = 0;
  let queueSizeValue = 0;
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let flushChain: Promise<void> = Promise.resolve();
  let unloadHandler: (() => void) | undefined;
  const stats = {
    enqueued: 0,
    delivered: 0,
    rejected: 0,
    droppedOldest: 0,
    droppedAfterRetries: 0,
    failedFlushes: 0,
  };

  const queueSize = () => queueSizeValue;
  const queueIndex = (offset: number) => (queueHead + offset) % maxQueueSize;

  const snapshot = (): BufferedBatchSinkStats => ({
    queueSize: queueSize(),
    maxQueueSize,
    enqueued: stats.enqueued,
    delivered: stats.delivered,
    rejected: stats.rejected,
    droppedOldest: stats.droppedOldest,
    droppedAfterRetries: stats.droppedAfterRetries,
    failedFlushes: stats.failedFlushes,
    closed,
  });

  const clearFlushTimer = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
      timerId = undefined;
    }
  };

  const removeUnloadHook = () => {
    if (unloadHandler) {
      globalThis.removeEventListener("unload", unloadHandler);
      unloadHandler = undefined;
    }
  };

  const enqueueEntry = (entry: BufferedBatchEntry<TRecord>) => {
    if (queueSizeValue === maxQueueSize) {
      if (overflowPolicy === "fail_closed") {
        stats.rejected += 1;
        throw bufferedSinkError(name, "queue is full");
      }

      queue[queueHead] = entry;
      queueHead = (queueHead + 1) % maxQueueSize;
      stats.droppedOldest += 1;
      return;
    }

    queue[queueIndex(queueSizeValue)] = entry;
    queueSizeValue += 1;
  };

  const resetQueueFrom = (entries: BufferedBatchEntry<TRecord>[]) => {
    queue.fill(undefined);
    queueHead = 0;
    queueSizeValue = entries.length;
    entries.forEach((entry, index) => {
      queue[index] = entry;
    });
  };

  const retryDelayMs = (attempts: number) =>
    Math.min(
      Math.ceil(baseBackoffMs * backoffMultiplier ** Math.max(0, attempts - 1)),
      maxBackoffMs,
    );

  const entriesInOrder = (): BufferedBatchEntry<TRecord>[] => {
    const entries: BufferedBatchEntry<TRecord>[] = [];
    for (let offset = 0; offset < queueSizeValue; offset += 1) {
      const entry = queue[queueIndex(offset)];
      if (entry) {
        entries.push(entry);
      }
    }
    return entries;
  };

  const nextDelayMs = () => {
    if (queueSize() === 0) {
      return flushIntervalMs;
    }

    const nextAttemptAt = Math.min(
      ...entriesInOrder().map((entry) => entry.nextAttemptAt),
    );
    return Math.min(
      flushIntervalMs,
      Math.max(0, nextAttemptAt - now()),
    );
  };

  const scheduleFlush = (delayMs = flushIntervalMs) => {
    if (closed || deliveryMode === "must_accept") {
      return;
    }

    if (timerId !== undefined) {
      if (delayMs > 0) {
        return;
      }
      clearFlushTimer();
    }

    timerId = setTimeout(() => {
      timerId = undefined;
      void sink.flush().catch((error) => {
        console.warn(`${name} buffered flush failure: ${errorMessage(error)}`);
      });
    }, delayMs);
    unrefBestEffort(timerId);
  };

  const planEligibleBatch = (
    force: boolean,
  ): {
    batch: BufferedBatchEntry<TRecord>[];
    remaining: BufferedBatchEntry<TRecord>[];
  } => {
    const batch: BufferedBatchEntry<TRecord>[] = [];
    const remaining: BufferedBatchEntry<TRecord>[] = [];
    const timestamp = now();

    for (const entry of entriesInOrder()) {
      if (
        batch.length < maxBatchSize &&
        (force || entry.nextAttemptAt <= timestamp)
      ) {
        batch.push(entry);
      } else {
        remaining.push(entry);
      }
    }

    return { batch, remaining };
  };

  const selectEligibleBatch = (
    force: boolean,
  ): BufferedBatchEntry<TRecord>[] => {
    const { batch, remaining } = planEligibleBatch(force);
    resetQueueFrom(remaining);
    return batch;
  };

  const peekEligibleBatch = (
    force: boolean,
  ): BufferedBatchEntry<TRecord>[] => planEligibleBatch(force).batch;

  const removeBatchEntries = (
    batch: BufferedBatchEntry<TRecord>[],
  ): void => {
    const selected = new Set(batch);
    resetQueueFrom(entriesInOrder().filter((entry) => !selected.has(entry)));
  };

  const requeueAfterFailure = (
    entries: BufferedBatchEntry<TRecord>[],
    force: boolean,
  ) => {
    for (const entry of entries) {
      const attempts = entry.attempts + 1;
      if (force || attempts >= maxAttempts) {
        stats.droppedAfterRetries += 1;
        continue;
      }

      enqueueEntry({
        record: entry.record,
        attempts,
        nextAttemptAt: now() + retryDelayMs(attempts),
      });
    }
  };

  const prependEntries = (entries: BufferedBatchEntry<TRecord>[]) => {
    resetQueueFrom([...entries, ...entriesInOrder()].slice(0, maxQueueSize));
  };

  const flushBatch = async (
    force: boolean,
    deadline: number,
    throwOnFailure: boolean,
  ): Promise<boolean> => {
    if (now() >= deadline) {
      return false;
    }

    const batch = throwOnFailure
      ? peekEligibleBatch(force)
      : selectEligibleBatch(force);
    if (batch.length === 0) {
      return false;
    }

    if (now() >= deadline) {
      if (!throwOnFailure) {
        prependEntries(batch);
      }
      return false;
    }

    try {
      await awaitWithDeadline(
        handler(
          batch.map((entry) => entry.record),
          { deadlineMs: deadline },
        ),
        deadline - now(),
      );
      if (throwOnFailure) {
        removeBatchEntries(batch);
      }
      stats.delivered += batch.length;
    } catch (error) {
      stats.failedFlushes += 1;
      if (throwOnFailure) {
        throw error;
      }
      requeueAfterFailure(batch, force);
    }

    return true;
  };

  const drain = async (
    options: TelemetryFlushOptions = {},
    throwOnFailure = false,
  ) => {
    const force = options.force ?? false;
    const maxDurationMs = boundedInteger(
      options.maxDurationMs,
      defaultDrainMs,
      TELEMETRY_MAX_DRAIN_MS,
    );
    const deadline = now() + maxDurationMs;

    clearFlushTimer();

    while (queueSize() > 0 && now() < deadline) {
      const progressed = await flushBatch(force, deadline, throwOnFailure);
      if (!progressed) {
        break;
      }

      if (!force) {
        break;
      }
    }

    if (!closed && queueSize() > 0) {
      scheduleFlush(nextDelayMs());
    }
  };

  const runSerialized = async (
    task: () => Promise<void>,
  ): Promise<void> => {
    const previous = flushChain.catch(() => undefined);
    const next = previous.then(task);
    flushChain = next.catch(() => undefined);
    await next;
  };

  const sink = ((record: TRecord) => {
    if (closed) {
      stats.rejected += 1;
      throw bufferedSinkError(name, "sink is closed");
    }

    enqueueEntry({ record, attempts: 0, nextAttemptAt: now() });
    stats.enqueued += 1;

    if (deliveryMode === "must_accept") {
      return sink.flush({ maxDurationMs: defaultDrainMs, force: true });
    }

    scheduleFlush(queueSize() >= maxBatchSize ? 0 : flushIntervalMs);
  }) as BufferedBatchSink<TRecord>;

  sink.flush = async (flushOptions: TelemetryFlushOptions = {}) => {
    const throwOnFailure = deliveryMode === "must_accept";
    await runSerialized(() => drain(flushOptions, throwOnFailure));
  };

  sink.close = async (flushOptions: TelemetryFlushOptions = {}) => {
    closed = true;
    clearFlushTimer();
    removeUnloadHook();
    await runSerialized(() =>
      drain({
        maxDurationMs: flushOptions.maxDurationMs ?? defaultDrainMs,
        force: flushOptions.force ?? true,
      })
    );
  };

  sink.stats = snapshot;

  if (options.registerUnloadHook ?? true) {
    unloadHandler = () => {
      void sink.flush({ maxDurationMs: defaultDrainMs, force: true });
    };
    globalThis.addEventListener("unload", unloadHandler, { once: true });
  }

  return sink;
}

export function createBufferedTelemetrySink(
  downstream: TelemetrySink,
  options: BufferedTelemetrySinkOptions = {},
): FlushableTelemetrySink {
  return createBufferedBatchSink<CoFailureTelemetry>(
    async (records) => {
      for (const telemetry of records) {
        await downstream(telemetry);
      }
    },
    {
      ...options,
      name: options.name ?? "telemetry_sink",
      maxBatchSize: 1,
      overflowPolicy: "drop_oldest",
      deliveryMode: "best_effort",
    },
  );
}

export function createCompositeTelemetrySink(
  ...sinks: TelemetrySink[]
): FlushableTelemetrySink {
  const composite = (async (telemetry: CoFailureTelemetry) => {
    await Promise.all(sinks.map((sink) => sink(telemetry)));
  }) as FlushableTelemetrySink;

  composite.flush = async (options: TelemetryFlushOptions = {}) => {
    await Promise.all(sinks.map((sink) => flushTelemetrySink(sink, options)));
  };

  composite.close = async (options: TelemetryFlushOptions = {}) => {
    await Promise.all(sinks.map((sink) => closeTelemetrySink(sink, options)));
  };

  composite.stats = () => ({
    queueSize: 0,
    maxQueueSize: 0,
    enqueued: 0,
    delivered: 0,
    rejected: 0,
    droppedOldest: 0,
    droppedAfterRetries: 0,
    failedFlushes: 0,
    closed: false,
  });

  return composite;
}
