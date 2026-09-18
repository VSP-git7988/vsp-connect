import { requireAdmin } from "@/lib/admin";
import { Card, Empty, Field, TextArea, Toggle } from "@/components/admin-ui";
import { deleteSolution, saveSolution } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  company_id: string;
  slug: string;
  name: string;
  short_description: string;
  full_description: string;
  target_industries: string[] | null;
  sort_order: number;
  active: boolean;
};

export default async function Solutions() {
  const { db } = await requireAdmin();
  const [solutions, companies] = await Promise.all([
    db
      .from("solutions")
      .select(
        "id,company_id,slug,name,short_description,full_description,target_industries,sort_order,active",
      )
      .order("sort_order"),
    db.from("companies").select("id,name").order("name"),
  ]);
  if (solutions.error || companies.error)
    throw new Error("Solutions could not be loaded.");
  const rows = (solutions.data || []) as Row[];
  const company = ((companies.data || []) as { id: string; name: string }[])[0];

  return (
    <>
      <h2>Solutions</h2>
      <p className="muted">
        Active solutions are readable publicly and are the only cards the
        assistant may surface. Identifiers are used by the assistant, so keep
        them stable. Describe capability and scope, never results or pricing.
      </p>
      {company && (
        <Card title="Add a solution" open={!rows.length}>
          <form action={saveSolution} className="admin-form">
            <input type="hidden" name="company_id" value={company.id} />
            <div className="admin-grid">
              <Field label="Name" name="name" required />
              <Field label="Identifier" name="slug" required hint="lower-case-with-hyphens" />
            </div>
            <Field label="Short description" name="short_description" />
            <TextArea label="Full description" name="full_description" rows={4} />
            <div className="admin-grid">
              <Field label="Target industries" name="target_industries" hint="Comma separated" />
              <Field label="Sort order" name="sort_order" defaultValue="0" type="number" />
            </div>
            <Toggle label="Active" name="active" defaultChecked />
            <div className="admin-buttons">
              <button className="button primary">Add solution</button>
            </div>
          </form>
        </Card>
      )}
      {rows.map((row) => (
        <Card
          key={row.id}
          title={row.name}
          meta={`${row.slug}${row.active ? "" : " · inactive"}`}
        >
          <form action={saveSolution} className="admin-form">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="company_id" value={row.company_id} />
            <div className="admin-grid">
              <Field label="Name" name="name" defaultValue={row.name} required />
              <Field label="Identifier" name="slug" defaultValue={row.slug} required />
            </div>
            <Field label="Short description" name="short_description" defaultValue={row.short_description} />
            <TextArea label="Full description" name="full_description" rows={4} defaultValue={row.full_description} />
            <div className="admin-grid">
              <Field
                label="Target industries"
                name="target_industries"
                defaultValue={(row.target_industries ?? []).join(", ")}
                hint="Comma separated"
              />
              <Field label="Sort order" name="sort_order" type="number" defaultValue={String(row.sort_order)} />
            </div>
            <Toggle label="Active" name="active" defaultChecked={row.active} />
            <div className="admin-buttons">
              <button className="button primary">Save</button>
            </div>
          </form>
          <form action={deleteSolution} className="admin-danger">
            <input type="hidden" name="id" value={row.id} />
            <button className="button secondary">Delete solution</button>
          </form>
        </Card>
      ))}
      {!rows.length && <Empty>No solutions configured yet.</Empty>}
    </>
  );
}
