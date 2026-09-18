import { redirect } from "next/navigation";
import { authDb, configured } from "@/lib/supabase";
import { logout } from "../login/actions";
export const dynamic = "force-dynamic";
export default async function Admin() {
  if (!configured) redirect("/login");
  const db = await authDb();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!admin)
    return (
      <main id="main" className="state-page">
        <h1>Access restricted</h1>
        <p>Your account does not have administrator access.</p>
        <form action={logout}>
          <button className="button secondary">Sign out</button>
        </form>
      </main>
    );
  const { data: rows, error } = await db.rpc("analytics_summary");
  if (error) throw new Error("Analytics could not be loaded.");
  const metrics = [
    ["profile_view", "Profile views"],
    ["save_contact", "Contact saves"],
    ["whatsapp_clicked", "WhatsApp clicks"],
    ["booking_clicked", "Meeting clicks"],
    ["profile_shared", "Shares"],
  ] as const;
  type Row = {
    profile_id: string;
    display_name: string;
    event_type: string | null;
    total: number;
  };
  const data = (rows || []) as Row[];
  const names = Array.from(
    new Map(data.map((x) => [x.profile_id, x.display_name])),
  );
  return (
    <main id="main" className="dashboard">
      <div className="section-heading">
        <div>
          <div className="eyebrow">TEAM INSIGHTS · LAST 30 DAYS</div>
          <h1>Every connection counts.</h1>
        </div>
        <form action={logout}>
          <button className="button secondary">Sign out</button>
        </form>
      </div>
      <div className="metric-grid">
        {metrics.map(([event, label]) => (
          <div key={event}>
            <span>{label}</span>
            <strong>
              {data
                .filter((x) => x.event_type === event)
                .reduce((a, b) => a + Number(b.total), 0)}
            </strong>
          </div>
        ))}
      </div>
      <h2>Engagement by founder</h2>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Founder</th>
              {metrics.map(([, label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map(([id, name]) => (
              <tr key={id}>
                <th>{name}</th>
                {metrics.map(([event]) => (
                  <td key={event}>
                    {Number(
                      data.find(
                        (x) => x.profile_id === id && x.event_type === event,
                      )?.total || 0,
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!data.some((x) => Number(x.total) > 0) && (
        <p>
          No activity yet. Events will appear here after visitors interact with
          a public profile.
        </p>
      )}
      <p className="muted">
        Anonymous event totals. Views are not unique visitors. No cookies or
        personal visitor identifiers.
      </p>
    </main>
  );
}
