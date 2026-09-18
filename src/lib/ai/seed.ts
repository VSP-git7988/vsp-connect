import { company, seedProfiles } from "../seed";
import type { AISolution } from "./types";

/**
 * Local starter AI configuration, mirroring supabase/seed_ai.sql. Used only
 * when Supabase is not configured, so the experience can be developed and
 * tested without a project. Capability descriptions only: no customers,
 * prices, results or invented founder detail.
 */
export type KnowledgeEntry = {
  title: string;
  content: string;
  category: string;
  scope: "company" | "founder";
  profileSlug?: string;
};

export const seedSolutions: AISolution[] = [
  {
    slug: "ai-voice-agents",
    name: "AI Voice Agents",
    short_description:
      "Voice assistants that answer calls, capture details and route what matters to a human.",
  },
  {
    slug: "ai-business-assistants",
    name: "AI Business Assistants",
    short_description:
      "Assistants grounded in your approved business knowledge rather than open-ended chat.",
  },
  {
    slug: "workflow-automation",
    name: "Workflow Automation",
    short_description:
      "Removing repetitive steps between the tools a team already uses.",
  },
  {
    slug: "ai-sales-follow-up",
    name: "AI Sales Follow-Up",
    short_description:
      "Consistent, reviewable follow-up on enquiries that would otherwise go cold.",
  },
  {
    slug: "ai-lead-qualification",
    name: "AI Lead Qualification",
    short_description:
      "Understanding what an enquiry actually needs before it reaches a person.",
  },
  {
    slug: "custom-ai-products",
    name: "Custom AI Product Development",
    short_description:
      "End-to-end design and build of an AI product owned by your business.",
  },
];

const companyKnowledge: KnowledgeEntry[] = [
  {
    title: "What VSP Innovations is",
    content: `VSP Innovations is an AI Solutions and Product Development company. ${company.description} The two co-founders are Arjun Devireddy and Kavya Kelam.`,
    category: "company",
    scope: "company",
  },
  {
    title: "How VSP Innovations works with clients",
    content:
      "Engagements start with a conversation about the problem before any solution is proposed. Scope, timelines and commercials are agreed per project. The fastest way to start is a short call with one of the co-founders.",
    category: "company",
    scope: "company",
  },
  {
    title: "What VSP Innovations builds",
    content: `Capability areas are ${seedSolutions
      .map((s) => s.name)
      .join(", ")}. Each is scoped to the client's own systems and data.`,
    category: "service",
    scope: "company",
  },
  {
    title: "How AI typically helps a business",
    content:
      "Common starting points are handling inbound enquiries and calls, qualifying leads, removing repetitive internal steps, keeping follow-up consistent, and making internal knowledge reliably answerable. The right starting point depends on where time is currently lost, which is what an initial conversation establishes.",
    category: "service",
    scope: "company",
  },
  {
    title: "Pricing",
    content:
      "VSP Innovations does not publish standard prices or packages. Cost depends on scope, integrations and support requirements, and is quoted after an initial conversation. No pricing figures, ranges or estimates are available through this assistant.",
    category: "policy",
    scope: "company",
  },
  {
    title: "Case studies and references",
    content:
      "No client names, case studies, project results or references are published through this assistant. Requests for references are handled directly by the co-founders.",
    category: "policy",
    scope: "company",
  },
  {
    title: "Company size, revenue and partnerships",
    content:
      "Employee counts, revenue figures, funding, certifications and partnership details are not published through this assistant.",
    category: "policy",
    scope: "company",
  },
  {
    title: "How to reach VSP Innovations",
    content:
      "The way to reach VSP Innovations is through a founder profile: save the contact card, use the contact actions shown on the profile, or book a meeting with the founder whose profile you are viewing. Contact details shown on a profile are the authoritative ones; this assistant does not hold any others.",
    category: "contact",
    scope: "company",
  },
  {
    title: "Data handling in this conversation",
    content:
      "Messages in this assistant may be stored so VSP Innovations can follow up on a request and understand what visitors ask. Contact details are stored only when a visitor provides them. No other personal data is collected.",
    category: "policy",
    scope: "company",
  },
];

const founderKnowledge: KnowledgeEntry[] = seedProfiles.flatMap((p) => [
  {
    title: `About ${p.display_name}`,
    content: `${p.display_name} is ${p.title} of ${company.name}. Headline: ${p.headline} ${p.bio} Focus areas: ${p.expertise
      .map((e) => e.name)
      .join(
        ", ",
      )}. No further biography, education, work history, location or personal detail has been published for this profile.`,
    category: "founder",
    scope: "founder" as const,
    profileSlug: p.slug,
  },
  {
    title: `Contacting ${p.display_name}`,
    content: `Visitors can reach ${p.display_name} through the contact actions on this profile: saving the contact card, and any of call, email, WhatsApp, LinkedIn or website that the profile shows as available. Actions shown as not added have not been published yet. ${
      p.booking_url
        ? "A meeting can be booked using the booking link on this profile."
        : "A booking link has not been published for this profile yet."
    }`,
    category: "contact",
    scope: "founder" as const,
    profileSlug: p.slug,
  },
]);

export const seedKnowledge: KnowledgeEntry[] = [
  ...companyKnowledge,
  ...founderKnowledge,
];

export const seedCompanyQuestions = [
  "What does VSP Innovations build?",
  "How can AI help my business?",
  "What AI solutions do you offer?",
  "Can you build an AI voice agent?",
  "Do you build custom AI products?",
  "Can I schedule a meeting?",
];

export function seedIntro(firstName: string) {
  return `Hi, I'm ${firstName}'s AI representative. Ask me about VSP Innovations, what we build, or how AI could fit your business.`;
}

export function seedPersona(displayName: string, title: string) {
  const firstName = displayName.split(" ")[0];
  return `You represent ${displayName}, ${title} of ${company.name}. Speak about ${firstName} in the third person. You are not ${firstName} and must not speak as them or commit them to anything beyond booking a meeting.`;
}

/**
 * Local mirror of the SQL ranking in search_knowledge(). Company entries plus
 * this founder's own entries only, so one founder's configured knowledge can
 * never be retrieved on the other's profile. Core identity categories stay
 * eligible even when nothing matches the query text.
 */
const CORE_CATEGORIES = ["company", "founder", "contact"];

export function rankSeedKnowledge(
  profileSlug: string,
  query: string,
  limit: number,
): KnowledgeEntry[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2);
  return seedKnowledge
    .filter(
      (entry) => entry.scope === "company" || entry.profileSlug === profileSlug,
    )
    .map((entry) => {
      const haystack = `${entry.title} ${entry.content}`.toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term)).length;
      return {
        entry,
        score:
          hits +
          (entry.profileSlug ? 0.35 : 0) +
          (CORE_CATEGORIES.includes(entry.category) ? 0.12 : 0),
        eligible: hits > 0 || CORE_CATEGORIES.includes(entry.category),
      };
    })
    .filter((row) => row.eligible)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
    .map((row) => row.entry);
}
