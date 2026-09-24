begin;
create table if not exists public.communities (
 id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
 short_description text, community_type text not null, category text, language_code text,
 region_label text, logo_media_id uuid references public.media(id) on delete set null,
 join_url text not null, website_url text, badge text, is_featured boolean not null default false,
 display_order integer not null default 100, status text not null default 'draft',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint communities_type_check check (community_type in ('discord','telegram','whatsapp','x','reddit','forum','other')),
 constraint communities_status_check check (status in ('draft','published')),
 constraint communities_order_check check (display_order >= 0)
);
create index if not exists communities_public_order_idx on public.communities(status,is_featured desc,display_order,name);
create or replace function public.touch_communities_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists communities_touch_updated_at on public.communities;
create trigger communities_touch_updated_at before update on public.communities for each row execute function public.touch_communities_updated_at();
insert into public.admin_permissions(key,module,action,label,sort_order) select 'communities.'||action,'communities',action,'Comunidades',120+n from unnest(array['view','create','update','delete']) with ordinality a(action,n) on conflict(key) do update set label=excluded.label,sort_order=excluded.sort_order;
insert into public.role_permissions(role,permission_key,allowed) select 'admin'::public.user_role,key,true from public.admin_permissions where module='communities' on conflict do nothing;
alter table public.communities enable row level security;
create policy communities_public_read on public.communities for select to public using(status='published');
create policy tg_communities_view on public.communities for select to authenticated using(public.has_admin_permission('communities.view'));
create policy tg_communities_create on public.communities for insert to authenticated with check(public.has_admin_permission('communities.create'));
create policy tg_communities_update on public.communities for update to authenticated using(public.has_admin_permission('communities.update')) with check(public.has_admin_permission('communities.update'));
create policy tg_communities_delete on public.communities for delete to authenticated using(public.has_admin_permission('communities.delete'));
grant select on public.communities to anon,authenticated; grant insert,update,delete on public.communities to authenticated; grant all on public.communities to service_role;
commit;
