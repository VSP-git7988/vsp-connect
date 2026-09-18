import type { Company, Profile } from "./types";
// Editorial starter copy; replace with founder-approved biographies and actual contact details.
export const company: Company = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "VSP Innovations",
  slug: "vsp-innovations",
  logo: null,
  website: null,
  description:
    "We turn ambitious ideas into intelligent products. Bringing AI solutions, thoughtful engineering, and purposeful design together to build what comes next.",
};
export const seedProfiles: Profile[] = [
  ["Arjun", "Devireddy", "00000000-0000-4000-8000-000000000011"],
  ["Kavya", "Kelam", "00000000-0000-4000-8000-000000000012"],
].map(([first_name, last_name, id]) => ({
  id,
  first_name,
  last_name,
  display_name: `${first_name} ${last_name}`,
  slug: `${first_name}-${last_name}`.toLowerCase(),
  title: "Co-Founder",
  company_id: company.id,
  headline: "Building AI solutions & intelligent products.",
  bio: "Turning possibilities into products at VSP Innovations. Let’s connect around meaningful problems, intelligent technology, and the ideas that move us forward.",
  profile_image: null,
  phone: null,
  email: null,
  whatsapp: null,
  linkedin_url: null,
  website_url: null,
  booking_url: null,
  active: true,
  expertise: [
    "AI Solutions",
    "AI Products",
    "Intelligent Automation",
    "Product Development",
  ].map((name, sort_order) => ({ name, sort_order })),
  social_links: [],
}));
