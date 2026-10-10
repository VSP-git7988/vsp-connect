import QRCode from "qrcode";
import { getRegionProfile, requestRegion } from "@/lib/data";
import { regionUrl } from "@/lib/regions";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const region = await requestRegion(req);
  if (!region || !(await getRegionProfile(slug, region.code)))
    return new Response("Not found", { status: 404 });
  const svg = await QRCode.toString(regionUrl(region.code, slug), {
    type: "svg",
    margin: 4,
    errorCorrectionLevel: "M",
    width: 512,
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      ...(new URL(req.url).searchParams.has("download")
        ? { "Content-Disposition": `attachment; filename="${slug}-qr.svg"` }
        : {}),
    },
  });
}
