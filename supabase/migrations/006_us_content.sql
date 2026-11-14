begin;
alter table public.profile_regions add column credential text check(length(credential)<=200), add column services text[];
update public.profile_regions set credential='14+ years of experience', services=array['AI Solutions','Product Development','Intelligent Automation','AI Integration','AI Consulting','Custom Software Development']
where region_code='us' and profile_id in (select id from public.profiles where slug='arjun-devireddy');
commit;
