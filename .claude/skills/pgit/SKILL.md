---
name: pgit
description: "작업 중인 변경사항을 기능 단위로 묶어 여러 커밋으로 분리하고 remote에 push한다. 민감파일을 사전 검사하고, 커밋 메시지는 영어 타입 접두사 + 한글 본문으로 작성한다."
user_invocable: true
argument_hint: ""
---

# 깃 — 기능 단위 커밋 및 푸시

사용자가 `/깃`을 호출하면 아래 흐름을 순차 실행한다. 절대 자의적으로 단계를 건너뛰지 않는다.

---

## Step 1: 상태 파악

- `git status` 실행 → staged / modified / untracked 파악
- 변경이 없으면 "올릴 변경사항이 없습니다"라고 알리고 종료
- 현재 브랜치와 원격 추적 상태 확인 (`git status -sb`)

---

## Step 2: 민감 파일 검사

다음 파일/패턴이 staged 또는 untracked에 있으면 **즉시 중단하고 사용자에게 경고**한다:

- `.env`, `.env.*` (단 `.env.example`은 허용)
- `*.key`, `*.pem`, `*.keystore`, `*.jks`
- `credentials*.json`, `secrets*`, `*token*`, `*.p12`
- `메모.txt`, `memo.txt`, `temp`, `temp/`
- 파일 내용에 `sk-`, `ghp_`, `gho_`, `AIza`, `AKIA`, `-----BEGIN .* PRIVATE KEY-----` 등의 패턴이 포함된 경우 (새로 추가된 파일만 Grep으로 간단 검사)

경고 형식:

```
⚠️ 민감 파일로 보이는 항목이 감지됨:
  - <파일 경로> (사유: <패턴>)

.gitignore에 추가하거나 제외하고 진행할까요?
```

사용자가 확인하기 전까지 어떤 파일도 stage하지 않는다.

---

## Step 3: 변경 내용 분석

- `git diff HEAD` 와 `git diff --staged` 로 수정된 내용을 읽는다
- untracked 파일은 `Read` 로 샘플링 (큰 파일은 앞 100줄 정도만)
- 각 파일의 **목적/기능**을 파악한다. 단순 경로가 아니라 변경의 의도를 본다.

---

## Step 4: 기능 단위 그룹핑

변경 파일들을 **기능 중심**으로 묶는다. 여러 디렉토리에 걸쳐 있어도 같은 기능이면 하나의 그룹으로 묶는다.

그룹핑 기준 예시:

- "옷 등록" 기능 → `app/clothing-register.tsx` + `components/ClothingForm.tsx` + `server/routers/analyze.py` + `server/prompts/analyze.py`
- "피팅" 기능 → `app/fitting-result-new.tsx` + `server/routers/tryon.py` + `services/api.ts`의 try-on 관련 부분
- "문서 정리" → `docs/*.md`
- "빌드 설정" → `package.json`, `tsconfig.json`, `.gitignore` 등

주의:

- 한 파일 안에 여러 기능의 변경이 섞여 있더라도 **파일 단위로만** 그룹핑한다 (`git add -p` 같은 hunk 분리는 하지 않는다 — 복잡도 대비 이득이 적음)
- 그룹 간 의존성이 있으면 순서를 정해 순차 커밋한다 (예: API 스키마 변경 → 클라이언트 변경 순)
- 그룹은 1~5개 정도가 적당. 너무 잘게 쪼개지 않는다.

---

## Step 5: 사용자에게 그룹 제안

아래 형식으로 사용자에게 제시한다:

```
제안 그룹 (N개):

[1] feat: 옷 등록 화면 구현
    - app/clothing-register.tsx (신규)
    - components/ClothingForm.tsx (신규)
    - server/routers/analyze.py (신규)

[2] fix: 피팅 결과 저장 실패 수정
    - app/fitting-result-new.tsx
    - services/storage.ts

[3] docs: PRD의 기능 번호 갱신
    - docs/prd.md

이대로 진행할까요? 수정할 그룹/메시지가 있으면 알려주세요.
```

사용자가 승인하거나 수정안을 주면 Step 6으로 진행한다.

---

## Step 6: 그룹별 커밋

승인된 그룹을 **순서대로** 처리한다. 각 그룹마다:

1. `git add <그룹의 파일들>` — 파일 경로만 명시. `git add -A` / `git add .` 금지.
2. `git commit` — 아래 형식으로 메시지 작성:

```
<type>: <한 줄 요약 (한글, 50자 이내)>

<본문 — 한글, 왜 이 변경이 필요한지 / 어떤 의사결정이 있었는지. 단순 변경 나열 금지.>

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

### 타입 (영어 접두사)

| 타입       | 사용 시점                         |
| ---------- | --------------------------------- |
| `feat`     | 새 기능 추가                      |
| `fix`      | 버그 수정                         |
| `docs`     | 문서만 변경                       |
| `refactor` | 동작 변화 없는 코드 개선          |
| `style`    | 포맷/세미콜론 등 (로직 변화 없음) |
| `test`     | 테스트 추가/수정                  |
| `chore`    | 빌드, 설정, 의존성 등             |
| `perf`     | 성능 개선                         |

### 본문 작성 원칙

- **왜** 바꿨는지를 설명한다. 무엇을 바꿨는지는 diff가 말해준다.
- 단순 파일/함수명 나열 금지
- 관련 이슈나 논의가 있으면 링크 또는 요약
- 본문이 불필요할 정도로 자명하면 제목만 써도 된다

### 예시

```
feat: 옷 등록 시 Gemini 분석 결과 자동 채움

카메라/갤러리로 받은 이미지를 /analyze 로 보내고 응답을
ClothingForm 초기값으로 주입한다. 사용자가 수정 가능한
상태로 두어 분석 오류 시에도 수동 보정이 가능하도록 했다.
```

```
fix: 피팅 결과 바꿔보기 시 이전 선택이 남는 문제

Context 초기화 누락으로 동일 옷이 중복 선택된 채 /try-on
이 호출되던 버그. SelectableClothingGrid 언마운트 시
선택 상태를 리셋하도록 수정.
```

### 커밋 실패 시

pre-commit hook 등으로 커밋이 실패하면:

- 원인을 확인하고 고친 뒤 **새 커밋**을 만든다
- `--amend`, `--no-verify` 금지 (사용자가 명시적으로 요청한 경우 제외)

---

## Step 7: Push

모든 그룹의 커밋이 끝나면 자동으로 push 한다.

1. `git status -sb` 로 원격 추적 브랜치 확인
2. 원격이 설정되어 있으면 `git push`
3. 설정이 안 되어 있으면 사용자에게 원격 URL을 물어본 뒤 `git remote add origin <url>` → `git push -u origin <현재 브랜치>`
4. 강제 푸시 (`--force`, `--force-with-lease`) 는 절대 자동으로 하지 않는다. 필요하면 사용자에게 이유와 함께 확인받는다.

푸시 성공 후 사용자에게 요약을 보고:

```
✅ 커밋 N개 푸시 완료

  [1] feat: 옷 등록 화면 구현         → <short-sha>
  [2] fix: 피팅 결과 저장 실패 수정   → <short-sha>
  [3] docs: PRD의 기능 번호 갱신      → <short-sha>

원격: <remote-url>
```

---

## 금지 사항

- `git add -A` / `git add .` (의도치 않은 파일 포함 위험)
- `--no-verify` 로 hook 건너뛰기
- `--amend` 로 기존 커밋 수정 (사용자 요청 시 예외)
- `git push --force` 자동 실행
- 커밋 메시지 타입 접두사를 한글로 번역 (`기능:`, `수정:` 등 금지 — 반드시 영어)
- 한 커밋에 무관한 파일 섞기
- 민감 파일 검사 건너뛰기
