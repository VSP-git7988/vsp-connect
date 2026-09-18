import { requireAdmin } from "@/lib/admin";
import { Card, Choice, Empty, Field, TextArea, Toggle } from "@/components/admin-ui";
import { deleteKnowledge, saveKnowledge } from "../actions";

export const dynamic = "force-dynamic";

const categories: [string, string][] = [
  ["company", "Company"],
  ["founder", "Founder"],
  ["product", "Product"],
  ["service", "Service"],
  ["case_study", "Case study"],
  ["faq", "FAQ"],
  ["policy", "Policy"],
  ["contact", "Contact"],
];

type Row = {
  id: string;
  company_id: string;
  profile_id: string | null;
  title: string;
  content: string;
  category: string;
  active: boolean;
};

export default async function Knowledge() {
  const { db } = await requireAdmin();
  const [entries, profiles, companies] = await Promise.all([
    db
      .from("knowledge_sources")
      .select("id,company_id,profile_id,title,content,category,active")
      .order("category")
      .order("title"),
    db.from("profiles").select("id,display_name").order("display_name"),
    db.from("companies").select("id,name").order("name"),
  ]);
  if (entries.error || profiles.error || companies.error)
    throw new Error("Knowledge could not be loaded.");
  const rows = (entries.data || []) as Row[];
  const people = (profiles.data || []) as { id: string; display_name: string }[];
  const company = ((companies.data || []) as { id: string; name: string }[])[0];
  const scopes: [string, string][] = [
    ["", "Company-wide (both founders)"],
    ...people.map((p) => [p.id, `${p.display_name} only`] as [string, string]),
  ];
  const scopeName = (id: string | null) =>
    id ? (people.find((p) => p.id === id)?.display_name ?? "Founder") : "Company";

  return (
    <>
      <h2>Approved knowledge</h2>
      <p className="muted">
        The assistant answers business questions only from active entries here.
        Anything absent is answered as unavailable, so add a short entry rather
        than relying on the model to know it. Company-wide entries apply to both
        founders; founder entries are only retrieved on that founder&rsquo;s
        profile. Never enter prices, customers or claims that are not approved.
      </p>
      {company && (
        <Card title="Add a knowledge entry" open={!rows.length}>
          <form action={saveKnowledge} className="admin-form">
            <input type="hidden" name="company_id" value={company.id} />
            <Field label="Title" name="title" required />
            <div className="admin-grid">
              <Choice label="Category" name="category" options={categories} defaultValue="company" />
              <Choice label="Applies to" name="profile_id" options={scopes} />
            </div>
            <TextArea label="Content" name="content" rows={5} required />
            <Toggle label="Active" name="active" defaultChecked />
            <div className="admin-buttons">
              <button className="button primary">Add entry</button>
            </div>
          </form>
        </Card>
      )}
      {rows.map((row) => (
        <Card
          key={row.id}
          title={row.title}
          meta={`${row.category} · ${scopeName(row.profile_id)}${row.active ? "" : " · inactive"}`}
        >
          <form action={saveKnowledge} className="admin-form">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="company_id" value={row.company_id} />
            <Field label="Title" name="title" defaultValue={row.title} required />
            <div className="admin-grid">
              <Choice label="Category" name="category" options={categories} defaultValue={row.category} />
              <Choice label="Applies to" name="profile_id" options={scopes} defaultValue={row.profile_id ?? ""} />
            </div>
            <TextArea label="Content" name="content" rows={5} defaultValue={row.content} required />
            <Toggle label="Active" name="active" defaultChecked={row.active} />
            <div className="admin-buttons">
              <button className="button primary">Save</button>
            </div>
          </form>
          <form action={deleteKnowledge} className="admin-danger">
            <input type="hidden" name="id" value={row.id} />
            <button className="button secondary">Delete entry</button>
          </form>
        </Card>
      ))}
      {!rows.length && <Empty>No knowledge entries yet.</Empty>}
    </>
  );
}
