import "server-only";
export { estimateCost, modelPricing } from "./pricing";

function int(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
}
function num(value: string | undefined, fallback: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Every limit is configurable through the environment so cost and abuse
 * controls can be tuned without a deploy of new code or a migration.
 */
export const aiConfig = {
  provider: (process.env.AI_PROVIDER || "anthropic").toLowerCase(),
  // Deliberately not the most expensive tier: this is a short, grounded
  // business-representative conversation. Override with AI_MODEL.
  model: process.env.AI_MODEL || "claude-sonnet-5",

  /** Longest single visitor message accepted, in characters. */
  maxMessageLength: int(process.env.AI_MAX_MESSAGE_LENGTH, 1000, 4000),
  /** Visitor turns allowed in one conversation. */
  maxMessagesPerConversation: int(process.env.AI_MAX_MESSAGES_PER_CONVERSATION, 25, 200),
  /** Visitor turns allowed from one anonymous session per hour. */
  maxMessagesPerSessionHour: int(process.env.AI_MAX_MESSAGES_PER_SESSION_HOUR, 60, 1000),
  /** Visitor turns accepted for one founder profile per minute, across everyone. */
  maxMessagesPerProfileMinute: int(process.env.AI_MAX_MESSAGES_PER_PROFILE_MINUTE, 30, 600),
  /** Prior turns replayed to the model (visitor + assistant combined). */
  maxHistoryMessages: int(process.env.AI_MAX_HISTORY_MESSAGES, 12, 40),
  /** Hard ceiling on generated tokens; also keeps answers short. */
  maxOutputTokens: int(process.env.AI_MAX_OUTPUT_TOKENS, 700, 4000),
  /** Knowledge rows retrieved per request, and the character budget for them. */
  knowledgeLimit: int(process.env.AI_KNOWLEDGE_LIMIT, 6, 12),
  maxKnowledgeChars: int(process.env.AI_MAX_KNOWLEDGE_CHARS, 6000, 40000),
  /** Estimated spend ceiling per UTC day, in USD. Zero disables the guard. */
  dailyCostLimitUsd: num(process.env.AI_DAILY_COST_LIMIT_USD, 5),
  /** Wall-clock budget for one generation. */
  requestTimeoutMs: int(process.env.AI_REQUEST_TIMEOUT_MS, 45000, 120000),
} as const;
