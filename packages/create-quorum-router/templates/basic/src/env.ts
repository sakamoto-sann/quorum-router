// Copied from the QuorumRouter library (src/env.ts) by `deno task scaffold:sync`.
// Edit the library source, not this copy.
const CANONICAL_PREFIX = "QUORUM_ROUTER_";
const LEGACY_PREFIX = "FUSION_ROUTER_";

/** Reads canonical router environment variables before deprecated legacy names. */
export function readRouterEnv(name: string): string | undefined {
  const canonical = Deno.env.get(name);
  if (canonical !== undefined) return canonical;
  if (!name.startsWith(CANONICAL_PREFIX)) return undefined;
  return Deno.env.get(LEGACY_PREFIX + name.slice(CANONICAL_PREFIX.length));
}

export function routerEnvPresent(name: string): boolean {
  return Boolean(readRouterEnv(name)?.trim());
}
