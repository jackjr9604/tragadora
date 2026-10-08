-- Campos editoriales para el directorio público de herramientas.
-- Las calculadoras internas continúan implementadas en código.
begin;

alter table public.tools
  add column if not exists pricing_model text null,
  add column if not exists has_free_plan boolean not null default false,
  add column if not exists price_label text null,
  add column if not exists availability text null,
  add column if not exists author_name text null,
  add column if not exists promo_code text null,
  add column if not exists promo_label text null,
  add column if not exists is_ours boolean not null default false,
  add column if not exists logo_media_id uuid null;

alter table public.tools
  drop constraint if exists tools_pricing_model_check;

alter table public.tools
  add constraint tools_pricing_model_check
  check (pricing_model is null or pricing_model in ('free', 'freemium', 'paid'));

alter table public.tools
  drop constraint if exists tools_logo_media_id_fkey;

alter table public.tools
  add constraint tools_logo_media_id_fkey
  foreign key (logo_media_id)
  references public.media(id)
  on delete set null;

create index if not exists tools_logo_media_id_idx
  on public.tools(logo_media_id);

create index if not exists tools_public_filters_idx
  on public.tools(status, category, has_free_plan, display_order);

comment on column public.tools.pricing_model is
  'Modelo comercial visible: free, freemium o paid.';
comment on column public.tools.has_free_plan is
  'Indica si existe una modalidad utilizable sin pago.';
comment on column public.tools.availability is
  'Dónde funciona la herramienta, por ejemplo Web, Desktop o Mobile.';
comment on column public.tools.is_ours is
  'Identifica herramientas propias de Tradagora dentro del catálogo.';

-- Mantiene las calculadoras existentes, pero traslada su destino canónico.
update public.tools
set
  internal_path = '/calculadoras/' || slug,
  pricing_model = 'free',
  has_free_plan = true,
  is_ours = true
where tool_type = 'internal'
  and slug in ('drawdown', 'profit-split', 'challenge-target');

commit;
