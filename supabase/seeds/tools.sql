begin;

insert into public.tools (
  slug, name, short_description, tool_type, category, icon_key, badge,
  internal_path, external_url, is_featured, display_order, status, open_in_new_tab
)
values
  ('drawdown', 'Calculadora de Drawdown', 'Calcula cuánto margen queda antes de alcanzar tu límite de pérdida.', 'internal', 'Riesgo', 'shield', null, '/herramientas/drawdown', null, true, 10, 'published', false),
  ('profit-split', 'Calculadora de Profit Split', 'Distribuye una ganancia entre el trader y la firma según el porcentaje acordado.', 'internal', 'Payouts', 'percent', null, '/herramientas/profit-split', null, true, 20, 'published', false),
  ('challenge-target', 'Calculadora de Objetivo', 'Mide el progreso y el saldo faltante para alcanzar el objetivo de un challenge.', 'internal', 'Challenges', 'target', null, '/herramientas/challenge-target', null, false, 30, 'published', false)
on conflict (slug) do update set
  name = excluded.name,
  short_description = excluded.short_description,
  tool_type = excluded.tool_type,
  category = excluded.category,
  icon_key = excluded.icon_key,
  internal_path = excluded.internal_path,
  external_url = excluded.external_url,
  is_featured = excluded.is_featured,
  display_order = excluded.display_order,
  status = excluded.status,
  open_in_new_tab = excluded.open_in_new_tab;

commit;
