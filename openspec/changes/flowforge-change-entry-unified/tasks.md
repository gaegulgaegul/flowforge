# Tasks — flowforge-change-entry-unified

## Tasks

### Sequential Group A: 게이트 완화 (핵심 변경)

- [ ] A.1 (RED) `web/src/App.tsx` 대상 테스트 작성 — 기획문서 있는 프로젝트 skeleton 렌더에서 change 목록(capability 버튼)이 노출되는지 검사 → 현재 실패 확인
- [ ] A.2 `web/src/App.tsx:1144`의 `{planTabsAvail.length === 0 && (...)}` 게이트를 제거해 change 목록 블록(`:1144~1162`)을 무조건 렌더 — 기획 탭/섹션과 형제로 병존
- [ ] A.3 (GREEN) A.1 테스트 통과 확인 — 기획문서 있는 프로젝트에서 기획 탭 + change 목록 병존 렌더

### Parallel Group B: 회귀·엣지 검증 (A 완료 후, 서로 독립)

- [ ] B.1 [parallel] 회귀 테스트 — 기획문서 없는 프로젝트(wowa-app 류) skeleton에서 기획 탭 미노출 + change 목록만 노출이 기존과 동일한지(무변화) 검증
- [ ] B.2 [parallel] 엣지 테스트 — capability 0개 프로젝트에서 "표시할 capability가 없습니다" 노출 확인
- [ ] B.3 [parallel] 엣지 테스트 — change 0개 capability가 개수 0으로 표기되고 클릭 시 오류 없이 처리되는지 확인
- [ ] B.4 [parallel] planning 계보 불변 확인 — 기획 탭/섹션·승인 위저드·핀 피드백·유저플로우 좌표 저장(`:990~1138`)이 수정되지 않았는지(diff 스코프) 검증

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
