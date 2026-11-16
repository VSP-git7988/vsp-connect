import { test, expect } from "@playwright/test";
const accents = [
  "rgb(63, 208, 194)",
  "rgb(184, 166, 255)",
  "rgb(244, 183, 64)",
  "rgb(96, 165, 250)",
  "rgb(74, 222, 128)",
  "rgb(244, 114, 182)",
];
for (const width of [1440, 390])
  test(`US portfolio interactions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/us/arjun-devireddy");
    const cards = page.locator(".portfolio-card-us");
    await expect(cards).toHaveCount(9);
    for (let i = 0; i < 9; i++) {
      const card = cards.nth(i);
      await expect(card.locator("h3")).toHaveCSS("color", accents[i % 6]);
      await expect(card.locator("p")).not.toBeEmpty();
      await expect(card.locator("h3 + p")).toHaveCount(1);
      await expect(card.locator(".eyebrow")).toHaveCount(0);
      const contrast = await card.evaluate((el) => {
        const luminance = (color: string) => {
          const channels = color
            .match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const c = v / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            });
          return (
            channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
          );
        };
        const bg = luminance(getComputedStyle(el).backgroundColor);
        const title = luminance(
          getComputedStyle(el.querySelector("h3")!).color,
        );
        const description = luminance(
          getComputedStyle(el.querySelector("p")!).color,
        );
        return {
          title: (Math.max(bg, title) + 0.05) / (Math.min(bg, title) + 0.05),
          description:
            (Math.max(bg, description) + 0.05) /
            (Math.min(bg, description) + 0.05),
        };
      });
      expect(contrast.title).toBeGreaterThanOrEqual(4.5);
      expect(contrast.description).toBeGreaterThanOrEqual(4.5);
      if (i < 6) console.log(`Accent ${i + 1}: ${contrast.title.toFixed(2)}:1`);
      const resting = await card.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          background: s.backgroundColor,
          color: s.color,
          border: s.borderTopColor,
        };
      });
      await card.hover();
      for (const side of ["top", "right", "bottom", "left"])
        await expect(card).toHaveCSS(`border-${side}-color`, accents[i % 6]);
      await expect(card).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -2)");
      await expect(card).toHaveCSS("background-color", resting.background);
      await expect(card).toHaveCSS("color", resting.color);
      expect(
        await card.evaluate((el) => getComputedStyle(el).boxShadow),
      ).not.toBe("none");
      if (i === 0)
        await page.screenshot({
          path: `artifacts/us-portfolio-hover-${width}.png`,
          fullPage: true,
        });
      await page.mouse.move(0, 0);
      await expect(card).toHaveCSS("border-top-color", resting.border);
    }
    const first = cards.first();
    await first.focus();
    await expect(first).toHaveCSS("border-top-color", accents[0]);
    await page.keyboard.press("Tab");
    await expect(first.locator("a")).toBeFocused();
    await expect(first).toHaveCSS("border-bottom-color", accents[0]);
    await page.screenshot({
      path: `artifacts/us-portfolio-focus-${width}.png`,
      fullPage: true,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(first).toHaveCSS("transform", "none");
    await expect(first).toHaveCSS("box-shadow", "none");
    await expect(first).toHaveCSS("border-top-color", accents[0]);
    await cards.nth(1).hover();
    await expect(cards.nth(1)).toHaveCSS("border-top-color", accents[1]);
    await expect(cards.nth(1)).toHaveCSS("transform", "none");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
