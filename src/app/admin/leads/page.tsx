import { requireAdmin } from "@/lib/admin";
import { Card, Choice, Empty } from "@/components/admin-ui";
import { deleteLead, updateLeadStatus } from "../actions";

export const dynamic = "force-dynamic";

const statuses: [string, string][] = [
  ["new", "New"],
  ["qualified", "Qualified"],
  ["meeting_requested", "Meeting requested"],
  ["contacted", "Contacted"],
  ["closed", "Closed"],
];

type Row = {
  id: string;
  profile_id: string;
  name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  business_type: string | null;
  interest: string | null;
  problem_summary: string | null;
  source: string;
  status: string;
  created_at: string;
};

export default async function Leads() {
  const { db } = await requireAdmin();
  const [leads, profiles] = await Promise.all([
    db
      .from("leads")
      .select(
        "id,profile_id,name,company_name,email,phone,business_type,interest,problem_summary,source,status,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("profiles").select("id,display_name"),
  ]);
  if (leads.error || profiles.error) throw new Error("Leads could not be loaded.");
  const rows = (leads.data || []) as Row[];
  const names = new Map(
    ((profiles.data || []) as { id: string; display_name: string }[]).map(
      (p) => [p.id, p.display_name],
    ),
  );

  return (
    <>
      <h2>Leads</h2>
      <p className="muted">
        Captured only when a visitor volunteered enough to make follow-up
        possible. Fields hold what the visitor actually wrote; nothing is
        inferred. Delete a lead to remove the stored details entirely.
      </p>
      {rows.map((row) => (
        <Card
          key={row.id}
          title={row.name || row.company_name || row.email || "Unnamed lead"}
          meta={`${names.get(row.profile_id) ?? "Unknown"} · ${row.status} · ${new Date(row.created_at).toLocaleDateString()}`}
        >
          <dl className="admin-details">
            {(
              [
                ["Name", row.name],
                ["Company", row.company_name],
                ["Email", row.email],
                ["Phone", row.phone],
                ["Business type", row.business_type],
                ["Interest", row.interest],
                ["Problem", row.problem_summary],
                ["Source", row.source],
              ] as [string, string | null][]
            )
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          <form action={updateLeadStatus} className="admin-form">
            <input type="hidden" name="id" value={row.id} />
            <Choice label="Status" name="status" options={statuses} defaultValue={row.status} />
            <div className="admin-buttons">
              <button className="button primary">Update status</button>
            </div>
          </form>
          <form action={deleteLead} className="admin-danger">
            <input type="hidden" name="id" value={row.id} />
            <button className="button secondary">Delete lead</button>
          </form>
        </Card>
      ))}
      {!rows.length && <Empty>No leads captured yet.</Empty>}
    </>
  );
}
