export function readRouterEnv(name: string): string | undefined {
  const canonical = Deno.env.get(name);
  if (canonical !== undefined) return canonical;
  return Deno.env.get(name.replace(/^QUORUM_ROUTER_/, "FUSION_ROUTER_"));
}
