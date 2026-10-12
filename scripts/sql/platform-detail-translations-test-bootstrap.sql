\ir challenge-translations-test-bootstrap.sql

alter table public.platforms add column if not exists type text;

create table public.broker_details (
  platform_id uuid primary key references public.platforms(id) on delete cascade,
  regulation_summary text
);
create table public.exchange_details (
  platform_id uuid primary key references public.platforms(id) on delete cascade,
  product_summary text,
  regulation_summary text
);

with broker as (insert into public.platforms(type) values('broker') returning id)
insert into public.broker_details(platform_id,regulation_summary)
select id,'Regulado en dos jurisdicciones' from broker;

with exchange_row as (insert into public.platforms(type) values('exchange') returning id)
insert into public.exchange_details(platform_id,product_summary,regulation_summary)
select id,'Spot y futuros','Exchange licenciado' from exchange_row;
