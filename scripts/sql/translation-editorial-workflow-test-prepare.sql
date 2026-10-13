\set ON_ERROR_STOP on

-- Simula una traducción publicada por el flujo previo a 3E.2. La migración
-- debe conservar su visibilidad sin modificar el texto.
select set_config('app.test_permissions','blog.update,blog.view',false);
select public.translation_save_manual(
  'blog_post_translation',
  (select id::text from public.blog_posts where slug='market-guide'),
  'title','en',to_jsonb('Legacy published title'::text),true
);
