# VSP Connect — development memory

Last updated: 2026-09-17.

## Product constraints

V1 is a digital business identity experience, not an AI agent platform. VSP Innovations is an AI Solutions & Product Development Company. Independent founder URLs, NFC URL records and real QR codes are central. No fabricated personal contact information, portraits, verification claims, analytics or AI features. Starter biographies and geometric brand treatment require founder approval.

## Architecture decisions

- Next.js 16.3.5 App Router, React 19.3, TypeScript, Tailwind 4, Framer Motion, Supabase SSR/Auth and PostgreSQL; versions locked in package-lock.json.
- CSS-generated holographic identity artwork; no image generation, stock founder photos, Three.js, external fonts or heavy 3D assets.
- Data-driven profiles through normalized tables, not profile JSON. Dynamic root/profile pages reflect content changes without rebuilds; React cache deduplicates data reads within a request.
- Without Supabase, explicit local starter data renders. With Supabase, failures surface as errors. No mock success for analytics or admin authentication.
- Server-only service key limited to event ingestion. Admin access requires an Auth user and membership in admin_users. Auth cookie refresh proxy only covers internal routes.
- Native sharing with clipboard fallback, real server-rendered QR SVG, escaped/folded vCard 3.0.
- Production Webpack build selected because workspace sandbox blocks Turbopack subprocess ports. PostCSS uses .cjs because Next's ESM config resolution mishandles the literal `%20` in the workspace path.

## Completed implementation

- Premium responsive company landing page, independent Arjun and Kavya profiles, subtle team discovery.
- Monogram portrait placeholders; dynamic configurable contact and social links, biographies and expertise.
- Save contact, actual QR modal/download, native/clipboard share, external Cal.com booking when configured.
- Semantic layout, skip navigation, focus states, reduced-motion support, keyboard-dismissable native QR dialog.
- Anonymous analytics validation, hostname-only referrer, allowlisted source and event types, server timestamps.
- Database-enforced cap of 120 events per profile per minute using a transaction lock; no visitor identifier.
- Protected login/dashboard with 30-day aggregate metrics and founder comparison; empty and failure states.
- README, environment template, migrations, repeatable seeds, browser and database verification scripts.

## Database changes

`supabase/migrations/001_initial.sql` creates companies, profiles, social_links, expertise, analytics_events and admin_users, constraints, indexes, updated-at triggers, RLS policies, admin membership check, analytics_summary aggregation and service-only record_analytics_event RPC. `supabase/seed.sql` adds both founders and expertise with NULL missing contact values. Apply migration once, then seed. Do not rerun the initial migration over an existing schema; future changes require new numbered migrations.

## Verification performed

- Dependencies installed; npm audit reported zero vulnerabilities at install time.
- TypeScript and lint passed; production Webpack build passed.
- Final browser suite passed all 24 tests on desktop, iPhone 13, Pixel 7 and iPad Mini Chromium viewport emulation. Automated axe WCAG A/AA checks found no violations on company, both profiles, and login pages. Analytics payload tests verified profile scoping and allowlisted anonymous fields.
- Both founders' displayed QR codes decoded from screenshots to their exact canonical local URLs.
- Contact downloads, route isolation, no horizontal overflow, native-share/clipboard stubs, unavailable contacts, event validation and unauthenticated admin setup state passed.
- PGlite executed the SQL migration/seeds and verified anon, ordinary authenticated, admin and service-role permissions, real event persistence, rate cap and dashboard aggregation. Auth schema was a test stub; this is not hosted Supabase Auth verification.
- Configured external action URLs verified with reserved synthetic fixtures; vCard escaping/folding and unsafe URL rejection passed.
- Desktop company and mobile profile screenshots manually inspected; artifacts stored in `artifacts/`.

## Pending launch work / limitations

- No Supabase project credentials were supplied. Hosted Auth login/logout/refresh, event API-to-Supabase persistence and real dashboard must be tested after environment configuration and migration. Live launch is not complete until these pass.
- Founders must supply actual contact details, portrait images, LinkedIn/website/Cal.com URLs and approved biography/brand assets. External destination services cannot be validated while fields are NULL. Synthetic test data is not published.
- Set NEXT_PUBLIC_SITE_URL to the HTTPS production domain before building, printing QR or programming NFC. localhost is development-only.
- Physical iOS/Android contact imports, native OS sharing, NFC taps and printed QR scans remain device acceptance tests; Chromium viewport emulation does not establish Safari or physical hardware compatibility.
- Content management uses Supabase Studio or authenticated Supabase clients; no custom profile-editing CMS in V1. Company logo schema field is available, shared UI mark currently comes from brand.tsx.
- Counts measure events, not unique people or completed calls/bookings. Public ingestion may be spoofed; add edge firewall limits and a retention job before public launch. The shared per-profile cap may drop busy legitimate traffic.
- No deployment was performed. No Lighthouse score is claimed. No secrets were created or committed.

## Repository setup

- User authorized creation of a private GitHub repository and initial push on 2026-09-17.
- Local GitHub PAT is stored only in ignored `.env.local`; never include it in commits or remote URLs.
- Target repository: `vspteam777/vsp-connect`.
