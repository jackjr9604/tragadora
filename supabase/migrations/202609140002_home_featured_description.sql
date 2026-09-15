begin;

alter table public.home_featured_platforms
  add column if not exists description text;

comment on column public.home_featured_platforms.description is
  'Descripción editorial opcional para la tarjeta destacada del Home.';

commit;
