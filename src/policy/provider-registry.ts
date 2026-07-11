import {
  type ProviderDescriptor,
  ProviderDescriptorSchema,
} from "../schemas.ts";
import {
  type PromptCacheCapability,
  PromptCacheCapabilitySchema,
} from "../prompt-cache.ts";

export type ProviderCapability = ProviderDescriptor & {
  supportsSynthesis: boolean;
  supportsStructuredJson: boolean;
  supportsStreaming?: boolean;
  promptCaching?: PromptCacheCapability;
  estimatedCostUsd?: number;
  latencyTier?: "low" | "medium" | "high";
  reliabilityTier?: "experimental" | "standard" | "preferred";
  enabled: boolean;
  tags?: string[];
};

export type ProviderCapabilityRegistryInput = Iterable<ProviderCapability>;

export function providerDescriptorKey(descriptor: ProviderDescriptor): string {
  const client = descriptor.client ?? "";
  return [
    descriptor.provider,
    descriptor.model,
    descriptor.authMode,
    descriptor.transport,
    client,
  ]
    .map((part) => part.toLowerCase())
    .join("\u0000");
}

function copyProviderCapability(
  capability: ProviderCapability,
): ProviderCapability {
  return {
    ...capability,
    tags: capability.tags ? [...capability.tags] : undefined,
    promptCaching: capability.promptCaching
      ? {
        supported: capability.promptCaching.supported,
        providerManaged: capability.promptCaching.providerManaged,
        ...(capability.promptCaching.ttlSeconds
          ? { ttlSeconds: [...capability.promptCaching.ttlSeconds] }
          : {}),
      }
      : undefined,
  };
}

function parseEstimatedCostUsd(
  estimatedCostUsd: number | undefined,
): number | undefined {
  if (estimatedCostUsd === undefined) {
    return undefined;
  }
  if (!Number.isFinite(estimatedCostUsd) || estimatedCostUsd < 0) {
    throw new Error("estimatedCostUsd must be a finite number >= 0.");
  }
  return estimatedCostUsd;
}

function parseProviderCapability(
  capability: ProviderCapability,
): ProviderCapability {
  const descriptor = ProviderDescriptorSchema.parse(capability);
  return {
    ...descriptor,
    supportsSynthesis: capability.supportsSynthesis,
    supportsStructuredJson: capability.supportsStructuredJson,
    supportsStreaming: capability.supportsStreaming,
    promptCaching: capability.promptCaching
      ? PromptCacheCapabilitySchema.parse(capability.promptCaching)
      : undefined,
    estimatedCostUsd: parseEstimatedCostUsd(capability.estimatedCostUsd),
    latencyTier: capability.latencyTier,
    reliabilityTier: capability.reliabilityTier,
    enabled: capability.enabled,
    tags: capability.tags ? [...capability.tags] : undefined,
  };
}

export class ProviderCapabilityRegistry {
  private readonly capabilities = new Map<string, ProviderCapability>();

  constructor(capabilities: ProviderCapabilityRegistryInput = []) {
    for (const capability of capabilities) {
      this.register(capability);
    }
  }

  register(capability: ProviderCapability): void {
    const parsed = parseProviderCapability(capability);
    this.capabilities.set(providerDescriptorKey(parsed), parsed);
  }

  get(descriptor: ProviderDescriptor): ProviderCapability | undefined {
    const capability = this.capabilities.get(providerDescriptorKey(descriptor));
    return capability ? copyProviderCapability(capability) : undefined;
  }

  require(descriptor: ProviderDescriptor): ProviderCapability {
    const capability = this.get(descriptor);
    if (!capability) {
      throw new Error(
        `Provider capability not registered for ${descriptor.provider}/${descriptor.model} (${descriptor.transport}).`,
      );
    }
    return capability;
  }

  list(): ProviderCapability[] {
    return [...this.capabilities.values()].map(copyProviderCapability);
  }
}

export const DEFAULT_PROVIDER_CAPABILITIES: ProviderCapability[] = [
  {
    provider: "OpenAI",
    model: "codex",
    authMode: "oauth",
    transport: "processAdapter",
    client: "CodexCLI",
    supportsSynthesis: false,
    supportsStructuredJson: true,
    supportsStreaming: true,
    estimatedCostUsd: 0.03,
    latencyTier: "medium",
    reliabilityTier: "preferred",
    enabled: true,
    tags: ["cli", "oauth", "structured"],
  },
  {
    provider: "OpenAI",
    model: "gpt-5.5",
    authMode: "oauth",
    transport: "processAdapter",
    client: "CodexCLI",
    supportsSynthesis: true,
    supportsStructuredJson: true,
    supportsStreaming: true,
    estimatedCostUsd: 0.04,
    latencyTier: "medium",
    reliabilityTier: "preferred",
    enabled: true,
    tags: ["cli", "oauth", "structured", "synthesis"],
  },
  {
    provider: "Anthropic",
    model: "claude-code",
    authMode: "oauth",
    transport: "processAdapter",
    client: "ClaudeCode",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    supportsStreaming: true,
    estimatedCostUsd: 0.04,
    latencyTier: "medium",
    reliabilityTier: "preferred",
    enabled: true,
    tags: ["cli", "oauth"],
  },
  {
    provider: "Google",
    model: "gemini-cli",
    authMode: "oauth",
    transport: "processAdapter",
    client: "GeminiCLI",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    supportsStreaming: true,
    estimatedCostUsd: 0.02,
    latencyTier: "medium",
    reliabilityTier: "standard",
    enabled: true,
    tags: ["cli", "oauth"],
  },
  {
    provider: "xAI",
    model: "grok",
    authMode: "oauth",
    transport: "processAdapter",
    client: "GrokCLI",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    supportsStreaming: true,
    estimatedCostUsd: 0.03,
    latencyTier: "medium",
    reliabilityTier: "standard",
    enabled: true,
    tags: ["cli", "oauth"],
  },
  {
    provider: "Cognition",
    model: "devin",
    authMode: "session",
    transport: "processAdapter",
    client: "DevinCLI",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    estimatedCostUsd: 0.05,
    latencyTier: "high",
    reliabilityTier: "experimental",
    enabled: true,
    tags: ["cli", "session"],
  },
  {
    provider: "Cline",
    model: "cline",
    authMode: "session",
    transport: "processAdapter",
    client: "Cline",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    estimatedCostUsd: 0.03,
    latencyTier: "high",
    reliabilityTier: "experimental",
    enabled: true,
    tags: ["cli", "session"],
  },
  {
    provider: "GLM",
    model: "glm-zcode",
    authMode: "oauth",
    transport: "zcodeWrapper",
    client: "zcode",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    estimatedCostUsd: 0.02,
    latencyTier: "medium",
    reliabilityTier: "experimental",
    enabled: true,
    tags: ["wrapper", "oauth", "glm"],
  },
  {
    provider: "OpenAI",
    model: "gpt-4o-mini",
    authMode: "apiKey",
    transport: "directHttp",
    client: "OpenAIChatCompletions",
    supportsSynthesis: true,
    supportsStructuredJson: true,
    supportsStreaming: false,
    promptCaching: { supported: true, providerManaged: true },
    estimatedCostUsd: 0.02,
    latencyTier: "low",
    reliabilityTier: "preferred",
    enabled: true,
    tags: ["direct-http", "api-key", "structured"],
  },
  {
    provider: "Anthropic",
    model: "claude-3-5-haiku-latest",
    authMode: "apiKey",
    transport: "directHttp",
    client: "AnthropicMessagesAPI",
    supportsSynthesis: false,
    supportsStructuredJson: false,
    supportsStreaming: false,
    promptCaching: {
      supported: true,
      providerManaged: true,
      ttlSeconds: [300],
    },
    estimatedCostUsd: 0.03,
    latencyTier: "low",
    reliabilityTier: "preferred",
    enabled: true,
    tags: ["direct-http", "api-key"],
  },
];

export function createDefaultProviderCapabilityRegistry(): ProviderCapabilityRegistry {
  return new ProviderCapabilityRegistry(DEFAULT_PROVIDER_CAPABILITIES);
}
