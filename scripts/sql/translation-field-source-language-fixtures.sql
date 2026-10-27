\set ON_ERROR_STOP on
update public.languages set auto_translate=true,libretranslate_status='supported' where code in('es','en','pt');
insert into public.platforms(id,type,name,slug,status) values('90000000-0000-4000-8000-000000000001','prop_firm','Synthetic Translation Firm','synthetic-translation-firm','draft');
insert into public.challenges(id,platform_id,name,slug,status) values('90000000-0000-4000-8000-000000000002','90000000-0000-4000-8000-000000000001','Synthetic Challenge','synthetic-challenge','draft');
insert into public.account_plans(id,challenge_id,account_size,price,currency,payout_frequency)
select gen_random_uuid(),'90000000-0000-4000-8000-000000000002',1000+g,100,'USD',
  case when g<=1404 then 'Every '||((g-1)%85+1)::text||' days' else null end
from generate_series(1,1501) g;

with picked as(select id from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='en' order by resource_id limit 3)
update public.translation_field_state s set status='machine_translated',translation_method='libretranslate',workflow_status='draft',draft_value=to_jsonb('synthetic EN draft'::text),draft_source_hash=s.source_hash,draft_source_revision=s.source_revision where s.id in(select id from picked);
with picked as(select id from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='pt' order by resource_id limit 2)
update public.translation_field_state s set status='machine_translated',translation_method='libretranslate',workflow_status='draft',draft_value=to_jsonb('rascunho PT'::text),draft_source_hash=s.source_hash,draft_source_revision=s.source_revision where s.id in(select id from picked);
with picked as(select id from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='en' order by resource_id offset 10 limit 1)
update public.translation_field_state s set status='reviewed',translation_method='manual',translated_source_hash=s.source_hash,translated_revision=s.source_revision,reviewed_at=now(),publication_status='published',is_protected=true,protection_reason='reviewed' where s.id in(select id from picked);
with picked as(select id from public.translation_field_state where resource_type='account_plan_translation' and field_name='payout_frequency' and target_language='pt' order by resource_id offset 10 limit 1)
update public.translation_field_state s set status='reviewed',translation_method='manual',translated_source_hash=s.source_hash,translated_revision=s.source_revision,reviewed_at=now(),publication_status='published',is_protected=true,protection_reason='reviewed' where s.id in(select id from picked);
