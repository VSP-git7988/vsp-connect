// Explicit maintenance command for the user-approved US catalogue. No global or India writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
const content = JSON.parse(
  fs.readFileSync(
    new URL("../supabase/content/us-arjun.json", import.meta.url),
    "utf8",
  ),
);
if (!process.argv.includes("--apply"))
  throw new Error("Use --apply to save the approved US content.");
if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("A server-only maintenance credential is required.");
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const profile = await db
  .from("profiles")
  .select("id")
  .eq("slug", "arjun-devireddy")
  .single();
if (profile.error) throw new Error("Arjun's profile could not be loaded.");
const id = profile.data.id;
const india = await db
  .from("profile_regions")
  .select("*")
  .eq("profile_id", id)
  .eq("region_code", "in");
if (india.error) throw new Error("India baseline could not be checked.");
const services = content.services.map((s) =>
  s.description ? s.name + " | " + s.description : s.name,
);
const saved = await db
  .from("profile_regions")
  .update({ services })
  .eq("profile_id", id)
  .eq("region_code", "us")
  .select("profile_id")
  .single();
if (saved.error) throw new Error("US services could not be saved.");
console.log(
  "Saved six US services in the requested order. Intelligence System description is awaiting the missing note.",
);
const existing = await db
  .from("portfolio_items")
  .select("id,title")
  .eq("profile_id", id)
  .eq("region_code", "us");
if (existing.error && ["PGRST205", "42P01"].includes(existing.error.code)) {
  console.log(
    "Portfolio insertion pending: portfolio_items is absent. Apply 008_us_arjun_content.sql using a database-management connection.",
  );
} else {
  if (existing.error) throw new Error("US portfolio could not be read.");
  for (const [sort_order, item] of content.portfolio.entries()) {
    const row = {
      ...item,
      profile_id: id,
      region_code: "us",
      sort_order,
      active: true,
    };
    const matching = existing.data.filter(
      (entry) => entry.title === item.title,
    );
    const result = matching.length
      ? await db
          .from("portfolio_items")
          .update(row)
          .in(
            "id",
            matching.map((entry) => entry.id),
          )
          .eq("profile_id", id)
          .eq("region_code", "us")
      : await db.from("portfolio_items").insert(row);
    if (result.error)
      throw new Error("US portfolio entry could not be saved: " + item.title);
  }
  console.log("Saved nine US portfolio items in the requested order.");
}
const after = await db
  .from("profile_regions")
  .select("*")
  .eq("profile_id", id)
  .eq("region_code", "in");
if (after.error) throw new Error("India verification could not be completed.");
assert.deepEqual(after.data, india.data);
console.log("Verified: India membership was unchanged.");
