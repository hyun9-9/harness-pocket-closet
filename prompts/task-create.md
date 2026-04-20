# Task 생성 규칙

## 디렉토리 구조

```
tasks/
├── index.json                # 전체 Task 인덱스
└── {task-dir}/               # 예: 0-mvp
    ├── index.json            # Task 메타데이터 + Phase 목록
    ├── phase1.md             # Phase 1 프롬프트
    ├── phase2.md             # Phase 2 프롬프트
    └── ...
```

## tasks/index.json

```json
{
  "tasks": [
    {
      "dir": "0-mvp",
      "name": "mvp",
      "status": "pending",
      "description": "MVP 전체 구현"
    }
  ]
}
```

## tasks/{task-dir}/index.json

```json
{
  "project": "pocket-closet",
  "task": "mvp",
  "totalPhases": 6,
  "gh_user": null,
  "phases": [
    {
      "phase": 1,
      "name": "프로젝트 초기화",
      "status": "pending",
      "description": "Expo + FastAPI 프로젝트 셋업"
    }
  ]
}
```

### status 값
- `pending` — 미실행
- `completed` — 완료 (`completed_at` 자동 추가)
- `error` — 실패 (`error_message` 필드 필수)
- `blocked` — 사용자 개입 필요 (`blocked_reason` 필드 필수)

## phase{N}.md 형식

```markdown
# Phase N: {제목}

## 목표
이 Phase가 완료되면 달성되는 것.

## 선행 조건
이전 Phase에서 완료되어야 하는 것. (Phase 1이면 "없음")

## Tasks

### Task N.1: {제목}
- **파일**: 생성/수정할 파일 경로
- **작업**: 구체적인 구현 내용
- **완료 기준**: 이 Task가 "완료"인 조건

### Task N.2: {제목}
...

## AC (Acceptance Criteria)
이 Phase 완료 후 확인할 것. Claude가 직접 검증하고 index.json을 업데이트한다.
```

## 규칙

1. **Task는 원자적** — 1 Task = 1 명확한 작업
2. **파일 경로 명시** — 각 Task에 생성/수정할 파일 경로 필수
3. **AC는 검증 가능** — "잘 동작한다" 금지, 구체적 조건 명시
4. **의존성 명시** — Task 간 의존성 있으면 선행 Task 번호 기재
5. **Phase 간 산출물 명확** — 다음 Phase에 전달할 결과물 명시

## Phase 분류 기준 (일반적 순서)

1. 인프라/설정 — 프로젝트 초기화, 의존성, 환경
2. 데이터 계층 — 스키마, 저장소, CRUD
3. 서버 — API 엔드포인트, AI 프롬프트
4. UI 기반 — 내비게이션, 테마, 공용 컴포넌트
5. 기능 — 각 기능별 화면 + 로직
6. 통합 — 기능 간 연결, E2E 흐름

프로젝트 특성에 따라 조정한다.

## 실행

파일 생성 완료 후 `scripts/run-phases.py {task-dir}`로 실행.
runner가 각 phase를 Claude Code 세션으로 순차 실행하고, index.json 상태를 업데이트하며, 자동 커밋한다.
