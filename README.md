# VSP Connect

A mobile-first digital business identity platform for VSP Innovations, an **AI Solutions & Product Development Company**. Public profiles open from a URL, NFC tag, or real downloadable QR code without login or installation.

## Architecture

Next.js stable App Router, TypeScript, Tailwind CSS, lightweight CSS holographic effects, Framer Motion with reduced-motion support, and Supabase PostgreSQL/Auth. Public pages are server components; motion and profile interactions are small client components. No Three.js or AI chatbot. Normalized companies, profiles, expertise, social links, admin users and anonymous events support additional profiles without new routes or duplicated UI.

- `/`: company and public profile directory; `/vsp-innovations` redirects here.
- `/[slug]`: independent profile, accessible actions, about, expertise, company and founder discovery.
- `/api/profiles/[slug]/vcard`: escaped, UTF-8 folded vCard 3.0 download.
- `/api/profiles/[slug]/qr`: server-generated SVG QR; `?download=1` downloads it.
- `/api/events`: validates anonymous events; never accepts browser service credentials.
- `/login`, `/admin`: password sign-in, authorization by admin membership, last-30-day event totals and founder comparison.

Without Supabase environment variables, public routes use explicitly marked starter data from `src/lib/seed.ts`. Analytics returns HTTP 503 and internal access displays setup instructions. No simulated activity or authentication is presented as real. With Supabase configured, database errors surface instead of falling back to starter data.

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
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-only event ingestion key; never prefix with `NEXT_PUBLIC_`                                                        |

`.env.local` is ignored. `.env.example` contains no credentials. No private visitor data is stored in localStorage or cookies. Auth cookies are used only for the team login.

## Supabase setup and migration

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial.sql` in the SQL editor once, then `supabase/seed.sql`. The migration is transactional; the seed is repeatable.
3. Set the environment variables and restart the app.
4. In Auth settings disable public sign-ups; create/invite internal users using the Supabase dashboard. Set their password through your organization’s provisioning process. There is intentionally no public signup UI.
5. Grant specific users access from the SQL editor:

```sql
insert into public.admin_users(user_id) values ('REPLACE_WITH_AUTH_USER_UUID');
```

6. Sign in at `/login`. Ordinary authenticated users cannot view analytics or edit profiles. Admin membership cannot be self-assigned from the browser.

RLS permits public reads of active profiles and their expertise/social links. Company records are public. Only admins may insert/update/delete profile/company/related content through authenticated Supabase clients; V1 content editing is performed in Supabase Studio or via an authenticated client, not a custom CMS. Events have no public SELECT/INSERT policies; the server validates events and uses its service key. Admin event reads and the SQL aggregation function respect RLS. Updated-at triggers and indexes are included.

Verify policies in your project with an anon client, a non-admin account, and an admin account before launch. Live auth/database verification requires your credentials and cannot be replaced by local fallback tests.

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

Events: profile_view, save_contact, call_clicked, email_clicked, whatsapp_clicked, linkedin_clicked, website_clicked, booking_clicked, profile_shared, qr_view. Store profile ID, server timestamp, referrer hostname (never query/path), and optional allowlisted `nfc`/`qr`/`direct` source. No names, IPs, fingerprints, session identifiers, or visitor emails are persisted. Counts represent interactions rather than unique users or completed calls/bookings. Additional arbitrary social links are rendered but not categorized as LinkedIn events.

Events are best-effort; blocked requests or offline clients do not prevent contact actions. A database transaction enforces a shared cap of 120 events per profile per minute without storing visitor identifiers. This cap can discard legitimate bursts and is configurable in the migration. Public telemetry can be spoofed; configure Vercel Firewall rate limiting on `/api/events` before public launch, with a suitable request budget for event traffic. Do not use these counts for billing. Set a retention schedule appropriate to your needs, e.g. a monthly SQL job deleting events older than 90 days. Service-role access is intentionally restricted to this ingestion module.

## Deployment

Import the repository into Vercel using the Next.js preset. Add environment variables to the relevant environment, apply migrations/seed to the matching Supabase project, configure the custom domain and canonical site URL, then deploy. Confirm HTTPS, production profile URLs, QR downloads and authenticated analytics before printing NFC cards. Do not deploy demo data as verified founder information. Credentials, final founder details, and brand approval must be supplied by VSP.

## Testing

```sh
npx playwright install chromium
npm run build
npm test
npm run test:database
npm run test:contact
```

Browser tests cover both founder routes, mobile/tablet/desktop overflow, contact download, real QR responses and dialog behavior, clipboard/native sharing with browser API stubs, missing contact states, unknown routes, input validation, and protected setup state. Sharing stubs test application behavior, not device OS share sheets. Live Supabase event persistence, RLS and authenticated dashboards must additionally be tested against a configured project. Real phone, mail, WhatsApp, LinkedIn and Cal.com destinations must be checked after owners provide them. See `VSP_CONNECT_MEMORY.md` for actual verification results and outstanding launch work.

## Future foundation

Profile/company UUIDs can anchor future knowledge bases, assistants, lead workflows, team ownership, NFC inventory, wallets and CRM integrations. None are represented as working V1 features. Extend with related tables and scoped RLS rather than placing profile content into one JSON blob.

Build tooling: production builds use Next.js’s supported Webpack mode because Turbopack subprocess binding is restricted in this workspace. CommonJS PostCSS configuration avoids a Next.js ESM path-resolution issue with the literal `%20` in the workspace path. Local PostgreSQL tests use PGlite and a minimal Auth schema stub; they verify SQL permissions and aggregation, not the hosted Supabase Auth service.
