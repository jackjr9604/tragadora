\set ON_ERROR_STOP on

do $$
begin
  if current_database() !~ '^tradagora_offer_c5c1f_[0-9]+_[0-9]{17}$' then
    raise exception 'Base temporal no autorizada: %',current_database();
  end if;
  if to_regclass('public.tradagora_local_e2e_guard') is null then
    raise exception 'La base no pertenece al entorno E2E local';
  end if;
end $$;

drop function if exists public.admin_save_offer(uuid,timestamptz,uuid,jsonb);
drop function if exists public.admin_save_offer(uuid,timestamptz,jsonb);
drop function if exists public.admin_set_offer_status(uuid,timestamptz,boolean);
drop trigger if exists offer_touch_updated_at on public.offers;
drop function if exists public.offer_touch_updated_at();
drop table if exists public.offer_admin_creation_requests;

alter table public.offers
  drop constraint if exists offers_challenge_platform_fkey,
  drop constraint if exists offers_affiliate_link_platform_fkey;

alter table public.challenges
  drop constraint if exists challenges_id_platform_id_key;

alter table public.affiliate_links
  drop constraint if exists affiliate_links_id_platform_id_key;

do $$
begin
  if not exists(
    select 1 from pg_constraint
    where conrelid='public.offers'::regclass
      and conname='offers_affiliate_link_id_fkey'
  ) then
    alter table public.offers
      add constraint offers_affiliate_link_id_fkey
      foreign key (affiliate_link_id)
      references public.affiliate_links(id)
      on delete set null;
  end if;
end $$;

alter table public.offers drop column if exists updated_at;

-- Reconstruye los privilegios históricos para demostrar que la migración los
-- restringe; la base es temporal, aislada y se destruye al finalizar.
grant select,insert,update,delete on table public.offers to authenticated;

do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='offers' and column_name='updated_at')
     or to_regclass('public.offer_admin_creation_requests') is not null
     or to_regprocedure('public.admin_save_offer(uuid,timestamp with time zone,uuid,jsonb)') is not null
     or to_regprocedure('public.admin_set_offer_status(uuid,timestamp with time zone,boolean)') is not null
     or exists(select 1 from pg_constraint where conrelid='public.offers'::regclass and conname in ('offers_challenge_platform_fkey','offers_affiliate_link_platform_fkey')) then
    raise exception 'No fue posible reconstruir el estado previo dentro de la base temporal';
  end if;
end $$;
