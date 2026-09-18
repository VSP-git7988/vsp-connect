import { requireAdmin } from "@/lib/admin";
import { Card, Empty, Field, TextArea, Toggle } from "@/components/admin-ui";
import { saveAIConfig } from "../actions";

export const dynamic = "force-dynamic";

type Profile = { id: string; display_name: string; slug: string; title: string };
type Config = {
  profile_id: string;
  enabled: boolean;
  intro: string;
  persona_instructions: string;
  focus_areas: string[] | null;
};

export default async function AIIdentity() {
  const { db } = await requireAdmin();
  const [profiles, configs] = await Promise.all([
    db.from("profiles").select("id,display_name,slug,title").order("display_name"),
    db
      .from("profile_ai_config")
      .select("profile_id,enabled,intro,persona_instructions,focus_areas"),
  ]);
  if (profiles.error || configs.error)
    throw new Error("AI identity could not be loaded.");
  const rows = (profiles.data || []) as Profile[];
  const byProfile = new Map(
    ((configs.data || []) as Config[]).map((row) => [row.profile_id, row]),
  );

  return (
    <>
      <h2>Founder AI identity</h2>
      <p className="muted">
        Each founder&rsquo;s assistant introduces itself differently and can be
        turned off independently. Instructions are internal: they are never sent
        to the browser and the assistant is told to refuse requests to reveal
        them. They shape tone and role only — factual answers come from
        Knowledge.
      </p>
      {rows.map((profile) => {
        const config = byProfile.get(profile.id);
        return (
          <Card
            key={profile.id}
            title={profile.display_name}
            meta={config?.enabled ? "assistant on" : "assistant off"}
          >
            <form action={saveAIConfig} className="admin-form">
              <input type="hidden" name="profile_id" value={profile.id} />
              <TextArea
                label="Introduction"
                name="intro"
                rows={2}
                defaultValue={config?.intro ?? ""}
                hint="Shown above the conversation before the first message."
              />
              <TextArea
                label="Internal instructions"
                name="persona_instructions"
                rows={4}
                defaultValue={config?.persona_instructions ?? ""}
                hint="Role and tone only. Never put facts, prices or claims here."
              />
              <Field
                label="Focus areas"
                name="focus_areas"
                defaultValue={(config?.focus_areas ?? []).join(", ")}
                hint="Comma separated"
              />
              <Toggle
                label="Assistant enabled on this profile"
                name="enabled"
                defaultChecked={config?.enabled ?? false}
              />
              <div className="admin-buttons">
                <button className="button primary">Save AI identity</button>
              </div>
            </form>
          </Card>
        );
      })}
      {!rows.length && <Empty>No profiles found.</Empty>}
    </>
  );
}
