// Isolated browser QA with synthetic Supabase data; never changes live data.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import next from "next";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../..", import.meta.url));
const source = path.resolve(root, "../.us-profile-qa");
fs.mkdirSync(source, { recursive: true });
if (!fs.existsSync(path.join(source, "node_modules")))
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(source, "node_modules"),
    "junction",
  );
for (const dir of ["src", "public"])
  fs.cpSync(path.join(root, dir), path.join(source, dir), { recursive: true });
for (const file of [
  "package.json",
  "tsconfig.json",
  "postcss.config.cjs",
  "next-env.d.ts",
  "next.config.ts",
])
  fs.copyFileSync(path.join(root, file), path.join(source, file));
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:43130";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "local-test-fixture";
process.env.NEXT_TELEMETRY_DISABLED = "1";
(async () => {
  const { seedProfiles, company } = await import("../../src/lib/seed.ts");
  const { usServices, usCredential } =
    await import("../../src/lib/us-content.ts");
  const catalogue = JSON.parse(
    fs.readFileSync(
      new URL("../../supabase/content/us-arjun.json", import.meta.url),
      "utf8",
    ),
  );
  let booking = "https://cal.com/us-test-fixture/meeting";
  const fixture = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/__booking") {
      booking = url.searchParams.get("value");
      res.end("ok");
      return;
    }
    let data = [];
    if (url.pathname === "/rest/v1/profiles")
      data = seedProfiles.map((p) => ({
        ...p,
        booking_url:
          p.slug === "arjun-devireddy"
            ? "https://cal.com/global-test-fixture/meeting"
            : null,
      }));
    else if (url.pathname === "/rest/v1/portfolio_items")
      data =
        url.searchParams.get("region_code") === "eq.us"
          ? catalogue.portfolio.map((item, sort_order) => ({
              ...item,
              id: "fixture-project-" + sort_order,
              profile_id: seedProfiles[0].id,
              region_code: "us",
              sort_order,
              active: true,
            }))
          : [];
    else if (url.pathname === "/rest/v1/companies") data = company;
    else if (url.pathname === "/rest/v1/regions")
      data = [
        {
          code: "in",
          name: "India",
          locale: "en-IN",
          default_region: true,
          active: true,
        },
        {
          code: "us",
          name: "United States",
          locale: "en-US",
          default_region: false,
          active: true,
        },
      ];
    else if (url.pathname === "/rest/v1/profile_regions") {
      const region =
        url.searchParams.get("region_code") === "eq.us" ? "us" : "in";
      data = seedProfiles
        .filter((p) => region !== "us" || p.slug === "arjun-devireddy")
        .map((p, i) => ({
          profile_id: p.id,
          region_code: region,
          is_primary: i === 0,
          sort_order: i,
          phone: null,
          email: null,
          whatsapp: null,
          role_title: null,
          credential: region === "us" ? usCredential : null,
          services: region === "us" ? usServices : null,
          booking_url: region === "us" ? booking : null,
        }));
    } else if (url.pathname === "/rest/v1/rpc/ai_public_config")
      data = [{ enabled: true, intro: "Ask about our services." }];
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  });
  await new Promise((resolve) => fixture.listen(43130, "127.0.0.1", resolve));
  const app = next({ dev: true, webpack: true, dir: source });
  await app.prepare();
  const server = http.createServer(app.getRequestHandler());
  await new Promise((resolve) => server.listen(43129, resolve));
  console.log("US QA ready http://localhost:43129");
  const close = () => {
    server.close();
    fixture.close();
    app.close().finally(() => process.exit(0));
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
