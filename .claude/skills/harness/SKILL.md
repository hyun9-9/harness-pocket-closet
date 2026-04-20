---
name: harness
description: "구조화된 개발 파이프라인. Context → Clarify → Plan → Generate → Notify. 각 단계는 sub-agent가 실행하고 파일 시스템으로 결과를 전달한다."
user_invocable: true
argument_hint: "[작업 설명]"
---

# Harness — 오케스트레이터

사용자가 `/harness`를 호출하면 아래 흐름을 순차 실행한다.
각 단계는 Agent 도구로 sub-agent를 호출하며, 산출물은 파일로 저장되어 다음 단계에 전달된다.

```
docs/ (없으면 생성)  →  tasks/{task-dir}/ (생성)  →  run-phases.py (실행)  →  Discord (알림)
```

---

## Step 1: Context

`docs/` 디렉토리 존재 여부를 확인한다.

**docs/ 있음:**
- Agent 도구로 Explore sub-agent를 호출한다. 필요시 여러 Explore 에이전트를 병렬로 사용한다.
- 프롬프트: "docs/ 하위의 prd.md, flow.md, data-schema.md, code-architecture.md, adr.md를 읽고 프로젝트의 기획, 디자인, 아키텍처, 설계의도를 요약해서 보고해라."
- sub-agent 결과를 사용자에게 요약 보고한다.

**docs/ 없음:**
- 사용자에게 "무엇을 만들 건가요?"라고 질문한다.
- 사용자 답변을 `$FEATURE_DESCRIPTION`으로 저장하고 Step 2로 넘어간다.

---

## Step 2: Clarify

Agent 도구로 sub-agent를 호출한다.
- **description**: "Clarify - 논의점 도출"
- **prompt**: `.claude/skills/harness/clarify.md`의 전체 내용을 읽어서 프롬프트로 전달한다. `$FEATURE_DESCRIPTION`이 있으면 함께 전달한다.

sub-agent 산출물: `docs/` 디렉토리에 설계 문서 생성.

**Gate**: sub-agent가 논의점을 제시하면 사용자와 대화한다. 사용자가 "충분하다" 또는 "다음"이라고 하면 Step 3으로.

---

## Step 3: Plan

사용자가 구현계획 작성을 지시하면 Agent 도구로 sub-agent를 호출한다.
- **description**: "Plan - 구현계획 작성"
- **prompt**: `.claude/skills/harness/plan.md`의 전체 내용을 읽어서 프롬프트로 전달한다. "docs/ 디렉토리의 설계 문서를 모두 읽어라"를 포함한다.

sub-agent는 2단계로 동작한다:

**3-a. 초안 제시**
- `prompts/task-create.md`를 숙지한다.
- 구현 계획을 여러 phase로 나뉜 초안으로 작성한다.
- 논의점을 포함하여 사용자에게 피드백을 요청한다.

**3-b. Task/Phase 파일 생성**
- 사용자가 확인하면 `prompts/task-create.md`의 형식에 맞게 파일을 생성한다:
  - `tasks/index.json`
  - `tasks/{task-dir}/index.json`
  - `tasks/{task-dir}/phase{N}.md` (각 Phase별)

**Gate**: 파일 생성 완료 후 사용자에게 확인을 받는다.

---

## Step 4: Generate

사용자가 실행을 지시하면 Bash 도구로 직접 실행한다:

```bash
python scripts/run-phases.py {task-dir}
```

실행 중 진행 상황을 사용자에게 보고한다.

---

## Step 5: Notify

`run-phases.py` 종료 후, 종료 코드에 따라 Discord로 사용자에게 알림을 보낸다:

| 종료 코드 | 상태 | 메시지 |
|-----------|------|--------|
| `exit 0` | 성공 | `✅ Task {name} 완료 (N phases)` |
| `exit 1` | 오류 | `❌ Task {name} phase {n} 실패: {error}` — `tasks/{task-dir}/index.json`의 `error_message` 참조 |
| `exit 2` | blocked | `⚠️ Task {name} phase {n} blocked: {reason}` — `tasks/{task-dir}/index.json`의 `blocked_reason` 참조 |

---

## 단계 건너뛰기

- docs/가 이미 있으면 Context는 요약만 하고 넘어간다.
- 이미 논의가 끝났으면 Clarify를 건너뛸 수 있다.
- tasks/가 이미 있으면 Plan을 건너뛰고 Generate부터 실행할 수 있다.
- 사용자가 "phase N부터 다시"라고 하면 해당 phase의 status를 pending으로 변경 후 재실행한다.
