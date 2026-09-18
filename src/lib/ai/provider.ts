import "server-only";
import { aiConfig, estimateCost } from "./config";

/**
 * Provider abstraction. Nothing outside src/lib/ai/providers/* may import a
 * vendor SDK, so a second provider is a new file plus a registry entry rather
 * than a change to the chat route, prompt or storage layers.
 */
export type AIChatRole = "user" | "assistant";
export type AIChatMessage = { role: AIChatRole; content: string };

export type AIGenerateRequest = {
  /** Trusted instructions. Never contains visitor text. */
  system: string;
  /** Alternating conversation, oldest first, ending with the visitor turn. */
  messages: AIChatMessage[];
  maxOutputTokens: number;
  signal?: AbortSignal;
};

export type AITokenUsage = { inputTokens: number; outputTokens: number };

export type AIStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; usage: AITokenUsage };

export interface AIProvider {
  /** Stored on ai_usage rows. */
  readonly name: string;
  readonly model: string;
  /** False when credentials are absent; the route then serves the fallback. */
  isConfigured(): boolean;
  stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent>;
  estimateCost(usage: AITokenUsage): number;
}

/** Raised for provider failures the route should translate into a fallback. */
export class AIProviderError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = true) {
    super(message);
    this.name = "AIProviderError";
    this.retryable = retryable;
  }
}

/** Shared cost helper so every provider records comparable estimates. */
export function costFor(model: string, usage: AITokenUsage) {
  return estimateCost(model, usage.inputTokens, usage.outputTokens);
}

type Factory = () => AIProvider;
const registry = new Map<string, Factory>();

export function registerProvider(name: string, factory: Factory) {
  registry.set(name, factory);
}

let active: AIProvider | null = null;

/**
 * Resolves the configured provider once per server process. Registration lives
 * in ./providers so this module stays free of vendor imports.
 */
export function getProvider(): AIProvider {
  if (active) return active;
  const factory = registry.get(aiConfig.provider);
  if (!factory)
    throw new AIProviderError(
      `Unknown AI provider "${aiConfig.provider}".`,
      false,
    );
  active = factory();
  return active;
}

/** Test seam: forget the memoised provider. */
export function resetProvider() {
  active = null;
}
