import { requireAdmin } from "@/lib/admin";
import { Card, Empty, Field, Choice, Toggle } from "@/components/admin-ui";
import type { PortfolioItem } from "@/lib/data";
import { savePortfolio, deletePortfolio } from "../actions";
export const dynamic = "force-dynamic";
export default async function Portfolio() {
  const { db } = await requireAdmin();
  const [items, members, profiles] = await Promise.all([
    db
      .from("portfolio_items")
      .select("*")
      .eq("region_code", "us")
      .order("sort_order"),
    db.from("profile_regions").select("profile_id").eq("region_code", "us"),
    db.from("profiles").select("id,display_name"),
  ]);
  if (items.error || members.error || profiles.error)
    throw new Error(
      "Portfolio could not be loaded. Apply the portfolio and US content migrations first.",
    );
  const options: [string, string][] = (profiles.data ?? [])
    .filter((p) => members.data?.some((m) => m.profile_id === p.id))
    .map((p) => [p.id, p.display_name]);
  const rows = items.data as PortfolioItem[];
  function editor(row?: PortfolioItem) {
    return (
      <form action={savePortfolio} className="admin-form">
        {row && <input type="hidden" name="id" value={row.id} />}
        <input type="hidden" name="region_code" value="us" />
        <Choice
          label="US profile"
          name="profile_id"
          options={options}
          defaultValue={row?.profile_id}
        />
        <Field
          label="Project name"
          name="title"
          defaultValue={row?.title}
          required
        />
        <Field
          label="One-line description"
          name="summary"
          defaultValue={row?.summary}
          required
        />
        <Field
          label="Type of work"
          name="category"
          defaultValue={row?.category}
          required
        />
        <Field
          label="Project URL (optional)"
          name="url"
          type="url"
          defaultValue={row?.url}
          hint="https://"
        />
        <Field
          label="Sort order"
          name="sort_order"
          type="number"
          defaultValue={String(row?.sort_order ?? 0)}
          required
        />
        <Toggle
          label="Active"
          name="active"
          defaultChecked={row?.active ?? true}
        />
        <button className="button primary">
          {row ? "Save project" : "Add project"}
        </button>
      </form>
    );
  }
  return (
    <>
      <h2>US portfolio</h2>
      <p className="muted">
        Add real projects only. The US profile section stays hidden until active
        entries exist. India pages do not display these entries.
      </p>
      {options.length > 0 && (
        <Card title="Add project" open={!rows.length}>
          {editor()}
        </Card>
      )}
      {rows.map((row) => (
        <Card
          key={row.id}
          title={row.title}
          meta={row.active ? "Active" : "Hidden"}
        >
          {editor(row)}
          <form action={deletePortfolio} className="admin-danger">
            <input type="hidden" name="id" value={row.id} />
            <button className="button secondary">Delete project</button>
          </form>
        </Card>
      ))}
      {!rows.length && <Empty>No portfolio entries yet.</Empty>}
    </>
  );
}
