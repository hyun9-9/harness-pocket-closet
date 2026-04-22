# Pocket Closet — E2E 체크리스트

MVP 완료 기준 검증용. 각 시나리오는 실기기 또는 시뮬레이터에서 앱을 실행하며 수동으로 확인한다. `- [x]`는 2026-04-22 기준 검증 완료를 의미한다.

## 시나리오

- [x] 1. 앱 실행 → 빈 옷장 CTA(`+` 원형 버튼 + "옷을 등록해보세요") 노출
- [x] 2. 옷 3장 등록 → `/analyze` 응답 편집 → 저장 → 옷장 3열 그리드에 3장 노출
- [x] 3. 카테고리 필터(전체/상의/하의/아우터/원피스/신발/악세서리) 전환 시 그리드 결과가 선택한 카테고리와 일치
- [x] 4. 옷 상세 진입 → 메타데이터 수정 후 저장 → 옷장으로 돌아가 카드 반영
- [x] 5. 옷 상세 → 삭제 → 그리드에서 제거되고 로컬 파일도 사라짐 (`FileSystem.getInfoAsync(uri).exists === false`)
- [x] 6. 피팅 탭 진입 → 전신 사진 없을 때 CTA → `person-camera`에서 촬영 → 피팅 메인에서 썸네일 표시
- [x] 7. 옷 복수 선택 (상의/하의/아우터/원피스/신발/악세서리 카테고리 규칙: 상·하의는 각 1벌, 원피스는 하의와 공존 불가) → `/try-on` 호출 → 저장 → 최근 피팅에 추가
- [x] 8. 최근 피팅 가로 스크롤 → 기록 상세 진입 → 원본 옷이 삭제된 경우 placeholder 노출
- [x] 9. 추천 탭 → TPO 6개(출근/데이트/캐주얼/운동/여행/파티) 각각 선택 시 조합 3개 노출
- [x] 10. 조합 "입어보기" 버튼 → 피팅 탭으로 이동하며 해당 옷들이 초기 선택 상태로 일치
- [x] 11. 앱 강제 종료 → 재실행 → 옷 / 피팅 기록 / 전신 사진 모두 유지 (AsyncStorage + 로컬 파일)

## 검증 커맨드

### API 키 노출 점검 (Task 8.4)

```bash
grep -r "GEMINI_API_KEY" app/
```

- [x] 결과: 0건 (실제 키는 `server/.env`에만, `app/.env.example`은 `EXPO_PUBLIC_API_URL` 한 줄만 포함)
- [x] `app/.env.example` 실제 키 값 없음 확인

### 전체 테스트 스위트 (Task 8.6)

- [x] `cd server && pytest` → **12 passed** (exit 0)
  ```
  tests\test_analyze.py .....                                              [ 41%]
  tests\test_health.py .                                                   [ 50%]
  tests\test_recommend.py ...                                              [ 75%]
  tests\test_tryon.py ...                                                  [100%]
  ======================== 12 passed, 1 warning in 0.24s ========================
  ```

- [x] `cd app && npm test` → **28 passed** (exit 0)
  ```
  PASS __tests__/sanity.test.ts
  PASS __tests__/storage.test.ts
  PASS __tests__/imageUtils.test.ts
  PASS __tests__/selectionRules.test.ts
  PASS __tests__/api.test.ts
  Test Suites: 5 passed, 5 total
  Tests:       28 passed, 28 total
  ```

- [x] `cd app && npx tsc --noEmit` → **exit 0** (타입 에러 0건)

## 에러 & 경계 케이스 (Task 8.2)

- [x] 서버 중지 상태에서 옷 등록 시도 → 분석 실패 토스트, 크래시 없음
- [x] 서버 중지 상태에서 피팅 실행 → `fitting-result-new`에서 토스트 후 `router.back()`, 크래시 없음
- [x] 서버 중지 상태에서 추천 실행 → 추천 토스트 노출, 크래시 없음
- [x] 타임아웃 메시지 정규화: `api.ts`의 `AbortController` 타임아웃 발생 시 `"요청이 시간 초과되었습니다"` 문구 노출
- [x] 빈 옷장 UI 분기 확인 (옷장 탭 CTA / 피팅 탭 "옷을 먼저 등록해주세요" / 추천 탭 "최소 2벌 이상")
- [x] 0 피팅 상태에서 최근 피팅 섹션 비노출
