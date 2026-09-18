"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Calendar,
  Download,
  Globe,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Profile } from "@/lib/types";
import type { AIAction, AIProfileContext, AISolution } from "@/lib/ai/types";
import { ControlFilter, parseControl } from "@/lib/ai/actions";
import { contactUrls, safeWebUrl } from "@/lib/contact";
import { track } from "@/lib/analytics-client";
import { AIMessageText } from "./ai-message";

type Bubble = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: AIAction[];
};

const SESSION_KEY = "vsp-ai-session";

/**
 * Per-tab anonymous identifier. Kept in sessionStorage rather than
 * localStorage so it is not a durable cross-visit identifier, and used only to
 * continue a conversation and apply rate limits.
 */
function sessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID().replace(/-/g, "");
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID().replace(/-/g, "");
  }
}

/**
 * The server already strips and validates the control block, but the browser
 * repeats both steps so a proxy, a future provider or a partial stream can
 * never render the structured side-channel as prose. Actions from either
 * source are merged and de-duplicated; neither source supplies a URL.
 */
function mergeActions(lists: AIAction[][]): AIAction[] {
  const seen = new Set<string>();
  const merged: AIAction[] = [];
  for (const action of lists.flat()) {
    const key =
      action.type === "SHOW_SOLUTION"
        ? `${action.type}:${action.solutionId}`
        : action.type;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(action);
  }
  return merged;
}

export function AIAssistant({
  profile,
  context,
  companyWebsite,
}: {
  profile: Profile;
  context: AIProfileContext;
  companyWebsite: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    retry: boolean;
  } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [leadSaved, setLeadSaved] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [lastAsked, setLastAsked] = useState("");

  const links = contactUrls(profile);
  const website = links.website ?? safeWebUrl(companyWebsite);
  const solutionSlugs = useMemo(
    () => new Set(context.solutions.map((s) => s.slug)),
    [context.solutions],
  );

  useEffect(() => {
    if (!log.current) return;
    log.current.scrollTop = log.current.scrollHeight;
  }, [bubbles, busy]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || busy) return;
      setLastAsked(question);
      setError(null);
      setInput("");
      setBusy(true);
      const replyId = crypto.randomUUID();
      setBubbles((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "user", text: question },
        { id: replyId, role: "assistant", text: "" },
      ]);

      const controller = new AbortController();
      abort.current = controller;
      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            slug: profile.slug,
            session_id: sessionId(),
            conversation_id: conversationId,
            message: question,
            source: new URLSearchParams(location.search).get("source"),
          }),
        });
        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.message ??
              "AI assistant is temporarily unavailable. You can still contact or book with this founder.",
          );
        }
        const filter = new ControlFilter();
        let serverActions: AIAction[] = [];
        let captured = false;
        const append = (text: string) => {
          if (!text) return;
          setBubbles((prev) =>
            prev.map((b) =>
              b.id === replyId ? { ...b, text: b.text + text } : b,
            ),
          );
        };
        await consume(response.body, {
          onMeta: (id) => setConversationId((current) => current ?? id),
          onDelta: (chunk) => append(filter.push(chunk)),
          onFinal: (actions, leadCaptured) => {
            serverActions = actions;
            captured = leadCaptured;
          },
          onError: (message) => setError({ message, retry: true }),
        });
        const tail = filter.finish();
        append(tail.text);
        const actions = mergeActions([
          serverActions,
          parseControl(tail.raw, solutionSlugs).actions,
        ]);
        if (actions.length)
          setBubbles((prev) =>
            prev.map((b) => (b.id === replyId ? { ...b, actions } : b)),
          );
        if (captured) setLeadSaved(true);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
        setError({
          message:
            caught instanceof Error
              ? caught.message
              : "Something went wrong. Please try again.",
          retry: true,
        });
      } finally {
        setBusy(false);
        abort.current = null;
        setBubbles((prev) =>
          prev.filter((b) => b.role === "user" || b.text.trim() || b.actions),
        );
      }
    },
    [busy, conversationId, profile.slug, solutionSlugs],
  );

  function openPanel() {
    setOpen(true);
    dialog.current?.showModal();
    track(profile.id, "ai_opened");
    requestAnimationFrame(() => field.current?.focus());
  }
  function closePanel() {
    abort.current?.abort();
    dialog.current?.close();
    setOpen(false);
  }
  function clearConversation() {
    abort.current?.abort();
    setBubbles([]);
    setConversationId(null);
    setError(null);
    setLeadSaved(false);
    setBusy(false);
    field.current?.focus();
  }

  const greeted = bubbles.length > 0;
  const solutionsBySlug = new Map(context.solutions.map((s) => [s.slug, s]));

  return (
    <>
      <button className="ai-cta" onClick={openPanel} aria-haspopup="dialog">
        <span className="ai-cta-glow" aria-hidden="true" />
        <Sparkles size={18} />
        <span>
          Ask my AI
          <small>Talk to {profile.first_name}&rsquo;s AI representative</small>
        </span>
        <ArrowUpRight size={16} />
      </button>

      <dialog
        ref={dialog}
        className="ai-dialog"
        aria-label={`${profile.display_name}'s AI representative`}
        onClose={() => setOpen(false)}
        onCancel={() => abort.current?.abort()}
        onClick={(e) => {
          if (e.target === dialog.current) closePanel();
        }}
      >
        <div className="ai-panel">
          <header className="ai-head">
            <div className="ai-head-mark" aria-hidden="true">
              <Sparkles size={17} />
            </div>
            <div className="ai-head-text">
              <strong>{profile.first_name}&rsquo;s AI representative</strong>
              <span>
                <span className="status-dot" /> VSP Innovations
              </span>
            </div>
            <button
              className="ai-icon"
              onClick={clearConversation}
              aria-label="Clear conversation"
              disabled={!greeted}
            >
              <Trash2 size={17} />
            </button>
            <button
              className="ai-icon"
              onClick={closePanel}
              aria-label="Close assistant"
            >
              <X size={19} />
            </button>
          </header>

          <div
            className="ai-log"
            ref={log}
            role="log"
            aria-live="polite"
            aria-busy={busy}
          >
            <div className="ai-intro">
              <p>{context.intro}</p>
              <small>
                Answers come from {profile.first_name}&rsquo;s approved profile
                and VSP Innovations business information.
              </small>
            </div>
            {bubbles.map((bubble) => (
              <div key={bubble.id} className={`ai-bubble ai-${bubble.role}`}>
                {bubble.role === "assistant" && !bubble.text && busy ? (
                  <span
                    className="ai-typing"
                    role="status"
                    aria-label="Thinking"
                  >
                    <i /> <i /> <i />
                  </span>
                ) : (
                  <AIMessageText text={bubble.text} />
                )}
                {bubble.actions?.length ? (
                  <ActionRow
                    actions={bubble.actions}
                    profile={profile}
                    website={website}
                    booking={links.booking}
                    solutions={solutionsBySlug}
                  />
                ) : null}
              </div>
            ))}
            {leadSaved && (
              <p className="ai-note" role="status">
                Your details have been shared with {profile.first_name}, who
                will follow up directly.
              </p>
            )}
            {error && (
              <div className="ai-error" role="alert">
                <p>{error.message}</p>
                <div className="ai-error-actions">
                  {error.retry && lastAsked && (
                    <button onClick={() => send(lastAsked)}>
                      <RefreshCw size={14} /> Try again
                    </button>
                  )}
                  {links.booking && (
                    <a
                      href={links.booking}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => track(profile.id, "booking_from_ai")}
                    >
                      <Calendar size={14} /> Book a meeting
                    </a>
                  )}
                  <a
                    href={`/api/profiles/${profile.slug}/vcard`}
                    onClick={() => track(profile.id, "save_contact")}
                  >
                    <Download size={14} /> Save contact
                  </a>
                </div>
              </div>
            )}
          </div>

          {!greeted && context.suggestions.length > 0 && (
            <div className="ai-suggestions">
              <span className="eyebrow">TRY ASKING</span>
              <div>
                {context.suggestions.map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      track(profile.id, "suggested_question_clicked");
                      void send(question);
                    }}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form
            className="ai-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label className="visually-hidden" htmlFor="ai-input">
              Message {profile.first_name}&rsquo;s AI representative
            </label>
            <textarea
              id="ai-input"
              ref={field}
              rows={1}
              value={input}
              maxLength={1000}
              placeholder="Ask about VSP, our AI solutions, or book a meeting…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              disabled={busy}
            />
            <button
              className="ai-send"
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </form>
          <p className="ai-privacy">
            Messages may be stored to improve follow-up and assist VSP
            Innovations with your request. Please don&rsquo;t share sensitive
            information.
          </p>
        </div>
      </dialog>
      {open && (
        <span className="visually-hidden" role="status">
          {busy ? "Assistant is replying" : "Assistant ready"}
        </span>
      )}
    </>
  );
}

/** Renders only predefined controls. Model output never supplies a URL. */
function ActionRow({
  actions,
  profile,
  website,
  booking,
  solutions,
}: {
  actions: AIAction[];
  profile: Profile;
  website: string | null;
  booking: string | null;
  solutions: Map<string, AISolution>;
}) {
  const links = contactUrls(profile);
  return (
    <div className="ai-actions">
      {actions.map((action, index) => {
        const key = `${action.type}-${index}`;
        if (action.type === "SHOW_SOLUTION") {
          const solution = solutions.get(action.solutionId);
          if (!solution) return null;
          return (
            <SolutionCard
              key={key}
              solution={solution}
              profileId={profile.id}
            />
          );
        }
        if (action.type === "BOOK_MEETING" && booking)
          return (
            <a
              key={key}
              className="ai-action"
              href={booking}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(profile.id, "booking_from_ai")}
            >
              <Calendar size={15} /> Book with {profile.first_name}
            </a>
          );
        if (action.type === "SAVE_CONTACT")
          return (
            <a
              key={key}
              className="ai-action"
              href={`/api/profiles/${profile.slug}/vcard`}
              onClick={() => track(profile.id, "save_contact")}
            >
              <Download size={15} /> Save contact
            </a>
          );
        if (action.type === "OPEN_WHATSAPP" && links.whatsapp)
          return (
            <a
              key={key}
              className="ai-action"
              href={links.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(profile.id, "whatsapp_clicked")}
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          );
        if (action.type === "OPEN_EMAIL" && links.email)
          return (
            <a
              key={key}
              className="ai-action"
              href={links.email}
              onClick={() => track(profile.id, "email_clicked")}
            >
              <Mail size={15} /> Email {profile.first_name}
            </a>
          );
        if (action.type === "OPEN_WEBSITE" && website)
          return (
            <a
              key={key}
              className="ai-action"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track(profile.id, "website_clicked")}
            >
              <Globe size={15} /> Visit website
            </a>
          );
        return null;
      })}
    </div>
  );
}

function SolutionCard({
  solution,
  profileId,
}: {
  solution: AISolution;
  profileId: string;
}) {
  useEffect(() => {
    track(profileId, "solution_viewed", solution.slug);
  }, [profileId, solution.slug]);
  return (
    <div className="ai-solution">
      <span className="eyebrow">VSP SOLUTION</span>
      <strong>{solution.name}</strong>
      <p>{solution.short_description}</p>
    </div>
  );
}

/**
 * Minimal server-sent-events reader. The endpoint streams `meta`, `delta`,
 * `final`, `error` and `done` events; anything else is ignored so a future
 * event type cannot break an older client.
 */
async function consume(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onMeta: (conversationId: string) => void;
    onDelta: (text: string) => void;
    onFinal: (actions: AIAction[], leadCaptured: boolean) => void;
    onError: (message: string) => void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf("\n\n");
    while (split >= 0) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf("\n\n");
      let name = "";
      let payload = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) payload += line.slice(5).trim();
      }
      if (!name || !payload) continue;
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(payload);
      } catch {
        continue;
      }
      if (name === "meta" && typeof data.conversationId === "string")
        handlers.onMeta(data.conversationId);
      else if (name === "delta" && typeof data.text === "string")
        handlers.onDelta(data.text);
      else if (name === "final" && Array.isArray(data.actions))
        handlers.onFinal(
          data.actions as AIAction[],
          data.leadCaptured === true,
        );
      else if (name === "error")
        handlers.onError(
          typeof data.message === "string"
            ? data.message
            : "AI assistant is temporarily unavailable.",
        );
      else if (name === "done") return;
    }
  }
}
