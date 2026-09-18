import { z } from "zod";
import { configured, eventDb } from "@/lib/supabase";
import { eventTypes } from "@/lib/types";
const schema = z.object({
  profile_id: z.uuid(),
  event_type: z.enum(eventTypes),
  referrer: z.string().max(2048).nullable().optional(),
  source: z.enum(["nfc", "qr", "direct"]).nullable().optional().catch(null),
});
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  if (Number(req.headers.get("content-length")) > 4096)
    return Response.json({ error: "Payload too large" }, { status: 413 });
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 4096) return new Response(null, { status: 413 });
    body = schema.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Invalid event" }, { status: 400 });
  }
  if (!configured || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    return Response.json(
      { recorded: false, reason: "Analytics not configured" },
      { status: 503 },
    );
  let referrer: null | string = null;
  try {
    if (body.referrer) referrer = new URL(body.referrer).hostname;
  } catch {}
  const db = eventDb();
  const { data: profile } = await db
    .from("profiles")
    .select("id")
    .eq("id", body.profile_id)
    .eq("active", true)
    .maybeSingle();
  if (!profile) return new Response(null, { status: 404 });
  const { data: recorded, error } = await db.rpc("record_analytics_event", {
    p_profile_id: body.profile_id,
    p_event_type: body.event_type,
    p_referrer: referrer,
    p_source: body.source ?? null,
  });
  return error
    ? Response.json({ recorded: false }, { status: 503 })
    : Response.json(
        { recorded: Boolean(recorded) },
        { status: recorded ? 201 : 429 },
      );
}
