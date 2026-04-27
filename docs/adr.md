# ADR — 기술 결정 기록

프로젝트 철학: **최소 기능, 최대 속도, 크래시 없는 안정성.** YC MVP.

---

## ADR-001: 피팅 방식 — Gemini Pro 이미지 합성

**결정**: 전신 사진 + 옷 이미지를 Gemini Pro에 보내 합성.
**불채택**:
- IDM-VTON: 코디 통째로 불가 (단일 의류만), 무료 HuggingFace Space 불안정, YC 데모 중 장애 리스크.
- 실시간 AR: body segmentation + cloth simulation 필요, MVP 범위 초과.
- 2D 실루엣: 시각적 임팩트 부족.
**리스크**: Gemini 합성 품질 미검증. 대응: 서버 `/try-on` 엔드포인트 추상화로 전문 Try-On API 교체 가능하게 설계.

## ADR-002: 체형 입력 삭제

**결정**: 키/가슴/허리 등 수치 입력 기능 제거. 전신 사진이 대체.
**이유**: 사진 기반 피팅 채택으로 수치가 불필요해짐. 기능 6→5개 축소, 화면 1개 제거.

## ADR-003: AI 모델 분리 — Flash/Pro

**결정**: 분석·추천은 Gemini Flash, 피팅은 Gemini Pro.
**이유**: Flash는 텍스트/분석에 충분하고 저렴. Pro는 이미지 생성 품질이 높음. 비용과 품질의 균형.

## ADR-004: 스타일 추천 — 메타데이터 기반

**결정**: 옷 이미지를 보내지 않고 메타데이터 JSON(카테고리, 색상, 소재, 태그)만 전송.
**이유**: 옷 50벌 이상이면 이미지 전송 시 토큰 비용/컨텍스트 한계. id로 로컬 이미지 매핑.

## ADR-005: 추천 입력 — TPO 프리셋

**결정**: 자유 텍스트 대신 6개 프리셋 (출근/데이트/캐주얼/운동/여행/파티).
**이유**: 구현 속도 최우선. 프리셋은 Gemini 프롬프트에 직접 매핑되어 프롬프트 엔지니어링 단순. 자유 텍스트는 엣지케이스 처리 복잡.

## ADR-006: 이미지 전송 — Multipart

**결정**: Base64 JSON 대신 multipart/form-data.
**이유**: 5장 일괄 분석 + 피팅(전신+옷 여러 장) 시 요청 크기 안정적.

## ADR-007: 상태 관리 — Context + useState

**결정**: 외부 라이브러리 없이 React 내장만 사용.
**이유**: 스키마 3개, 화면 8개 미만. Zustand/Redux는 오버엔지니어링.

## ADR-008: 옷 삭제 시 피팅 기록 유지

**결정**: 피팅 기록 보존, 삭제된 옷 썸네일은 placeholder.
**이유**: 합성 이미지 자체는 독립적으로 가치 있음. 연쇄 삭제는 사용자 기대와 불일치.

## ADR-009: 피팅 선택 — 카테고리당 1개 + 아우터 레이어드

**결정**: 카테고리당 최대 1개. 레이어드는 상의(이너) + 아우터(겉) 조합으로 해결.
**이유**: 이미 카테고리에 "아우터"가 분리되어 있어 구조 변경 불필요. 복수 선택 허용 시 Gemini 프롬프트 복잡도와 품질 저하.

## ADR-010: 추천 캐싱 없음

**결정**: TPO 재진입 시 매번 새 요청.
**이유**: 캐시 무효화 로직(옷 등록/삭제 시) 복잡도 대비 이득 적음. MVP 단순화.

## ADR-011: 전신 사진 — 1회 저장, 재사용

**결정**: 피팅 첫 시도 시 촬영, 로컬 저장, 이후 재사용. 피팅 탭 ⚙️로 변경.
**이유**: 매번 촬영은 UX 마찰. 저장 시 일관된 합성 결과.

## ADR-012: Local-first + LWW 동기화 전략

**Context**: 단일 사용자 멀티 기기 + 향후 멀티 유저 확장. 오프라인에서도 즉시 반영되어야 하고, 동시 편집 시 단순한 충돌 해소가 필요하다.
**Decision**: AsyncStorage 를 로컬 source-of-truth 로 유지하고 Supabase 와 양방향 sync. `updated_at` ISO 타임스탬프 비교로 LWW(Last-Write-Wins) 머지. 삭제는 hard delete 가 아니라 `deleted_at` 으로 soft delete — 다른 기기에 사라짐 신호로 전달된다. `remote_synced_at` 필드로 push 큐를 관리(== null 또는 < updated_at 이면 push 대상).
**Consequences**:
- 오프라인 mutation 이 즉시 UI 에 반영, 온라인 복귀 시 자동 push.
- 동시 편집은 최후 승 — 동시성 충돌이 드물 것이라 가정. 협업 편집 같은 상황은 본 마일스톤 미지원.
- Soft delete 덕분에 ADR-008 (옷 삭제 후 피팅 placeholder) 가 sync 환경에서도 유지된다.
- LWW 머지 시 로컬 file:// imageUri 는 보존(서버 remote path 가 더 최신이어도) — multipart fetch 가 캐시된 로컬 파일을 재사용 가능.

## ADR-013: Supabase Auth(Google OAuth) 위임 + 서버 JWKS 검증

**Context**: 자체 인증/세션 운영 비용 회피. Expo Go 호환을 유지하면서 모바일 OAuth 흐름을 처리해야 한다. 본 마일스톤은 Android + Web 타겟이며 Apple 로그인 미지원.
**Decision**: Supabase Auth 가 Google OAuth 를 처리(콜백/state 관리/토큰 발급). 앱은 `expo-auth-session` + `expo-web-browser` 의 in-app browser 를 통해 OAuth 페이지를 열고, redirect 로 받은 PKCE `code` 를 `supabase.auth.exchangeCodeForSession` 으로 토큰 교환. 세션은 `expo-secure-store` (chunking adapter, 2KB 한도 우회) 에 저장. 서버는 `Authorization: Bearer <jwt>` 를 받아 Supabase JWKS endpoint 의 공개키로 ES256/RS256 검증(audience='authenticated', exp/sub 강제). 새 비대칭 signing key 시스템에 맞춰 옛 HS256 shared-secret 흐름은 사용하지 않는다.
**Consequences**:
- Apple 로그인 미지원 — 추후 별도 마일스톤.
- Custom Tabs 의 deep link redirect 가 일부 환경에서 자동 close 되지 않는 케이스가 있어, `Linking.addEventListener('url')` 을 `WebBrowser.openAuthSessionAsync` 결과와 `Promise.race` 해 둘 중 먼저 도착하는 쪽으로 진행한다.
- 자체 사용자 DB 없음 — auth.users 테이블이 단일 출처.

## ADR-014: 이미지 Signed URL 업로드 패턴

**Context**: 모든 이미지가 서버를 거쳐 Supabase Storage 로 가면 우리 FastAPI 가 이미지 트래픽을 다 떠안는다. 한편 클라이언트가 service_role key 를 들고 직접 PUT 하면 RLS 우회 권한이 노출되어 보안상 위험하다.
**Decision**: 앱이 `POST /uploads/signed-url` 로 서버에 요청하면, 서버가 service_role 로 Supabase 의 `create_signed_upload_url` 를 호출해 일회성 PUT URL 을 발급한다. 앱은 그 URL 로 직접 Supabase Storage 에 PUT — service_role key 는 절대 클라에 가지 않는다. 객체 경로는 항상 `{user_id}/{uuid}.jpg` 로 서버가 강제 (클라가 다른 prefix 요청해도 무시, filename 에 슬래시/`..` 포함 시 422). Storage RLS 정책도 `(storage.foldername(name))[1] = auth.uid()::text` 로 일관성 유지.
**Consequences**:
- 서버는 메타데이터 + signed URL 발급만 — 이미지 byte 자체는 거치지 않음.
- 읽기는 `POST /uploads/signed-read-url` 로 동일 패턴(5분 캐시).
- 앱의 anon key 는 Storage 직접 호출에 사용하지 않음. RLS 가 보호하지만 정책 미스로 인한 권한 상승 위험을 차단.
- multipart fetch (tryOn / analyze) 는 imageUri 가 remote path 면 호출 시점에 signed read URL 로 변환해서 사용 — 로컬 file:// 캐시가 있으면 그대로.
