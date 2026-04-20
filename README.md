# 주머니 속 옷장 (Pocket Closet)

옷 사진을 찍으면 AI가 분석하고, 전신 사진 위에 옷을 합성해 피팅해보고, 상황별 코디를 추천받는 모바일 앱.

## 기능

| # | 기능 | 설명 |
|---|------|------|
| 1 | 옷 등록 | 촬영/갤러리(최대 5장) → Gemini Flash 분석 → 메타데이터 수정 → 로컬 저장 |
| 2 | 옷장 | 3열 그리드 + 카테고리 필터 (상의/하의/아우터/원피스/신발/악세서리) |
| 3 | 옷 상세 | 메타데이터 편집 및 삭제 |
| 4 | 피팅 | 전신 사진 + 옷 복수 선택 → Gemini Pro 합성, 결과 저장/바꿔보기 |
| 5 | 스타일 추천 | TPO 6개(출근/데이트/캐주얼/운동/여행/파티) → 조합 3개 + 한줄 코멘트 |

## 스택

- **앱**: React Native (Expo), Expo Router
- **서버**: FastAPI (Python) — Gemini 프록시
- **AI**: Google Gemini (Flash: 분석/추천, Pro: 합성)
- **저장**: AsyncStorage + 로컬 파일시스템 (DB 없음)

## 제약

- DB / 로그인 / 부가 스크린 없음
- 포인트 색상 `#7A8450` + 무채색
- API 키는 서버에서만 관리 (앱 미포함)

## 구조

```
app/          # Expo Router 화면 (옷장/피팅/추천 3탭)
server/       # FastAPI — /analyze, /try-on, /recommend
docs/         # PRD, 아키텍처, 데이터 스키마, 플로우
scripts/      # 개발 워크플로우 자동화 (run-phases.py 등)
prompts/      # 작업 생성 프롬프트
```

## 환경변수 설정

실행 전 각 워크스페이스의 `.env.example`을 복사해서 `.env`로 만든다.

```bash
cp app/.env.example app/.env
cp server/.env.example server/.env
# server/.env 의 GEMINI_API_KEY 를 채운다
```

- `app/.env` — `EXPO_PUBLIC_API_URL` (기본값 `http://localhost:8000`)
- `server/.env` — `GEMINI_API_KEY` (Google AI Studio에서 발급)

## 앱 실행

```bash
cd app
npm install
npx expo start
```

시뮬레이터/실기기/웹 중 원하는 타겟을 선택한다. 서버가 먼저 기동되어 있어야 네트워크 호출이 동작한다.

## 서버 실행

```bash
cd server
pip install -r requirements.txt
uvicorn main:app --reload
```

기본 포트는 `8000`. 헬스체크: `curl http://localhost:8000/health` → `{"status":"ok"}`.

## 테스트 실행

```bash
# 앱 (Jest)
cd app && npm test

# 서버 (pytest)
cd server && pytest
```

## 개발 워크플로우

이 저장소는 Claude Code 기반 harness 파이프라인(Clarify → Context → Plan → Generate → Evaluate)으로 작업을 진행한다. 자세한 설계 문서는 `docs/` 참고.
