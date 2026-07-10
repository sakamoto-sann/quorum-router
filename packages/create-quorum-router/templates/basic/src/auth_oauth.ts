export function browserLoginSupported(): boolean {
  return false;
}

export function printLoginGuidance(): never {
  console.error(
    "OAuth/session login is not configured for this generated scaffold yet.",
  );
  console.error("Use an installed provider CLI login, then rerun:");
  console.error("  deno task intake");
  console.error("");
  console.error(
    "Generic env fallback exists, but it is private/manual and not the preferred path.",
  );
  console.error(
    "Never paste tokens into chat/logs and never commit .env or .quorum-router/.",
  );
  Deno.exit(1);
}
