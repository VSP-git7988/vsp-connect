# VSP Connect — development memory

Last updated: 2026-09-18. V1 shipped; V2 (AI business representative) implemented and verified offline, not yet launched.

## Product constraints

V1 is a digital business identity experience, not an AI agent platform. VSP Innovations is an AI Solutions & Product Development Company. Independent founder URLs, NFC URL records and real QR codes are central. No fabricated personal contact information, portraits, verification claims, analytics or AI features. Starter biographies and geometric brand treatment require founder approval.

V2 adds one grounded AI business representative per founder profile. It is not an open-ended chatbot: it answers only from approved knowledge rows, declines anything absent from them rather than estimating, never emits links or markup, and stays switched off for any founder without an enabled `profile_ai_config` row. The identity constraints above are unchanged and apply to everything the assistant can say.

## Architecture decisions

- Next.js 16.3.5 App Router, React 19.3, TypeScript, Tailwind 4, Framer Motion, Supabase SSR/Auth and PostgreSQL; versions locked in package-lock.json.
- CSS-generated holographic identity artwork; no image generation, stock founder photos, Three.js, external fonts or heavy 3D assets.
- Data-driven profiles through normalized tables, not profile JSON. Dynamic root/profile pages reflect content changes without rebuilds; React cache deduplicates data reads within a request.
- Without Supabase, explicit local starter data renders. With Supabase, failures surface as errors. No mock success for analytics or admin authentication.
- Server-only service key limited to event ingestion in V1; V2 additionally uses it for knowledge retrieval, conversation/lead storage and usage records. It is never used for administration: every admin write goes through the signed-in user's own client so RLS is the authority. Admin access requires an Auth user and membership in admin_users. Auth cookie refresh proxy only covers internal routes.
- Native sharing with clipboard fallback, real server-rendered QR SVG, escaped/folded vCard 3.0.
- Production Webpack build selected because workspace sandbox blocks Turbopack subprocess ports. PostCSS uses .cjs because Next's ESM config resolution mishandles the literal `%20` in the workspace path.
- V2: provider SDKs are confined to `src/lib/ai/providers/*` behind an `AIProvider` interface and a registry; the chat route, prompt builder and storage layer import no vendor. A second vendor is one new file plus one registry line. An unregistered `AI_PROVIDER` degrades to the unavailable fallback rather than throwing a 500.
- Every AI limit (message length, per-conversation/session/profile rate, history, output tokens, retrieval size, timeout, daily spend) is read from the environment, so cost and abuse controls are tuned without a code change or a migration.
- The model's only channel to the interface is a control block naming predefined actions. It is stripped from the stream, parsed against a closed schema, and checked against the actions configured for that founder and the solutions loaded for that request. `src/lib/ai/actions.ts` is deliberately free of `server-only` so the browser repeats the same stripping and validation on the stream it receives; actions from both sources are merged and de-duplicated. Destinations always come from trusted profile data, never from model output.
- `persona_instructions` is service-role only and has no public policy. Public pages call `ai_public_config()`, which returns only whether the assistant is enabled and its introduction.
- Retrieval is scoped in SQL, not in application code: `search_knowledge()` returns company knowledge plus the requesting founder's own rows and can never return another founder's.
- Only visitor and assistant turns are persisted. System instructions, retrieved knowledge and persona text are not stored. The anonymous session id lives in `sessionStorage`, so it is per tab rather than a durable cross-visit identifier.

## Completed implementation

- Premium responsive company landing page, independent Arjun and Kavya profiles, subtle team discovery.
- Monogram portrait placeholders; dynamic configurable contact and social links, biographies and expertise.
- Save contact, actual QR modal/download, native/clipboard share, external Cal.com booking when configured.
- Semantic layout, skip navigation, focus states, reduced-motion support, keyboard-dismissable native QR dialog.
- Anonymous analytics validation, hostname-only referrer, allowlisted source and event types, server timestamps.
- Database-enforced cap of 120 events per profile per minute using a transaction lock; no visitor identifier.
- Protected login/dashboard with 30-day aggregate metrics and founder comparison; empty and failure states.
- README, environment template, migrations, repeatable seeds, browser and database verification scripts.

### V2 — AI business representative

- Per-founder assistant panel on each profile: streamed answers over server-sent events, suggested questions, typing state, conversation continuation, clear-conversation, keyboard dismissal and a phone-first layout that passes axe WCAG A/AA.
- Grounded prompt with explicit refusal rules for prices, customers, partnerships, case studies, certifications, team size, revenue, biography details and timelines; prompt-injection handling; labelled knowledge block treated as data, not instructions.
- Streaming-safe control filter on both server and client, so a sentinel split across deltas is never shown. Predefined actions only: save contact, book, WhatsApp, email, website and solution cards; the model is told about an action only when its destination is configured.
- Lead capture with a contactability rule (email, phone, or name plus company), one lead per conversation, no blank overwrites, and a visitor-facing confirmation when details are shared.
- Database rate limiting per conversation, per session-hour and per profile-minute under a transaction lock, plus a daily estimated-spend guard; a process-local limiter applies when Supabase is absent so development is not an open AI proxy. Every refusal degrades to guidance with working contact and booking actions.
- Administration area behind admin membership: overview with AI metrics, profile contact editing, per-founder AI identity, knowledge, solutions, suggested questions, lead statuses, conversation transcripts and token/cost reporting.
- Eight new analytics event types and an allowlisted solution-slug metadata key; per-profile cap raised to 240 events per minute.
- Offline seed knowledge, solutions and questions so the assistant is demonstrable without Supabase or a provider key.

## Database changes

`supabase/migrations/002_ai_representative.sql` adds knowledge_sources (with a generated tsvector and GIN index), solutions, suggested_questions, profile_ai_config, leads, conversations, messages and ai_usage, their constraints, indexes, updated-at triggers and RLS. Only active solutions and suggested questions have a public read policy; everything else is admin-only through the user's own session or service-role only through the server. It adds `ai_public_config`, `search_knowledge`, `ai_rate_check`, `ai_spend_today` and `ai_summary`, extends the analytics event-type check with eight V2 types, and replaces the V1 four-argument `record_analytics_event` with a five-argument version that allowlists one solution-slug metadata key and raises the per-profile cap to 240/minute. Because the V1 function is dropped, apply 002 before deploying V2 code. `supabase/seed_ai.sql` adds starter knowledge, solutions, questions and founder AI identity. Apply 001, then 002, then seed.sql, then seed_ai.sql.

`supabase/migrations/001_initial.sql` creates companies, profiles, social_links, expertise, analytics_events and admin_users, constraints, indexes, updated-at triggers, RLS policies, admin membership check, analytics_summary aggregation and service-only record_analytics_event RPC. `supabase/seed.sql` adds both founders and expertise with NULL missing contact values. Apply migration once, then seed. Do not rerun the initial migration over an existing schema; future changes require new numbered migrations.

## Verification performed

### V2, on 2026-09-18

- `npm run typecheck`, `npm run lint` and the production Webpack build pass.
- `npm run test:ai` passes: control-block stripping at chunk sizes 1, 3, 7, 13 and 1000, structured-output validation against the closed schema, lead qualification rules, prompt-injection neutralising, founder knowledge isolation and cost estimates. No provider key and no database required.
- `npm run test:database` passes on PGlite: V1+V2 migrations and seeds, anon/ordinary/admin RLS across ten tables, founder-scoped retrieval, AI rate limits, spend guard, lead constraints, V2 analytics metadata allowlist, the 240-event cap and dashboard aggregation.
- `npm run test:contact` passes: configured action URLs, unsafe URL rejection, vCard fields, escaping and folding.
- Full Playwright suite: 60 of 60 pass (15 tests across four viewport projects) on desktop, iPhone 13, Pixel 7 and iPad Mini Chromium emulation, including the nine assistant tests (one added this session) and an axe WCAG A/AA pass on the open assistant panel. One run at `--workers=2` showed a single failure that passed in isolation and passed in a clean `--workers=1` run; the machine had roughly 400 MB free of 6 GB, so it was memory pressure rather than a defect.
- Assistant browser tests use a scripted server-sent-events mock. No provider was called, no model output was asserted as correct, and no live generation was verified.

### V1

- Dependencies installed; npm audit reported zero vulnerabilities at install time.
- TypeScript and lint passed; production Webpack build passed.
- Final browser suite passed all 24 tests on desktop, iPhone 13, Pixel 7 and iPad Mini Chromium viewport emulation. Automated axe WCAG A/AA checks found no violations on company, both profiles, and login pages. Analytics payload tests verified profile scoping and allowlisted anonymous fields.
- Both founders' displayed QR codes decoded from screenshots to their exact canonical local URLs.
- Contact downloads, route isolation, no horizontal overflow, native-share/clipboard stubs, unavailable contacts, event validation and unauthenticated admin setup state passed.
- PGlite executed the SQL migration/seeds and verified anon, ordinary authenticated, admin and service-role permissions, real event persistence, rate cap and dashboard aggregation. Auth schema was a test stub; this is not hosted Supabase Auth verification.
- Configured external action URLs verified with reserved synthetic fixtures; vCard escaping/folding and unsafe URL rejection passed.
- Desktop company and mobile profile screenshots manually inspected; artifacts stored in `artifacts/`.

## V2 work completed in the 2026-09-18 session

The V2 implementation was already largely in place and passing build and lint. This session finished the parts that were not:

- The browser rendered the model's control block as prose. `tests/ai.spec.ts` already asserted it must not, and that test was failing. The client now runs deltas through the same `ControlFilter` as the server and parses the payload with `parseControl` against the solutions the profile loaded, merging and de-duplicating actions from both sources.
- `leadCaptured` was computed and streamed by the chat route but discarded by the client. The visitor now sees a confirmation that their details were shared, cleared with the conversation.
- `saveTurn` wrote `message_count: rows.length`, so `conversations.message_count` was always 2 instead of a running total. It is now derived from a count of stored messages.
- `getProvider()` was called unguarded in the chat route, so an unregistered `AI_PROVIDER` produced a 500 instead of the documented unavailable fallback. It is now caught.
- Removed the dead `actionTypeList` export.
- `estimateCost` returned 0 for any model missing from the rate table, and those rows feed `ai_spend_today()`. Setting `AI_MODEL` to an unlisted model therefore recorded every request as free and silently disabled `AI_DAILY_COST_LIMIT_USD`. An unpriced model now estimates at the most expensive known tier, so the guard fails safe by over-estimating; the admin usage page flags which models are unpriced and why. Rate table verified against current published pricing and extended to the Fable 5.1/5, Opus 4.7 and Opus 4.6 ids.
- Added a browser test covering the lead confirmation, merged server and client actions, and rejection of a solution slug the profile does not offer.
- README rewritten for V2: routes, environment table, migration order, the AI representative section, updated analytics events and cap, and the testing commands.
- `next.config.ts` gained an opt-in `NEXT_BUILD_CPUS` cap. Unset, the build is unchanged; it exists because page-data collection with one worker per core exhausted memory on this machine.

## Pending launch work / limitations

- No Supabase project credentials were supplied. Hosted Auth login/logout/refresh, event API-to-Supabase persistence and real dashboard must be tested after environment configuration and migration. Live launch is not complete until these pass.
- No provider API key was supplied and no live generation has ever run. Answer quality, grounding behaviour under real questions, refusal behaviour, streaming latency, token usage and actual cost per conversation are all unverified. Everything asserted about the assistant so far is about the plumbing around the model, not the model's output. Run a supervised session against real credentials, read the transcripts, and tune knowledge and persona before exposing it to visitors.
- Knowledge, solutions, suggested questions and founder persona instructions are starter content and need founder review. The assistant should stay disabled per founder until their `profile_ai_config` row is approved and enabled.
- `estimated_cost` is computed from the rate table in `src/lib/ai/pricing.ts`. It is an estimate, not a billed amount, and the table must be updated when provider pricing changes. Rates were correct as of 2026-09-18; a model absent from the table is deliberately over-estimated at the dearest known tier, so add its real rate rather than relying on that upper bound. Set a provider-side spend limit as well; `AI_DAILY_COST_LIMIT_USD` only guards what this application itself records.
- Conversation and lead retention is not automated. Add a retention job for `conversations`, `messages` and `leads`, and state the handling of chat content in the privacy notice, before public launch.
- The assistant endpoint is public and can be driven by a script despite the database limiters. Add edge rate limiting on `/api/ai/chat` as well as `/api/events` before launch.
- Founders must supply actual contact details, portrait images, LinkedIn/website/Cal.com URLs and approved biography/brand assets. External destination services cannot be validated while fields are NULL. Synthetic test data is not published.
- Set NEXT_PUBLIC_SITE_URL to the HTTPS production domain before building, printing QR or programming NFC. localhost is development-only.
- Physical iOS/Android contact imports, native OS sharing, NFC taps and printed QR scans remain device acceptance tests; Chromium viewport emulation does not establish Safari or physical hardware compatibility.
- V2 replaced Supabase Studio content management with the `/admin` area for profiles, AI identity, knowledge, solutions, questions, leads and conversations. Company logo schema field is still unused; the shared UI mark comes from brand.tsx.
- Counts measure events, not unique people or completed calls/bookings. Public ingestion may be spoofed; add edge firewall limits and a retention job before public launch. The shared per-profile cap may drop busy legitimate traffic.
- No deployment was performed. No Lighthouse score is claimed. No secrets were created or committed.

## Repository setup

- User authorized creation of a private GitHub repository and initial push on 2026-09-17.
- Local GitHub PAT is stored only in ignored `.env.local`; never include it in commits or remote URLs.
- Target repository: `vspteam777/vsp-connect`.
