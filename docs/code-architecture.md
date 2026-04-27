# 코드 아키텍처

## 앱 — React Native (Expo)

Expo Router, Context + useState, 라이브러리 최소화.

```
app/
├── (tabs)/
│   ├── _layout.tsx              # 탭 내비 (옷장/피팅/추천)
│   ├── closet.tsx               # 옷장
│   ├── fitting.tsx              # 피팅
│   └── recommend.tsx            # 추천 (결과도 조건부 렌더링)
├── _layout.tsx                  # 루트 레이아웃
├── clothing/[id].tsx            # 옷 상세/수정
├── clothing-register.tsx        # 옷 등록
├── fitting-result/[id].tsx      # 피팅 기록 보기
└── fitting-result-new.tsx       # 신규 피팅 결과

components/
├── ClothingCard.tsx             # 그리드 셀 (옷장, 피팅 공용)
├── ClothingForm.tsx             # 메타데이터 폼 (등록, 상세 공용)
├── CategoryFilter.tsx           # 카테고리 칩 (옷장, 피팅 공용)
├── SelectableClothingGrid.tsx   # 체크박스 그리드 (피팅)
└── CombinationCard.tsx          # 추천 조합 카드

services/
├── api.ts                       # FastAPI 호출. 기존 4개 + bootstrap/uploads/clothes/
│                                # fittings/profile sync 헬퍼. Bearer JWT 자동 주입(JSON
│                                # 호출만), 401 시 강제 signOut + clearAllLocal.
│                                # tryOn 은 imageUri 가 remote path 면 signed URL 로 변환.
├── storage.ts                   # AsyncStorage CRUD + sync 메타(updated_at /
│                                # deleted_at / remote_synced_at) + LWW 머지(file:// 보존)
├── supabase.ts                  # Supabase JS client + chunking SecureStore adapter
├── imageUtils.ts                # 리사이즈(1024px), JPG 변환, 파일 저장/삭제
└── sync/
    ├── imageUpload.ts           # signed URL → PUT 패턴, getReadUrl 5분 캐시
    ├── clothesSync.ts           # pushPendingClothes / pullRemoteClothes / syncClothes
    ├── fittingsSync.ts          # 위와 동일 패턴
    └── profileSync.ts           # user 1행 upsert/get + LWW

contexts/
└── AuthContext.tsx              # { user, session, loading, signInWithGoogle,
                                 #   signInWithMockDev, signOut }. mount 시 getSession
                                 #   + onAuthStateChange. 로그인 직후 1회
                                 #   bootstrapUser() (user_profiles row 생성).

constants/
├── categories.ts                # ["상의","하의","아우터","원피스","신발","악세서리"]
├── occasions.ts                 # ["출근","데이트","캐주얼","운동","여행","파티"]
└── theme.ts                     # { point: "#7A8450", ...무채색 }
```

### 설정
- 서버 URL: `EXPO_PUBLIC_API_URL` (.env)
- Supabase: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Dev mock 인증: `EXPO_PUBLIC_DEV_MOCK_AUTH=true` + `_EMAIL` / `_PASSWORD`

## 서버 — FastAPI (Python)

Gemini 프록시. 비즈니스 로직 없음.

```
server/
├── main.py                      # 앱 생성, 라우터 등록, CORS(개발: 전체 허용)
├── middleware/
│   └── auth.py                  # get_current_user FastAPI dependency.
│                                #   Authorization Bearer JWT → JWKS 검증 → CurrentUser.
├── routers/
│   ├── analyze.py               # POST /analyze (Gemini Flash, 인증 없음 - legacy)
│   ├── tryon.py                 # POST /try-on (Gemini Pro)
│   ├── recommend.py             # POST /recommend
│   ├── detect.py                # POST /detect-multi (1장에서 여러 벌)
│   ├── uploads.py               # POST /uploads/signed-url, /signed-read-url (인증)
│   ├── users.py                 # POST /users/bootstrap (멱등 user_profiles 생성)
│   ├── clothes.py               # GET /clothes, POST /clothes/upsert, DELETE /clothes/{id}
│   ├── fittings.py              # 위와 동일 패턴
│   └── profile.py               # GET /profile, POST /profile/upsert (user 1행)
├── services/
│   ├── gemini.py                # Gemini 호출 래퍼 (Flash/Pro 분기)
│   ├── auth.py                  # JWKS 비대칭(ECC P-256) JWT 검증.
│   │                            #   PyJWKClient 캐싱, audience='authenticated'.
│   └── supabase_client.py       # service_role Supabase Python client 싱글턴.
├── prompts/
│   ├── analyze.py
│   ├── tryon.py
│   ├── recommend.py
│   └── detect_multi.py
├── schemas.py
├── config.py                    # Settings dataclass — gemini_api_key, supabase_url,
│                                #   supabase_service_role_key, google_oauth_client_id,
│                                #   supabase_jwks_url 프로퍼티 (URL 에서 자동 조립).
└── requirements.txt
```

## 데이터 흐름

```
┌───────────┐  Bearer JWT      ┌────────────┐  service_role    ┌──────────┐
│  Expo App │ ───────────────▶ │  FastAPI   │ ────────────────▶│ Supabase │
│           │ ◀─────────────── │  (JWKS 검증)│ ◀─────────────── │ (RLS 우회)│
└───────────┘                  └────────────┘                  └──────────┘
     │                                ▲
     │  PUT (signed URL, no key)      │  POST /uploads/signed-url
     ▼                                │
┌──────────────────┐                  │
│ Supabase Storage │ ─────────────────┘
│ {user_id}/x.jpg  │
└──────────────────┘
```

- 메타 sync (clothes/fittings/profile): 앱 → FastAPI → Supabase. JWT 검증 후 service_role
  로 RLS 우회하지만 user_id 는 항상 서버에서 current_user 로 강제.
- 이미지 업로드: 앱이 FastAPI 에 signed URL 만 받고, 그 URL 로 Supabase Storage 에 직접
  PUT. 우리 서버는 이미지 byte 를 거치지 않는다 (ADR-014).
