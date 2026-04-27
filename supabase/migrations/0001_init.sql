-- 0001_init.sql — Pocket Closet 초기 스키마
-- 실행 순서: 0001_init.sql → 0002_rls.sql 순서로 SQL Editor 에서 실행한다.
--
-- 설계 메모
-- - PK 는 모두 uuid. 앱이 만든 client uuid 를 그대로 PK 로 사용한다 (서버 default 미사용).
--   → 오프라인 작성한 행을 그대로 push 할 수 있고, 동일 id 로 LWW 기반 sync 가능.
-- - updated_at 은 set_updated_at() 트리거가 row UPDATE 시 자동 갱신한다.
-- - deleted_at 은 soft delete 컬럼. NULL 이면 살아있음, 시각이 박히면 tombstone.
-- - user_id 는 auth.users(id) 참조. 사용자가 삭제되면 cascade 로 함께 삭제.

create extension if not exists "pgcrypto";

-- ==========================================================================
-- updated_at 자동 갱신 트리거
-- ==========================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================================================================
-- clothes — 옷 (앱이 보낸 client uuid 를 PK 로 사용)
-- ==========================================================================
create table if not exists public.clothes (
  id                  uuid primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  image_url           text,
  category            text,
  colors              jsonb,
  material            text,
  tags                jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

drop trigger if exists trg_clothes_updated_at on public.clothes;
create trigger trg_clothes_updated_at
before update on public.clothes
for each row execute function public.set_updated_at();

create index if not exists idx_clothes_user_updated
  on public.clothes (user_id, updated_at);

create index if not exists idx_clothes_user_alive
  on public.clothes (user_id)
  where deleted_at is null;

-- ==========================================================================
-- fittings — 피팅 결과 (옷 여러 벌 합성한 한 장)
-- ==========================================================================
create table if not exists public.fittings (
  id                  uuid primary key,
  user_id             uuid not null references auth.users(id) on delete cascade,
  result_image_url    text,
  clothing_ids        jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

drop trigger if exists trg_fittings_updated_at on public.fittings;
create trigger trg_fittings_updated_at
before update on public.fittings
for each row execute function public.set_updated_at();

create index if not exists idx_fittings_user_updated
  on public.fittings (user_id, updated_at);

-- ==========================================================================
-- user_profiles — 사용자별 전신사진 1장 (user_id 자체가 PK)
-- ==========================================================================
create table if not exists public.user_profiles (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  person_image_url    text,
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();
