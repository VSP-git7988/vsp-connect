import { getProfile, getCompany, profileUrl } from "@/lib/data";
import { vcard } from "@/lib/contact";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const p = await getProfile(slug);
  if (!p) return new Response("Not found", { status: 404 });
  const company = await getCompany(p.company_id);
  return new Response(vcard(p, company.name, profileUrl(slug)), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${p.slug}.vcf"`,
      "Cache-Control": "no-store",
    },
  });
}
