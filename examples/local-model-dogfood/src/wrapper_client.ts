import {
  callWrapper as callScaffoldWrapper,
} from "../../../packages/create-quorum-router/templates/basic/src/wrapper_client.ts";
import type {
  ModelInventoryEntry,
  ProviderResult,
} from "../../../packages/create-quorum-router/templates/basic/src/schema.ts";

export { buildWrapperArgs } from "../../../packages/create-quorum-router/templates/basic/src/wrapper_client.ts";

/** Absolute, so the root `models` task and Hermes (cwd = example) share it. */
export const WRAPPER_OUT_DIR =
  `${import.meta.dirname}/../../../out/dogfood/local-model-dogfood`;

/** The scaffold wrapper client, writing temp files under the dogfood out dir. */
export function callWrapper(
  entry: ModelInventoryEntry,
  prompt: string,
): Promise<ProviderResult> {
  return callScaffoldWrapper(entry, prompt, { outDir: WRAPPER_OUT_DIR });
}
