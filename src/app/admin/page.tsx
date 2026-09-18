import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

type EventRow = {
  profile_id: string;
  display_name: string;
  event_type: string | null;
  total: number;
};
type AIRow = {
  profile_id: string;
  display_name: string;
  conversations: number;
  visitor_messages: number;
  leads: number;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
};

export default async function Overview() {
  const { db } = await requireAdmin();
  const [events, ai] = await Promise.all([
    db.rpc("analytics_summary"),
    db.rpc("ai_summary"),
  ]);
  if (events.error || ai.error)
    throw new Error("Analytics could not be loaded.");
  const rows = (events.data || []) as EventRow[];
  const aiRows = (ai.data || []) as AIRow[];

  const sum = (event: string, profileId?: string) =>
    rows
      .filter(
        (row) =>
          row.event_type === event &&
          (!profileId || row.profile_id === profileId),
      )
      .reduce((total, row) => total + Number(row.total), 0);
  const aiFor = (profileId: string) =>
    aiRows.find((row) => row.profile_id === profileId);
  const conversations = aiRows.reduce(
    (total, row) => total + Number(row.conversations),
    0,
  );
  const views = sum("profile_view");
  const rate = (opened: number, seen: number) =>
    seen > 0 ? `${Math.round((opened / seen) * 100)}%` : "—";

  const headline: [string, string][] = [
    ["Profile views", String(views)],
    ["AI conversations", String(conversations)],
    ["AI engagement rate", rate(sum("ai_opened"), views)],
    [
      "Leads generated",
      String(aiRows.reduce((total, row) => total + Number(row.leads), 0)),
    ],
    ["Meeting intent", String(sum("meeting_intent"))],
    ["Booking clicks", String(sum("booking_clicked") + sum("booking_from_ai"))],
    ["Contact saves", String(sum("save_contact"))],
    [
      "Estimated AI cost",
      `$${aiRows
        .reduce((total, row) => total + Number(row.estimated_cost), 0)
        .toFixed(2)}`,
    ],
  ];

  return (
    <>
      <div className="eyebrow">LAST 30 DAYS</div>
      <div className="metric-grid">
        {headline.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <h2>Engagement by founder</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Founder</th>
              <th>Profile views</th>
              <th>AI opened</th>
              <th>Engagement</th>
              <th>Conversations</th>
              <th>Visitor messages</th>
              <th>Leads</th>
              <th>Meeting intent</th>
              <th>Booking clicks</th>
            </tr>
          </thead>
          <tbody>
            {aiRows.map((row) => {
              const seen = sum("profile_view", row.profile_id);
              return (
                <tr key={row.profile_id}>
                  <th>{row.display_name}</th>
                  <td>{seen}</td>
                  <td>{sum("ai_opened", row.profile_id)}</td>
                  <td>{rate(sum("ai_opened", row.profile_id), seen)}</td>
                  <td>{Number(aiFor(row.profile_id)?.conversations ?? 0)}</td>
                  <td>{Number(aiFor(row.profile_id)?.visitor_messages ?? 0)}</td>
                  <td>{Number(aiFor(row.profile_id)?.leads ?? 0)}</td>
                  <td>{sum("meeting_intent", row.profile_id)}</td>
                  <td>
                    {sum("booking_clicked", row.profile_id) +
                      sum("booking_from_ai", row.profile_id)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.some((row) => Number(row.total) > 0) && !conversations && (
        <p>
          No activity yet. Events appear here after visitors interact with a
          public profile.
        </p>
      )}
      <p className="muted">
        Anonymous event totals over the last 30 days. Views are not unique
        visitors. Booking clicks count link opens, not confirmed meetings. No
        cookies or personal visitor identifiers are stored.
      </p>
    </>
  );
}
