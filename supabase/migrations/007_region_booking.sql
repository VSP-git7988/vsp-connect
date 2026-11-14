begin;
-- Nullable override; an empty value inherits the global profile booking URL.
-- Existing profile_regions RLS already restricts all writes to administrators.
alter table public.profile_regions add column booking_url text check (
 booking_url is null or (length(booking_url) <= 2048 and booking_url ~ '^https://cal[.]com/[^[:space:]]+')
);
commit;
