begin;
-- User-supplied US services and work. Intelligence System description awaits the missing note.
create table if not exists public.portfolio_items (
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
create index if not exists portfolio_region_profile on public.portfolio_items(region_code,profile_id,sort_order);
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='portfolio_updated' and tgrelid='public.portfolio_items'::regclass) then
  create trigger portfolio_updated before update on public.portfolio_items for each row execute function public.set_updated_at();
 end if;
end $$;
alter table public.portfolio_items enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='portfolio_items' and policyname='portfolio_read') then
 create policy portfolio_read on public.portfolio_items for select to anon,authenticated using(
 (active and exists(select 1 from public.profile_regions pr join public.profiles p on p.id=pr.profile_id join public.regions r on r.code=pr.region_code where pr.profile_id=portfolio_items.profile_id and pr.region_code=portfolio_items.region_code and pr.visible and p.active and r.active)) or public.is_admin());
 end if;
end $$;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='portfolio_items' and policyname='portfolio_admin') then
 create policy portfolio_admin on public.portfolio_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
 end if;
end $$;
grant select on public.portfolio_items to anon;
grant select,insert,update,delete on public.portfolio_items to authenticated;

update public.profile_regions set services=array['Full-stack web applications | Next.js, Supabase and Vercel builds with auth, role-based portals, admin dashboards and CMS-style controls',
 'AI products | Our own products, including an AI tutor, AI visiting card and AI CEO',
 'AI features inside client products | Claude-powered assistants, voice and Telugu language layers, and n8n workflow integrations',
 'Mobile apps | iOS and Android apps, with Flutter planned for later phases',
 'Business and marketing websites | Redesigns and new builds, including 3D and animated sites',
 'Intelligence System'] where region_code='us' and profile_id in (select id from public.profiles where slug='arjun-devireddy');

-- Update matching US projects; insert only missing titles. Never touches India.
with supplied(title,summary,category,url,sort_order) as (values
('LMS Portal','Admin, faculty and student portals with OTP login, admissions workflow, course content, quizzes, attendance and emails','Client project','https://biblicalseminary.in',0),
('Cookinpot','Restaurant site with menu and cuisine pages, catering and table reservations, gallery uploads, an admin panel and a Q&A chatbot','Client project','https://cookinpotusa.com',1),
('Abhi Trainings','AI voice trainer platform for IT professionals with six trainer personas','Own product','https://abhi-trainings.vercel.app',2),
('VSP Innovations','Company site with a Claude-powered assistant and Cal.com booking','Own product','https://vspinnovations.com',3),
('Faith Temple','Modern church site redesign with a Supabase-driven gallery, settings and videos','Client project',null,4),
('VSP Connect','Digital business cards with founder profiles, QR and NFC, and a per-founder AI representative','Own product',null,5),
('Acharya Bhaarathi','Teacher-controlled AI Telugu classroom with voice','Own product',null,6),
('Cinematic Thinking Engine','Think, Plan, Direct tool for visual content creators, with fal.ai video generation','Own product',null,7),
('RK Genesis','3D corporate website with a services navbar and a site-specific chatbot','Client project',null,8)
)
update public.portfolio_items item set summary=s.summary,category=s.category,url=s.url,sort_order=s.sort_order,active=true
from supplied s,public.profiles p where p.slug='arjun-devireddy' and item.profile_id=p.id and item.region_code='us' and item.title=s.title;
with supplied(title,summary,category,url,sort_order) as (values
('LMS Portal','Admin, faculty and student portals with OTP login, admissions workflow, course content, quizzes, attendance and emails','Client project','https://biblicalseminary.in',0),
('Cookinpot','Restaurant site with menu and cuisine pages, catering and table reservations, gallery uploads, an admin panel and a Q&A chatbot','Client project','https://cookinpotusa.com',1),
('Abhi Trainings','AI voice trainer platform for IT professionals with six trainer personas','Own product','https://abhi-trainings.vercel.app',2),
('VSP Innovations','Company site with a Claude-powered assistant and Cal.com booking','Own product','https://vspinnovations.com',3),
('Faith Temple','Modern church site redesign with a Supabase-driven gallery, settings and videos','Client project',null,4),
('VSP Connect','Digital business cards with founder profiles, QR and NFC, and a per-founder AI representative','Own product',null,5),
('Acharya Bhaarathi','Teacher-controlled AI Telugu classroom with voice','Own product',null,6),
('Cinematic Thinking Engine','Think, Plan, Direct tool for visual content creators, with fal.ai video generation','Own product',null,7),
('RK Genesis','3D corporate website with a services navbar and a site-specific chatbot','Client project',null,8)
)
insert into public.portfolio_items(profile_id,region_code,title,summary,category,url,sort_order,active)
select p.id,'us',s.title,s.summary,s.category,s.url,s.sort_order,true from supplied s cross join public.profiles p
where p.slug='arjun-devireddy' and not exists(select 1 from public.portfolio_items item where item.profile_id=p.id and item.region_code='us' and item.title=s.title);
commit;
