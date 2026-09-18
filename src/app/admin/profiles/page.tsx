import { requireAdmin } from "@/lib/admin";
import { Card, Empty, Field, TextArea, Toggle } from "@/components/admin-ui";
import { saveProfile } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  display_name: string;
  title: string;
  headline: string;
  bio: string;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  booking_url: string | null;
  active: boolean;
};

export default async function Profiles() {
  const { db } = await requireAdmin();
  const { data, error } = await db
    .from("profiles")
    .select(
      "id,slug,display_name,title,headline,bio,phone,email,whatsapp,linkedin_url,website_url,booking_url,active",
    )
    .order("display_name");
  if (error) throw new Error("Profiles could not be loaded.");
  const rows = (data || []) as Row[];

  return (
    <>
      <h2>Founder profiles</h2>
      <p className="muted">
        Public profile content and contact destinations. Leave a field empty to
        keep it unpublished; empty actions show as “Not added” and are omitted
        from the contact card. Slugs are fixed after creation.
      </p>
      {rows.map((row) => (
        <Card
          key={row.id}
          title={row.display_name}
          meta={`/${row.slug} · ${row.active ? "public" : "hidden"}`}
        >
          <form action={saveProfile} className="admin-form">
            <input type="hidden" name="id" value={row.id} />
            <Field label="Headline" name="headline" defaultValue={row.headline} />
            <TextArea label="Biography" name="bio" defaultValue={row.bio} rows={4} />
            <div className="admin-grid">
              <Field label="Phone" name="phone" defaultValue={row.phone} hint="International format" />
              <Field label="Email" name="email" type="email" defaultValue={row.email} />
              <Field label="WhatsApp" name="whatsapp" defaultValue={row.whatsapp} hint="International digits" />
              <Field label="LinkedIn URL" name="linkedin_url" defaultValue={row.linkedin_url} hint="https://" />
              <Field label="Website URL" name="website_url" defaultValue={row.website_url} hint="https://" />
              <Field label="Booking URL" name="booking_url" defaultValue={row.booking_url} hint="https://cal.com/…" />
            </div>
            <Toggle label="Publicly visible" name="active" defaultChecked={row.active} />
            <div className="admin-buttons">
              <button className="button primary">Save profile</button>
            </div>
          </form>
        </Card>
      ))}
      {!rows.length && <Empty>No profiles found.</Empty>}
    </>
  );
}
