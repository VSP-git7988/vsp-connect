import "server-only";
import { cache } from "react";
import { configured, publicDb } from "../supabase";
import type { Profile } from "../types";
import {
  seedCompanyQuestions,
  seedIntro,
  seedSolutions,
} from "./seed";
import type { AIProfileContext, AISolution } from "./types";

/**
 * Public, non-secret AI context for a founder profile. Read with the anon key
 * under RLS; the founder's internal persona instructions are never selected
 * here and have no public policy.
 */
export const getAIContext = cache(
  async (profile: Profile): Promise<AIProfileContext> => {
    const firstName = profile.first_name;
    if (!configured)
      return {
        slug: profile.slug,
        displayName: profile.display_name,
        intro: seedIntro(firstName),
        suggestions: [
          ...seedCompanyQuestions,
          `Tell me about ${firstName}.`,
        ],
        solutions: seedSolutions,
        enabled: true,
      };

    const db = publicDb();
    const [config, questions, solutions] = await Promise.all([
      db.rpc("ai_public_config", { p_profile_id: profile.id }).maybeSingle(),
      db
        .from("suggested_questions")
        .select("question,sort_order,profile_id")
        .eq("company_id", profile.company_id)
        .eq("active", true)
        .or(`profile_id.is.null,profile_id.eq.${profile.id}`)
        .order("sort_order")
        .limit(12),
      db
        .from("solutions")
        .select("slug,name,short_description")
        .eq("company_id", profile.company_id)
        .eq("active", true)
        .order("sort_order")
        .limit(12),
    ]);

    const row = config.data as { enabled: boolean; intro: string } | null;
    return {
      slug: profile.slug,
      displayName: profile.display_name,
      intro: row?.intro || seedIntro(firstName),
      suggestions: (questions.data ?? []).map(
        (q: { question: string }) => q.question,
      ),
      solutions: (solutions.data ?? []) as AISolution[],
      // An unreachable or unseeded config row means the assistant stays off
      // rather than answering without founder-approved configuration.
      enabled: Boolean(row?.enabled),
    };
  },
);
