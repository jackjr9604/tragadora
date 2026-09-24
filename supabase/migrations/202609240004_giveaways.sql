begin;
create table if not exists public.giveaways (
 id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, short_description text,
 sponsor_platform_id uuid references public.platforms(id) on delete set null, prize_title text not null,
 prize_quantity integer check(prize_quantity is null or prize_quantity>0), prize_description text,
 cover_media_id uuid references public.media(id) on delete set null, starts_at timestamptz not null, ends_at timestamptz not null,
 participation_url text, rules_url text, badge text, reveal_title text, reveal_content text,
 is_featured boolean not null default false, display_order integer not null default 100,
 status text not null default 'draft', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint giveaways_status_check check(status in ('draft','published','ended')),
 constraint giveaways_dates_check check(ends_at>starts_at), constraint giveaways_order_check check(display_order>=0)
);
create index if not exists giveaways_public_order_idx on public.giveaways(status,is_featured desc,display_order,ends_at desc);
create or replace function public.touch_giveaways_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists giveaways_touch_updated_at on public.giveaways;
create trigger giveaways_touch_updated_at before update on public.giveaways for each row execute function public.touch_giveaways_updated_at();
insert into public.admin_permissions(key,module,action,label,sort_order) select 'giveaways.'||action,'giveaways',action,'Giveaways',140+n from unnest(array['view','create','update','delete']) with ordinality a(action,n) on conflict(key) do update set label=excluded.label,sort_order=excluded.sort_order;
insert into public.role_permissions(role,permission_key,allowed) select 'admin'::public.user_role,key,true from public.admin_permissions where module='giveaways' on conflict do nothing;
alter table public.giveaways enable row level security;
create policy giveaways_public_read on public.giveaways for select to public using(status in ('published','ended'));
create policy tg_giveaways_view on public.giveaways for select to authenticated using(public.has_admin_permission('giveaways.view'));
create policy tg_giveaways_create on public.giveaways for insert to authenticated with check(public.has_admin_permission('giveaways.create'));
create policy tg_giveaways_update on public.giveaways for update to authenticated using(public.has_admin_permission('giveaways.update')) with check(public.has_admin_permission('giveaways.update'));
create policy tg_giveaways_delete on public.giveaways for delete to authenticated using(public.has_admin_permission('giveaways.delete'));
grant select on public.giveaways to anon,authenticated; grant insert,update,delete on public.giveaways to authenticated; grant all on public.giveaways to service_role;
commit;
