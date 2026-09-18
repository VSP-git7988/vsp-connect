import assert from "node:assert/strict";
import { seedProfiles } from "../src/lib/seed";
import { safeWebUrl, vcard, contactUrls } from "../src/lib/contact";
// Synthetic reserved examples for link-contract tests; never published as founder data.
const profile = {
  ...seedProfiles[0],
  phone: "+1 (202) 555-0100",
  email: "test@example.com",
  whatsapp: "+12025550100",
  linkedin_url: "https://www.linkedin.com/in/test-fixture",
  website_url: "https://example.com",
  booking_url: "https://cal.com/test-fixture",
};
assert.deepEqual(contactUrls(profile), {
  call: "tel:+12025550100",
  email: "mailto:test%40example.com",
  whatsapp: "https://wa.me/12025550100",
  linkedin: "https://www.linkedin.com/in/test-fixture",
  website: "https://example.com/",
  booking: "https://cal.com/test-fixture",
});
assert.equal(safeWebUrl("javascript:alert(1)"), null);
const card = vcard(
  { ...profile, display_name: "Name\nInjected;Value,Test" },
  "VSP Innovations",
  "https://example.com/arjun-devireddy",
);
assert.ok(card.includes("FN:Name\\nInjected\\;Value\\,Test"));
assert.ok(card.includes("TEL;TYPE=WORK,VOICE:+1 (202) 555-0100"));
for (const line of card.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
console.log(
  "PASS: all configured action URLs, unsafe URL rejection, vCard fields/escaping/folding.",
);
