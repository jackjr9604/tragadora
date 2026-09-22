begin;

alter table public.offers
  add column if not exists includes_free_account boolean not null default false,
  add column if not exists free_account_label text,
  add column if not exists is_featured boolean not null default false,
  add column if not exists hot_badge text,
  add column if not exists short_highlight text;

comment on column public.offers.includes_free_account is 'Indica que la promoción incluye una cuenta gratuita.';
comment on column public.offers.free_account_label is 'Texto editorial breve del beneficio de cuenta gratuita.';
comment on column public.offers.is_featured is 'Muestra la oferta en la franja pública de ofertas destacadas.';
comment on column public.offers.hot_badge is 'Badge editorial visible en la oferta destacada.';
comment on column public.offers.short_highlight is 'Resumen editorial corto para tarjetas compactas y notificaciones.';

commit;
