import { test, expect } from "@playwright/test";
test.setTimeout(120_000);
for (const width of [1440, 390]) {
  test(`US region at ${width}px preserves regional boundaries`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/us", "/us/arjun-devireddy"]) {
      await page.goto(path);
      await expect(page.locator("header").getByText("Our people")).toHaveCount(
        0,
      );
      await expect(page.locator("footer a")).toHaveCount(0);
      await expect(page.locator("footer")).toContainText("All rights reserved");
      await expect(page.getByText("14+ years of experience")).toBeVisible();
      await expect(
        page.getByText("Building AI solutions & intelligent products.", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (path === "/us") {
        await expect(page.locator(".capabilities > div")).toHaveCount(3);
        await expect(
          page.getByText("Intelligence that works for you.", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("From possibility to product.", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("Less friction. More forward.", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByText("THIS IS VSP INNOVATIONS PVT LTD", { exact: true }),
        ).toBeVisible();
      } else {
        await expect(page.locator(".profile-company")).toHaveCount(0);
        await expect(page.locator(".profile-details > section")).toHaveCount(0);
        await expect(
          page.getByRole("link", { name: "Back", exact: true }),
        ).toHaveAttribute("href", "/us");
        await expect(
          page.getByRole("heading", { name: "Portfolio", exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByText("Full-stack web applications", { exact: true }),
        ).toBeVisible();
      }
      if (path !== "/us") {
        await page.getByRole("button", { name: /Ask my AI/ }).click();
        await expect(page.locator(".ai-privacy")).toHaveCount(0);
        await page.getByRole("button", { name: "Close assistant" }).click();
      }
      await page.screenshot({
        path: `artifacts/us-${path === "/us" ? "landing" : "profile"}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto("/arjun-devireddy");
    await expect(page.locator(".profile-company")).toBeVisible();
    await expect(page.locator("header").getByText("Our people")).toBeVisible();
    await expect(
      page.locator("footer").getByRole("link", { name: "Privacy" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Building AI solutions & intelligent products.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText("14+ years of experience")).toHaveCount(0);
  });
}
