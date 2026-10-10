import { getCompany, getRegionProfile, requestRegion } from "@/lib/data";
import { regionUrl } from "@/lib/regions";
import { vcard } from "@/lib/contact";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const region = await requestRegion(req);
  const p = region && (await getRegionProfile(slug, region.code));
  if (!p) return new Response("Not found", { status: 404 });
  const company = await getCompany(p.company_id);
  return new Response(vcard(p, company.name, regionUrl(region.code, slug)), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${p.slug}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
