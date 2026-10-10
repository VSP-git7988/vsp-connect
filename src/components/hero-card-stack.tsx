import Link from "next/link";
import { ScanLine } from "lucide-react";
import type { Profile } from "@/lib/types";
import { Mark } from "@/components/brand";
import { ProfileQr } from "@/components/profile-qr";
import { DEFAULT_ACCENT, profileAccent } from "@/lib/accents";
import { HeroDeck } from "@/components/hero-deck";
import { regionPath } from "@/lib/regions";
type CSSVars = React.CSSProperties & Record<`--${string}`, string>;
// x%, y%, size px, twinkle duration s, delay s
const SPARKLES = [
  [7, 16, 12, 3.2, 0],
  [86, 6, 15, 4.6, 0.8],
  [96, 52, 10, 3.8, 1.6],
  [3, 66, 13, 5.4, 0.4],
  [50, 2, 9, 4.2, 2.2],
  [74, 94, 12, 6, 1.2],
  [26, 92, 9, 3.6, 2.8],
] as const;
// Kavya's card sits behind Arjun's; the company card behind both.
// --ry/--rz: resting tilt. --sway-y/--sway-z: rotation amplitude of the loop.
const SLOTS: Record<"back" | "front" | "company", CSSVars> = {
  back: {
    "--ry": "16deg",
    "--rz": "-6deg",
    "--sway-y": "8deg",
    "--sway-z": "3deg",
    "--drift": "17s",
    "--delay": "-4s",
  },
  front: {
    "--ry": "-13deg",
    "--rz": "5deg",
    "--sway-y": "-7deg",
    "--sway-z": "-2.5deg",
    "--drift": "14s",
    "--delay": "-9s",
  },
  company: {
    "--ry": "18deg",
    "--rz": "8deg",
    "--sway-y": "10deg",
    "--sway-z": "4deg",
    "--drift": "20s",
    "--delay": "0s",
    "--accent": DEFAULT_ACCENT,
  },
};
function FounderCard({
  profile: p,
  companyName,
  slot,
  deck,
}: {
  profile: Profile;
  companyName: string;
  slot: "back" | "front";
  deck: number;
}) {
  return (
    <div
      className={`hero-slot hero-slot-${slot}`}
      data-deck={deck}
      style={{ ...SLOTS[slot], "--accent": profileAccent(p) } as CSSVars}
    >
      <Link href={regionPath(p.region_code, p.slug)} className="hero-card">
        <span className="hero-card-top">
          <span aria-hidden="true" className="hero-monogram">
            {p.first_name[0]}
            {p.last_name[0]}
          </span>
          <ProfileQr profile={p} size={96} className="hero-card-qr" />
        </span>
        <span className="hero-card-name">{p.display_name}</span>
        <span className="hero-card-role">
          {p.title}, {companyName}
        </span>
        <span className="hero-card-cta">
          <ScanLine size={15} aria-hidden="true" /> Scan or tap to open
        </span>
      </Link>
    </div>
  );
}
export function HeroCardStack({
  profiles,
  companyName,
}: {
  profiles: Profile[];
  companyName: string;
}) {
  const back =
    profiles.find((p) => p.slug === "kavya-kelam") ?? profiles[1] ?? null;
  const front = profiles.find((p) => p !== back) ?? null;
  // Mobile deck order: the front card (Arjun) starts in front.
  const founders = [front, back].filter((p): p is Profile => p !== null);
  return (
    <HeroDeck
      founders={founders.map((p) => ({
        slug: p.slug,
        name: p.display_name,
        accent: profileAccent(p),
      }))}
    >
      <div className="hero-glow hero-glow-teal" aria-hidden="true" />
      <div className="hero-glow hero-glow-violet" aria-hidden="true" />
      {(["a", "b"] as const).map((k) => (
        <svg
          key={k}
          className={`hero-orbit hero-orbit-${k}`}
          viewBox="0 0 520 300"
          aria-hidden="true"
        >
          <ellipse cx="260" cy="150" rx="258" ry="120" />
        </svg>
      ))}
      {SPARKLES.map(([x, y, size, dur, delay]) => (
        <svg
          key={`${x}-${y}`}
          className="hero-sparkle"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              "--twinkle": `${dur}s`,
              "--delay": `${delay}s`,
            } as CSSVars
          }
        >
          <path d="M12 0C13 8 16 11 24 12C16 13 13 16 12 24C11 16 8 13 0 12C8 11 11 8 12 0Z" />
        </svg>
      ))}
      {/* A lone founder's card stands alone; the company card only backs a pair. */}
      {founders.length > 1 && (
        <div
          className="hero-slot hero-slot-company"
          style={SLOTS.company}
          aria-hidden="true"
        >
          <div className="hero-card hero-card-company">
            <span className="hero-card-top">
              <Mark />
              <span className="contactless">)))</span>
            </span>
            <span className="hero-card-name">{companyName}</span>
            <span className="hero-card-role">Ideas into intelligence.</span>
          </div>
        </div>
      )}
      {founders.map((p, i) => (
        <FounderCard
          key={p.id}
          profile={p}
          companyName={companyName}
          slot={p === front ? "front" : "back"}
          deck={i}
        />
      ))}
    </HeroDeck>
  );
}
