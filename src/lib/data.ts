import { cache } from "react";
import { configured, publicDb } from "./supabase";
import { company, seedProfiles } from "./seed";
import type { Company, Profile } from "./types";
export const getProfiles = cache(async (): Promise<Profile[]> => {
  if (!configured) return seedProfiles;
  const { data, error } = await publicDb()
    .from("profiles")
    .select(
      "*, expertise(name,sort_order), social_links(platform,label,url,sort_order)",
    )
    .eq("active", true)
    .order("created_at");
  if (error) throw new Error("Profiles could not be loaded. Please try again.");
  return (data as Profile[]).map((p) => ({
    ...p,
    expertise: p.expertise.sort((a, b) => a.sort_order - b.sort_order),
    social_links: p.social_links.sort((a, b) => a.sort_order - b.sort_order),
  }));
});
export const getProfile = cache(async (slug: string) =>
  (await getProfiles()).find((p) => p.slug === slug),
);
export const getCompany = cache(async (id = company.id): Promise<Company> => {
  if (!configured) return company;
  const { data, error } = await publicDb()
    .from("companies")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error("Company could not be loaded.");
  return data;
});
export function profileUrl(slug: string) {
  return `${(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")}/${slug}`;
}
