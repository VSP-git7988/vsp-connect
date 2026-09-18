import { z } from "zod";
import type { AIAction } from "./types";

/**
 * Structured side-channel. The model writes prose for the visitor and may end
 * its turn with a single control block. The block is stripped before any text
 * reaches the browser, parsed here, and validated against a closed schema; a
 * malformed, oversized or unknown block is discarded rather than trusted. The
 * model can therefore request predefined UI, never generate it.
 */
export const CONTROL_OPEN = "<<<VSP_CONTROL";
export const CONTROL_CLOSE = "VSP_CONTROL>>>";
const MAX_CONTROL_CHARS = 4000;

const trimmed = (max: number) =>
  z
    .string()
    .transform((s) => s.trim().replace(/\s+/g, " ").slice(0, max))
    .refine((s) => s.length > 0);

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("BOOK_MEETING") }),
  z.object({ type: z.literal("SAVE_CONTACT") }),
  z.object({ type: z.literal("OPEN_WHATSAPP") }),
  z.object({ type: z.literal("OPEN_EMAIL") }),
  z.object({ type: z.literal("OPEN_WEBSITE") }),
  z.object({
    type: z.literal("SHOW_SOLUTION"),
    solutionId: z
      .string()
      .max(60)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  }),
]);

export const leadDraftSchema = z.object({
  name: trimmed(120).optional(),
  company_name: trimmed(160).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)
    .optional(),
  phone: z
    .string()
    .trim()
    .max(24)
    .regex(/^[-+0-9 ()]{6,24}$/)
    .optional(),
  business_type: trimmed(120).optional(),
  interest: trimmed(200).optional(),
  problem_summary: trimmed(1000).optional(),
});
export type LeadDraft = z.infer<typeof leadDraftSchema>;

const controlSchema = z.object({
  actions: z.array(actionSchema).max(4).optional(),
  lead: leadDraftSchema.optional(),
  meeting_intent: z.boolean().optional(),
});
export type AIControl = {
  actions: AIAction[];
  lead: LeadDraft | null;
  meetingIntent: boolean;
};

export const emptyControl: AIControl = {
  actions: [],
  lead: null,
  meetingIntent: false,
};

/**
 * Strips control markers and null bytes from untrusted text, so neither a
 * visitor message nor a retrieved knowledge row can forge a control block.
 */
export function neutralise(text: string) {
  return text
    .replaceAll(CONTROL_OPEN, "[removed]")
    .replaceAll(CONTROL_CLOSE, "[removed]")
    .replace(/\u0000/g, "");
}

/** Longest suffix of `text` that is also a prefix of `marker`. */
function overlap(text: string, marker: string) {
  const max = Math.min(text.length, marker.length - 1);
  for (let size = max; size > 0; size--)
    if (text.endsWith(marker.slice(0, size))) return size;
  return 0;
}

/**
 * Streaming-safe splitter. Emits visitor-visible text as it arrives while
 * holding back any tail that could still turn out to be the control marker,
 * so a partially streamed sentinel is never shown.
 */
export class ControlFilter {
  #pending = "";
  #control = "";
  #inControl = false;

  push(chunk: string): string {
    let out = "";
    let input = chunk;
    for (;;) {
      if (this.#inControl) {
        // Search the accumulated payload, not just this chunk: the closing
        // marker can arrive split across any number of deltas.
        this.#control += input;
        input = "";
        const close = this.#control.indexOf(CONTROL_CLOSE);
        if (close < 0) {
          this.#control = this.#control.slice(0, MAX_CONTROL_CHARS);
          return out;
        }
        const rest = this.#control.slice(close + CONTROL_CLOSE.length);
        this.#control = this.#control
          .slice(0, close)
          .slice(0, MAX_CONTROL_CHARS);
        this.#inControl = false;
        input = rest;
        continue;
      }
      this.#pending += input;
      input = "";
      const open = this.#pending.indexOf(CONTROL_OPEN);
      if (open >= 0) {
        out += this.#pending.slice(0, open);
        input = this.#pending.slice(open + CONTROL_OPEN.length);
        this.#pending = "";
        this.#inControl = true;
        continue;
      }
      const hold = overlap(this.#pending, CONTROL_OPEN);
      out += this.#pending.slice(0, this.#pending.length - hold);
      this.#pending = this.#pending.slice(this.#pending.length - hold);
      return out;
    }
  }

  /** Remaining safe text plus the raw control payload, if any. */
  finish(): { text: string; raw: string } {
    const text = this.#inControl ? "" : this.#pending;
    this.#pending = "";
    return { text, raw: this.#control.trim() };
  }
}

/**
 * Validates a raw control payload. `allowedSolutions` is the set of solution
 * slugs the server actually loaded for this request, so the model cannot
 * surface a card for something that does not exist or is not active.
 */
export function parseControl(
  raw: string,
  allowedSolutions: ReadonlySet<string>,
): AIControl {
  if (!raw) return emptyControl;
  const json = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return emptyControl;
  }
  const result = controlSchema.safeParse(parsed);
  if (!result.success) return emptyControl;

  const seen = new Set<string>();
  const actions: AIAction[] = [];
  for (const action of result.data.actions ?? []) {
    if (
      action.type === "SHOW_SOLUTION" &&
      !allowedSolutions.has(action.solutionId)
    )
      continue;
    const key =
      action.type === "SHOW_SOLUTION"
        ? `${action.type}:${action.solutionId}`
        : action.type;
    if (seen.has(key)) continue;
    seen.add(key);
    actions.push(action);
  }

  const lead = result.data.lead ?? null;
  return {
    actions,
    lead: lead && Object.values(lead).some(Boolean) ? lead : null,
    meetingIntent: Boolean(result.data.meeting_intent),
  };
}

/**
 * A lead row is only worth writing when the visitor gave something that makes
 * follow-up possible. Interest alone is a conversation, not a lead.
 */
export function isContactable(lead: LeadDraft | null): lead is LeadDraft {
  if (!lead) return false;
  return Boolean(lead.email || lead.phone || (lead.name && lead.company_name));
}
