-- Reproduce only the deployed contract relevant to 202610270002.
revoke all on function public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean)
  from public,anon,authenticated,service_role;
grant execute on function public.translation_request_ai_draft(uuid,bigint,integer,integer,integer,integer,boolean)
  to authenticated,service_role;
