\ir community-translations-test-bootstrap.sql

create table public.giveaways(
 id uuid primary key default extensions.gen_random_uuid(),slug text not null unique,title text not null,short_description text,
 sponsor_platform_id uuid,prize_title text not null,prize_quantity integer,prize_description text,
 starts_at timestamptz not null,ends_at timestamptz not null,participation_url text,rules_url text,badge text,
 reveal_title text,reveal_content text,is_featured boolean not null default false,display_order integer not null default 100,
 status text not null default 'draft'
);
insert into public.giveaways(slug,title,short_description,prize_title,prize_quantity,prize_description,starts_at,ends_at,participation_url,rules_url,badge,reveal_title,reveal_content,is_featured,status) values
 ('annual-giveaway','Sorteo anual','Participa ahora','Cuenta financiada',2,'Premio principal',now(),now()+interval '30 days','https://example.com/join','https://example.com/rules','Destacado','Ganador','Resultado oficial',true,'published'),
 ('closed-giveaway','Sorteo cerrado','Campaña finalizada','Suscripción',1,'Premio secundario',now()-interval '30 days',now()-interval '1 day',null,null,null,null,null,false,'ended');
