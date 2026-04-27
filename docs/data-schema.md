# 데이터 스키마

DB 없음. AsyncStorage(JSON) + expo-file-system(이미지). 전부 로컬.

## 모델

```typescript
// 옷
interface Clothing {
  id: string              // uuid
  imageUri: string         // 로컬 파일 경로
  category: "상의" | "하의" | "아우터" | "원피스" | "신발" | "악세서리"
  colors: string[]         // ["검정", "흰색"]
  material: string         // "면"
  tags: string[]           // ["캐주얼", "미니멀"]
  createdAt: number        // timestamp
}

// 피팅 기록
interface FittingResult {
  id: string               // uuid
  resultImageUri: string   // 합성 이미지 로컬 경로
  clothingIds: string[]    // 사용된 옷 id
  createdAt: number
}

// 사용자
interface UserProfile {
  personImageUri: string | null  // 전신 사진 경로
}
```

## 저장 키

| AsyncStorage 키 | 타입 |
|-----------------|------|
| `@clothes` | Clothing[] |
| `@fittings` | FittingResult[] |
| `@userProfile` | UserProfile |

## 파일 구조

```
{documentDirectory}/
├── clothes/{id}.jpg       # 옷 (전부 JPG 변환)
├── fittings/{id}.jpg      # 합성 결과
└── person.jpg             # 전신 사진
```

## 정책

- **이미지**: 앱에서 1024px 리사이즈 + JPG 변환 후 저장
- **피팅 기록**: 제한 없음 (MVP)
- **옷 삭제 시**: 피팅 기록 유지, 삭제된 옷 썸네일은 placeholder 표시
- **추천 캐싱**: 없음 — 매번 새 요청

## Supabase Postgres 스키마 (Phase 1~5)

DB 도입 후 AsyncStorage 는 로컬 캐시 + push 큐 역할. Supabase 는 source-of-record.

### 테이블

| 테이블 | 컬럼 |
|---|---|
| `clothes` | `id uuid PK`, `user_id uuid FK auth.users(id) on delete cascade`, `image_url text`, `category text`, `colors jsonb`, `material text`, `tags jsonb`, `created_at timestamptz`, `updated_at timestamptz`, `deleted_at timestamptz` |
| `fittings` | `id uuid PK`, `user_id uuid FK auth.users(id) on delete cascade`, `result_image_url text`, `clothing_ids jsonb`, `created_at timestamptz`, `updated_at timestamptz`, `deleted_at timestamptz` |
| `user_profiles` | `user_id uuid PK FK auth.users(id) on delete cascade`, `person_image_url text`, `updated_at timestamptz`, `deleted_at timestamptz` |

PK 는 모두 uuid — 앱이 만든 client uuid 를 그대로 사용 (server default 미사용). 오프라인 작성한 행을 그대로 push 가능.

### 트리거 / 인덱스

- `set_updated_at()` BEFORE UPDATE 트리거가 3개 테이블의 `updated_at` 자동 갱신 (search_path 명시 고정).
- `idx_clothes_user_updated`, `idx_fittings_user_updated` — pull `since` 쿼리 가속.
- `idx_clothes_user_alive` — `where deleted_at is null` partial index, 옷장 표시 가속.

### LWW 정책

- 클라가 보낸 `updated_at` 을 우선 신뢰. UPSERT 시 conflict 면 trigger 가 갱신.
- pull 시 클라이언트가 로컬과 비교해 **`updated_at` 큰 쪽 승**. 같으면 변경 없음.
- 삭제는 hard delete 가 아니라 `deleted_at` set (soft delete) — 다른 기기에 사라짐 신호.
- `remote_synced_at` (클라 전용 메타) — push 큐 관리.

### RLS

- 3개 테이블 모두 `enable row level security`.
- 정책: `auth.uid() = user_id` 인 행만 select/insert/update/delete 가능 (12개 정책).
- service_role key 는 RLS 우회 — 서버 전용. 클라이언트는 anon key 만 사용하며 RLS 안에서 동작.

## Supabase Storage

3개 **private** 버킷 (public 아님):

| 버킷 | 용도 | 객체 경로 컨벤션 |
|---|---|---|
| `clothes` | 옷 사진 | `{user_id}/{clothing_id}.jpg` |
| `fittings` | 피팅 결과 | `{user_id}/{fitting_id}.jpg` |
| `person` | 전신 사진 | `{user_id}/{uuid}.jpg` |

업로드는 ADR-014 의 signed URL 패턴 — 앱이 anon key 로 직접 PUT 하지 않고, 서버가 발급한 일회성 PUT URL 사용. `storage.objects` RLS 가 `(storage.foldername(name))[1] = auth.uid()::text` 로 사용자별 prefix 격리.

세부 SQL 은 `supabase/migrations/0001_init.sql`, `0002_rls.sql`, `0004_set_updated_at_search_path.sql` 와 `supabase/storage-setup.md` 참고.
