const CANONICAL_PREFIX = "QUORUM_ROUTER_";
const LEGACY_PREFIX = "FUSION_ROUTER_";

/** Canonical variables win; legacy names are read only when canonical is absent. */
export function readRouterEnv(name: string): string | undefined {
  const canonical = Deno.env.get(name);
  if (canonical !== undefined) return canonical;
  if (!name.startsWith(CANONICAL_PREFIX)) return undefined;
  return Deno.env.get(LEGACY_PREFIX + name.slice(CANONICAL_PREFIX.length));
}
