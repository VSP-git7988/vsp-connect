import { notFound } from "next/navigation";
import { getRegion } from "@/lib/data";
import { profileMetadata } from "@/lib/seo";
import { ProfileView } from "@/components/profile-view";
type Params = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const region = await getRegion("us");
  return region ? profileMetadata(region, slug) : {};
}
export default async function UsProfilePage({ params }: Params) {
  const { slug } = await params;
  const region = await getRegion("us");
  if (!region) notFound();
  return <ProfileView region={region} slug={slug} />;
}
