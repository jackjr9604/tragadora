begin;
create table if not exists public.blog_posts (
 id uuid primary key default gen_random_uuid(), slug text not null unique, title text not null, excerpt text,
 body_markdown text not null default '', category text, tags text[] not null default '{}',
 cover_media_id uuid references public.media(id) on delete set null, author_name text,
 is_featured boolean not null default false, status text not null default 'draft', published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint blog_posts_status_check check(status in ('draft','published'))
);
create index if not exists blog_posts_public_date_idx on public.blog_posts(status,published_at desc);
create or replace function public.touch_blog_posts_updated_at() returns trigger language plpgsql set search_path=public as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists blog_posts_touch_updated_at on public.blog_posts;
create trigger blog_posts_touch_updated_at before update on public.blog_posts for each row execute function public.touch_blog_posts_updated_at();
insert into public.admin_permissions(key,module,action,label,sort_order) select 'blog.'||action,'blog',action,'Blog',130+n from unnest(array['view','create','update','delete']) with ordinality a(action,n) on conflict(key) do update set label=excluded.label,sort_order=excluded.sort_order;
insert into public.role_permissions(role,permission_key,allowed) select 'admin'::public.user_role,key,true from public.admin_permissions where module='blog' on conflict do nothing;
alter table public.blog_posts enable row level security;
create policy blog_posts_public_read on public.blog_posts for select to public using(status='published' and (published_at is null or published_at<=now()));
create policy tg_blog_view on public.blog_posts for select to authenticated using(public.has_admin_permission('blog.view'));
create policy tg_blog_create on public.blog_posts for insert to authenticated with check(public.has_admin_permission('blog.create'));
create policy tg_blog_update on public.blog_posts for update to authenticated using(public.has_admin_permission('blog.update')) with check(public.has_admin_permission('blog.update'));
create policy tg_blog_delete on public.blog_posts for delete to authenticated using(public.has_admin_permission('blog.delete'));
grant select on public.blog_posts to anon,authenticated; grant insert,update,delete on public.blog_posts to authenticated; grant all on public.blog_posts to service_role;
commit;
