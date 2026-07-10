# 배포 전 최종 검토 — flowforge-change-entry-unified
검토일: 2026-07-10 / 검토 범위: `web/src/App.tsx`(skeleton change 목록 게이트), `web/src/styles.css`(dash-changes-section·그래프 section overflow), 관련 verify.json — change diff 한정, 앱 전체 아님

## 요약
`planTabsAvail.length === 0` 게이트를 제거해 기획문서 있는 프로젝트에서도 change 목록을 항상 노출하는 최소 변경. 적대적 리뷰(code-reviewer, opus, 독립 세션)가 **게이트 제거가 새로 노출한 그래프 탭 레이아웃 회귀**를 발견 → 검토 중 수정 완료 → gstack 실픽셀 2차 재검증으로 확정. verify 최종 PASS(archiveGate.open=true).

## 반드시 수정해야 할 항목
- 없음. (초기 리뷰에서 발견된 그래프 탭 클리핑은 배포 전에 수정·재검증 완료 — 아래 적대적 검토 참조.)

## 수정하면 좋은 항목
- **[해결됨] 그래프 탭 change 목록 클리핑/오버레이** — `web/src/App.tsx:1209`, `web/src/styles.css:341~360`
  - 발견: 게이트 제거로 기획문서 있는 프로젝트에서 그래프 탭(features/ia/user-flow, `dash-body--wide`) + change 목록이 처음 병존하며, `overflow:hidden` + 스크롤 불가로 change 목록이 그래프 캔버스(`.dash-plan-flow { min-height:480px }`)에 덮여 하단 항목 도달 불가. verify가 PRD 탭에서만 캡처해 놓친 자기검증 사각지대.
  - 수정: change 목록을 `<section className="dash-changes-section">`으로 감싸 `--wide`일 때 `flex:0 0 auto`(flex 경쟁 제외) + `max-height:40vh` + `overflow-y:auto`; 그래프 section에 `overflow:hidden` 추가.
  - 재검증(gstack 실픽셀): 기능명세·유저플로우 탭 오버레이 완전 해소(elementFromPoint로 확정), change 목록 상단 항목 온전·독립 스크롤로 24개 전부 도달, PRD 탭 무회귀.
- **[후속 change로 분리] flowforge charter capability ↔ change 링크 0개** — `server/src/lib/capabilityIndex.ts:82~104`
  - flowforge 24개 capability 전부 `changeKeys:[]`라, flowforge에서 capability 클릭 시 "연결된 change 없음"으로 진입해 5종 뷰 dead-end. 원인은 **charter capability 키(`api-write-auth`·`planning-*`)와 active change spec-dir 이름(`flowforge-change-entry` 등)의 네이밍 불일치 + `capabilityIndex.ts:90`의 archive 스캔 제외**(교집합 0으로 실측 확정). verify.json의 초기 서술("archive 시점 생성 전")은 부정확 → 실제 원인은 네이밍 불일치.
  - 판정: **이 change(게이트 제거)의 코드 결함이 아니다.** 게이트 제거는 "입구 노출"까지가 스코프이고 그건 달성됨(spec 시나리오 R2 C.2는 change 있는 capability를 전제로 하며 wowa-app에서 실증 PASS). 다만 proposal.md:19의 "flowforge 자신의 change를 보게" 문구는 링크 복원 없이는 flowforge에서 미실현 → 링크 복원은 별도 change로 등록 권장.

## 현재 상태로 유지해도 되는 항목
- 게이트 제거 방식(`{planTabsAvail.length===0 && <>...</>}` → 무조건 렌더): 최소·비파괴·원복 용이. 적절.
- 내부 블록(h3 + `capabilities.length===0 ? empty : ul.map`) 무변경 → 문서 없는 프로젝트 픽셀 동일(회귀 없음), agentic-harness로 실증.
- change 목록 갱신 주석(App.tsx:1200~): 팀 컨벤션(결정 이력 박제)과 일관, "왜 게이트를 뗐나"를 자족 설명 → 6개월 뒤 이해 가능.
- 보안: `cap.koreanLabel`/`cap.key`는 React 자동 이스케이프(dangerouslySetInnerHTML 없음), XSS 표면 없음. capabilities는 openspec 문서 메타(민감정보 아님), 게이트는 인가 게이트가 아니라 UI 표시 게이트라 신규 권한 노출 없음(개인 홈서버 단독 사용).

## 리팩토링 추천 항목
- (선택) 그래프:change 비율이 46:42로 그래프가 다소 좁음(change section이 max-height 40vh를 꽉 채움). 클리핑/도달성엔 무관한 시각 취향 문제 — 그래프를 키우려면 `max-height`를 30vh로 낮추면 됨. 개인 도구라 현행 유지도 무방.
- (후속) `capabilityIndex.ts:90`의 archive 제외가 의도인지 문서화 필요 — flowforge 링크 0의 숨은 공범.

## 적대적 검토 (4 페르소나)
- **파괴자**: 그래프 탭(features/ia/user-flow) 활성 시 change 목록이 그래프 캔버스(min-height:480px)에 덮여 스크롤 도달 불가 — **실제 회귀로 확정**(gstack). → 수정 완료(그래프 overflow:hidden + change section 격리 스크롤). null/빈 데이터: capabilities 초기값 `[]`, 서버가 항상 배열 → null 진입 표면 없음. 대량: 24개 capability 렌더·스크롤 정상.
- **신입 개발자**: 갱신 주석 명료. 단 "change 목록이 항상 노출"이라 하지만 flowforge에서 실제로 전부 "change 0개" dead-end인 점(링크 0)은 코드에 안 적힘 → 암묵 지식 부채(후속 change에서 해소).
- **보안 감사자**: capabilities fetch는 `encodeURIComponent`(api.ts) + 서버 경로탐색 거부 테스트 존재. 렌더는 React 자동 이스케이프. 게이트는 UI 표시용이라 신규 정보 노출·권한 상승 없음. → clean.
- **게으른 시니어**: 게이트 제거 + 프래그먼트 언랩은 최소(라인 순증 0). 클리핑 수정은 필요한 최소 CSS(section 격리 + overflow) — 불필요 추가 없음. → clean.
- **2+ 페르소나 중복(심각도 상승)**: 파괴자(그래프 탭 클리핑)는 단독이지만 실제 회귀라 반드시-수정급으로 격상 → 배포 전 수정. 신입(dead-end 오해)과 링크 0 이슈는 동일 근본원인을 다른 각도로 지적 → 후속 change 필요성 확정.

## 최종 배포 가능 여부
**배포 가능** — 반드시 수정 0건.
- 초기 발견된 그래프 탭 클리핑(파괴자)은 배포 전 수정·gstack 2차 재검증으로 완전 해소. verify 최종 PASS(6/6 시나리오, edge-case 충분, archiveGate.open=true).
- flowforge 링크 0(dead-end)은 이 change의 코드 결함이 아니라 별개 데이터 파이프라인 이슈 → 후속 change로 분리(배포 블로킹 아님). 게이트 제거의 스코프("입구 노출")는 달성.

## 개선 우선순위 (제안)
1. **[완료]** 그래프 탭 change 목록 클리핑 수정 — 배포 전 필수였고 해소됨(파괴자 발견).
2. **[후속 change, 권장]** flowforge charter capability ↔ active change 링크 복원(네이밍 정합 또는 archive 스캔 정책) — proposal의 "flowforge 자신을 보게"를 실제 실현.
3. **[문서]** verify.json 초기 서술 정정 반영됨(네이밍 불일치가 진짜 원인). proposal 톤은 "입구 노출"로 이해하면 정합.
4. **[선택]** 그래프:change 세로 비율 취향 조정 / archive 제외 정책 문서화.
