import { test, expect } from "@playwright/test";
import fs from "node:fs";
const content = JSON.parse(
  fs.readFileSync(
    new URL("../../supabase/content/us-arjun.json", import.meta.url),
    "utf8",
  ),
);
for (const width of [1440, 390]) {
  test(`US service cards and regional booking at ${width}px`, async ({
    page,
    request,
  }) => {
    await request.get(
      "http://127.0.0.1:43130/__booking?value=" +
        encodeURIComponent("https://cal.com/us-test-fixture/meeting"),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/us/arjun-devireddy");
    await expect(
      page.getByRole("heading", { name: "Arjun Devireddy", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".profile-details .expertise")).toHaveCount(0);
    await expect(page.locator(".profile-company")).toHaveCount(0);
    await expect(page.locator(".profile-details")).toHaveCount(0);
    await expect(
      page.getByText("A LITTLE ABOUT ME", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".us-service-card")).toHaveCount(6);
    for (const card of await page.locator(".us-service-card").all()) {
      await expect(card.locator("h3")).toBeVisible();
      if ((await card.locator("h3").innerText()) !== "Intelligence System")
        await expect(card.locator("p")).not.toBeEmpty();
      await expect(card.locator("svg")).toHaveCount(1);
    }
    expect(
      await page
        .locator(".us-services-grid")
        .evaluate(
          (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(width === 1440 ? 2 : 1);
    const about = await page.locator(".identity-panel").boundingBox();
    const services = await page.locator(".us-services").boundingBox();
    expect(services!.y - (about!.y + about!.height)).toBeGreaterThanOrEqual(28);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".us-service-card h3")).toHaveText(
      content.services.map((service: { name: string }) => service.name),
    );
    await expect(page.locator(".portfolio-card")).toHaveCount(9);
    await expect(page.locator(".portfolio-card h3")).toHaveText(
      content.portfolio.map((item: { title: string }) => item.title),
    );
    await expect(page.locator(".portfolio-card a")).toHaveCount(4);
    for (const [index, item] of content.portfolio.entries()) {
      const card = page.locator(".portfolio-card").nth(index);
      await expect(card.locator("p")).toHaveText(item.summary);
      if (item.url)
        await expect(card.locator("a")).toHaveAttribute("href", item.url);
      else {
        await expect(card.locator("a")).toHaveCount(0);
        await expect(card).not.toHaveAttribute("role", "link");
      }
    }
    const book = page.getByRole("link", { name: "Book a meeting" });
    await expect(book).toHaveAttribute(
      "href",
      "https://cal.com/us-test-fixture/meeting",
    );
    await expect(book).toHaveAttribute("target", "_blank");
    await expect(page.locator(".meeting-panel")).not.toContainText(
      "Not configured",
    );
    await page.screenshot({
      path: `artifacts/us-profile-${width}.png`,
      fullPage: true,
    });
    // An empty regional value inherits the profile URL rather than hiding booking.
    await request.get("http://127.0.0.1:43130/__booking?value=");
    await page.reload();
    await expect(book).toHaveAttribute(
      "href",
      "https://cal.com/global-test-fixture/meeting",
    );
    await page.goto("/arjun-devireddy");
    await expect(page.locator(".profile-details .expertise")).toBeVisible();
    await expect(page.locator(".profile-company")).toBeVisible();
    await expect(page.locator(".us-services")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Book a meeting" }),
    ).toHaveAttribute("href", "https://cal.com/global-test-fixture/meeting");
  });
}
