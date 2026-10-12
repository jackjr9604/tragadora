\ir tool-translations-test-bootstrap.sql

create table public.communities(
 id uuid primary key default extensions.gen_random_uuid(),name text not null,slug text not null unique,
 short_description text,community_type text not null,category text,language_code text,region_label text,
 join_url text not null,badge text,status text not null default 'published'
);
insert into public.communities(name,slug,short_description,community_type,category,language_code,region_label,join_url,badge) values
 ('Futures Hub','futures-hub','Comunidad de futuros','discord','education','es','Global','https://example.com/futures','Destacada'),
 ('Trading Forum','trading-forum','Foro de traders','forum','discussion','es','Latinoamérica','https://example.com/forum','Nueva');
