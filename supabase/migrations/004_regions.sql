begin;
-- Region variants. The default region is served at the site root (/, /[slug]);
-- every other active region at /[code] and /[code]/[slug]. Adding a region is
-- a row here plus profile_regions rows, not new routes.
create table public.regions (
 code text primary key check(code ~ '^[a-z]{2,3}$' and code not in ('api')),
 name text not null check(length(name) between 1 and 80),
 -- BCP 47 tag used for hreflang alternates, e.g. en-IN.
 locale text not null check(locale ~ '^[a-z]{2}-[A-Z]{2}$'),
 default_region boolean not null default false, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(active or not default_region)
);
create unique index regions_single_default on public.regions(default_region) where default_region;
create table public.profile_regions (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 region_code text not null references public.regions(code) on update cascade on delete cascade,
 visible boolean not null default true, is_primary boolean not null default false, sort_order integer not null default 0,
 -- Nullable overrides; null means "use the profile's own value".
 phone text check(length(phone)<=40), whatsapp text check(length(whatsapp)<=40),
 email text check(length(email)<=254), role_title text check(length(role_title) between 1 and 120),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(profile_id,region_code)
);
create unique index profile_regions_single_primary on public.profile_regions(region_code) where is_primary;
create index profile_regions_region_idx on public.profile_regions(region_code,sort_order);
create trigger regions_updated before update on public.regions for each row execute function public.set_updated_at();
create trigger profile_regions_updated before update on public.profile_regions for each row execute function public.set_updated_at();
-- Region codes and profile slugs share the first path segment, so neither may
-- take a value the other already uses. Definer rights so hidden rows count too.
create function public.guard_region_path() returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- Nested so each branch only reads the column its table has.
 if tg_table_name='regions' then
  if exists(select 1 from public.profiles where slug=new.code) then
   raise exception 'Region code "%" is already used by a profile slug', new.code;
  end if;
 elsif exists(select 1 from public.regions where code=new.slug) then
  raise exception 'Profile slug "%" is reserved for a region', new.slug;
 end if;
 return new;
end;
$$;
revoke all on function public.guard_region_path() from public,anon,authenticated;
create trigger regions_path_guard before insert or update of code on public.regions for each row execute function public.guard_region_path();
create trigger profiles_region_guard before insert or update of slug on public.profiles for each row execute function public.guard_region_path();
-- New profiles join the default region, so creating a profile still publishes
-- it at /[slug] as before; other regions are opted into from /admin.
create function public.join_default_region() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 insert into public.profile_regions(profile_id,region_code,sort_order)
 select new.id,code,100 from public.regions where default_region
 on conflict(profile_id,region_code) do nothing;
 return new;
end;
$$;
create trigger profiles_join_default_region after insert on public.profiles for each row execute function public.join_default_region();
alter table public.regions enable row level security;
alter table public.profile_regions enable row level security;
create policy region_read on public.regions for select to anon,authenticated using(active or public.is_admin());
create policy profile_region_read on public.profile_regions for select to anon,authenticated using(
 (visible and exists(select 1 from public.regions r where r.code=region_code and r.active)
  and exists(select 1 from public.profiles p where p.id=profile_id and p.active))
 or public.is_admin());
create policy region_admin on public.regions for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy profile_region_admin on public.profile_regions for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.regions,public.profile_regions to anon;
grant select,insert,update,delete on public.regions,public.profile_regions to authenticated;
insert into public.regions(code,name,locale,default_region) values
 ('in','India','en-IN',true),
 ('us','United States','en-US',false);
-- India: Kavya leads, Arjun second. United States: Arjun only, US phone and
-- WhatsApp left unset until entered in /admin.
insert into public.profile_regions(profile_id,region_code,visible,is_primary,sort_order)
select p.id,s.region_code,true,s.is_primary,s.sort_order
from (values ('kavya-kelam','in',true,1),('arjun-devireddy','in',false,2),('arjun-devireddy','us',true,1)) s(slug,region_code,is_primary,sort_order)
join public.profiles p on p.slug=s.slug
on conflict(profile_id,region_code) do nothing;
-- Any other existing profile keeps its current root URL.
insert into public.profile_regions(profile_id,region_code,sort_order)
select id,'in',100 from public.profiles where slug not in ('kavya-kelam','arjun-devireddy')
on conflict(profile_id,region_code) do nothing;
commit;
