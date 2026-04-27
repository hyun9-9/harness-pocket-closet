# Supabase Storage 셋업

Pocket Closet 은 모든 이미지(옷 사진 / 피팅 결과 / 전신 사진) 를 Supabase Storage 의
**private 버킷** 3개에 저장한다. 앱은 anon key 로 직접 업로드하지 않고, 서버가 발급한
**signed URL 로 PUT** 한다 — service_role key 가 클라이언트 번들에 새지 않도록 하기 위함.

## 버킷

| 이름 | 용도 | 객체 경로 컨벤션 |
|---|---|---|
| `clothes`  | 옷 사진       | `{user_id}/{clothing_id}.jpg` |
| `fittings` | 피팅 결과 이미지 | `{user_id}/{fitting_id}.jpg` |
| `person`   | 전신 사진     | `{user_id}/{uuid}.jpg` |

세 버킷 모두 **public 아님**. 외부 노출은 signed URL(만료 시간 포함) 로만.

## 콘솔에서 만드는 절차

1. Supabase Dashboard → **Storage** → **New bucket**
2. 이름에 `clothes`/`fittings`/`person` 각각 입력
3. **Public bucket** 체크 해제 (private 으로 둔다)
4. Save

## 동등한 SQL (콘솔 대신 SQL Editor 에서 한 번에)

```sql
insert into storage.buckets (id, name, public)
values
  ('clothes',  'clothes',  false),
  ('fittings', 'fittings', false),
  ('person',   'person',   false)
on conflict (id) do nothing;
```

## 버킷별 RLS 정책

`storage.objects` 는 RLS 가 기본 활성화돼 있다. 사용자가 자기 prefix
(`{user_id}/...`) 의 객체에만 read/insert/update/delete 가능하도록 12개 정책을 건다.
service_role key 는 RLS 를 우회하므로 서버 signed URL 흐름엔 영향 없음.

```sql
-- ============================================================
-- clothes 버킷
-- ============================================================
create policy "clothes_select_own"
on storage.objects for select
using (
  bucket_id = 'clothes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "clothes_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'clothes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "clothes_update_own"
on storage.objects for update
using (
  bucket_id = 'clothes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "clothes_delete_own"
on storage.objects for delete
using (
  bucket_id = 'clothes'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- fittings 버킷
-- ============================================================
create policy "fittings_select_own"
on storage.objects for select
using (
  bucket_id = 'fittings'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "fittings_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'fittings'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "fittings_update_own"
on storage.objects for update
using (
  bucket_id = 'fittings'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "fittings_delete_own"
on storage.objects for delete
using (
  bucket_id = 'fittings'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- person 버킷
-- ============================================================
create policy "person_select_own"
on storage.objects for select
using (
  bucket_id = 'person'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "person_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'person'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "person_update_own"
on storage.objects for update
using (
  bucket_id = 'person'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "person_delete_own"
on storage.objects for delete
using (
  bucket_id = 'person'
  and auth.uid()::text = (storage.foldername(name))[1]
);
```

`(storage.foldername(name))[1]` 은 객체 키 `{user_id}/{file}.jpg` 의 첫 segment 인
`{user_id}` 를 뽑아낸다. 그 값이 호출자의 `auth.uid()` 와 일치할 때만 통과.

## 검증

```sql
-- 버킷 3개 + private 여부 확인
select id, name, public from storage.buckets where id in ('clothes','fittings','person');

-- 정책 12개 확인
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by policyname;
```

## 클라/서버 흐름 요약

```
[App]                                       [Server (service_role)]
  │  POST /clothes/upload-url                       │
  │ ─────────────────────────────────────────────▶ │
  │                                                 │ create_signed_upload_url(
  │                                                 │   bucket='clothes',
  │                                                 │   path=f"{user_id}/{clothing_id}.jpg")
  │  signed_url, path                               │
  │ ◀───────────────────────────────────────────── │
  │                                                 │
  │  PUT signed_url (binary, no auth header needed) │
  │ ─────────────────────────────────────────────▶ Supabase Storage
  │                                                 │
  │  POST /clothes  { id, image_url=path, ... }     │
  │ ─────────────────────────────────────────────▶ │
```

앱은 어떤 단계에서도 `service_role` key 를 보지 않는다. signed URL 만으로 업로드.
