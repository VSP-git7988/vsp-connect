import type { EventType } from "./types";

/**
 * Best-effort anonymous event. Fire-and-forget: a blocked or failed request
 * never affects the interaction the visitor was making. `solution` is only
 * included when present so the payload stays minimal.
 */
export function track(
  profileId: string,
  event: EventType,
  solution?: string,
) {
  void fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profile_id: profileId,
      event_type: event,
      referrer: document.referrer ? new URL(document.referrer).origin : null,
      source: new URLSearchParams(location.search).get("source"),
      ...(solution ? { solution } : {}),
    }),
    keepalive: true,
  }).catch(() => {});
}

/** Allowlisted `?source=` value for this page view, if any. */
export function pageSource() {
  const value = new URLSearchParams(location.search).get("source");
  return value === "nfc" || value === "qr" || value === "direct" ? value : null;
}
