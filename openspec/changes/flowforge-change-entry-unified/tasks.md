# Tasks — flowforge-change-entry-unified

## Tasks

### Sequential Group A: 게이트 완화 (핵심 변경)

> Context Scan(2026-07-10): web 워크스페이스에 테스트 러너(vitest/jest/RTL·jsdom) 부재. server만 Jest(node env, `.test.ts`). React 컴포넌트 렌더 테스트 원천 불가 — 선례(archive/2026-07-10-flowforge-deeplink-url)와 동일하게 RED/GREEN은 "typecheck + VERIFY 라이브(Playwright 실픽셀)"로 검증한다. design.md 라인번호(:1144·:989~1163)는 실제와 어긋나 실제값(게이트 :1205, 블록 :1049~1224)으로 갱신.

- [x] A.1 (RED) 검증 수단 확정 — web에 컴포넌트 테스트 러너 없음(Context Scan). 변경 전 기준선: 기획문서 있는 flowforge에서 `planTabsAvail.length === 0` 게이트로 change 목록이 렌더 안 됨을 코드로 확인(게이트 `:1205`). typecheck 기준선 클린(에러 0). 라이브 부재 확인은 D단계 Playwright before로 대체
- [x] A.2 `web/src/App.tsx:1205`의 `{planTabsAvail.length === 0 && (...)}` 게이트를 제거해 change 목록 블록(`:1205~1223`)을 무조건 렌더 — 기획 탭/섹션과 형제로 병존. 2026-07-03 "뼈대라 숨김" 주석도 병존 취지로 갱신
- [x] A.3 (GREEN) typecheck + build PASS 확인 — 게이트 제거 후 `tsc --noEmit` 에러 0, `vite build` 성공(221 modules). 실렌더 병존은 D단계 Playwright로 실픽셀 확인

### Parallel Group B: 회귀·엣지 검증 (A 완료 후, 서로 독립)

- [x] B.1 [parallel] 회귀(코드 논리) — 기획문서 없는 프로젝트는 여전히 `planTabsAvail.length === 0`이라 기획 탭 바(`:1051`)는 조건상 미노출, change 목록만 노출. 게이트 제거는 "있을 때 추가 노출"만 바꾸고 "없을 때 동작"은 무변경. 실픽셀 무회귀는 D.4 Playwright before/after로 확정
- [x] B.2 [parallel] 엣지(코드 확인) — `capabilities.length === 0 ? <p className="dash-empty">표시할 capability가 없습니다.</p>` 분기 그대로 유지됨(diff 무변). 게이트 완화가 이 엣지를 새로 깨지 않음
- [x] B.3 [parallel] 엣지(코드 확인) — `change {cap.changeKeys.length}개` 표기(0이면 "change 0개"), 클릭 시 `openCapability`가 fetch 후 capChanges 전이 — 빈 상세도 오류 없이 처리(로직 무변). 실동작은 verify 단계에서 라이브 확인
- [x] B.4 [parallel] planning 계보 불변 — `git diff web/src/App.tsx` 단일 hunk(`@@ -1197,29 +1197,27`)만 변경. 승인 위저드·핀 피드백·유저플로우 좌표 저장·planTabsAvail/activePlanTab 계산·planningXxx 상태 심볼이 diff에 0건 등장(grep 확인). 계보 불변 PASS

### Sequential Group C: 5종 뷰 진입 실동작

- [ ] C.1 capability 클릭 → capChanges 단계 이동(`openCapability`, `:865`) 실동작 확인
- [ ] C.2 change 클릭 → views 단계 + PRD 탭 활성(`openChangeViews`, `:892`) 실동작 확인

### Sequential Group D: 라이브 반영 + UI 검증

- [ ] D.1 `docker compose up -d --build`로 flowforge 라이브 반영(커밋≠라이브)
- [ ] D.2 Playwright(`~/.cache/ms-playwright`)로 flowforge를 열어 기획 탭 + change 목록 병존 실픽셀 캡처
- [ ] D.3 Playwright로 capability→change→5종 뷰 진입 실동작 캡처
- [ ] D.4 Playwright로 기획문서 없는 프로젝트 before/after 비교 — 픽셀 회귀 없음 확인

## Verify

- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 시) 전부 PASS
