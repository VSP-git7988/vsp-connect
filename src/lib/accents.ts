import type { Profile } from "./types";
type CSSVars = React.CSSProperties & Record<`--${string}`, string>;
// Per-founder accent, keyed by profile slug. Read by the hero card, founder
// card, avatar and profile page so every surface uses the same colour.
export const FOUNDER_ACCENTS: Record<string, string> = {
  "arjun-devireddy": "#3FD0C2",
  "kavya-kelam": "#B8A6FF",
};
export const DEFAULT_ACCENT = "#B8A6FF";
export function profileAccent(p: Pick<Profile, "slug">) {
  return FOUNDER_ACCENTS[p.slug] ?? DEFAULT_ACCENT;
}
// Inline style exposing the accent to CSS as --accent.
export function accentStyle(p: Pick<Profile, "slug">): CSSVars {
  return { "--accent": profileAccent(p) };
}
// Contact channel icon colours.
export const CHANNEL_COLORS = {
  Call: "#3FD0C2",
  Email: "#F4B740",
  WhatsApp: "#4ADE80",
  LinkedIn: "#60A5FA",
  Website: "#B8A6FF",
} as const;
