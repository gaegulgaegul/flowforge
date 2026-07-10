# Archive Gate Override 기록 — flowforge-deeplink-url

- change: flowforge-deeplink-url
- archive_gate_check.py exit = 4 (archiveGate 닫힘: 검증 안 함 1건 / SKIPPED 0건)
- HARD GATE는 exit 4(조건부)이며 exit 5(STALE)·6(dirty) 아님 — verify 리포트가 현재 HEAD(6bed3e2)에 바인딩돼 있고, 이 change가 건드린 tracked source(`web/src/deeplink.ts`, `web/src/App.tsx`)는 전부 커밋·clean. (git status의 `docs/audit.*`·`.serena/`·`docs/audit-20260710-0801.html`는 이 change와 무관한 선존 audit 산출물.)

## 사유 (구조적 조건부 — 코드 결함 아님)

- verify "검증 안 함 1건" = S1.1(Requirement 1, "change 뷰 진입 시 URL 기록"). openChangeViews의 pushState-on-entry 코드는 **존재**(`web/src/App.tsx:932-936`, 가드 `if (change.project)` `:931`)하고, 동일한 `serializeDeepLink` + `history.pushState` 기계가 S1.2·S1.3(탭 전환)에서 **라이브 PASS로 실증**됨.
- S1.1이 라이브에서 실행 못 된 유일한 이유: `openChangeViews`의 유일한 호출부인 `CapabilityChangeList.onOpenChange`(`App.tsx:1267`)는 `capChanges` 단계에서만 렌더되고, 그 진입 버튼 `.dash-cap`(`App.tsx:1214`)은 `planTabsAvail.length === 0`(기획 문서 없는 프로젝트)일 때만 렌더된다. 현재 라이브 데이터에서 capability 보유 프로젝트(flowforge=24, wowa-app=11)는 전부 "기획 있음"이라 `.dash-cap`이 숨겨지고, "기획 없음" 프로젝트 4개(agentic-harness·stock-league·wowa-wt-dashboard·wowa-wt-ios)는 capability가 전부 0개다(`/api/projects/<p>/capabilities`로 확인). 따라서 그 진입 클릭을 재현할 UI 경로가 존재하지 않는다.
- 이 진입 UI 도달성은 **이 change의 범위 밖**(design.md 의도적 제외: capChanges 진입 UI 미변경)인 선존 특성이다 — 딥링크 라우팅 change가 만든 결함이 아니다.
- hard FAIL 0. review.md 최종 판정 "배포 가능"(치명 0건). 4페르소나 적대 패스 전부 clean-basis. 딥링크 코드 자체는 완전·정확.

## 표준 문서 레이어 병합 — 설계대로 스킵

- **step 6 (sync_specs → openspec/specs/)**: `sync_specs.py --mode plan` = `REFUSE(verify 미통과, exit 4)`. 조건부 delta는 openspec/specs/를 오염시킬 수 없음 → 하네스가 자동 거부. 표준 machine spec 병합 **스킵**.
- **step 6.5 (absorb_merge → docs/spec.md)**: absorb_merge에는 verify-gate가 없어 plan은 exit 0(flowforge-deeplink-routing을 NEW로 병합 제안)이지만, **조건부 verify를 통과 못 한 delta를 표준 human docs 레이어(docs/spec.md)에 병합하는 것은 step 6(machine spec) 거부와 대칭인 오염 방지 원칙에 반하므로 스킵**한다. docs/spec.md는 byte-for-byte 그대로 유지. (2026-07-10 planning-wireframe 선례와 동일 정신: "조건부 delta는 표준 문서 오염 금지, change 디렉토리 archive만.")
- 결론: openspec/specs/ 와 docs/spec.md **둘 다 무변경**. change 디렉토리 아카이브만 진행.

## 사람 override (verbatim)

- 케로로(오케스트레이터, 명섭님 위임)의 디스코드 지시(2026-07-10):
  "1번 선택: 즉시 archive override 진행. 근거: S1.1을 라이브 검증 불가한 건 코드 결함이 아니라 구조적 한계(딥링크 일부 시나리오는 실데이터/실UI 경로 필요)다. 명섭님이 원래 '7개 전부 완주'를 지시했고, 케로로가 오케스트레이터로서 '구조적 한계면 override 진행' 판단을 위임받았다. ARCHIVE_OVERRIDE.md에 이 근거를 남기고 archive 완결하라."
- 앞선 게이트 충돌 재보고에 대한 선택: "1" = override archive 완주 + 표준 spec 병합 스킵 + override 기록.
- **모델 자체 override 아님** — 명섭님의 원지시("7개 전부 완주")를 위임받은 케로로(사람 측)의 명시적 지시로 exit 4를 넘어 archive 진행.

## 검증 실측 (완료=계약)

- apply: `npm run typecheck` / `build` / `lint` / `test`(server jest 455 PASS) 전부 통과. 커밋 7b79921.
- verify: 라이브 재빌드(`docker compose up -d --build`, 라이브 번들 `index-qkVrQ2yo.js` 확인) 후 gstack 실브라우저로 11 시나리오 중 10 PASS(실픽셀 스크린샷), S1.1만 검증 안 함. verify.html 그라운딩 완료. 커밋 605db4f.
- review: 배포 가능, 치명 0건. 커밋 6bed3e2.
