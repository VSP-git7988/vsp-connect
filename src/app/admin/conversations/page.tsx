import { requireAdmin } from "@/lib/admin";
import { Card, Empty } from "@/components/admin-ui";
import { deleteConversation } from "../actions";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  profile_id: string;
  lead_id: string | null;
  started_at: string;
  messages: { role: string; content: string; created_at: string }[];
};

export default async function Conversations() {
  const { db } = await requireAdmin();
  const [conversations, profiles] = await Promise.all([
    db
      .from("conversations")
      .select(
        "id,profile_id,lead_id,started_at,messages(role,content,created_at)",
      )
      .order("started_at", { ascending: false })
      .limit(50),
    db.from("profiles").select("id,display_name"),
  ]);
  if (conversations.error || profiles.error)
    throw new Error("Conversations could not be loaded.");
  const rows = (conversations.data || []) as Row[];
  const names = new Map(
    ((profiles.data || []) as { id: string; display_name: string }[]).map(
      (p) => [p.id, p.display_name],
    ),
  );

  return (
    <>
      <h2>Conversations</h2>
      <p className="muted">
        The 50 most recent conversations. Visitor and assistant turns only:
        system instructions and retrieved knowledge are never stored. Anonymous
        session identifiers are not shown here and are not linked to a person.
        Set a retention schedule appropriate to your policy.
      </p>
      {rows.map((row) => {
        const turns = [...(row.messages || [])].sort((a, b) =>
          a.created_at.localeCompare(b.created_at),
        );
        return (
          <Card
            key={row.id}
            title={`${names.get(row.profile_id) ?? "Unknown"} · ${turns.length} messages`}
            meta={`${new Date(row.started_at).toLocaleString()}${row.lead_id ? " · lead captured" : ""}`}
          >
            <div className="admin-transcript">
              {turns.map((turn, index) => (
                <p key={index} className={`admin-turn admin-turn-${turn.role}`}>
                  <span>{turn.role === "user" ? "Visitor" : "Assistant"}</span>
                  {turn.content}
                </p>
              ))}
              {!turns.length && <Empty>No messages recorded.</Empty>}
            </div>
            <form action={deleteConversation} className="admin-danger">
              <input type="hidden" name="id" value={row.id} />
              <button className="button secondary">Delete conversation</button>
            </form>
          </Card>
        );
      })}
      {!rows.length && <Empty>No conversations yet.</Empty>}
    </>
  );
}
