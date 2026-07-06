export async function runFixtureSmoke(): Promise<void> {
  const prompt = "evaluate Fusion Router deterministic fixture smoke";
  const hashBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(prompt),
  );
  const promptHash = Array.from(new Uint8Array(hashBytes)).map((byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  console.log(JSON.stringify(
    {
      ok: true,
      mode: "fixture",
      fixtureOnly: true,
      externalProviderCall: false,
      providerRequestSent: false,
      promptHash,
      result: {
        synthesis: `Fusion Router fixture synthesis for: ${prompt}`,
        reasoning:
          "combined 1 deterministic fixture output; no external provider API was called",
        consensusModel: "Fixture/synthesis-evaluation",
        sources: ["Fixture/direct-evaluation"],
      },
    },
    null,
    2,
  ));
}
