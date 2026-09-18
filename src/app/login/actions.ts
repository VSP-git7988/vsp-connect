"use server";
import { redirect } from "next/navigation";
import { authDb, configured } from "@/lib/supabase";
export async function login(form: FormData) {
  if (!configured) redirect("/login?error=setup");
  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  if (email.length > 254 || password.length > 1024)
    redirect("/login?error=credentials");
  const db = await authDb();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect("/admin");
}
export async function logout() {
  if (configured) await (await authDb()).auth.signOut();
  redirect("/login");
}
