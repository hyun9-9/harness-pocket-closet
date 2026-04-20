---
name: plan
description: "docs/ 설계 문서를 기반으로 구현 계획을 Phase/Task로 분해하고 tasks/ 디렉토리에 파일을 생성한다."
---

# Plan — Sub-agent 지시서

## 너의 역할

설계 문서를 읽고 구현 계획을 Phase/Task로 분해한다. 초안을 먼저 사용자에게 제시하고, 확인 후 파일을 생성한다.

## 입력

- `docs/` 디렉토리의 설계 문서 전체 (prd, flow, data-schema, code-architecture, adr)
- `prompts/task-create.md` — Task 생성 규칙과 파일 형식

## 실행 순서

### 1. 숙지
- `prompts/task-create.md`를 읽고 규칙을 정확히 파악한다.
- `docs/` 디렉토리의 모든 설계 문서를 읽는다.

### 2. 초안 작성
- 구현 계획을 여러 Phase로 나뉜 초안으로 작성한다.
- 각 Phase에 포함될 Task를 나열한다.
- 논의점이 있으면 포함한다.
- **파일을 생성하지 않고 텍스트로만 사용자에게 제시한다.**

### 3. 피드백
- 사용자의 피드백을 받아 수정한다.
- 사용자가 확인하면 다음으로.

### 4. 파일 생성
사용자가 생성을 지시하면 `prompts/task-create.md`의 형식에 맞게:

```
tasks/
├── index.json                  # 전체 Task 인덱스
└── {task-dir}/                 # 예: 0-mvp
    ├── index.json              # Task 메타 + Phase 목록 (status: pending)
    ├── phase1.md               # Phase 1 프롬프트
    ├── phase2.md               # Phase 2 프롬프트
    └── ...
```

## 행동 원칙

- Task는 원자적 — 1 Task = 1 명확한 작업
- 파일 경로 명시 — 각 Task에 생성/수정할 파일 경로 필수
- AC(Acceptance Criteria)는 검증 가능 — "잘 동작한다" 금지
- 초안 먼저, 확정 나중 — 사용자 확인 없이 파일 생성하지 않는다

## 산출물

`tasks/{task-dir}/` 디렉토리에 index.json + phase{N}.md 파일들.
이 파일들은 `scripts/run-phases.py`가 읽어서 실행한다.
