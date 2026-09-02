-- Permite leer mercados únicamente para Prop Firms públicas y activas.
-- Las políticas de escritura existentes no se modifican.

alter table public.platform_markets
  enable row level security;

drop policy if exists "platform_markets_public_read"
  on public.platform_markets;

create policy "platform_markets_public_read"
  on public.platform_markets
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.platforms
      where platforms.id = platform_markets.platform_id
        and platforms.type = 'prop_firm'
        and platforms.status = 'active'
    )
  );
