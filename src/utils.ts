import { ProcessExecutionError } from "./errors.ts";

export async function sleepWithAbort(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  if (signal.aborted) {
    throw new ProcessExecutionError(
      "aborted",
      "Request aborted before adapter execution.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      reject(
        new ProcessExecutionError("aborted", "Request aborted or timed out."),
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
