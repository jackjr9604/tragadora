begin;

create table if not exists public.documentation_articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  section text not null,
  subsection text,
  audience text not null default 'general',
  body_markdown text not null default '',
  sort_order integer not null default 100,
  status text not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documentation_articles_audience_check check (audience in ('admin','user','technical','general')),
  constraint documentation_articles_status_check check (status in ('draft','published'))
);

create index if not exists documentation_articles_navigation_idx
  on public.documentation_articles(section, subsection, sort_order, title);

create or replace function public.touch_documentation_articles_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists documentation_articles_touch_updated_at on public.documentation_articles;
create trigger documentation_articles_touch_updated_at
before update on public.documentation_articles
for each row execute function public.touch_documentation_articles_updated_at();

insert into public.admin_permissions(key, module, action, label, sort_order)
select 'docs.' || action, 'docs', action, 'Documentación', 150 + n
from unnest(array['view','create','update','delete']) with ordinality a(action,n)
on conflict(key) do update set label = excluded.label, sort_order = excluded.sort_order;

insert into public.role_permissions(role, permission_key, allowed)
select 'admin'::public.user_role, key, true
from public.admin_permissions where module = 'docs'
on conflict do nothing;

alter table public.documentation_articles enable row level security;

drop policy if exists tg_documentation_view on public.documentation_articles;
drop policy if exists tg_documentation_create on public.documentation_articles;
drop policy if exists tg_documentation_update on public.documentation_articles;
drop policy if exists tg_documentation_delete on public.documentation_articles;

create policy tg_documentation_view on public.documentation_articles
for select to authenticated using (public.has_admin_permission('docs.view'));
create policy tg_documentation_create on public.documentation_articles
for insert to authenticated with check (public.has_admin_permission('docs.create'));
create policy tg_documentation_update on public.documentation_articles
for update to authenticated using (public.has_admin_permission('docs.update'))
with check (public.has_admin_permission('docs.update'));
create policy tg_documentation_delete on public.documentation_articles
for delete to authenticated using (public.has_admin_permission('docs.delete'));

revoke all on public.documentation_articles from anon;
grant select, insert, update, delete on public.documentation_articles to authenticated;
grant all on public.documentation_articles to service_role;

commit;
