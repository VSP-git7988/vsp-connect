"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";

/**
 * Administration mutations. Every write goes through the signed-in user's
 * Supabase client, so row level security is the real authority; the checks
 * here shape input rather than grant access.
 */
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);
const required = (max: number) => z.string().trim().min(1).max(max);
const uuid = z.uuid();
const optionalUuid = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine((value) => value === null || uuid.safeParse(value).success)
  .transform((value) => value as string | null);
const checkbox = (value: FormDataEntryValue | null) => value === "on";

function fields(form: FormData) {
  return (key: string) => String(form.get(key) ?? "");
}

async function db() {
  const { db, isAdmin } = await requireAdmin();
  if (!isAdmin) throw new Error("Not authorized.");
  return db;
}

function refresh(path: string) {
  revalidatePath(path);
  revalidatePath("/", "layout");
}

export async function saveKnowledge(form: FormData) {
  const client = await db();
  const get = fields(form);
  const row = {
    company_id: uuid.parse(get("company_id")),
    profile_id: optionalUuid.parse(get("profile_id")),
    title: required(200).parse(get("title")),
    content: required(8000).parse(get("content")),
    category: z
      .enum([
        "company",
        "founder",
        "product",
        "service",
        "case_study",
        "faq",
        "policy",
        "contact",
      ])
      .parse(get("category")),
    active: checkbox(form.get("active")),
  };
  const id = get("id");
  const { error } = id
    ? await client.from("knowledge_sources").update(row).eq("id", uuid.parse(id))
    : await client.from("knowledge_sources").insert(row);
  if (error) throw new Error("Knowledge entry could not be saved.");
  refresh("/admin/knowledge");
}

export async function deleteKnowledge(form: FormData) {
  const client = await db();
  const { error } = await client
    .from("knowledge_sources")
    .delete()
    .eq("id", uuid.parse(String(form.get("id"))));
  if (error) throw new Error("Knowledge entry could not be removed.");
  refresh("/admin/knowledge");
}

export async function saveSolution(form: FormData) {
  const client = await db();
  const get = fields(form);
  const row = {
    company_id: uuid.parse(get("company_id")),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      .max(60)
      .parse(get("slug")),
    name: required(120).parse(get("name")),
    short_description: z.string().trim().max(400).parse(get("short_description")),
    full_description: z.string().trim().max(4000).parse(get("full_description")),
    target_industries: get("target_industries")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 20),
    sort_order: z.coerce.number().int().min(0).max(999).catch(0).parse(get("sort_order")),
    active: checkbox(form.get("active")),
  };
  const id = get("id");
  const { error } = id
    ? await client.from("solutions").update(row).eq("id", uuid.parse(id))
    : await client.from("solutions").insert(row);
  if (error) throw new Error("Solution could not be saved.");
  refresh("/admin/solutions");
}

export async function deleteSolution(form: FormData) {
  const client = await db();
  const { error } = await client
    .from("solutions")
    .delete()
    .eq("id", uuid.parse(String(form.get("id"))));
  if (error) throw new Error("Solution could not be removed.");
  refresh("/admin/solutions");
}

export async function saveQuestion(form: FormData) {
  const client = await db();
  const get = fields(form);
  const row = {
    company_id: uuid.parse(get("company_id")),
    profile_id: optionalUuid.parse(get("profile_id")),
    question: required(160).parse(get("question")),
    sort_order: z.coerce.number().int().min(0).max(999).catch(0).parse(get("sort_order")),
    active: checkbox(form.get("active")),
  };
  const id = get("id");
  const { error } = id
    ? await client.from("suggested_questions").update(row).eq("id", uuid.parse(id))
    : await client.from("suggested_questions").insert(row);
  if (error) throw new Error("Suggested question could not be saved.");
  refresh("/admin/questions");
}

export async function deleteQuestion(form: FormData) {
  const client = await db();
  const { error } = await client
    .from("suggested_questions")
    .delete()
    .eq("id", uuid.parse(String(form.get("id"))));
  if (error) throw new Error("Suggested question could not be removed.");
  refresh("/admin/questions");
}

export async function saveAIConfig(form: FormData) {
  const client = await db();
  const get = fields(form);
  const { error } = await client.from("profile_ai_config").upsert(
    {
      profile_id: uuid.parse(get("profile_id")),
      enabled: checkbox(form.get("enabled")),
      intro: z.string().trim().max(400).parse(get("intro")),
      persona_instructions: z
        .string()
        .trim()
        .max(4000)
        .parse(get("persona_instructions")),
      focus_areas: get("focus_areas")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 12),
    },
    { onConflict: "profile_id" },
  );
  if (error) throw new Error("AI identity could not be saved.");
  refresh("/admin/ai");
}

const https = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine((value) => value === null || /^https:\/\//.test(value), {
    message: "Must be an https URL.",
  });

export async function saveProfile(form: FormData) {
  const client = await db();
  const get = fields(form);
  const booking = https.parse(get("booking_url"));
  if (booking && !booking.startsWith("https://cal.com/"))
    throw new Error("Booking link must be an https://cal.com/ URL.");
  const { error } = await client
    .from("profiles")
    .update({
      headline: z.string().trim().max(300).parse(get("headline")),
      bio: z.string().trim().max(4000).parse(get("bio")),
      phone: text(40).parse(get("phone")),
      email: text(254).parse(get("email")),
      whatsapp: text(40).parse(get("whatsapp")),
      linkedin_url: https.parse(get("linkedin_url")),
      website_url: https.parse(get("website_url")),
      booking_url: booking,
      active: checkbox(form.get("active")),
    })
    .eq("id", uuid.parse(get("id")));
  if (error) throw new Error("Profile could not be saved.");
  refresh("/admin/profiles");
}

export async function updateLeadStatus(form: FormData) {
  const client = await db();
  const { error } = await client
    .from("leads")
    .update({
      status: z
        .enum(["new", "qualified", "meeting_requested", "contacted", "closed"])
        .parse(String(form.get("status"))),
    })
    .eq("id", uuid.parse(String(form.get("id"))));
  if (error) throw new Error("Lead could not be updated.");
  refresh("/admin/leads");
}

export async function deleteLead(form: FormData) {
  const client = await db();
  const { error } = await client
    .from("leads")
    .delete()
    .eq("id", uuid.parse(String(form.get("id"))));
  if (error) throw new Error("Lead could not be removed.");
  refresh("/admin/leads");
}

export async function deleteConversation(form: FormData) {
  const client = await db();
  const { error } = await client
    .from("conversations")
    .delete()
    .eq("id", uuid.parse(String(form.get("id"))));
  if (error) throw new Error("Conversation could not be removed.");
  refresh("/admin/conversations");
}
