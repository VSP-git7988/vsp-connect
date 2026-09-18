import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { aiConfig } from "../config";
import {
  AIProviderError,
  costFor,
  type AIGenerateRequest,
  type AIProvider,
  type AIStreamEvent,
  type AITokenUsage,
} from "../provider";

/**
 * Models that reject `thinking: {type:"disabled"}` outright, or reject it at
 * the effort levels we use. For a short, grounded business answer we want the
 * cheapest reliable configuration, so thinking is off where the model allows
 * it and adaptive at low effort where it does not.
 */
function thinkingFor(model: string) {
  const adaptiveOnly = /^claude-(fable|mythos|opus-5)/.test(model);
  return adaptiveOnly
    ? ({ type: "adaptive" } as const)
    : ({ type: "disabled" } as const);
}

class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  readonly model = aiConfig.model;
  #client: Anthropic | null = null;

  isConfigured() {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  #sdk() {
    if (!this.isConfigured())
      throw new AIProviderError("ANTHROPIC_API_KEY is not set.", false);
    this.#client ??= new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries: 1,
      timeout: aiConfig.requestTimeoutMs,
    });
    return this.#client;
  }

  async *stream(request: AIGenerateRequest): AsyncIterable<AIStreamEvent> {
    const client = this.#sdk();
    let stream;
    try {
      stream = client.messages.stream(
        {
          model: this.model,
          max_tokens: request.maxOutputTokens,
          // The system prompt is stable per founder, so caching it keeps
          // repeat conversations cheap. Retrieved knowledge and the visitor
          // turn sit after it and never enter the cached prefix.
          system: [
            {
              type: "text",
              text: request.system,
              cache_control: { type: "ephemeral" },
            },
          ],
          thinking: thinkingFor(this.model),
          output_config: { effort: "low" },
          messages: request.messages,
        },
        { signal: request.signal },
      );
    } catch (error) {
      throw wrap(error);
    }

    const usage: AITokenUsage = { inputTokens: 0, outputTokens: 0 };
    try {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta" &&
          event.delta.text
        )
          yield { type: "text", text: event.delta.text };
        if (event.type === "message_start")
          usage.inputTokens =
            (event.message.usage.input_tokens ?? 0) +
            (event.message.usage.cache_read_input_tokens ?? 0) +
            (event.message.usage.cache_creation_input_tokens ?? 0);
        if (event.type === "message_delta")
          usage.outputTokens = event.usage.output_tokens ?? usage.outputTokens;
      }
    } catch (error) {
      throw wrap(error);
    }
    yield { type: "done", usage };
  }

  estimateCost(usage: AITokenUsage) {
    return costFor(this.model, usage);
  }
}

function wrap(error: unknown) {
  if (error instanceof AIProviderError) return error;
  if (error instanceof Anthropic.AuthenticationError)
    return new AIProviderError("AI provider credentials rejected.", false);
  if (error instanceof Anthropic.BadRequestError)
    return new AIProviderError("AI provider rejected the request.", false);
  if (error instanceof Anthropic.RateLimitError)
    return new AIProviderError("AI provider is rate limiting requests.", true);
  if (error instanceof Anthropic.APIError)
    return new AIProviderError(`AI provider error (${error.status}).`, true);
  return new AIProviderError("AI provider is unreachable.", true);
}

export function createAnthropicProvider(): AIProvider {
  return new AnthropicProvider();
}
