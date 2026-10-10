import { notFound } from "next/navigation";
import { getRegion } from "@/lib/data";
import { landingMetadata } from "@/lib/seo";
import { RegionLanding } from "@/components/region-landing";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const region = await getRegion("us");
  return region ? landingMetadata(region) : {};
}
export default async function UsHome() {
  const region = await getRegion("us");
  if (!region) notFound();
  return <RegionLanding region={region} />;
}
