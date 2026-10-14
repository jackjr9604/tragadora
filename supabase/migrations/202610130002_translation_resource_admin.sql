begin;

-- Inventario agrupado para el Admin. La función es exclusivamente de lectura
-- y solo puede invocarse con service_role desde el servidor de Tradagora.
create or replace function public.translation_admin_resource_inventory(
  p_allowed_resource_types text[],
  p_resource_type text default null,
  p_target_language text default null,
  p_status text default null,
  p_protection text default null,
  p_query text default null,
  p_sort text default 'updated_desc',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table(
  resource_type text,
  resource_id text,
  resource_label text,
  origin_href text,
  updated_at timestamptz,
  total_fields bigint,
  pending_count bigint,
  translated_count bigint,
  reviewed_count bigint,
  published_count bigint,
  stale_count bigint,
  protected_count bigint,
  en_total bigint,
  en_published bigint,
  pt_total bigint,
  pt_published bigint,
  total_count bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  if coalesce(array_length(p_allowed_resource_types,1),0)=0
     or p_page < 1 or p_page_size not between 1 and 100
     or p_sort not in ('updated_desc','updated_asc','name_asc','progress_asc')
     or (p_protection is not null and p_protection not in ('protected','unprotected')) then
    raise exception 'Parámetros de inventario inválidos' using errcode='22023';
  end if;

  return query
  with matching as (
    select distinct s.resource_type,s.resource_id
    from public.translation_field_state s
    where s.resource_type=any(p_allowed_resource_types)
      and (p_resource_type is null or s.resource_type=p_resource_type)
      and (p_target_language is null or s.target_language=p_target_language)
      and (p_status is null or s.status=p_status)
      and (p_protection is null or s.is_protected=(p_protection='protected'))
  ), grouped as (
    select s.resource_type,s.resource_id,max(s.updated_at) as updated_at,
      count(*) as total_fields,
      count(*) filter(where s.status in ('missing','queued')) as pending_count,
      count(*) filter(where s.status not in ('missing','queued')) as translated_count,
      count(*) filter(where s.status='reviewed' or s.workflow_status='approved') as reviewed_count,
      count(*) filter(where s.publication_status='published') as published_count,
      count(*) filter(where s.status='stale') as stale_count,
      count(*) filter(where s.is_protected) as protected_count,
      count(*) filter(where s.target_language='en') as en_total,
      count(*) filter(where s.target_language='en' and s.publication_status='published') as en_published,
      count(*) filter(where s.target_language='pt') as pt_total,
      count(*) filter(where s.target_language='pt' and s.publication_status='published') as pt_published
    from public.translation_field_state s join matching m using(resource_type,resource_id)
    group by s.resource_type,s.resource_id
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
        else g.resource_type||' · '||left(g.resource_id,8)
      end as resource_label,
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
        else '/admin/challenges'
      end as origin_href
    from grouped g
  ), filtered as (
    select * from labeled l where nullif(btrim(p_query),'') is null
      or l.resource_label ilike '%'||replace(replace(p_query,'%',''),'_','')||'%'
      or l.resource_id ilike '%'||replace(replace(p_query,'%',''),'_','')||'%'
  )
  select f.resource_type,f.resource_id,f.resource_label,f.origin_href,f.updated_at,
    f.total_fields,f.pending_count,f.translated_count,f.reviewed_count,f.published_count,
    f.stale_count,f.protected_count,f.en_total,f.en_published,f.pt_total,f.pt_published,
    count(*) over() as total_count
  from filtered f
  order by
    case when p_sort='name_asc' then lower(f.resource_label) end asc,
    case when p_sort='progress_asc' then f.published_count::numeric/nullif(f.total_fields,0) end asc,
    case when p_sort='updated_asc' then f.updated_at end asc,
    case when p_sort='updated_desc' then f.updated_at end desc,
    f.resource_type,f.resource_id
  offset (p_page-1)*p_page_size limit p_page_size;
end
$$;

revoke all on function public.translation_admin_resource_inventory(text[],text,text,text,text,text,text,integer,integer) from public,anon,authenticated;
grant execute on function public.translation_admin_resource_inventory(text[],text,text,text,text,text,text,integer,integer) to service_role;

commit;
