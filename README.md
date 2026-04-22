# 주머니 속 옷장 (Pocket Closet)

옷 사진을 찍으면 AI가 분석하고, 전신 사진 위에 옷을 합성해 피팅해보고, 상황별 코디를 추천받는 모바일 앱.

## 아키텍처 개요

```
┌─────────────────┐   HTTPS   ┌─────────────────┐   SDK    ┌──────────────┐
│  Expo RN App    │ ────────▶ │  FastAPI Server │ ───────▶ │   Gemini     │
│  (옷장/피팅/추천)│           │  (API 프록시)   │          │  Flash / Pro │
└─────────────────┘           └─────────────────┘          └──────────────┘
       │                             │
       ▼                             ▼
AsyncStorage + FS              환경변수만 보유 (GEMINI_API_KEY)
(옷/피팅/전신 사진 영속)        앱은 키를 절대 알지 못함
```

- 앱은 이미지와 메타데이터를 모두 로컬(AsyncStorage + `FileSystem`)에 저장한다. DB 없음.
- 서버는 `/analyze`, `/try-on`, `/recommend` 세 엔드포인트만 제공하는 얇은 프록시이다.
- API 키는 서버 `.env`에만 존재하고, 클라이언트 번들에는 절대 포함되지 않는다.

## 기능

| # | 기능 | 설명 |
|---|------|------|
| 1 | 옷 등록 | 촬영/갤러리(최대 5장) → Gemini Flash 분석 → 메타데이터 수정 → 로컬 저장 |
| 2 | 옷장 | 3열 그리드 + 카테고리 필터 (상의/하의/아우터/원피스/신발/악세서리) |
| 3 | 옷 상세 | 메타데이터 편집 및 삭제 |
| 4 | 피팅 | 전신 사진 + 옷 복수 선택 → Gemini Pro 합성, 결과 저장/바꿔보기 |
| 5 | 스타일 추천 | TPO 6개(출근/데이트/캐주얼/운동/여행/파티) → 조합 3개 + 한줄 코멘트 |

## 스택

- **앱**: React Native (Expo ~54), Expo Router, TypeScript
- **서버**: FastAPI (Python 3.11+) — Gemini 프록시
- **AI**: Google Gemini (Flash: 분석/추천, Pro: 피팅 합성)
- **저장**: AsyncStorage + 로컬 파일시스템 (DB 없음)
- **테스트**: Jest (jest-expo) / pytest

## 디렉토리 구조

```
app/                              # Expo Router 앱
  app/
    (tabs)/                       # 탭 화면 (closet / fitting / recommend)
    clothing/[id].tsx             # 옷 상세
    clothing-register.tsx         # 옷 등록 폼
    fitting-result/[id].tsx       # 피팅 기록 상세
    fitting-result-new.tsx        # 새 피팅 결과
    person-camera.tsx             # 전신 사진 촬영
  components/                     # 공용 UI 컴포넌트 (Button, ClothingCard 등)
  services/                       # storage, imageUtils, api, imagePicker
  constants/                      # theme, categories, occasions, storageKeys
  types/                          # TS 타입 정의
  __tests__/                      # Jest 테스트
server/                           # FastAPI 서버
  main.py                         # 앱 진입점
  routers/                        # /analyze, /try-on, /recommend
  services/                       # Gemini 클라이언트 래퍼
  prompts/                        # Gemini 프롬프트 템플릿
  tests/                          # pytest
docs/                             # PRD, 아키텍처, 플로우, E2E 체크리스트
tasks/0-mvp/                      # Phase 단위 작업 지시서
scripts/                          # 개발 워크플로우 자동화 (run-phases.py 등)
```

## 환경변수

각 워크스페이스의 `.env.example`을 복사해서 `.env`로 만든다.

```bash
cp app/.env.example app/.env
cp server/.env.example server/.env
# server/.env 의 GEMINI_API_KEY 를 채운다
```

| 파일 | 변수 | 설명 |
|------|------|------|
| `app/.env` | `EXPO_PUBLIC_API_URL` | 서버 주소. 기본값 `http://localhost:8000`. 실기기에서 접속할 때는 머신 LAN IP로 교체 |
| `server/.env` | `GEMINI_API_KEY` | Google AI Studio에서 발급받은 키. **절대 앱 코드에 커밋하지 말 것** |

## 로컬 실행 순서

네트워크 호출이 동작하려면 **서버를 먼저 기동**한다.

### 1. 서버 기동

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
```

기본 포트는 `8000`. 헬스체크: `curl http://localhost:8000/health` → `{"status":"ok"}`.

### 2. 앱 기동

```bash
cd app
npm install
npx expo start
```

시뮬레이터/실기기/웹 중 원하는 타겟을 선택한다.

## 테스트 실행

```bash
# 앱 (Jest)
cd app && npm test

# 앱 타입 체크
cd app && npx tsc --noEmit

# 서버 (pytest)
cd server && pytest
```

세 커맨드가 모두 exit 0이어야 MVP 합격 기준이다. 상세한 E2E 시나리오는 [`docs/e2e-checklist.md`](docs/e2e-checklist.md) 참고.

## 제약 (MVP 스코프)

- DB / 로그인 / 부가 스크린 없음
- 포인트 색상 `#7A8450` + 무채색
- API 키는 서버에서만 관리 (앱 번들 미포함)

## 개발 워크플로우

이 저장소는 Claude Code 기반 harness 파이프라인(Clarify → Context → Plan → Generate → Evaluate)으로 작업을 진행한다. Phase 단위 작업 지시는 `tasks/0-mvp/`에, 설계 문서는 `docs/`에 있다.
