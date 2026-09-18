import "server-only";
import { serviceConfigured, serviceDb } from "../supabase";
import type { Profile } from "../types";
import { aiConfig } from "./config";
import {
  rankSeedKnowledge,
  seedIntro,
  seedPersona,
  seedSolutions,
  type KnowledgeEntry,
} from "./seed";
import type { AISolution } from "./types";

export type ServerAIConfig = {
  enabled: boolean;
  intro: string;
  persona: string;
  focusAreas: string[];
};

/**
 * Founder AI identity including the internal persona fragment. Service-role
 * only: persona_instructions must never be selectable by a browser client.
 */
export async function getServerAIConfig(
  profile: Profile,
): Promise<ServerAIConfig> {
  if (!serviceConfigured())
    return {
      enabled: true,
      intro: seedIntro(profile.first_name),
      persona: seedPersona(profile.display_name, profile.title),
      focusAreas: profile.expertise.map((e) => e.name),
    };
  const { data } = await serviceDb()
    .from("profile_ai_config")
    .select("enabled,intro,persona_instructions,focus_areas")
    .eq("profile_id", profile.id)
    .maybeSingle();
  return {
    enabled: Boolean(data?.enabled),
    intro: data?.intro || "",
    persona: data?.persona_instructions || "",
    focusAreas: (data?.focus_areas as string[] | null) ?? [],
  };
}

export async function getServerSolutions(
  companyId: string,
): Promise<AISolution[]> {
  if (!serviceConfigured()) return seedSolutions;
  const { data } = await serviceDb()
    .from("solutions")
    .select("slug,name,short_description")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("sort_order")
    .limit(12);
  return (data ?? []) as AISolution[];
}

/**
 * Retrieval for one turn. Scoped by the database function to this founder's
 * company knowledge plus their own rows, so one founder's configured content
 * can never appear on the other's profile. Only the top matches are sent, not
 * the whole knowledge base, and the result is capped to a character budget.
 */
export async function retrieveKnowledge(
  profile: Profile,
  query: string,
): Promise<KnowledgeEntry[]> {
  const rows = serviceConfigured()
    ? await searchDatabase(profile.id, query)
    : rankSeedKnowledge(profile.slug, query, aiConfig.knowledgeLimit);
  const selected: KnowledgeEntry[] = [];
  let budget = aiConfig.maxKnowledgeChars;
  for (const row of rows) {
    const size = row.title.length + row.content.length + 24;
    if (size > budget) continue;
    budget -= size;
    selected.push(row);
  }
  return selected;
}

async function searchDatabase(profileId: string, query: string) {
  const { data, error } = await serviceDb().rpc("search_knowledge", {
    p_profile_id: profileId,
    p_query: query,
    p_limit: aiConfig.knowledgeLimit,
  });
  if (error || !data) return [];
  return (
    data as {
      title: string;
      content: string;
      category: string;
      scope: "company" | "founder";
    }[]
  ).map((row) => ({ ...row, scope: row.scope }));
}
