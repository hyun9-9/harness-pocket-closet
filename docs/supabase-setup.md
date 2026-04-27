# Supabase 셋업

Pocket Closet 의 클라우드 sync(옷 / 피팅 / 전신사진) 와 Google 로그인을 위해 Supabase
무료 프로젝트 1개 + Google Cloud OAuth 클라이언트 1개를 준비한다.

> Google 로그인은 Expo Go 호환을 위해 **`expo-auth-session` + Supabase Hosted OAuth**
> 흐름을 쓴다. 그래서 Google Cloud Console 에서 만들 OAuth 클라이언트는 **Web type 1개**
> 면 충분하다. Android / iOS 네이티브 OAuth 클라이언트는 만들 필요 없음.

---

## 1. Supabase 콘솔에서 프로젝트 생성

1. https://supabase.com 에 로그인 → **New Project**
2. **Region**: `Northeast Asia (Tokyo)` 권장 (한국 사용자 기준 latency 가장 낮음)
3. 무료 플랜으로 생성. 약 1~2분 후 사용 가능.

## 2. 키 / 시크릿 복사

좌측 메뉴 → **Project Settings → API Keys** 페이지:

| 콘솔 위치 | 어디로 | env 변수 |
|---|---|---|
| `Project URL` | server **+** app | `SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_URL` |
| `Publishable key` (`sb_publishable_*`) | **app 만** | `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| `Secret key` (`sb_secret_*`) | **server 만** ⚠️ | `SUPABASE_SERVICE_ROLE_KEY` |

> ⚠️ **`Secret key` 는 RLS 우회 권한**. 절대 앱 번들 / git 저장소 / 채팅 메시지에 평문으로
> 두지 말 것. 노출되면 DB 전체가 털린다. 의심되면 **API Keys 페이지의 Rotate** 로 즉시 회전.

### JWT 검증은 별도 변수 없음

이 프로젝트는 Supabase 의 새 비대칭(ECC P-256) 시스템을 쓴다. 토큰 검증은 서버가
JWKS endpoint(`https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`)
에서 공개키를 동적으로 받아 처리하므로, 옛 `SUPABASE_JWT_SECRET` (HS256 shared secret)
같은 환경변수는 **사용하지 않는다**. JWKS URL 은 서버 코드가 `SUPABASE_URL` 에서 자동
조립한다.

## 3. Google OAuth 연결

### 3-1. Google Cloud Console — Web client 생성

1. https://console.cloud.google.com → **APIs & Services → Credentials**
2. **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. **Authorized redirect URIs** 에 Supabase 가 안내하는 URL 추가:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   (정확한 URL 은 Supabase Dashboard → Authentication → Providers → Google 화면에 표시됨)
5. Create → 발급된 **Client ID** / **Client Secret** 복사

### 3-2. Supabase Dashboard — Google provider 활성화

1. Supabase Dashboard → **Authentication → Providers → Google**
2. **Enable**
3. Google 의 `Client ID`, `Client Secret` 붙여넣기
4. Save

### 3-3. (선택) 서버 ID token 검증용

서버에서 Google ID token 의 `aud` (audience) 비교를 하려면 위 Google Web Client ID 를
`server/.env` 의 `GOOGLE_OAUTH_CLIENT_ID` 에도 넣는다. 옵션이며, 미설정 시 audience
검증을 건너뛴다.

## 4. SQL 마이그레이션 실행

좌측 메뉴 → **SQL Editor** 에서 아래 두 파일을 **순서대로** 1회씩 실행:

1. `supabase/migrations/0001_init.sql` — 테이블(`clothes` / `fittings` / `user_profiles`),
   `set_updated_at()` 트리거, 인덱스
2. `supabase/migrations/0002_rls.sql` — 12개 RLS 정책 (행 소유자 only)

검증:
```sql
select schemaname, tablename, policyname, cmd
from pg_policies where schemaname = 'public'
order by tablename, cmd;
-- 12행 (3 테이블 × 4 cmd) 가 나와야 정상
```

## 5. Storage 버킷 + 정책

→ [`supabase/storage-setup.md`](../supabase/storage-setup.md)

요약: `clothes` / `fittings` / `person` 3개 private 버킷을 만들고 각각 4개 RLS 정책
(총 12개) 을 건다. 앱은 anon key 로 직접 업로드하지 않고, **서버가 발급한 signed URL
로 PUT** 한다.

## 6. 로컬 `.env` 채우기

```bash
cp app/.env.example app/.env
cp server/.env.example server/.env
# 위 표대로 키 값 넣기
```

### env 매핑 종합

| 파일 | 변수 | 값 출처 | 필수 |
|---|---|---|:---:|
| `server/.env` | `GEMINI_API_KEY` | Google AI Studio | ✅ |
| `server/.env` | `SUPABASE_URL` | Supabase Project URL | ✅ |
| `server/.env` | `SUPABASE_SERVICE_ROLE_KEY` | Supabase API Keys → `Secret key` | ✅ |
| `server/.env` | `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud Console → Web client ID | ⬜ |
| `app/.env` | `EXPO_PUBLIC_API_URL` | 서버 주소 (실기기는 LAN IP) | ✅ |
| `app/.env` | `EXPO_PUBLIC_SUPABASE_URL` | Supabase Project URL (server 와 같음) | ✅ |
| `app/.env` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase API Keys → `Publishable key` | ✅ |
| `app/.env` | `EXPO_PUBLIC_DEV_MOCK_AUTH` | `false` (개발 중 임시 통과 시 `true`) | ✅ |

## 점검 체크리스트

- [ ] Supabase 프로젝트 생성 및 API Keys 페이지에서 URL / `sb_publishable_*` / `sb_secret_*` 확보
- [ ] Google Cloud Web OAuth 클라이언트 + Supabase 의 Authorized redirect URI 등록
- [ ] Supabase Dashboard → Authentication → Providers → Google 에 Client ID/Secret 입력 후 Enable
- [ ] SQL Editor 에서 `0001_init.sql` → `0002_rls.sql` 순서로 실행
- [ ] Storage 버킷 `clothes` / `fittings` / `person` 생성 + 12개 RLS 정책 실행
- [ ] `server/.env` / `app/.env` 위 표대로 채움
