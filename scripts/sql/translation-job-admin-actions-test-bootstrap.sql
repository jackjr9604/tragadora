\set ON_ERROR_STOP on

\ir blog-translations-test-bootstrap.sql
\ir ../../supabase/migrations/202610100001_translation_persistence_infrastructure.sql
\ir ../../supabase/migrations/202610100002_offer_translations.sql
\ir ../../supabase/migrations/202610100003_challenge_translations.sql
\ir ../../supabase/migrations/202610110001_broker_exchange_detail_translations.sql
\ir ../../supabase/migrations/202610110002_tool_translations.sql
\ir ../../supabase/migrations/202610110003_community_translations.sql
\ir ../../supabase/migrations/202610120001_giveaway_translations.sql
\ir ../../supabase/migrations/202610120002_blog_translations.sql
\ir translation-editorial-workflow-test-prepare.sql
\ir ../../supabase/migrations/202610120003_translation_editorial_workflow.sql
\ir ../../supabase/migrations/202610130001_translation_ai_draft_engine.sql

create table public.profiles(id uuid primary key);
insert into public.profiles(id) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
create table public.admin_audit_log(
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),target_user_id uuid references public.profiles(id),
  action text not null,module text,previous_value jsonb,new_value jsonb,created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('app.test_user_id',true),'')::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('app.test_role',true),''),'authenticated')
$$;

\ir ../../supabase/migrations/202610160002_translation_job_admin_actions.sql
