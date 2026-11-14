begin;
create table public.portfolio_items (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.profiles(id) on delete cascade,
 region_code text not null references public.regions(code) on update cascade on delete cascade,
 title text not null check(length(title) between 1 and 200),
 summary text not null check(length(summary) between 1 and 400),
 category text not null check(length(category) between 1 and 120),
 url text check(url is null or (length(url)<=2048 and url ~ '^https://')),
 sort_order integer not null default 0,
 active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index portfolio_region_profile on public.portfolio_items(region_code,profile_id,sort_order);
create trigger portfolio_updated before update on public.portfolio_items for each row execute function public.set_updated_at();
alter table public.portfolio_items enable row level security;
create policy portfolio_read on public.portfolio_items for select to anon,authenticated using(
 (active and exists(select 1 from public.profile_regions pr join public.profiles p on p.id=pr.profile_id join public.regions r on r.code=pr.region_code where pr.profile_id=portfolio_items.profile_id and pr.region_code=portfolio_items.region_code and pr.visible and p.active and r.active)) or public.is_admin());
create policy portfolio_admin on public.portfolio_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select on public.portfolio_items to anon;
grant select,insert,update,delete on public.portfolio_items to authenticated;
-- Intentionally no project seed rows. Publish only real, approved work.
commit;
