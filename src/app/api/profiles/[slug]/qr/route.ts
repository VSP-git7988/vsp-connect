import QRCode from "qrcode";
import { getProfile, profileUrl } from "@/lib/data";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!(await getProfile(slug)))
    return new Response("Not found", { status: 404 });
  const svg = await QRCode.toString(profileUrl(slug), {
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
