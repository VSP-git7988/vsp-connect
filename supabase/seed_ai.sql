-- VSP Connect V2 starter AI configuration. Repeatable.
-- Every row below is configurable starter copy describing capabilities only.
-- No customers, prices, partnerships, certifications, results or biography
-- details have been invented. Replace with founder-approved content before launch.

-- ------------------------------------------------------------- solutions
insert into public.solutions(company_id,slug,name,short_description,full_description,target_industries,sort_order) values
('00000000-0000-4000-8000-000000000001','ai-voice-agents','AI Voice Agents',
 'Voice assistants that answer calls, capture details and route what matters to a human.',
 'Conversational voice agents for inbound and outbound calling. Typical scope covers call handling, qualification questions, appointment capture, handover rules to a human, and transcripts. Language coverage, telephony provider, data handling and escalation rules are defined per engagement.',
 '{}',0),
('00000000-0000-4000-8000-000000000001','ai-business-assistants','AI Business Assistants',
 'Assistants grounded in your approved business knowledge rather than open-ended chat.',
 'Assistants that answer from a controlled knowledge base you maintain, with explicit behaviour when information is unavailable. Typical scope covers knowledge structure, retrieval, guardrails, escalation paths, and an admin surface for updating approved content.',
 '{}',1),
('00000000-0000-4000-8000-000000000001','workflow-automation','Workflow Automation',
 'Removing repetitive steps between the tools a team already uses.',
 'Automation of recurring internal processes: intake, routing, data entry between systems, document handling, notifications and reporting. Scope begins with a walkthrough of the current process before anything is automated.',
 '{}',2),
('00000000-0000-4000-8000-000000000001','ai-sales-follow-up','AI Sales Follow-Up',
 'Consistent, reviewable follow-up on enquiries that would otherwise go cold.',
 'Drafting and scheduling of follow-up communication tied to your pipeline stages, with human review points. Channels, tone, timing rules and approval steps are configured per engagement.',
 '{}',3),
('00000000-0000-4000-8000-000000000001','ai-lead-qualification','AI Lead Qualification',
 'Understanding what an enquiry actually needs before it reaches a person.',
 'Structured qualification of inbound enquiries: intent, business type, problem, timeline and preferred next step, written into your chosen destination. Question sets and scoring rules are configurable.',
 '{}',4),
('00000000-0000-4000-8000-000000000001','custom-ai-products','Custom AI Product Development',
 'End-to-end design and build of an AI product owned by your business.',
 'Product discovery, architecture, model and provider selection, evaluation, interface design, deployment and handover. Suited to teams building an AI capability into their own product rather than adopting an off-the-shelf tool.',
 '{}',5)
on conflict(company_id,slug) do nothing;

-- ------------------------------------------------------- company knowledge
insert into public.knowledge_sources(company_id,profile_id,title,content,category)
select '00000000-0000-4000-8000-000000000001',null,k.title,k.content,k.category
from (values
 ('What VSP Innovations is',
  'VSP Innovations is an AI Solutions and Product Development company. It turns ambitious ideas into intelligent products, combining AI solutions, engineering and product design. The two co-founders are Arjun Devireddy and Kavya Kelam.',
  'company'),
 ('How VSP Innovations works with clients',
  'Engagements start with a conversation about the problem before any solution is proposed. Scope, timelines and commercials are agreed per project. The fastest way to start is a short call with one of the co-founders.',
  'company'),
 ('What VSP Innovations builds',
  'Capability areas are AI voice agents, AI business assistants, workflow automation, AI sales follow-up, AI lead qualification, and custom AI product development. Each is scoped to the client''s own systems and data.',
  'service'),
 ('How AI typically helps a business',
  'Common starting points are handling inbound enquiries and calls, qualifying leads, removing repetitive internal steps, keeping follow-up consistent, and making internal knowledge reliably answerable. The right starting point depends on where time is currently lost, which is what an initial conversation establishes.',
  'service'),
 ('Pricing',
  'VSP Innovations does not publish standard prices or packages. Cost depends on scope, integrations and support requirements, and is quoted after an initial conversation. No pricing figures, ranges or estimates are available through this assistant.',
  'policy'),
 ('Case studies and references',
  'No client names, case studies, project results or references are published through this assistant. Requests for references are handled directly by the co-founders.',
  'policy'),
 ('Company size, revenue and partnerships',
  'Employee counts, revenue figures, funding, certifications and partnership details are not published through this assistant.',
  'policy'),
 ('How to reach VSP Innovations',
  'The way to reach VSP Innovations is through a founder profile: save the contact card, use the contact actions shown on the profile, or book a meeting with the founder whose profile you are viewing. Contact details shown on a profile are the authoritative ones; this assistant does not hold any others.',
  'contact'),
 ('Booking a meeting',
  'Meetings are booked through the booking link on the founder''s profile. If a booking link is not shown on the profile, it has not been published yet and the visitor should use the profile''s contact actions instead.',
  'contact'),
 ('Data handling in this conversation',
  'Messages in this assistant may be stored so VSP Innovations can follow up on a request and understand what visitors ask. Contact details are stored only when a visitor provides them. No other personal data is collected.',
  'policy')
) as k(title,content,category)
where not exists(select 1 from public.knowledge_sources x
 where x.company_id='00000000-0000-4000-8000-000000000001' and x.profile_id is null and x.title=k.title);

-- ------------------------------------------------------- founder knowledge
-- Only restates approved V1 profile content. Detailed biography is deliberately
-- absent so the assistant answers "not in my approved profile yet".
insert into public.knowledge_sources(company_id,profile_id,title,content,category)
select p.company_id,p.id,'About '||p.display_name,
 p.display_name||' is '||p.title||' of VSP Innovations. Headline: '||p.headline||' '||p.bio||
 ' Focus areas: '||coalesce((select string_agg(e.name,', ' order by e.sort_order) from public.expertise e where e.profile_id=p.id),'not published')||
 '. No further biography, education, work history, location or personal detail has been published for this profile.',
 'founder'
from public.profiles p where p.slug in ('arjun-devireddy','kavya-kelam')
and not exists(select 1 from public.knowledge_sources x where x.profile_id=p.id and x.title='About '||p.display_name);

insert into public.knowledge_sources(company_id,profile_id,title,content,category)
select p.company_id,p.id,'Contacting '||p.display_name,
 'Visitors can reach '||p.display_name||' through the contact actions on this profile: saving the contact card, and any of call, email, WhatsApp, LinkedIn or website that the profile shows as available. Actions shown as not added have not been published yet. '||
 case when p.booking_url is null then 'A booking link has not been published for this profile yet.' else 'A meeting can be booked using the booking link on this profile.' end,
 'contact'
from public.profiles p where p.slug in ('arjun-devireddy','kavya-kelam')
and not exists(select 1 from public.knowledge_sources x where x.profile_id=p.id and x.title='Contacting '||p.display_name);

-- ------------------------------------------------------------ AI identity
insert into public.profile_ai_config(profile_id,enabled,intro,persona_instructions,focus_areas)
select p.id,true,
 'Hi, I''m '||p.first_name||'''s AI representative. Ask me about VSP Innovations, what we build, or how AI could fit your business.',
 'You represent '||p.display_name||', '||p.title||' of VSP Innovations. Speak about '||p.first_name||
 ' in the third person. You are not '||p.first_name||' and must not speak as them or commit them to anything beyond booking a meeting.',
 array['AI Solutions','AI Products','Intelligent Automation','Product Development']
from public.profiles p where p.slug in ('arjun-devireddy','kavya-kelam')
on conflict(profile_id) do nothing;

-- ----------------------------------------------------- suggested questions
insert into public.suggested_questions(company_id,profile_id,question,sort_order)
select '00000000-0000-4000-8000-000000000001',null,q.question,q.sort_order
from (values
 ('What does VSP Innovations build?',0),
 ('How can AI help my business?',1),
 ('What AI solutions do you offer?',2),
 ('Can you build an AI voice agent?',3),
 ('Do you build custom AI products?',4),
 ('Can I schedule a meeting?',5)
) as q(question,sort_order)
where not exists(select 1 from public.suggested_questions x
 where x.company_id='00000000-0000-4000-8000-000000000001' and x.profile_id is null and x.question=q.question);

-- Founder-specific suggestion: on each profile, offer the other founder.
insert into public.suggested_questions(company_id,profile_id,question,sort_order)
select p.company_id,p.id,'Tell me about '||p.first_name||'.',6
from public.profiles p where p.slug in ('arjun-devireddy','kavya-kelam')
and not exists(select 1 from public.suggested_questions x where x.profile_id=p.id and x.question='Tell me about '||p.first_name||'.');
