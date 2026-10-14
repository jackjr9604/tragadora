begin;

-- Read models for the unified Content and Languages Center. Both functions
-- are server-only and receive the resource types already authorized by the app.
create or replace function public.translation_admin_content_center_inventory(
  p_allowed_resource_types text[], p_resource_type text default null,
  p_target_language text default null, p_bucket text default null,
  p_query text default null, p_page integer default 1, p_page_size integer default 25
)
returns table(
  resource_type text, resource_id text, resource_label text, origin_href text, updated_at timestamptz,
  total_fields bigint, pending_count bigint, translated_count bigint, reviewed_count bigint,
  published_count bigint, stale_count bigint, protected_count bigint, en_total bigint,
  en_published bigint, pt_total bigint, pt_published bigint, draft_count bigint,
  in_review_count bigint, approved_count bigint, error_count bigint, language_progress jsonb,
  total_count bigint
)
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(array_length(p_allowed_resource_types,1),0)=0 or p_page<1 or p_page_size not between 1 and 100
     or (p_bucket is not null and p_bucket not in ('pending','draft','in_review','approved','published','partial','stale','error')) then
    raise exception 'Parámetros del Centro inválidos' using errcode='22023';
  end if;

  return query
  with scoped as (
    select s.* from public.translation_field_state s
    where s.resource_type=any(p_allowed_resource_types)
      and (p_resource_type is null or s.resource_type=p_resource_type)
      and (p_target_language is null or s.target_language=p_target_language)
  ), grouped as (
    select s.resource_type,s.resource_id,max(s.updated_at) updated_at,count(*) total_fields,
      count(*) filter(where s.status in ('missing','queued')) pending_count,
      count(*) filter(where s.status not in ('missing','queued')) translated_count,
      count(*) filter(where s.status='reviewed' or s.workflow_status='approved') reviewed_count,
      count(*) filter(where s.publication_status='published') published_count,
      count(*) filter(where s.status='stale') stale_count,
      count(*) filter(where s.is_protected) protected_count,
      count(*) filter(where s.target_language='en') en_total,
      count(*) filter(where s.target_language='en' and s.publication_status='published') en_published,
      count(*) filter(where s.target_language='pt') pt_total,
      count(*) filter(where s.target_language='pt' and s.publication_status='published') pt_published,
      count(*) filter(where s.workflow_status='draft') draft_count,
      count(*) filter(where s.workflow_status='in_review') in_review_count,
      count(*) filter(where s.workflow_status='approved') approved_count,
      count(*) filter(where s.status='error') error_count,
      coalesce((select jsonb_object_agg(x.target_language,jsonb_build_object('total',x.total,'published',x.published))
        from (select l.target_language,count(*) total,count(*) filter(where l.publication_status='published') published
              from scoped l where l.resource_type=s.resource_type and l.resource_id=s.resource_id group by l.target_language) x),'{}'::jsonb) language_progress
    from scoped s group by s.resource_type,s.resource_id
  ), labeled as (
    select g.*,
      case g.resource_type
        when 'site_content' then g.resource_id
        when 'platform_translation' then coalesce((select p.name from public.platforms p where p.id::text=g.resource_id),'Plataforma · '||left(g.resource_id,8))
        when 'broker_detail_translation' then coalesce((select p.name from public.platforms p where p.id::text=g.resource_id),'Broker · '||left(g.resource_id,8))
        when 'exchange_detail_translation' then coalesce((select p.name from public.platforms p where p.id::text=g.resource_id),'Exchange · '||left(g.resource_id,8))
        when 'offer_translation' then coalesce((select o.title from public.offers o where o.id::text=g.resource_id),'Oferta · '||left(g.resource_id,8))
        when 'challenge_phase_translation' then coalesce((select 'Fase '||cp.phase_number::text from public.challenge_phases cp where cp.id::text=g.resource_id),'Fase · '||left(g.resource_id,8))
        when 'challenge_variant_translation' then coalesce((select cv.name from public.challenge_variants cv where cv.id::text=g.resource_id),'Variante · '||left(g.resource_id,8))
        when 'challenge_variant_phase_translation' then coalesce((select coalesce(cv.name,'Variante')||' · Fase '||cvp.phase_number::text from public.challenge_variant_phases cvp left join public.challenge_variants cv on cv.id=cvp.variant_id where cvp.id::text=g.resource_id),'Override · '||left(g.resource_id,8))
        when 'account_plan_translation' then coalesce((select 'Plan '||coalesce(ap.account_size::text,'sin tamaño')||coalesce(' '||ap.currency,'') from public.account_plans ap where ap.id::text=g.resource_id),'Plan · '||left(g.resource_id,8))
        when 'challenge_reward_translation' then coalesce((select cro.name from public.challenge_reward_options cro where cro.id::text=g.resource_id),'Reward · '||left(g.resource_id,8))
        when 'tool_translation' then coalesce((select t.name from public.tools t where t.id::text=g.resource_id),'Herramienta · '||left(g.resource_id,8))
        when 'community_translation' then coalesce((select c.name from public.communities c where c.id::text=g.resource_id),'Comunidad · '||left(g.resource_id,8))
        when 'giveaway_translation' then coalesce((select gv.title from public.giveaways gv where gv.id::text=g.resource_id),'Giveaway · '||left(g.resource_id,8))
        when 'blog_post_translation' then coalesce((select bp.title from public.blog_posts bp where bp.id::text=g.resource_id),'Artículo · '||left(g.resource_id,8))
        else g.resource_type||' · '||left(g.resource_id,8) end resource_label,
      case g.resource_type
        when 'site_content' then '/admin/content/'||split_part(g.resource_id,'.',1)
        when 'platform_translation' then '/admin/platforms/'||g.resource_id||'/edit'
        when 'broker_detail_translation' then '/admin/brokers/'||g.resource_id||'/edit'
        when 'exchange_detail_translation' then '/admin/exchanges/'||g.resource_id||'/edit'
        when 'offer_translation' then '/admin/offers/'||g.resource_id
        when 'tool_translation' then '/admin/tools/'||g.resource_id||'/edit'
        when 'community_translation' then '/admin/communities/'||g.resource_id||'/edit'
        when 'giveaway_translation' then '/admin/giveaways/'||g.resource_id||'/edit'
        when 'blog_post_translation' then '/admin/blog/'||g.resource_id||'/edit'
        else '/admin/challenges' end origin_href
    from grouped g
  ), filtered as (
    select * from labeled l where
      (nullif(btrim(p_query),'') is null or l.resource_label ilike '%'||replace(replace(p_query,'%',''),'_','')||'%' or l.resource_id ilike '%'||replace(replace(p_query,'%',''),'_','')||'%')
      and (p_bucket is null
        or (p_bucket='pending' and l.pending_count>0)
        or (p_bucket='draft' and l.draft_count>0)
        or (p_bucket='in_review' and l.in_review_count>0)
        or (p_bucket='approved' and l.approved_count>0)
        or (p_bucket='published' and l.total_fields>0 and l.published_count=l.total_fields)
        or (p_bucket='partial' and l.published_count>0 and l.published_count<l.total_fields)
        or (p_bucket='stale' and l.stale_count>0)
        or (p_bucket='error' and l.error_count>0))
  )
  select f.resource_type,f.resource_id,f.resource_label,f.origin_href,f.updated_at,f.total_fields,
    f.pending_count,f.translated_count,f.reviewed_count,f.published_count,f.stale_count,f.protected_count,
    f.en_total,f.en_published,f.pt_total,f.pt_published,f.draft_count,f.in_review_count,f.approved_count,
    f.error_count,f.language_progress,count(*) over()
  from filtered f order by f.updated_at desc,f.resource_type,f.resource_id
  offset (p_page-1)*p_page_size limit p_page_size;
end $$;

create or replace function public.translation_admin_content_center_summary(p_allowed_resource_types text[])
returns table(resources bigint,fields bigint,pending bigint,draft bigint,in_review bigint,approved bigint,
  published bigint,partial bigint,stale bigint,error bigint,queued_jobs bigint,running_jobs bigint,retry_jobs bigint,failed_jobs bigint)
language plpgsql security definer set search_path=pg_catalog,public
as $$
begin
  if auth.role()<>'service_role' then raise exception 'Forbidden' using errcode='42501'; end if;
  if coalesce(array_length(p_allowed_resource_types,1),0)=0 then raise exception 'Recursos requeridos' using errcode='22023'; end if;
  return query
  with grouped as (
    select s.resource_type,s.resource_id,count(*) total,
      count(*) filter(where s.status in ('missing','queued')) pending_count,
      count(*) filter(where s.workflow_status='draft') draft_count,
      count(*) filter(where s.workflow_status='in_review') review_count,
      count(*) filter(where s.workflow_status='approved') approved_count,
      count(*) filter(where s.publication_status='published') published_count,
      count(*) filter(where s.status='stale') stale_count,
      count(*) filter(where s.status='error') error_count
    from public.translation_field_state s where s.resource_type=any(p_allowed_resource_types)
    group by s.resource_type,s.resource_id
  ), job_counts as (
    select count(*) filter(where j.status='queued') queued,count(*) filter(where j.status='running') running,
      count(*) filter(where j.status='retry_wait') retry,count(*) filter(where j.status='failed') failed
    from public.translation_jobs j where j.resource_type=any(p_allowed_resource_types)
  )
  select count(*),coalesce(sum(g.total),0)::bigint,count(*) filter(where g.pending_count>0),count(*) filter(where g.draft_count>0),
    count(*) filter(where g.review_count>0),count(*) filter(where g.approved_count>0),
    count(*) filter(where g.total>0 and g.published_count=g.total),count(*) filter(where g.published_count>0 and g.published_count<g.total),
    count(*) filter(where g.stale_count>0),count(*) filter(where g.error_count>0),
    coalesce(max(j.queued),0),coalesce(max(j.running),0),coalesce(max(j.retry),0),coalesce(max(j.failed),0)
  from grouped g cross join job_counts j;
end $$;

revoke all on function public.translation_admin_content_center_inventory(text[],text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.translation_admin_content_center_inventory(text[],text,text,text,text,integer,integer) to service_role;
revoke all on function public.translation_admin_content_center_summary(text[]) from public,anon,authenticated;
grant execute on function public.translation_admin_content_center_summary(text[]) to service_role;

commit;
