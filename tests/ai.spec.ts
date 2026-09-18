import { test, expect, type Page } from "@playwright/test";

const OPEN = "<<<VSP_CONTROL";
const CLOSE = "VSP_CONTROL>>>";

/** Streams a scripted SSE reply, mirroring the real endpoint's frames. */
async function mockAssistant(
  page: Page,
  reply: string,
  options: {
    chunk?: number;
    capture?: Record<string, unknown>[];
    final?: { actions?: unknown[]; leadCaptured?: boolean };
  } = {},
) {
  await page.route("**/api/ai/chat", async (route) => {
    options.capture?.push(route.request().postDataJSON());
    const chunk = options.chunk ?? 6;
    const frames = [
      `event: meta\ndata: {"conversationId":"11111111-1111-4111-8111-111111111111"}\n\n`,
    ];
    for (let i = 0; i < reply.length; i += chunk)
      frames.push(
        `event: delta\ndata: ${JSON.stringify({ text: reply.slice(i, i + chunk) })}\n\n`,
      );
    frames.push(
      `event: final
data: ${JSON.stringify({
        actions: options.final?.actions ?? [],
        leadCaptured: options.final?.leadCaptured ?? false,
      })}

`,
    );
    frames.push(`event: done\ndata: {}\n\n`);
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: frames.join(""),
    });
  });
}

async function openAssistant(page: Page, slug: string) {
  await page.goto(`/${slug}`);
  await page.getByRole("button", { name: /Ask my AI/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("both founders expose an AI representative with their own identity", async ({
  page,
}) => {
  for (const [slug, first] of [
    ["arjun-devireddy", "Arjun"],
    ["kavya-kelam", "Kavya"],
  ]) {
    await openAssistant(page, slug);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toHaveAttribute(
      "aria-label",
      new RegExp(`${first}.*AI representative`),
    );
    await expect(
      dialog.getByText(`${first}'s AI representative`),
    ).toBeVisible();
    await expect(
      dialog.getByText(
        /Messages may be stored to improve follow-up and assist VSP Innovations/,
      ),
    ).toBeVisible();
    // Contextual suggestions, including the founder-specific one.
    await expect(
      dialog.getByRole("button", { name: "What does VSP Innovations build?" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: `Tell me about ${first}.` }),
    ).toBeVisible();
    // The other founder is never offered on this profile.
    const other = first === "Arjun" ? "Kavya" : "Arjun";
    await expect(
      dialog.getByRole("button", { name: `Tell me about ${other}.` }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  }
});

test("the assistant answers, hides its control block and scopes the request", async ({
  page,
}) => {
  const sent: Record<string, unknown>[] = [];
  await mockAssistant(
    page,
    `We build AI voice agents and business assistants.\n${OPEN}{"actions":[{"type":"SAVE_CONTACT"}],"meeting_intent":true}${CLOSE}`,
    { capture: sent, chunk: 3 },
  );
  await openAssistant(page, "kavya-kelam");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "What AI solutions do you offer?" })
    .click();
  await expect(
    dialog.getByText("We build AI voice agents and business assistants."),
  ).toBeVisible();
  // The structured side-channel never reaches the visitor, even split across deltas.
  await expect(dialog.getByText("VSP_CONTROL")).toHaveCount(0);
  await expect(dialog.getByText("meeting_intent")).toHaveCount(0);
  // Predefined actions render as real controls, not model-authored markup.
  await expect(
    dialog.getByRole("link", { name: "Save contact" }),
  ).toBeVisible();
  // The request is scoped to the profile being viewed, with an anonymous session.
  expect(sent).toHaveLength(1);
  expect(sent[0].slug).toBe("kavya-kelam");
  expect(sent[0].message).toBe("What AI solutions do you offer?");
  expect(String(sent[0].session_id)).toMatch(/^[a-f0-9]{32}$/);
  expect(Object.keys(sent[0]).sort()).toEqual([
    "conversation_id",
    "message",
    "session_id",
    "slug",
    "source",
  ]);
});

test("model output is rendered as text, never as markup", async ({ page }) => {
  await mockAssistant(
    page,
    'Here is **bold** text.\n\n- First point\n- Second point\n\n<img src=x onerror="window.pwned=1"> <script>window.pwned=1</script>',
  );
  await openAssistant(page, "arjun-devireddy");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Show me formatting");
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(dialog.getByText("First point")).toBeVisible();
  await expect(dialog.locator("strong", { hasText: "bold" })).toBeVisible();
  await expect(dialog.locator("li")).toHaveCount(2);
  // HTML in model output stays inert literal text.
  await expect(dialog.locator("img")).toHaveCount(0);
  await expect(dialog.getByText("onerror=", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => "pwned" in window)).toBe(false);
});

test("conversation continues, then clears to a new conversation", async ({
  page,
}) => {
  const sent: Record<string, unknown>[] = [];
  await mockAssistant(page, "Happy to help.", { capture: sent });
  await openAssistant(page, "arjun-devireddy");
  const dialog = page.getByRole("dialog");
  const input = dialog.getByRole("textbox");
  await input.fill("First question");
  await input.press("Enter");
  await expect(dialog.getByText("First question")).toBeVisible();
  await input.fill("Second question");
  await input.press("Enter");
  await expect(dialog.getByText("Second question")).toBeVisible();
  // The second turn continues the conversation the server opened.
  expect(sent[0].conversation_id).toBeNull();
  expect(sent[1].conversation_id).toBe("11111111-1111-4111-8111-111111111111");
  await dialog.getByRole("button", { name: "Clear conversation" }).click();
  await expect(dialog.getByText("First question")).toHaveCount(0);
  await input.fill("Fresh start");
  await input.press("Enter");
  // Clearing starts a new conversation but keeps the session, so per-session
  // limits cannot be reset by clearing.
  expect(sent[2].conversation_id).toBeNull();
  expect(sent[2].session_id).toBe(sent[0].session_id);
});

test("provider failure falls back to contact actions without breaking the profile", async ({
  page,
}) => {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: "unavailable",
        message:
          "AI assistant is temporarily unavailable. You can still contact or book with this founder.",
      }),
    }),
  );
  await openAssistant(page, "arjun-devireddy");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Are you there?");
  await dialog.getByRole("button", { name: "Send message" }).click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toContainText("temporarily unavailable");
  await expect(alert.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(alert.getByRole("link", { name: "Save contact" })).toBeVisible();
  // The profile itself keeps working.
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: "Arjun Devireddy", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Save contact" })).toBeVisible();
});

test("rate limiting is surfaced as guidance, not a failure", async ({
  page,
}) => {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: "rate_limited",
        message:
          "You have reached the message limit for now. Please try again later, or contact the founder directly.",
      }),
    }),
  );
  await openAssistant(page, "kavya-kelam");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Another question");
  await dialog.getByRole("button", { name: "Send message" }).click();
  await expect(dialog.getByRole("alert")).toContainText("message limit");
});

test("assistant endpoint validates input and stays server-side", async ({
  request,
}) => {
  // Oversized, malformed and cross-origin requests are refused before any
  // provider call. Without provider credentials the route reports unavailable
  // rather than failing open.
  expect(
    (
      await request.post("/api/ai/chat", { data: { slug: "arjun-devireddy" } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/ai/chat", {
        headers: { origin: "https://untrusted.example" },
        data: {},
      })
    ).status(),
  ).toBe(403);
  const valid = {
    slug: "arjun-devireddy",
    session_id: "a".repeat(32),
    message: "What does VSP Innovations build?",
  };
  expect(
    (
      await request.post("/api/ai/chat", {
        data: { ...valid, session_id: "short" },
      })
    ).status(),
  ).toBe(400);
  const long = await request.post("/api/ai/chat", {
    data: { ...valid, message: "x".repeat(4000) },
  });
  expect(long.status()).toBe(413);
  expect((await long.json()).error).toBe("too_long");
  const unconfigured = await request.post("/api/ai/chat", { data: valid });
  expect(unconfigured.status()).toBe(503);
  expect((await unconfigured.json()).error).toBe("unavailable");
  expect(
    (
      await request.post("/api/ai/chat", { data: { ...valid, slug: "nobody" } })
    ).status(),
  ).toBe(404);
});

test("assistant panel is usable and accessible on a phone viewport", async ({
  page,
}) => {
  await mockAssistant(
    page,
    "VSP Innovations builds AI solutions and products.",
  );
  await openAssistant(page, "arjun-devireddy");
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "What does VSP Innovations build?" })
    .click();
  await expect(
    dialog.getByText("VSP Innovations builds AI solutions and products."),
  ).toBeVisible();
  // The panel never forces the page sideways on a narrow screen.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // The transcript stays scrolled to the newest message.
  expect(
    await page.evaluate(() => {
      const log = document.querySelector(".ai-log");
      if (!log) return false;
      return log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    }),
  ).toBe(true);
  const { default: AxeBuilder } = await import("@axe-core/playwright");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("a captured lead is confirmed to the visitor and cleared with the conversation", async ({
  page,
}) => {
  await mockAssistant(
    page,
    "Thanks — I have passed your details on.\n" +
      `${OPEN}{"actions":[{"type":"SHOW_SOLUTION","solutionId":"ai-voice-agents"},{"type":"SHOW_SOLUTION","solutionId":"not-a-real-solution"}]}${CLOSE}`,
    { final: { actions: [{ type: "SAVE_CONTACT" }], leadCaptured: true } },
  );
  await openAssistant(page, "kavya-kelam");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("I am Sam, sam@example.com");
  await dialog.getByRole("button", { name: "Send message" }).click();
  // The visitor is told their details were recorded rather than left guessing.
  await expect(
    dialog.getByText(/details have been shared with Kavya/),
  ).toBeVisible();
  // Server-validated and client-parsed actions are merged, and a solution this
  // profile does not offer is dropped rather than rendered.
  await expect(
    dialog.getByRole("link", { name: "Save contact" }),
  ).toBeVisible();
  await expect(dialog.getByText("AI Voice Agents")).toBeVisible();
  await expect(dialog.locator(".ai-solution")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Clear conversation" }).click();
  await expect(dialog.getByText(/details have been shared/)).toHaveCount(0);
});
