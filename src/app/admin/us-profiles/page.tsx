import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { Card, Empty, Field, TextArea } from "@/components/admin-ui";
import { saveUSProfile } from "../actions";
export const dynamic = "force-dynamic";
export default async function USProfiles() {
  const { db } = await requireAdmin();
  const [members, profiles] = await Promise.all([
    db
      .from("profile_regions")
      .select("profile_id,services,booking_url")
      .eq("region_code", "us")
      .order("sort_order"),
    db.from("profiles").select("id,display_name,booking_url"),
  ]);
  if (members.error || profiles.error)
    throw new Error(
      "US settings could not be loaded. Apply migrations 006_us_content.sql and 007_region_booking.sql first.",
    );
  return (
    <>
      <h2>US services & booking</h2>
      <p className="muted">
        Services appear on the US profile only. Paste a Cal.com link to enable
        its Book a meeting button.
      </p>
      <p>
        <Link className="text-link" href="/admin/portfolio">
          Edit US portfolio projects
        </Link>
      </p>
      {members.data.map((member) => {
        const profile = profiles.data.find(
          (profile) => profile.id === member.profile_id,
        );
        if (!profile) return null;
        return (
          <Card key={member.profile_id} title={profile.display_name} open>
            <form action={saveUSProfile} className="admin-form">
              <input
                type="hidden"
                name="profile_id"
                value={member.profile_id}
              />
              <TextArea
                label="US profile services"
                name="services"
                defaultValue={(member.services ?? []).join("\n")}
                rows={8}
                hint="One service per line: Name | One-line description. Descriptions are optional for standard services. Remove all lines to hide the section."
              />
              <Field
                label="US booking URL override"
                name="booking_url"
                type="url"
                defaultValue={member.booking_url}
                hint={
                  profile.booking_url
                    ? "Leave empty to inherit " + profile.booking_url
                    : "https://cal.com/name/meeting. Leave empty for no booking link."
                }
              />
              <button className="button primary">
                Save US services & booking
              </button>
            </form>
          </Card>
        );
      })}
      {!members.data.length && <Empty>No US profiles found.</Empty>}
    </>
  );
}
