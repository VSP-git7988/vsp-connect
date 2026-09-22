# VSP Connect

A mobile-first digital business identity platform for VSP Innovations, an **AI Solutions & Product Development Company**. Public profiles open from a URL, NFC tag, or real downloadable QR code without login or installation. V2 adds a grounded AI business representative on each founder profile, an administration area for the content it answers from, and lead, conversation and cost reporting.

## Architecture

Next.js stable App Router, TypeScript, Tailwind CSS, lightweight CSS holographic effects, Framer Motion with reduced-motion support, and Supabase PostgreSQL/Auth. Public pages are server components; motion, profile interactions and the assistant panel are client components. No Three.js. The assistant is a retrieval-grounded business representative answering only from approved knowledge, not an open-ended chatbot. Normalized companies, profiles, expertise, social links, admin users, anonymous events, knowledge, solutions, questions, leads, conversations and AI usage support additional profiles without new routes or duplicated UI. Provider SDKs are confined to `src/lib/ai/providers/*`; the chat route, prompt builder and storage layer never import a vendor.

- `/`: company and public profile directory; `/vsp-innovations` redirects here.
- `/[slug]`: independent profile, accessible actions, about, expertise, company and founder discovery.
- `/api/profiles/[slug]/vcard`: escaped, UTF-8 folded vCard 3.0 download.
- `/api/profiles/[slug]/qr`: server-generated SVG QR; `?download=1` downloads it.
- `/api/events`: validates anonymous events; never accepts browser service credentials.
- `/api/ai/chat`: server-sent-events assistant endpoint. Validates input, enforces rate and spend limits, retrieves approved knowledge, strips the model's control block and stores only visitor and assistant turns.
- `/login`, `/admin`: password sign-in and authorization by admin membership. Overview (last-30-day events, conversations, leads, meeting intent and estimated cost), Profiles, AI identity, Knowledge, Solutions, Questions, Leads, Conversations and AI usage.

Without Supabase environment variables, public routes use explicitly marked starter data from `src/lib/seed.ts` and `src/lib/ai/seed.ts`. Analytics returns HTTP 503 and internal access displays setup instructions. No simulated activity or authentication is presented as real. With Supabase configured, database errors surface instead of falling back to starter data.

## Local installation

Use Node.js 20.9+ (Node 24 used for development).

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Production verification:

```sh
npm run typecheck
npm run lint
npm run build
npm run start
```

## Environment variables

| Variable                        | Purpose                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`          | Canonical absolute origin, e.g. `https://connect.vspinnovations.com`; used for QR/share/vCard URLs. Set before building. |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                                                                     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable legacy anon API key, protected by RLS                                                                        |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only key for event ingestion, knowledge retrieval, conversation/lead storage and usage records; never prefix with `NEXT_PUBLIC_` |
| `ANTHROPIC_API_KEY`             | Server-only provider credential. Absent, the assistant reports itself unavailable and profiles keep their contact and booking actions   |
| `AI_PROVIDER`, `AI_MODEL`       | Registered provider (`anthropic`) and model id. An unregistered provider degrades to the same unavailable fallback                      |
| `AI_*` limits                   | Optional message length, per-conversation/session/profile rate, history, output token, retrieval, timeout and daily spend ceilings      |

Every `AI_*` limit has a default and is listed with it in `.env.example`, so cost and abuse controls can be tuned without a code change or a migration. `.env.local` is ignored. `.env.example` contains no credentials. No private visitor data is stored in localStorage or cookies. Auth cookies are used only for the team login.

## Supabase setup and migration

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial.sql` in the SQL editor once, then `supabase/migrations/002_ai_representative.sql`, then `supabase/seed.sql` and `supabase/seed_ai.sql`. Migrations are transactional and must not be rerun over an existing schema; the seeds are repeatable. `002` adds the V2 tables and functions and replaces the V1 four-argument `record_analytics_event` with a five-argument version, so apply it before deploying V2 code.
3. Set the environment variables and restart the app.
4. In Auth settings disable public sign-ups; create/invite internal users using the Supabase dashboard. Set their password through your organization’s provisioning process. There is intentionally no public signup UI.
5. Grant specific users access from the SQL editor:

```sql
insert into public.admin_users(user_id) values ('REPLACE_WITH_AUTH_USER_UUID');
```

6. Sign in at `/login`. Ordinary authenticated users cannot view analytics, edit profiles, or read knowledge, leads or conversations. Admin membership cannot be self-assigned from the browser.

Knowledge, AI identity, leads, conversations, messages and usage have no anonymous read policy at all: only administrators read them through their own session, and the server reaches them with its service key. Active solutions and suggested questions are the only V2 tables with a public read policy, because they appear on the profile before a conversation starts. `persona_instructions` is never selected by a browser client; public pages call `ai_public_config()`, which returns only whether the assistant is on and how it introduces itself.

RLS permits public reads of active profiles and their expertise/social links. Company records are public. Only admins may insert/update/delete profile/company/related content through authenticated Supabase clients; V1 content editing is performed in Supabase Studio or via an authenticated client, not a custom CMS. Events have no public SELECT/INSERT policies; the server validates events and uses its service key. Admin event reads and the SQL aggregation function respect RLS. Updated-at triggers and indexes are included.

Verify policies in your project with an anon client, a non-admin account, and an admin account before launch. Live auth/database verification requires your credentials and cannot be replaced by local fallback tests.

## AI business representative

Each founder profile offers an assistant that answers as that founder's representative. It is scoped, grounded and reviewable rather than open-ended.

**Grounding.** Every turn retrieves at most `AI_KNOWLEDGE_LIMIT` rows through `search_knowledge()`, which returns company-wide knowledge plus that founder's own rows and never another founder's. Retrieved text is placed in a labelled data block the prompt identifies as reference material, not instructions. The model is told to decline anything absent from that block rather than estimate it, and is specifically barred from inventing prices, customer names, partnerships, case studies, certifications, team size, revenue, biography details or timelines. If knowledge is missing, the answer is "I don't have that information in my approved profile yet" plus a contact or booking next step.

**Actions, not markup.** The model never emits links, HTML or scripts. It may end a reply with one control block naming predefined actions (`SAVE_CONTACT`, `BOOK_MEETING`, `OPEN_WHATSAPP`, `OPEN_EMAIL`, `OPEN_WEBSITE`, `SHOW_SOLUTION`) and any details the visitor volunteered. The block is stripped from the stream before it reaches the browser, parsed against a closed schema, and checked against the actions actually configured for that founder and the solutions actually loaded for that request. The browser repeats both steps on the stream it receives, so a proxy or a partially streamed sentinel cannot render the side-channel as prose. Destinations come from trusted profile data; visible model output is rendered as React elements with no `dangerouslySetInnerHTML`.

**Leads.** A lead row is written only when the visitor supplied an email, a phone number, or both a name and a company. Interest alone is a conversation, not a lead. Fields are never overwritten with blanks, one lead is attached per conversation, and the visitor is told when their details have been shared. The model is instructed never to invent or complete a visitor's details.

**Limits.** `ai_rate_check()` enforces per-conversation, per-session-hour and per-profile-minute visitor turn caps inside a transaction lock. `ai_spend_today()` pauses generation once the estimated daily spend reaches `AI_DAILY_COST_LIMIT_USD`. Without Supabase a process-local limiter applies, so a development instance is still not an open AI proxy. Every refusal is surfaced as guidance with working contact and booking actions, never as a broken page.

**Cost.** `ai_usage` records provider, model, token counts and an estimate derived from published per-token rates in `src/lib/ai/pricing.ts`. These are estimates, not billed amounts; reconcile against the provider invoice and update the rate table when pricing changes. A model missing from the table is estimated at the most expensive known tier and flagged in the usage view: the daily spend guard reads these rows, so recording an unknown model as free would switch that guard off without any signal. Set a provider-side spend limit as well — `AI_DAILY_COST_LIMIT_USD` only bounds what this application itself records.

**Content management.** Administrators manage the assistant at `/admin`: AI identity (on/off, introduction, internal persona instructions, focus areas) per founder, knowledge entries by category and scope, solutions, suggested questions, profile contact fields, lead statuses, conversation transcripts and usage. A founder whose `profile_ai_config` row is missing or disabled shows no assistant at all, so the feature stays off until content is approved rather than answering unconfigured.

**Privacy.** Only visitor and assistant turns are stored; system instructions, retrieved knowledge and internal persona text are not. The anonymous session identifier lives in `sessionStorage`, not a cookie or `localStorage`, so it is per tab and not a durable cross-visit identifier. Set a retention schedule for `conversations`, `messages` and `leads` appropriate to your policy, and state your handling of chat content in your privacy notice before public launch.

## Content and adding profiles

Replace the placeholder biographies, monogram avatars, and missing contact fields in Supabase Studio. Missing phone/email/WhatsApp/LinkedIn/website/booking values are `NULL`, visibly unavailable, and omitted from vCards. No personal details have been invented. The geometric VSP wordmark is a starter brand treatment; replace it with approved artwork in `src/components/brand.tsx`.

Create a `profiles` row with a unique slug, company ID, full name, title, headline, biography, and `active=true`. Use UUID defaults for new rows. Add `expertise` and `social_links` rows with `profile_id` and `sort_order`. Profile routes and discovery update automatically. Add company rows as needed; the root directory currently represents VSP. Reserved profile slugs are enforced by SQL.

Set phone in international format, WhatsApp as international digits, email as an actual address, HTTPS social/website URLs, and `booking_url` as an external `https://cal.com/...` URL. Provide optimized, appropriately sized HTTPS portrait images (recommended WebP under 100 KB); images render at fixed sizes to avoid layout shifts. Remote portraits are served directly rather than proxied through an unrestricted image optimizer. Company website and profile links are configurable. Company logo is reserved in the schema for future brand configuration; the current UI uses the shared mark component.

## NFC and QR

Write the canonical profile URL to an NFC tag as a standard NDEF URL record, for example:

```
https://connect.vspinnovations.com/arjun-devireddy
https://connect.vspinnovations.com/kavya-kelam
```

No NFC hardware integration is required in the application. A tap opens the browser. Optionally append `?source=nfc` for source attribution. A QR interaction can be tagged `?source=qr` when generating printed campaigns; the built-in QR points directly to the canonical profile URL. `qr_view` means the visitor opened the QR dialog, not that another device scanned it. Verify NFC and printed QR on physical iPhone and Android devices before distributing cards. Never print localhost QR codes: configure the production origin first.

Open a profile’s QR button to view or download the actual SVG. Each code is generated with error correction and a quiet zone. Keep the code black on white and preserve the surrounding margin when printing.

## Analytics and privacy

Events: profile_view, save_contact, call_clicked, email_clicked, whatsapp_clicked, linkedin_clicked, website_clicked, booking_clicked, profile_shared, qr_view, and the V2 additions ai_opened, ai_message_sent, suggested_question_clicked, lead_started, lead_created, meeting_intent, solution_viewed and booking_from_ai. `solution_viewed` carries an allowlisted solution slug as its only metadata; nothing else from a conversation is written to analytics. Store profile ID, server timestamp, referrer hostname (never query/path), and optional allowlisted `nfc`/`qr`/`direct` source. No names, IPs, fingerprints, session identifiers, or visitor emails are persisted. Counts represent interactions rather than unique users or completed calls/bookings. Additional arbitrary social links are rendered but not categorized as LinkedIn events.

Events are best-effort; blocked requests or offline clients do not prevent contact actions. A database transaction enforces a shared cap of 240 events per profile per minute without storing visitor identifiers; V2 raised it from 120 because the assistant adds events. This cap can discard legitimate bursts and is configurable in the migration. Public telemetry can be spoofed; configure Vercel Firewall rate limiting on `/api/events` before public launch, with a suitable request budget for event traffic. Do not use these counts for billing. Set a retention schedule appropriate to your needs, e.g. a monthly SQL job deleting events older than 90 days. Service-role access is intentionally restricted to this ingestion module.

## Deployment

Import the repository into Vercel using the Next.js preset. Add environment variables to the relevant environment, apply migrations/seed to the matching Supabase project, configure the custom domain and canonical site URL, then deploy. Confirm HTTPS, production profile URLs, QR downloads and authenticated analytics before printing NFC cards. Do not deploy demo data as verified founder information. Credentials, final founder details, and brand approval must be supplied by VSP.

## Testing

```sh
npx playwright install chromium
npm run build
npm test
npm run test:database
npm run test:contact
npm run test:ai
```

`npm run test:ai` covers control-block stripping at every chunk boundary, structured-output validation, lead qualification rules, prompt-injection neutralising, founder knowledge isolation and cost estimates without a provider key or a database. On a memory-constrained machine the build's page-data step can be capped with `NEXT_BUILD_CPUS=2 npm run build`, and Playwright with `--workers=1`; both are environment knobs, not behaviour changes.

Browser tests cover both founder routes, mobile/tablet/desktop overflow, contact download, real QR responses and dialog behavior, clipboard/native sharing with browser API stubs, missing contact states, unknown routes, input validation, and protected setup state. The assistant suite additionally covers per-founder identity and scoping, streamed answers with the control block hidden, model output rendered as inert text, conversation continuation and clearing, merged server and client actions, rejection of an unknown solution, lead confirmation, provider-failure and rate-limit fallbacks, endpoint validation, and an axe pass on the open panel. Assistant tests use a scripted server-sent-events mock: no provider is called and no model output is asserted as correct. Sharing stubs test application behavior, not device OS share sheets. Live Supabase event persistence, RLS and authenticated dashboards must additionally be tested against a configured project. Real phone, mail, WhatsApp, LinkedIn and Cal.com destinations must be checked after owners provide them. See `VSP_CONNECT_MEMORY.md` for actual verification results and outstanding launch work.

## Future foundation

V2 added the knowledge base, assistant and lead workflow on these UUIDs. Team ownership, NFC inventory, wallets and CRM integrations remain unbuilt and are not represented as working features. Extend with related tables, new numbered migrations and scoped RLS rather than placing profile content into one JSON blob. A second AI vendor is a new file in `src/lib/ai/providers/` implementing `AIProvider` plus one registry line.

Build tooling: production builds use Next.js’s supported Webpack mode because Turbopack subprocess binding is restricted in this workspace. CommonJS PostCSS configuration avoids a Next.js ESM path-resolution issue with the literal `%20` in the workspace path. Local PostgreSQL tests use PGlite and a minimal Auth schema stub; they verify SQL permissions and aggregation, not the hosted Supabase Auth service.
.
