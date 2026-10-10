import { cache } from "react";
import { configured, publicDb } from "./supabase";
import { company, seedProfiles } from "./seed";
import { DEFAULT_REGION, ROUTED_REGIONS } from "./regions";
import type { Company, Profile, Region } from "./types";
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
// Used without a database, or before 004_regions.sql is applied: every profile
// appears in every region with its own details, as before regions existed.
const fallbackRegions: Region[] = [
  {
    code: "in",
    name: "India",
    locale: "en-IN",
    default_region: true,
    active: true,
  },
  {
    code: "us",
    name: "United States",
    locale: "en-US",
    default_region: false,
    active: true,
  },
];
// PostgREST reports PGRST205 for a table missing from its schema cache;
// 42P01 is Postgres' own undefined_table.
function missingTable(error: { code?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01";
}
// Active regions that have routes, in route order.
export const getRegions = cache(async (): Promise<Region[]> => {
  if (!configured) return fallbackRegions;
  const { data, error } = await publicDb()
    .from("regions")
    .select("code,name,locale,default_region,active")
    .eq("active", true);
  if (missingTable(error)) return fallbackRegions;
  if (error) throw new Error("Regions could not be loaded. Please try again.");
  return ROUTED_REGIONS.flatMap((code) =>
    (data as Region[]).filter((r) => r.code === code),
  );
});
export const getRegion = cache(async (code: string) =>
  (await getRegions()).find((r) => r.code === code),
);
// The root routes always serve the default region, even if its row is missing.
export const getDefaultRegion = cache(
  async () =>
    (await getRegion(DEFAULT_REGION)) ??
    fallbackRegions.find((r) => r.code === DEFAULT_REGION)!,
);
type Membership = {
  profile_id: string;
  is_primary: boolean;
  sort_order: number;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  role_title: string | null;
};
// Visible memberships of a region (row-level security hides the rest), or null
// when the profile_regions table does not exist.
const getMemberships = cache(
  async (code: string): Promise<Membership[] | null> => {
    if (!configured) return null;
    const { data, error } = await publicDb()
      .from("profile_regions")
      .select(
        "profile_id,is_primary,sort_order,phone,whatsapp,email,role_title",
      )
      .eq("region_code", code);
    if (missingTable(error)) return null;
    if (error)
      throw new Error("Profiles could not be loaded. Please try again.");
    return data;
  },
);
// A region's profiles, primary first, with its contact and title overrides.
export const getRegionProfiles = cache(
  async (code: string): Promise<Profile[]> => {
    const [profiles, members] = await Promise.all([
      getProfiles(),
      getMemberships(code),
    ]);
    if (!members) return profiles.map((p) => ({ ...p, region_code: code }));
    const index = new Map(profiles.map((p, i) => [p.id, i]));
    return members
      .filter((m) => index.has(m.profile_id))
      .sort(
        (a, b) =>
          Number(b.is_primary) - Number(a.is_primary) ||
          a.sort_order - b.sort_order ||
          index.get(a.profile_id)! - index.get(b.profile_id)!,
      )
      .map((m) => {
        const p = profiles[index.get(m.profile_id)!];
        return {
          ...p,
          title: m.role_title ?? p.title,
          phone: m.phone ?? p.phone,
          whatsapp: m.whatsapp ?? p.whatsapp,
          email: m.email ?? p.email,
          region_code: code,
        };
      });
  },
);
export const getRegionProfile = cache(async (slug: string, code: string) =>
  (await getRegionProfiles(code)).find((p) => p.slug === slug),
);
// The region named by an API request's ?region= (default region if absent),
// or undefined for an unknown one.
export async function requestRegion(req: Request) {
  const code = new URL(req.url).searchParams.get("region");
  return code ? getRegion(code) : getDefaultRegion();
}
