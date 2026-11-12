begin;
-- Founder portraits. profiles.profile_image (001) already stores the portrait,
-- but 001 only allowed https:// URLs. Portraits now also ship as static files
-- in public/, so root-relative paths such as /arjun%20devireddy.jpeg are
-- allowed too. Protocol-relative //host URLs are still rejected.
alter table public.profiles drop constraint if exists profiles_profile_image_check;
alter table public.profiles add constraint profiles_profile_image_check check (
 profile_image is null
 or (length(profile_image) <= 2048 and profile_image ~ '^(https://|/[^/])')
);
-- Portraits belong to the person, not a region: every region reads the
-- profile's own profile_image, so one value covers India and the US.
-- Only fills empty values, so a portrait set in /admin is never overwritten.
update public.profiles set profile_image = s.path
from (values
 ('arjun-devireddy', '/arjun%20devireddy.jpeg'),
 ('kavya-kelam', '/kavya%20kelam.jpeg')
) s(slug, path)
where profiles.slug = s.slug and profiles.profile_image is null;
commit;
