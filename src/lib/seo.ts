import type { Metadata } from "next";
import { getRegionProfile, getRegionProfiles, getRegions } from "./data";
import { DEFAULT_REGION, regionUrl } from "./regions";
import type { Region } from "./types";
// Canonical, Open Graph URL and hreflang alternates for one page that exists
// in every region in `available`.
function regionMetadata(
  region: Region,
  available: Region[],
  slug?: string,
  og: { title?: string; description?: string } = {},
): Metadata {
  const canonical = regionUrl(region.code, slug);
  const hasDefault = available.some((r) => r.code === DEFAULT_REGION);
  return {
    alternates: {
      canonical,
      languages: {
        ...Object.fromEntries(
          available.map((r) => [r.locale, regionUrl(r.code, slug)]),
        ),
        ...(hasDefault ? { "x-default": regionUrl(DEFAULT_REGION, slug) } : {}),
      },
    },
    openGraph: {
      ...og,
      url: canonical,
      locale: region.locale.replace("-", "_"),
    },
  };
}
export async function landingMetadata(region: Region): Promise<Metadata> {
  return regionMetadata(region, await getRegions());
}
export async function profileMetadata(
  region: Region,
  slug: string,
): Promise<Metadata> {
  const p = await getRegionProfile(slug, region.code);
  if (!p) return { title: "Profile not found" };
  const regions = await getRegions();
  const listed = await Promise.all(
    regions.map(async (r) =>
      (await getRegionProfiles(r.code)).some((x) => x.id === p.id) ? r : null,
    ),
  );
  return {
    title: p.display_name,
    description: p.headline,
    ...regionMetadata(
      region,
      listed.filter((r): r is Region => r !== null),
      slug,
      { title: p.display_name, description: p.headline },
    ),
  };
}
