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
├── api.ts                       # FastAPI 호출 4개 (health, analyze, try-on, recommend)
├── storage.ts                   # AsyncStorage CRUD
└── imageUtils.ts                # 리사이즈(1024px), JPG 변환, 파일 저장/삭제

constants/
├── categories.ts                # ["상의","하의","아우터","원피스","신발","악세서리"]
├── occasions.ts                 # ["출근","데이트","캐주얼","운동","여행","파티"]
└── theme.ts                     # { point: "#7A8450", ...무채색 }
```

### 설정
- 서버 URL: `EXPO_PUBLIC_API_URL` (.env)

## 서버 — FastAPI (Python)

Gemini 프록시. 비즈니스 로직 없음.

```
server/
├── main.py                      # 앱 생성, 라우터 등록, CORS(개발: 전체 허용)
├── routers/
│   ├── analyze.py               # POST /analyze
│   ├── tryon.py                 # POST /try-on
│   └── recommend.py             # POST /recommend
├── services/
│   └── gemini.py                # Gemini 호출 래퍼 (Flash/Pro 분기)
├── prompts/
│   ├── analyze.py               # 분석 프롬프트
│   ├── tryon.py                 # 합성 프롬프트 (카테고리+색상+소재로 구체적 지시)
│   └── recommend.py             # 추천 프롬프트
├── schemas.py                   # Pydantic 모델
├── config.py                    # GEMINI_API_KEY (환경변수)
└── requirements.txt
```
