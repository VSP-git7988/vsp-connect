import type { Profile } from "./types";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
export function vcard(p: Profile, company: string, url: string) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escape(p.last_name)};${escape(p.first_name)};;;`,
    `FN:${escape(p.display_name)}`,
    `ORG:${escape(company)}`,
    `TITLE:${escape(p.title)}`,
    ...(p.phone ? [`TEL;TYPE=WORK,VOICE:${escape(p.phone)}`] : []),
    ...(p.email ? [`EMAIL;TYPE=WORK:${escape(p.email)}`] : []),
    ...(p.website_url ? [`URL:${escape(p.website_url)}`] : []),
    `URL:${escape(url)}`,
    "END:VCARD",
  ];
  return (
    lines
      .map((line) => {
        let result = "",
          bytes = 0;
        for (const char of line) {
          const size = new TextEncoder().encode(char).length;
          if (bytes + size > 75) {
            result += "\r\n ";
            bytes = 1;
          }
          result += char;
          bytes += size;
        }
        return result;
      })
      .join("\r\n") + "\r\n"
  );
}
export function safeWebUrl(url: string | null) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

export function contactUrls(p: Profile) {
  return {
    call: p.phone ? `tel:${p.phone.replace(/[^+\d]/g, "")}` : null,
    email: p.email ? `mailto:${encodeURIComponent(p.email)}` : null,
    whatsapp: p.whatsapp
      ? `https://wa.me/${p.whatsapp.replace(/\D/g, "")}`
      : null,
    linkedin: safeWebUrl(p.linkedin_url),
    website: safeWebUrl(p.website_url),
    booking: safeWebUrl(p.booking_url),
  };
}
