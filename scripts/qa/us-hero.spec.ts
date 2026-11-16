import { test, expect } from "@playwright/test";
for (const width of [1440, 390])
  test(`US hero and portfolio at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/us");
    await expect(
      page.getByRole("heading", { name: "One mind. One vision." }),
    ).toHaveCount(1);
    await expect(page.locator(".hero-art .eyebrow")).toHaveText(
      "THE PERSON BEHIND THE POSSIBILITIES",
    );
    await expect(page.locator("#people")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /Meet our founder/ }),
    ).toHaveCount(0);
    await expect(page.locator(".art-caption")).toHaveCount(0);
    await expect(page.getByText("Scan me", { exact: true })).toBeVisible();
    await expect(page.locator(".hero-card .view-profile")).toBeVisible();
    await expect(page.locator(".hero-card-qr")).toHaveJSProperty(
      "complete",
      true,
    );
    expect(
      await page.locator(".hero-card-qr").evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    const prompt = await page.locator(".hero-scan-prompt").boundingBox();
    const link = await page.locator(".hero-card .view-profile").boundingBox();
    expect(Math.abs(prompt!.y - link!.y)).toBeLessThan(25);
    await expect(page.locator(".hero-card")).toHaveAttribute(
      "href",
      "/us/arjun-devireddy",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/us-landing-${width}.png`,
      fullPage: true,
    });
    await page.goto("/us/arjun-devireddy");
    await expect(page.locator(".portfolio-card")).toHaveCount(9);
    await expect(
      page.locator(".portfolio-card .eyebrow,.portfolio-card p"),
    ).toHaveCount(0);
    await expect(page.locator(".portfolio-card img")).toHaveCount(4);
    for (const img of await page.locator(".portfolio-card img").all())
      await expect(img).toHaveJSProperty("naturalWidth", 1200);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/us-profile-${width}.png`,
      fullPage: true,
    });
    await page.goto("/");
    await expect(page.locator("#people")).toBeVisible();
    await expect(page.locator(".art-caption")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Meet our founders/ }),
    ).toBeVisible();
    await expect(page.getByText("Scan me", { exact: true })).toHaveCount(0);
  });
