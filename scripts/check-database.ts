import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;`);
await db.exec(await readFile("supabase/migrations/001_initial.sql", "utf8"));
await db.exec(await readFile("supabase/seed.sql", "utf8"));
await db.exec(`grant all on all tables in schema public to service_role;
insert into auth.users values ('00000000-0000-4000-8000-000000000021'),('00000000-0000-4000-8000-000000000022');
insert into public.admin_users values ('00000000-0000-4000-8000-000000000021');
insert into public.profiles(company_id,slug,first_name,last_name,display_name,title) values ('00000000-0000-4000-8000-000000000001','private-person','Private','Person','Private Person','Test');`);
await db.exec("set role anon");
assert.equal((await db.query("select * from public.profiles")).rows.length, 2);
await assert.rejects(db.exec("update public.profiles set title='Hacked'"));
await assert.rejects(db.query("select * from public.analytics_events"));
await assert.rejects(
  db.exec(
    "insert into public.analytics_events(profile_id,event_type) values ('00000000-0000-4000-8000-000000000011','profile_view')",
  ),
);
await db.exec(
  "reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',false)",
);
assert.equal(
  (await db.query("select * from public.analytics_summary()")).rows.length,
  0,
);
assert.equal(
  (await db.query("update public.profiles set title='Hacked' returning id"))
    .rows.length,
  0,
);
await assert.rejects(
  db.exec(
    "insert into public.admin_users values ('00000000-0000-4000-8000-000000000022')",
  ),
);
await db.exec("reset role; set role service_role");
for (let i = 0; i < 120; i++) {
  const result = await db.query<{ recorded: boolean }>(
    "select public.record_analytics_event('00000000-0000-4000-8000-000000000011','profile_view','example.org','qr') as recorded",
  );
  assert.equal(result.rows[0].recorded, true);
}
assert.equal(
  (
    await db.query<{ recorded: boolean }>(
      "select public.record_analytics_event('00000000-0000-4000-8000-000000000011','profile_view',null,null) as recorded",
    )
  ).rows[0].recorded,
  false,
);
await db.exec(
  "reset role; set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',false)",
);
assert.equal((await db.query("select * from public.profiles")).rows.length, 3);
assert.equal(
  (
    await db.query(
      "update public.profiles set headline='Approved headline' where slug='arjun-devireddy' returning id",
    )
  ).rows.length,
  1,
);
assert.equal(
  (await db.query("select * from public.analytics_events")).rows.length,
  120,
);
const summary = await db.query<{ total: number }>(
  "select total from public.analytics_summary() where event_type='profile_view'",
);
assert.equal(Number(summary.rows[0].total), 120);
await db.close();
console.log(
  "PASS: migration, seeds, public/ordinary/admin RLS, service ingestion, 120-event cap, dashboard aggregation.",
);
