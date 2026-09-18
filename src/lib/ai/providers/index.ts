import "server-only";
import { registerProvider } from "../provider";
import { createAnthropicProvider } from "./anthropic";

/**
 * Provider registry. Adding OpenAI or another vendor means adding a file that
 * implements AIProvider and one line here. Import this module (not the vendor
 * modules) wherever a provider is resolved.
 */
registerProvider("anthropic", createAnthropicProvider);

export { getProvider, AIProviderError } from "../provider";
