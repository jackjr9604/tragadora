\ir platform-detail-translations-test-bootstrap.sql

create table public.tools (
  id uuid primary key default extensions.gen_random_uuid(), slug text not null unique, name text not null,
  short_description text, tool_type text not null, category text, badge text, price_label text,
  availability text, promo_label text, is_ours boolean not null default false
);

insert into public.tools(slug,name,short_description,tool_type,category,badge,price_label,availability,promo_label,is_ours) values
 ('risk-calculator','Calculadora de riesgo','Calcula el riesgo','internal','risk','Propia','Gratis','Web','Sin promoción',true),
 ('external-brand','External Brand','Herramienta de gráficos','external','charts','Popular','Desde 10 USD','Web','Prueba gratuita',false);
