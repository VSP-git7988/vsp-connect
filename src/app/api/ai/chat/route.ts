import { z } from "zod";
import { getCompany, getProfile } from "@/lib/data";
import {
  ControlFilter,
  emptyControl,
  isContactable,
  parseControl,
} from "@/lib/ai/actions";
import { aiConfig } from "@/lib/ai/config";
import {
  availableActions,
  buildSystemPrompt,
  neutralise,
} from "@/lib/ai/prompt";
import { AIProviderError, getProvider } from "@/lib/ai/providers";
import {
  getServerAIConfig,
  getServerSolutions,
  retrieveKnowledge,
} from "@/lib/ai/retrieval";
import {
  checkRate,
  loadConversation,
  overDailyBudget,
  recordEvent,
  recordUsage,
  saveTurn,
  startConversation,
  upsertLead,
} from "@/lib/ai/store";
import type { AIChatMessage } from "@/lib/ai/provider";
import type { ChatErrorCode } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16_384;
const UNAVAILABLE =
  "AI assistant is temporarily unavailable. You can still contact or book with this founder.";

const schema = z.object({
  slug: z.string().max(80),
  session_id: z
    .string()
    .min(16)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  conversation_id: z.uuid().nullable().optional().catch(null),
  message: z.string().min(1).max(8000),
  source: z.enum(["nfc", "qr", "direct"]).nullable().optional().catch(null),
});

function fail(code: ChatErrorCode, status: number, message: string) {
  return Response.json({ error: code, message }, { status });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (origin && (!host || new URL(origin).host !== host))
    return fail("invalid", 403, "Invalid origin.");
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES)
    return fail("too_long", 413, "Message is too long.");

  let body: z.infer<typeof schema>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES)
      return fail("too_long", 413, "Message is too long.");
    body = schema.parse(JSON.parse(raw));
  } catch {
    return fail("invalid", 400, "That request could not be read.");
  }

  const message = neutralise(body.message).trim();
  if (!message) return fail("invalid", 400, "Please enter a message.");
  if (message.length > aiConfig.maxMessageLength)
    return fail(
      "too_long",
      413,
      `Please keep messages under ${aiConfig.maxMessageLength} characters.`,
    );

  const profile = await getProfile(body.slug);
  if (!profile) return fail("unavailable", 404, "Profile not found.");

  const config = await getServerAIConfig(profile);
  if (!config.enabled)
    return fail(
      "disabled",
      503,
      "This founder's AI representative is not available yet.",
    );

  // An unregistered AI_PROVIDER is a misconfiguration, not a visitor error:
  // it degrades to the same fallback as missing credentials.
  let provider;
  try {
    provider = getProvider();
  } catch {
    return fail("unavailable", 503, UNAVAILABLE);
  }
  if (!provider.isConfigured()) return fail("unavailable", 503, UNAVAILABLE);
  if (await overDailyBudget())
    return fail(
      "rate_limited",
      503,
      "The AI assistant is paused for today. You can still contact or book with this founder.",
    );

  const existing = await loadConversation(
    profile.id,
    body.session_id,
    body.conversation_id ?? null,
  );
  const verdict = await checkRate(
    profile.id,
    body.session_id,
    existing?.id ?? null,
  );
  if (verdict !== "ok")
    return fail(
      verdict === "unavailable" ? "unavailable" : "rate_limited",
      verdict === "unavailable" ? 503 : 429,
      {
        conversation:
          "This conversation has reached its length limit. Clear it to start a new one, or contact the founder directly.",
        session:
          "You have reached the message limit for now. Please try again later, or contact the founder directly.",
        busy: "The assistant is busy right now. Please try again in a moment.",
        unavailable: UNAVAILABLE,
      }[verdict],
    );

  const conversationId =
    existing?.id ?? (await startConversation(profile.id, body.session_id));

  const [company, knowledge, solutions] = await Promise.all([
    getCompany(profile.company_id),
    retrieveKnowledge(profile, message),
    getServerSolutions(profile.company_id),
  ]);

  const system = buildSystemPrompt({
    profile,
    company,
    config,
    knowledge,
    solutions,
    actions: availableActions(profile, company),
  });
  const history: AIChatMessage[] = [
    ...(existing?.history ?? []),
    { role: "user", content: message },
  ];
  const allowedSolutions = new Set(solutions.map((s) => s.slug));

  void recordEvent(profile.id, "ai_message_sent", body.source ?? null);

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      const filter = new ControlFilter();
      let visible = "";
      let usage = { inputTokens: 0, outputTokens: 0 };
      let failed = false;

      send("meta", { conversationId });
      try {
        for await (const event of provider.stream({
          system,
          messages: history,
          maxOutputTokens: aiConfig.maxOutputTokens,
          signal: abort.signal,
        })) {
          if (event.type === "text") {
            const text = filter.push(event.text);
            if (text) {
              visible += text;
              send("delta", { text });
            }
          } else usage = event.usage;
        }
      } catch (error) {
        failed = true;
        send("error", {
          code: "provider_error" satisfies ChatErrorCode,
          retryable: !(error instanceof AIProviderError) || error.retryable,
          message: UNAVAILABLE,
        });
      }

      const tail = filter.finish();
      if (tail.text) {
        visible += tail.text;
        send("delta", { text: tail.text });
      }
      // Structured output is validated here, on the server, against a closed
      // schema and the solutions this request actually loaded.
      const control = failed
        ? emptyControl
        : parseControl(tail.raw, allowedSolutions);

      let leadCaptured = false;
      try {
        if (visible.trim() && conversationId)
          await saveTurn(conversationId, message, visible.trim());
        if (usage.inputTokens || usage.outputTokens)
          await recordUsage({
            profileId: profile.id,
            conversationId,
            provider: provider.name,
            model: provider.model,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            estimatedCost: provider.estimateCost(usage),
          });
        if (control.meetingIntent)
          await recordEvent(profile.id, "meeting_intent", body.source ?? null);
        if (control.lead) {
          await recordEvent(profile.id, "lead_started", body.source ?? null);
          if (isContactable(control.lead)) {
            const { created } = await upsertLead({
              profileId: profile.id,
              companyId: profile.company_id,
              conversationId,
              source: body.source ?? "ai_chat",
              lead: control.lead,
            });
            leadCaptured = created;
            if (created)
              await recordEvent(
                profile.id,
                "lead_created",
                body.source ?? null,
              );
          }
        }
      } catch {
        // Storage problems must never break an answer that was delivered.
      }

      if (!failed) send("final", { actions: control.actions, leadCaptured });
      send("done", {});
      controller.close();
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
