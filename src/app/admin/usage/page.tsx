import { requireAdmin } from "@/lib/admin";
import { Empty } from "@/components/admin-ui";
import { aiConfig } from "@/lib/ai/config";
import { isPricedModel } from "@/lib/ai/pricing";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  profile_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  created_at: string;
};

export default async function Usage() {
  const { db } = await requireAdmin();
  const [usage, profiles] = await Promise.all([
    db
      .from("ai_usage")
      .select(
        "id,profile_id,provider,model,input_tokens,output_tokens,estimated_cost,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    db.from("profiles").select("id,display_name"),
  ]);
  if (usage.error || profiles.error)
    throw new Error("AI usage could not be loaded.");
  const rows = (usage.data || []) as Row[];
  const names = new Map(
    ((profiles.data || []) as { id: string; display_name: string }[]).map(
      (p) => [p.id, p.display_name],
    ),
  );
  const today = new Date().toISOString().slice(0, 10);
  const spentToday = rows
    .filter((row) => row.created_at.slice(0, 10) === today)
    .reduce((total, row) => total + Number(row.estimated_cost), 0);
  const unpriced = [...new Set(rows.map((row) => row.model))].filter(
    (model) => !isPricedModel(model),
  );
  const totals = rows.reduce(
    (acc, row) => ({
      input: acc.input + Number(row.input_tokens),
      output: acc.output + Number(row.output_tokens),
      cost: acc.cost + Number(row.estimated_cost),
    }),
    { input: 0, output: 0, cost: 0 },
  );

  return (
    <>
      <h2>AI usage and cost</h2>
      <div className="metric-grid">
        <div>
          <span>Requests shown</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Input tokens</span>
          <strong>{totals.input.toLocaleString()}</strong>
        </div>
        <div>
          <span>Output tokens</span>
          <strong>{totals.output.toLocaleString()}</strong>
        </div>
        <div>
          <span>Estimated cost</span>
          <strong>${totals.cost.toFixed(4)}</strong>
        </div>
        <div>
          <span>Spent today</span>
          <strong>${spentToday.toFixed(4)}</strong>
        </div>
        <div>
          <span>Daily limit</span>
          <strong>
            {aiConfig.dailyCostLimitUsd > 0
              ? `$${aiConfig.dailyCostLimitUsd.toFixed(2)}`
              : "off"}
          </strong>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Founder</th>
              <th>Provider</th>
              <th>Model</th>
              <th>Input</th>
              <th>Output</th>
              <th>Estimated cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((row) => (
              <tr key={row.id}>
                <th>{new Date(row.created_at).toLocaleString()}</th>
                <td>{names.get(row.profile_id) ?? "Unknown"}</td>
                <td>{row.provider}</td>
                <td>
                  {row.model}
                  {!isPricedModel(row.model) && " *"}
                </td>
                <td>{Number(row.input_tokens).toLocaleString()}</td>
                <td>{Number(row.output_tokens).toLocaleString()}</td>
                <td>${Number(row.estimated_cost).toFixed(5)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty>No AI requests recorded yet.</Empty>}
      {unpriced.length > 0 && (
        <p className="muted">
          * No published rate is configured for {unpriced.join(", ")}, so those
          rows are estimated at the most expensive known tier. The figure is an
          upper bound, not a projection: add the real rate to{" "}
          <code>src/lib/ai/pricing.ts</code> to make it accurate. Estimating
          them at zero instead would disable the daily spend limit.
        </p>
      )}
      <p className="muted">
        Costs are estimates calculated from published per-token rates for the
        configured model, not billed amounts. Reconcile against your provider
        invoice. The most recent 500 records are summarised and the latest 100
        listed. When the daily limit is reached the assistant declines new
        messages and the profile still offers contact and booking actions.
      </p>
    </>
  );
}
