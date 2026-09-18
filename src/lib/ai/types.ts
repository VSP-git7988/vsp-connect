// Shared V2 AI types. Safe to import from client components: no secrets, no
// server-only imports.

export const aiActionTypes = [
  "BOOK_MEETING",
  "SAVE_CONTACT",
  "OPEN_WHATSAPP",
  "OPEN_EMAIL",
  "OPEN_WEBSITE",
  "SHOW_SOLUTION",
] as const;
export type AIActionType = (typeof aiActionTypes)[number];

/**
 * The only UI the model is allowed to trigger. The model never emits markup,
 * URLs or script; it names an action and the client renders a predefined
 * control using data the server already trusts.
 */
export type AIAction =
  | { type: "BOOK_MEETING" }
  | { type: "SAVE_CONTACT" }
  | { type: "OPEN_WHATSAPP" }
  | { type: "OPEN_EMAIL" }
  | { type: "OPEN_WEBSITE" }
  | { type: "SHOW_SOLUTION"; solutionId: string };

export type AISolution = {
  slug: string;
  name: string;
  short_description: string;
};

export type AIProfileContext = {
  slug: string;
  displayName: string;
  intro: string;
  suggestions: string[];
  solutions: AISolution[];
  enabled: boolean;
};

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string };

/** Machine-readable reasons the chat endpoint can decline, for UI copy. */
export const chatErrorCodes = [
  "unavailable",
  "disabled",
  "rate_limited",
  "too_long",
  "invalid",
  "provider_error",
] as const;
export type ChatErrorCode = (typeof chatErrorCodes)[number];
