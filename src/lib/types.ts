export type Company = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  website: string | null;
  description: string;
};
export type Profile = {
  id: string;
  slug: string;
  first_name: string;
  last_name: string;
  display_name: string;
  title: string;
  company_id: string;
  headline: string;
  bio: string;
  profile_image: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  booking_url: string | null;
  active: boolean;
  expertise: { name: string; sort_order: number }[];
  social_links: {
    platform: string;
    label: string;
    url: string;
    sort_order: number;
  }[];
};
export const eventTypes = [
  "profile_view",
  "save_contact",
  "call_clicked",
  "email_clicked",
  "whatsapp_clicked",
  "linkedin_clicked",
  "website_clicked",
  "booking_clicked",
  "profile_shared",
  "qr_view",
  // V2 AI representative
  "ai_opened",
  "ai_message_sent",
  "suggested_question_clicked",
  "lead_started",
  "lead_created",
  "meeting_intent",
  "solution_viewed",
  "booking_from_ai",
] as const;
export type EventType = (typeof eventTypes)[number];
