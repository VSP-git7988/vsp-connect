import "server-only";
import { serviceConfigured, serviceDb } from "../supabase";
import { aiConfig } from "./config";
import type { LeadDraft } from "./actions";
import type { AIChatMessage } from "./provider";

export type RateVerdict =
  "ok" | "conversation" | "session" | "busy" | "unavailable";

/**
 * Fallback limiter used only when Supabase is not configured, so a development
 * instance is still not an open AI proxy. Process-local and therefore not a
 * substitute for the database limiter in production.
 */
const memory = {
  perSession: new Map<string, number[]>(),
  perProfile: new Map<string, number[]>(),
  conversations: new Map<
    string,
    { profileId: string; sessionId: string; messages: AIChatMessage[] }
  >(),
};

function bump(map: Map<string, number[]>, key: string, windowMs: number) {
  const now = Date.now();
  const hits = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  map.set(key, hits);
  return hits;
}

export async function checkRate(
  profileId: string,
  sessionId: string,
  conversationId: string | null,
): Promise<RateVerdict> {
  if (!serviceConfigured()) {
    const session = bump(memory.perSession, sessionId, 3_600_000);
    if (session.length >= aiConfig.maxMessagesPerSessionHour) return "session";
    const profile = bump(memory.perProfile, profileId, 60_000);
    if (profile.length >= aiConfig.maxMessagesPerProfileMinute) return "busy";
    const turns = conversationId
      ? (memory.conversations
          .get(conversationId)
          ?.messages.filter((m) => m.role === "user").length ?? 0)
      : 0;
    if (turns >= aiConfig.maxMessagesPerConversation) return "conversation";
    session.push(Date.now());
    profile.push(Date.now());
    return "ok";
  }
  const { data, error } = await serviceDb().rpc("ai_rate_check", {
    p_profile_id: profileId,
    p_session_id: sessionId,
    p_conversation_id: conversationId,
    p_max_conversation: aiConfig.maxMessagesPerConversation,
    p_max_session_hour: aiConfig.maxMessagesPerSessionHour,
    p_max_profile_minute: aiConfig.maxMessagesPerProfileMinute,
  });
  if (error) return "unavailable";
  return (data as RateVerdict) ?? "unavailable";
}

/** Daily estimated-spend guard. Fails closed only on a real overspend. */
export async function overDailyBudget() {
  if (aiConfig.dailyCostLimitUsd <= 0 || !serviceConfigured()) return false;
  const { data, error } = await serviceDb().rpc("ai_spend_today");
  if (error) return false;
  return Number(data ?? 0) >= aiConfig.dailyCostLimitUsd;
}

/**
 * Loads prior turns for a conversation the caller can prove it owns: the
 * conversation must belong to both this profile and this anonymous session, so
 * a guessed identifier cannot expose another visitor's messages.
 */
export async function loadConversation(
  profileId: string,
  sessionId: string,
  conversationId: string | null,
): Promise<{ id: string; history: AIChatMessage[] } | null> {
  if (!conversationId) return null;
  if (!serviceConfigured()) {
    const record = memory.conversations.get(conversationId);
    if (
      !record ||
      record.profileId !== profileId ||
      record.sessionId !== sessionId
    )
      return null;
    return {
      id: conversationId,
      history: record.messages.slice(-aiConfig.maxHistoryMessages),
    };
  }
  const db = serviceDb();
  const { data: conversation } = await db
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("profile_id", profileId)
    .eq("anonymous_session_id", sessionId)
    .maybeSingle();
  if (!conversation) return null;
  const { data: rows } = await db
    .from("messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(aiConfig.maxHistoryMessages);
  const history = ((rows ?? []) as AIChatMessage[]).reverse();
  return { id: conversationId, history };
}

export async function startConversation(
  profileId: string,
  sessionId: string,
): Promise<string | null> {
  if (!serviceConfigured()) {
    const id = crypto.randomUUID();
    memory.conversations.set(id, { profileId, sessionId, messages: [] });
    return id;
  }
  const { data, error } = await serviceDb()
    .from("conversations")
    .insert({ profile_id: profileId, anonymous_session_id: sessionId })
    .select("id")
    .single();
  return error ? null : (data.id as string);
}

/** Persists the visitor turn and the assistant's visible reply only. */
export async function saveTurn(
  conversationId: string,
  userText: string,
  assistantText: string,
) {
  const rows = [
    { role: "user" as const, content: userText },
    { role: "assistant" as const, content: assistantText },
  ].filter((row) => row.content.trim().length > 0);
  if (!rows.length) return;
  if (!serviceConfigured()) {
    memory.conversations.get(conversationId)?.messages.push(...rows);
    return;
  }
  const db = serviceDb();
  await db
    .from("messages")
    .insert(rows.map((row) => ({ ...row, conversation_id: conversationId })));
  // The column is a running total for the conversation, so it is derived from
  // the stored rows rather than overwritten with the size of this turn.
  const { count } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  await db
    .from("conversations")
    .update({
      message_count: count ?? rows.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

export async function recordUsage(entry: {
  profileId: string;
  conversationId: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}) {
  if (!serviceConfigured()) return;
  await serviceDb().from("ai_usage").insert({
    profile_id: entry.profileId,
    conversation_id: entry.conversationId,
    provider: entry.provider,
    model: entry.model,
    input_tokens: entry.inputTokens,
    output_tokens: entry.outputTokens,
    estimated_cost: entry.estimatedCost,
  });
}

/**
 * Creates or updates the lead attached to a conversation. Only fields the
 * visitor supplied are written; existing values are never overwritten with
 * blanks. Returns whether a new lead row was created.
 */
export async function upsertLead(input: {
  profileId: string;
  companyId: string;
  conversationId: string | null;
  source: string;
  lead: LeadDraft;
}): Promise<{ created: boolean }> {
  if (!serviceConfigured() || !input.conversationId) return { created: false };
  const db = serviceDb();
  const fields = Object.fromEntries(
    Object.entries(input.lead).filter(([, value]) => Boolean(value)),
  );
  if (!Object.keys(fields).length) return { created: false };

  const { data: conversation } = await db
    .from("conversations")
    .select("lead_id")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversation?.lead_id) {
    await db.from("leads").update(fields).eq("id", conversation.lead_id);
    return { created: false };
  }
  const { data, error } = await db
    .from("leads")
    .insert({
      ...fields,
      profile_id: input.profileId,
      company_id: input.companyId,
      source: ["ai_chat", "nfc", "qr", "direct"].includes(input.source)
        ? input.source
        : "ai_chat",
    })
    .select("id")
    .single();
  if (error) return { created: false };
  await db
    .from("conversations")
    .update({ lead_id: data.id })
    .eq("id", input.conversationId);
  return { created: true };
}

/** Server-side analytics write, reusing the V1 validated ingestion function. */
export async function recordEvent(
  profileId: string,
  eventType: string,
  source: string | null,
  solutionSlug: string | null = null,
) {
  if (!serviceConfigured()) return;
  await serviceDb().rpc("record_analytics_event", {
    p_profile_id: profileId,
    p_event_type: eventType,
    p_referrer: null,
    p_source: source,
    p_solution_slug: solutionSlug,
  });
}
