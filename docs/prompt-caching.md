# Prompt Caching

QuorumRouter exposes a provider-native prompt caching contract for direct HTTP
adapters. Caching is opt-in per invocation and is separate from response
caching: QuorumRouter never stores or replays model responses.

## Supported paths

| Provider adapter        | Request behavior                                                                   | Normalized usage                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| OpenAI Chat Completions | Provider-managed prefix caching; no vendor-specific request flag                   | `inputTokens`, `outputTokens`, `cacheReadInputTokens`, `uncachedInputTokens`, `cacheHit`                             |
| Anthropic Messages      | Adds `cache_control: { type: "ephemeral" }` to explicitly cacheable read-only text | `inputTokens`, `outputTokens`, `cacheCreationInputTokens`, `cacheReadInputTokens`, `uncachedInputTokens`, `cacheHit` |

Process, OAuth, session, and wrapper adapters advertise no prompt-cache support
unless their adapter contract explicitly implements it.

## Invocation

```ts
const output = await adapter.invoke(prompt, signal, {
  cache: {
    enabled: true,
    payloadClass: "read_only",
    ttlSeconds: 300,
  },
});

console.log(output.usage?.cacheHit);
console.log(output.usage?.cacheReadInputTokens);
```

Caching defaults to disabled. An adapter rejects an enabled policy when it does
not advertise support or when the requested TTL is unsupported.

## Safety boundary

Only `read_only` payloads may opt into caching. QuorumRouter fails closed before
provider execution if caching is enabled for:

- `mutation`
- `approval`
- `credential`

Do not place secrets, SafeLoop requests, approval payloads, execution receipts,
mutable repository diffs, or private user data inside a cacheable prompt.
Provider-native caches remain subject to each provider's retention,
minimum-token, regional, and pricing rules.

Prompt caching does not alter quorum, validation, SafeLoop policy, approval,
execution, or audit requirements.
