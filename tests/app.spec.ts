import jsQR from "jsqr";
import { PNG } from "pngjs";
import { test, expect } from "@playwright/test";
test("company page and independent profiles are responsive", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Great things start with a connection.",
    }),
  ).toBeVisible();
  for (const [slug, name] of [
    ["arjun-devireddy", "Arjun Devireddy"],
    ["kavya-kelam", "Kavya Kelam"],
  ]) {
    await page.goto("/" + slug);
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel("Call: not configured")).toBeVisible();
    await expect(
      page.getByText("Not configured", { exact: true }),
    ).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Save contact" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(slug + ".vcf");
    await page.getByRole("button", { name: "Show profile QR code" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("img", { name: `QR code linking to ${name}'s profile` }),
    ).toBeVisible();
    const png = PNG.sync.read(
      await page
        .getByRole("img", { name: `QR code linking to ${name}'s profile` })
        .screenshot(),
    );
    const decoded = jsQR(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    expect(decoded?.data).toBe(`http://localhost:3000/${slug}`);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});
test("share fallback copies the correct URL and native share receives profile data", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          (window as unknown as { copied: string }).copied = text;
        },
      },
      configurable: true,
    });
  });
  await page.goto("/arjun-devireddy");
  await page
    .getByRole("button", { name: "Share profile", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Profile link copied.");
  expect(
    await page.evaluate(() => (window as unknown as { copied: string }).copied),
  ).toContain("/arjun-devireddy");
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: async (data: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = data;
      },
      configurable: true,
    }),
  );
  await page
    .getByRole("button", { name: "Share profile", exact: true })
    .click();
  expect(
    await page.evaluate(
      () => (window as unknown as { shared: ShareData }).shared.title,
    ),
  ).toBe("Arjun Devireddy");
});
test("API validates events, serves cards and unique real QR SVGs", async ({
  request,
}) => {
  const arjun = await request.get("/api/profiles/arjun-devireddy/vcard");
  expect(arjun.status()).toBe(200);
  const text = await arjun.text();
  expect(text).toContain("FN:Arjun Devireddy");
  expect(text).not.toContain("TEL");
  expect(text).toContain("END:VCARD\r\n");
  const a = await (
    await request.get("/api/profiles/arjun-devireddy/qr")
  ).text();
  const b = await (await request.get("/api/profiles/kavya-kelam/qr")).text();
  expect(a).toContain("<svg");
  expect(a).not.toBe(b);
  expect(
    (
      await request.post("/api/events", { data: { event_type: "fake" } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/events", {
        data: {
          profile_id: "00000000-0000-4000-8000-000000000011",
          event_type: "profile_view",
        },
      })
    ).status(),
  ).toBe(503);
  expect(
    (
      await request.post("/api/events", {
        headers: { origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect((await request.get("/api/profiles/missing/vcard")).status()).toBe(404);
});
test("admin routes remain protected without configuration", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Connect Supabase to continue" }),
  ).toBeVisible();
  await page.goto("/unknown-person");
  await expect(
    page.getByRole("heading", { name: "This profile isn’t available." }),
  ).toBeVisible();
});

test("public pages pass automated accessibility checks", async ({ page }) => {
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  for (const route of ["/", "/arjun-devireddy", "/kavya-kelam", "/login"]) {
    await page.goto(route);
    await page.waitForTimeout(600);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
test("profile interactions emit scoped anonymous event payloads", async ({
  page,
}) => {
  const events: Record<string, unknown>[] = [];
  await page.route("**/api/events", async (route) => {
    events.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: '{"recorded":true}',
    });
  });
  await page.goto("/kavya-kelam?source=nfc");
  await page.getByRole("button", { name: "Show profile QR code" }).click();
  await expect.poll(() => events.length).toBe(2);
  expect(events.map((e) => e.event_type)).toEqual(["profile_view", "qr_view"]);
  for (const event of events) {
    expect(event.profile_id).toBe("00000000-0000-4000-8000-000000000012");
    expect(event.source).toBe("nfc");
    expect(Object.keys(event).sort()).toEqual([
      "event_type",
      "profile_id",
      "referrer",
      "source",
    ]);
  }
});
