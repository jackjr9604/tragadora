\ir giveaway-translations-test-bootstrap.sql

create table public.admin_permissions(key text primary key);
insert into public.admin_permissions(key) values('blog.view'),('blog.update');

create table public.blog_posts(
 id uuid primary key default extensions.gen_random_uuid(),slug text not null unique,title text not null,excerpt text,
 body_markdown text not null,category text,tags text[] not null default '{}',cover_media_id uuid,author_name text,
 is_featured boolean not null default false,status text not null default 'draft',published_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
insert into public.blog_posts(slug,title,excerpt,body_markdown,category,tags,author_name,is_featured,status,published_at) values
 ('market-guide','Guía de mercados','Una guía práctica',E'# Guía\n\nUse `const risk = 1` y visite [Herramientas](/herramientas).','Educación',array['mercados','riesgo'],'Tradagora',true,'published',now()),
 ('risk-notes','Notas de riesgo','Control del capital',E'# Riesgo\n\n![Gráfico](https://example.com/chart.png)','Análisis',array['riesgo'],'Equipo editorial',false,'draft',null);
