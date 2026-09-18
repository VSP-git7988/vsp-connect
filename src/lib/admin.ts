import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { authDb, configured } from "./supabase";

/**
 * Single authorization gate for every /admin route. Membership is read through
 * the user's own Supabase session so RLS decides what the request may do; the
 * service key is never involved in administration.
 */
export const requireAdmin = cache(async () => {
  if (!configured) redirect("/login");
  const db = await authDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return { db, user, isAdmin: Boolean(admin) };
});

export const adminSections = [
  ["/admin", "Overview"],
  ["/admin/profiles", "Profiles"],
  ["/admin/ai", "AI identity"],
  ["/admin/knowledge", "Knowledge"],
  ["/admin/solutions", "Solutions"],
  ["/admin/questions", "Questions"],
  ["/admin/leads", "Leads"],
  ["/admin/conversations", "Conversations"],
  ["/admin/usage", "AI usage"],
] as const;
