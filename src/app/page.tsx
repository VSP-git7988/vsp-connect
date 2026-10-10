import { getDefaultRegion } from "@/lib/data";
import { landingMetadata } from "@/lib/seo";
import { RegionLanding } from "@/components/region-landing";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return landingMetadata(await getDefaultRegion());
}
export default async function Home() {
  return <RegionLanding region={await getDefaultRegion()} />;
}
