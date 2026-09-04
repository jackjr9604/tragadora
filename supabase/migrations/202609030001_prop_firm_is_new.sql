alter table public.prop_firm_details
  add column if not exists is_new boolean not null default false;

comment on column public.prop_firm_details.is_new is
  'Marca editorial administrable para destacar Prop Firms nuevas en el directorio público.';
