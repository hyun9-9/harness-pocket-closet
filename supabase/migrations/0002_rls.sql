-- 0002_rls.sql — Pocket Closet RLS 정책
-- 0001_init.sql 다음에 실행한다.
--
-- 설계 메모
-- - 모든 테이블에 RLS 활성화. 정책은 행 소유자(auth.uid() = user_id) 만 통과.
-- - service_role key 는 RLS 우회가 기본 동작이므로 별도 정책을 만들지 않는다.
--   서버는 service_role 로 접속해 RLS 와 무관하게 동작 (signed URL 발급, bootstrap 등).
-- - 정책명 컨벤션: {table}_{action}_own
--
-- 검증용 쿼리 (실행 후 별도로 돌려보면 정책 12개가 등록된 걸 확인 가능):
--   select schemaname, tablename, policyname, cmd
--   from pg_policies
--   where schemaname = 'public'
--   order by tablename, cmd;

alter table public.clothes        enable row level security;
alter table public.fittings       enable row level security;
alter table public.user_profiles  enable row level security;

-- ==========================================================================
-- clothes — 4 정책
-- ==========================================================================
drop policy if exists clothes_select_own on public.clothes;
create policy clothes_select_own on public.clothes
  for select using (auth.uid() = user_id);

drop policy if exists clothes_insert_own on public.clothes;
create policy clothes_insert_own on public.clothes
  for insert with check (auth.uid() = user_id);

drop policy if exists clothes_update_own on public.clothes;
create policy clothes_update_own on public.clothes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists clothes_delete_own on public.clothes;
create policy clothes_delete_own on public.clothes
  for delete using (auth.uid() = user_id);

-- ==========================================================================
-- fittings — 4 정책
-- ==========================================================================
drop policy if exists fittings_select_own on public.fittings;
create policy fittings_select_own on public.fittings
  for select using (auth.uid() = user_id);

drop policy if exists fittings_insert_own on public.fittings;
create policy fittings_insert_own on public.fittings
  for insert with check (auth.uid() = user_id);

drop policy if exists fittings_update_own on public.fittings;
create policy fittings_update_own on public.fittings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists fittings_delete_own on public.fittings;
create policy fittings_delete_own on public.fittings
  for delete using (auth.uid() = user_id);

-- ==========================================================================
-- user_profiles — 4 정책 (user_id 가 PK 이자 owner)
-- ==========================================================================
drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own on public.user_profiles
  for select using (auth.uid() = user_id);

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own on public.user_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own on public.user_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists user_profiles_delete_own on public.user_profiles;
create policy user_profiles_delete_own on public.user_profiles
  for delete using (auth.uid() = user_id);
