import {
  type CoFailureTelemetry,
  CoFailureTelemetrySchema,
  type ModelOutput,
  type TelemetryFailure,
} from "../schemas.ts";
import type { ModelAdapter } from "../contracts.ts";
import { errorCode, errorMessage } from "../errors.ts";

export function buildCoFailureTelemetry(
  adapters: ModelAdapter[],
  settled: PromiseSettledResult<ModelOutput>[],
): CoFailureTelemetry {
  const failures: TelemetryFailure[] = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [];
    }

    const descriptor = adapters[index].descriptor;
    return [{
      provider: descriptor.provider,
      model: descriptor.model,
      code: errorCode(result.reason),
      message: errorMessage(result.reason),
    }];
  });

  return CoFailureTelemetrySchema.parse({
    totalAdapters: adapters.length,
    successfulAdapters: settled.length - failures.length,
    failedAdapters: failures.length,
    failures,
  });
}
