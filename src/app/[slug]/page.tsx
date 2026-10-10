import { getDefaultRegion } from "@/lib/data";
import { profileMetadata } from "@/lib/seo";
import { ProfileView } from "@/components/profile-view";
type Params = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  return profileMetadata(await getDefaultRegion(), slug);
}
export default async function ProfilePage({ params }: Params) {
  const { slug } = await params;
  return <ProfileView region={await getDefaultRegion()} slug={slug} />;
}
