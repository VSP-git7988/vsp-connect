// URL helpers shared by server and client code. Each region has literal routes
// under src/app: the default region at the site root (/, /[slug]), every other
// one under its code (/us, /us/[slug]). Adding a region means adding its route
// folder and its code here.
export const DEFAULT_REGION = "in";
export const ROUTED_REGIONS = [DEFAULT_REGION, "us"];
export function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
export function regionPath(region = DEFAULT_REGION, slug?: string) {
  return (
    "/" +
    [region === DEFAULT_REGION ? "" : region, slug ?? ""]
      .filter(Boolean)
      .join("/")
  );
}
export function regionUrl(region = DEFAULT_REGION, slug?: string) {
  const path = regionPath(region, slug);
  return siteUrl() + (path === "/" ? "" : path);
}
// Default-region API URLs are unchanged; other regions add ?region=code.
export function profileApiPath(
  slug: string,
  kind: "vcard" | "qr",
  region = DEFAULT_REGION,
  params: Record<string, string> = {},
) {
  const query = new URLSearchParams({
    ...(region === DEFAULT_REGION ? {} : { region }),
    ...params,
  }).toString();
  return `/api/profiles/${slug}/${kind}${query ? `?${query}` : ""}`;
}
