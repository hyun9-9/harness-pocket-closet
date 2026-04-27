-- 0004_set_updated_at_search_path.sql
-- public.set_updated_at() 의 search_path 를 명시적으로 고정한다.
-- 이유: Supabase database linter (lint 0011_function_search_path_mutable) 가
-- mutable search_path 를 권한 상승 위험으로 경고한다. trigger 함수가 now() 만
-- 호출하므로 pg_catalog + public 으로 충분.
-- 참고: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
