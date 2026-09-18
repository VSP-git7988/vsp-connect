import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const ARJUN = "00000000-0000-4000-8000-000000000011";
const KAVYA = "00000000-0000-4000-8000-000000000012";
const ADMIN = "00000000-0000-4000-8000-000000000021";
const MEMBER = "00000000-0000-4000-8000-000000000022";
const SESSION = "session-aaaaaaaaaaaaaaaa";

const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public,auth to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;`);
for (const file of [
  "supabase/migrations/001_initial.sql",
  "supabase/seed.sql",
  "supabase/migrations/002_ai_representative.sql",
  "supabase/seed_ai.sql",
])
  await db.exec(await readFile(file, "utf8"));
await db.exec(`grant all on all tables in schema public to service_role;
insert into auth.users values ('${ADMIN}'),('${MEMBER}');
insert into public.admin_users values ('${ADMIN}');
insert into public.profiles(company_id,slug,first_name,last_name,display_name,title) values ('00000000-0000-4000-8000-000000000001','private-person','Private','Person','Private Person','Test');`);

const asRole = (role: string, subject?: string) =>
  db.exec(
    `reset role; set role ${role}; select set_config('request.jwt.claim.sub','${subject ?? ""}',false)`,
  );
const rows = async (sql: string) => (await db.query(sql)).rows;
const one = async <T>(sql: string) => (await db.query<T>(sql)).rows[0];

// ------------------------------------------------------------ anonymous
await db.exec("set role anon");
assert.equal((await rows("select * from public.profiles")).length, 2);
await assert.rejects(db.exec("update public.profiles set title='Hacked'"));
await assert.rejects(db.query("select * from public.analytics_events"));
await assert.rejects(
  db.exec(
    `insert into public.analytics_events(profile_id,event_type) values ('${ARJUN}','profile_view')`,
  ),
);
// V2: public marketing content is readable, everything else is not.
assert.equal((await rows("select * from public.solutions")).length, 6);
assert.ok((await rows("select * from public.suggested_questions")).length >= 6);
for (const table of [
  "knowledge_sources",
  "profile_ai_config",
  "leads",
  "conversations",
  "messages",
  "ai_usage",
])
  await assert.rejects(
    db.query(`select * from public.${table}`),
    `anon must not read public.${table}`,
  );
for (const table of ["solutions", "suggested_questions"])
  await assert.rejects(
    db.exec(`update public.${table} set active=false`),
    `anon must not write public.${table}`,
  );
// A visitor may learn whether an assistant is on, never its instructions.
{
  const config = await one<{ enabled: boolean; intro: string }>(
    `select * from public.ai_public_config('${ARJUN}')`,
  );
  assert.equal(config.enabled, true);
  assert.ok(config.intro.includes("Arjun"));
  assert.ok(!config.intro.toLowerCase().includes("you represent"));
}
// Retrieval, rate limiting and spend are server-only surfaces.
for (const call of [
  `select * from public.search_knowledge('${ARJUN}','ai',5)`,
  `select public.ai_rate_check('${ARJUN}','${SESSION}',null,25,60,30)`,
  "select public.ai_spend_today()",
  `select public.record_analytics_event('${ARJUN}','ai_opened',null,null,null)`,
])
  await assert.rejects(db.query(call), `anon must not execute: ${call}`);

// ------------------------------------------- ordinary authenticated user
await asRole("authenticated", MEMBER);
assert.equal((await rows("select * from public.analytics_summary()")).length, 0);
assert.equal((await rows("select * from public.ai_summary()")).length, 0);
assert.equal(
  (await rows("update public.profiles set title='Hacked' returning id")).length,
  0,
);
await assert.rejects(
  db.exec(`insert into public.admin_users values ('${MEMBER}')`),
);
for (const table of [
  "knowledge_sources",
  "profile_ai_config",
  "leads",
  "conversations",
  "messages",
  "ai_usage",
])
  assert.equal(
    (await rows(`select * from public.${table}`)).length,
    0,
    `non-admin must not read public.${table}`,
  );
assert.equal(
  (
    await rows(
      "update public.knowledge_sources set content='Injected pricing' returning id",
    )
  ).length,
  0,
);

// ------------------------------------------------------------- server
await asRole("service_role");
// Founder knowledge never crosses profiles; company knowledge reaches both.
{
  const titles = async (profile: string, query: string) =>
    (
      await db.query<{ title: string }>(
        `select title from public.search_knowledge('${profile}','${query}',12)`,
      )
    ).rows.map((row) => row.title);
  const arjun = await titles(ARJUN, "tell me about kavya kelam");
  const kavya = await titles(KAVYA, "tell me about arjun devireddy");
  assert.ok(arjun.includes("About Arjun Devireddy"));
  assert.ok(
    !arjun.some((title) => title.includes("Kavya")),
    "Kavya's knowledge must not be retrievable on Arjun's profile",
  );
  assert.ok(kavya.includes("About Kavya Kelam"));
  assert.ok(
    !kavya.some((title) => title.includes("Arjun")),
    "Arjun's knowledge must not be retrievable on Kavya's profile",
  );
  for (const list of [arjun, kavya])
    assert.ok(list.includes("What VSP Innovations is"));
  // Core identity survives a query that matches nothing; pricing policy is found.
  assert.ok((await titles(ARJUN, "zzzz qqqq")).length > 0);
  assert.ok((await titles(ARJUN, "how much does this cost")).includes("Pricing"));
  // Retrieval is bounded and inactive rows are excluded.
  assert.ok((await titles(ARJUN, "ai")).length <= 12);
  await db.exec("update public.knowledge_sources set active=false where title='Pricing'");
  assert.ok(!(await titles(ARJUN, "how much does this cost")).includes("Pricing"));
  await db.exec("update public.knowledge_sources set active=true where title='Pricing'");
  // An unknown or inactive profile retrieves nothing at all.
  assert.equal((await titles("00000000-0000-4000-8000-0000000009ff", "ai")).length, 0);
}

// Conversation storage, rate limiting and spend controls.
{
  const conversation = (
    await one<{ id: string }>(
      `insert into public.conversations(profile_id,anonymous_session_id) values ('${ARJUN}','${SESSION}') returning id`,
    )
  ).id;
  // Only visitor and assistant turns can be stored: no hidden prompts.
  await assert.rejects(
    db.exec(
      `insert into public.messages(conversation_id,role,content) values ('${conversation}','system','You are...')`,
    ),
    "system-role messages must be rejected",
  );
  const rate = async (
    conversationId: string | null,
    perConversation = 25,
    perSessionHour = 60,
    perProfileMinute = 30,
  ) =>
    (
      await one<{ verdict: string }>(
        `select public.ai_rate_check('${ARJUN}','${SESSION}',${conversationId ? `'${conversationId}'` : "null"},${perConversation},${perSessionHour},${perProfileMinute}) as verdict`,
      )
    ).verdict;
  assert.equal(await rate(conversation), "ok");
  for (let i = 0; i < 25; i++)
    await db.exec(
      `insert into public.messages(conversation_id,role,content) values ('${conversation}','user','Question ${i}'),('${conversation}','assistant','Answer ${i}')`,
    );
  assert.equal(await rate(conversation), "conversation", "conversation cap");
  assert.equal(await rate(null, 25, 10, 100), "session", "session hourly cap");
  assert.equal(await rate(null, 25, 1000, 5), "busy", "per-profile burst cap");
  assert.equal(await rate(null, 1000, 1000, 1000), "ok", "limits are configurable");
  // An unknown profile is never chargeable.
  assert.equal(
    (
      await one<{ verdict: string }>(
        `select public.ai_rate_check('00000000-0000-4000-8000-0000000009ff','${SESSION}',null,25,60,30) as verdict`,
      )
    ).verdict,
    "unavailable",
  );

  // Usage accounting and the daily spend guard.
  await db.exec(
    `insert into public.ai_usage(profile_id,conversation_id,provider,model,input_tokens,output_tokens,estimated_cost)
     values ('${ARJUN}','${conversation}','anthropic','claude-sonnet-5',1200,300,0.005400),
            ('${KAVYA}',null,'anthropic','claude-sonnet-5',900,240,0.004200)`,
  );
  assert.equal(
    Number((await one<{ spend: string }>("select public.ai_spend_today() as spend")).spend),
    0.0096,
  );
  await assert.rejects(
    db.exec(
      `insert into public.ai_usage(profile_id,provider,model,input_tokens) values ('${ARJUN}','anthropic','m',-5)`,
    ),
  );

  // Leads: stored details must be well formed, and a bad address is refused.
  await assert.rejects(
    db.exec(
      `insert into public.leads(profile_id,company_id,email) values ('${ARJUN}','00000000-0000-4000-8000-000000000001','not-an-email')`,
    ),
  );
  const lead = (
    await one<{ id: string }>(
      `insert into public.leads(profile_id,company_id,name,company_name,email,business_type,problem_summary)
       values ('${ARJUN}','00000000-0000-4000-8000-000000000001','Test Visitor','Example Clinic','visitor@example.com','clinic','Wants an AI receptionist') returning id`,
    )
  ).id;
  await db.exec(
    `update public.conversations set lead_id='${lead}' where id='${conversation}'`,
  );
}

// Analytics ingestion: V2 event types, allowlisted metadata, raised cap.
{
  const record = async (event: string, source = "null", solution = "null") =>
    (
      await one<{ recorded: boolean }>(
        `select public.record_analytics_event('${ARJUN}','${event}',null,${source},${solution}) as recorded`,
      )
    ).recorded;
  for (const event of [
    "ai_opened",
    "ai_message_sent",
    "suggested_question_clicked",
    "lead_started",
    "lead_created",
    "meeting_intent",
    "solution_viewed",
    "booking_from_ai",
  ])
    assert.equal(await record(event), true, `${event} must be accepted`);
  await assert.rejects(db.query(`select public.record_analytics_event('${ARJUN}','sql_drop',null,null,null)`));
  // Only allowlisted metadata is stored, and only in a recognised shape.
  assert.equal(await record("solution_viewed", "'qr'", "'ai-voice-agents'"), true);
  assert.equal(await record("solution_viewed", "'spoofed'", "'DROP TABLE leads'"), true);
  const stored = await rows(
    `select metadata from public.analytics_events where event_type='solution_viewed' order by created_at`,
  );
  assert.deepEqual(stored[1], { metadata: { source: "qr", solution: "ai-voice-agents" } });
  assert.deepEqual(stored[2], { metadata: {} });
  // The per-profile cap still applies, at the raised V2 limit.
  let accepted = 0;
  for (let i = 0; i < 260; i++) if (await record("profile_view")) accepted++;
  assert.equal(accepted, 240 - 10, "cap is 240 events per profile per minute");
  assert.equal(await record("profile_view"), false);
}

// ------------------------------------------------------------ administrator
await asRole("authenticated", ADMIN);
assert.equal((await rows("select * from public.profiles")).length, 3);
assert.equal(
  (
    await rows(
      "update public.profiles set headline='Approved headline' where slug='arjun-devireddy' returning id",
    )
  ).length,
  1,
);
assert.equal((await rows("select * from public.analytics_events")).length, 240);
assert.equal(
  Number(
    (
      await one<{ total: string }>(
        "select total from public.analytics_summary() where event_type='profile_view'",
      )
    ).total,
  ),
  230,
);
assert.ok((await rows("select * from public.knowledge_sources")).length >= 12);
assert.equal((await rows("select * from public.leads")).length, 1);
assert.equal((await rows("select * from public.conversations")).length, 1);
assert.equal((await rows("select * from public.messages")).length, 50);
assert.equal((await rows("select * from public.ai_usage")).length, 2);
assert.equal(
  (
    await rows(
      `insert into public.knowledge_sources(company_id,profile_id,title,content,category)
       values ('00000000-0000-4000-8000-000000000001',null,'Support hours','Configured by an administrator.','policy') returning id`,
    )
  ).length,
  1,
);
{
  const summary = await db.query<{
    display_name: string;
    conversations: string;
    visitor_messages: string;
    leads: string;
    estimated_cost: string;
  }>("select * from public.ai_summary()");
  const arjun = summary.rows.find((row) => row.display_name === "Arjun Devireddy");
  assert.equal(Number(arjun?.conversations), 1);
  assert.equal(Number(arjun?.visitor_messages), 25);
  assert.equal(Number(arjun?.leads), 1);
  assert.equal(Number(arjun?.estimated_cost), 0.0054);
  const kavya = summary.rows.find((row) => row.display_name === "Kavya Kelam");
  assert.equal(Number(kavya?.conversations), 0);
  assert.equal(Number(kavya?.leads), 0);
}
// Administrators cannot read another visitor's data through a public surface;
// the service key remains the only writer of conversations and usage.
await asRole("anon");
await assert.rejects(db.query("select * from public.messages"));

await db.close();
console.log(
  "PASS: V1+V2 migrations and seeds, anon/ordinary/admin RLS on ten tables, founder-scoped retrieval, AI rate limits, spend guard, lead constraints, V2 analytics metadata allowlist, 240-event cap, dashboard aggregation.",
);
