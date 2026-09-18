import { requireAdmin } from "@/lib/admin";
import { Card, Choice, Empty, Field, Toggle } from "@/components/admin-ui";
import { deleteQuestion, saveQuestion } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  company_id: string;
  profile_id: string | null;
  question: string;
  sort_order: number;
  active: boolean;
};

export default async function Questions() {
  const { db } = await requireAdmin();
  const [questions, profiles, companies] = await Promise.all([
    db
      .from("suggested_questions")
      .select("id,company_id,profile_id,question,sort_order,active")
      .order("sort_order"),
    db.from("profiles").select("id,display_name").order("display_name"),
    db.from("companies").select("id,name").order("name"),
  ]);
  if (questions.error || profiles.error || companies.error)
    throw new Error("Suggested questions could not be loaded.");
  const rows = (questions.data || []) as Row[];
  const people = (profiles.data || []) as { id: string; display_name: string }[];
  const company = ((companies.data || []) as { id: string; name: string }[])[0];
  const scopes: [string, string][] = [
    ["", "Every founder profile"],
    ...people.map((p) => [p.id, `${p.display_name} only`] as [string, string]),
  ];
  const scopeName = (id: string | null) =>
    id
      ? (people.find((p) => p.id === id)?.display_name ?? "Founder")
      : "All profiles";

  return (
    <>
      <h2>Suggested questions</h2>
      <p className="muted">
        Shown as prompts before the first message. Keep them short and
        answerable from approved knowledge.
      </p>
      {company && (
        <Card title="Add a suggested question" open={!rows.length}>
          <form action={saveQuestion} className="admin-form">
            <input type="hidden" name="company_id" value={company.id} />
            <Field label="Question" name="question" required />
            <div className="admin-grid">
              <Choice label="Shown on" name="profile_id" options={scopes} />
              <Field label="Sort order" name="sort_order" type="number" defaultValue="0" />
            </div>
            <Toggle label="Active" name="active" defaultChecked />
            <div className="admin-buttons">
              <button className="button primary">Add question</button>
            </div>
          </form>
        </Card>
      )}
      {rows.map((row) => (
        <Card
          key={row.id}
          title={row.question}
          meta={`${scopeName(row.profile_id)}${row.active ? "" : " · inactive"}`}
        >
          <form action={saveQuestion} className="admin-form">
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="company_id" value={row.company_id} />
            <Field label="Question" name="question" defaultValue={row.question} required />
            <div className="admin-grid">
              <Choice label="Shown on" name="profile_id" options={scopes} defaultValue={row.profile_id ?? ""} />
              <Field label="Sort order" name="sort_order" type="number" defaultValue={String(row.sort_order)} />
            </div>
            <Toggle label="Active" name="active" defaultChecked={row.active} />
            <div className="admin-buttons">
              <button className="button primary">Save</button>
            </div>
          </form>
          <form action={deleteQuestion} className="admin-danger">
            <input type="hidden" name="id" value={row.id} />
            <button className="button secondary">Delete question</button>
          </form>
        </Card>
      ))}
      {!rows.length && <Empty>No suggested questions yet.</Empty>}
    </>
  );
}
