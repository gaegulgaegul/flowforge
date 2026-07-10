# Design — flowforge-change-entry-unified

## 목표

기획문서 유무로 갈리던 change 5종 뷰 진입로를 통일한다. 사용자 결정(G1=b): **planning 뷰는 그대로 유지하고, 모든 프로젝트에서 change 목록도 항상 노출**한다. 기획 탭과 change 목록을 병존 렌더하는 **최소 변경**이다.

## 현재 구조 (근거)

skeleton 단계 렌더는 `web/src/App.tsx:989~1163`에서 이뤄진다.

1. `planTabsAvail` 배열(`:912~917`)은 어떤 기획문서가 존재하는지에 따라 채워진다: `planningPrd`→`"prd"`, `planningFeatures`→`"features"`, `planningIaRoot`→`"ia"`, `planningWireScreens`→`"wire"`, `planningUserFlow`→`"flow"`.
2. 기획 탭 바(`:990~998`)는 `planTabsAvail.length > 0`일 때만 뜨고, 각 기획 섹션(`:1000~1138`)이 `activePlanTab`에 따라 렌더된다.
3. change 목록 블록(`:1144~1162`)은 `{planTabsAvail.length === 0 && (...)}`로 감싸여 있다. 이 조건 때문에 **기획문서가 하나라도 있으면 change 목록이 렌더되지 않는다.**
4. change 목록 안에서 `capabilities.map`(`:1151`)이 capability 버튼을 그리고, 클릭 시 `openCapability(cap)`(`:865`) → `dashStage="capChanges"` → change 클릭 시 `openChangeViews`(`:892`) → `dashStage="views"`, `tab="prd"`로 5종 뷰에 진입한다.

문제의 핵심은 **오직 `:1144`의 `planTabsAvail.length === 0` 게이트 하나**다. 데이터(`capabilities`, `openCapability`, `openChangeViews`)는 이미 존재하고 기획문서 없는 프로젝트에서 정상 동작한다.

## HOW — 게이트 완화

`:1144`의 조건부 래핑 `{planTabsAvail.length === 0 && (...)}`을 **무조건 렌더**로 바꾼다(조건 제거). change 목록 블록(`<h3>` + `capabilities.length === 0 ? empty : <ul>`)은 그대로 두고, 바깥 게이트만 없앤다.

- 기획문서 있는 프로젝트: 기획 탭 바(`:990~998`) + 활성 기획 섹션(`:1000~1138`)이 위쪽에 그대로 렌더되고, 그 **아래에 change 목록이 이어서** 렌더된다. 두 블록은 형제 관계로 병존한다.
- 기획문서 없는 프로젝트: `planTabsAvail.length === 0`이라 기획 탭·섹션은 렌더 안 되고(기존과 동일), change 목록만 렌더된다 → **기존 동작과 픽셀 동일**(회귀 없음). 게이트를 없앤 것은 "기획문서 있을 때도 목록을 보이게" 하는 것이지, 기획문서 없을 때 동작을 바꾸지 않는다.

## 레이아웃 병존 방식

- change 목록 블록은 skeleton `dash-body` div(`:988~989`) 내부에서 기획 섹션들과 **형제**로 배치된다. 기존 마크업 순서를 유지하면 기획 탭/섹션이 먼저, change 목록이 마지막에 온다(자연스러운 세로 흐름).
- change 목록의 `<h3 class="dash-h">` 헤딩("… — change 목록 (capability별)")이 기획 섹션과 시각적으로 구분되는 앵커 역할을 한다. 새 CSS·새 컴포넌트 없이 기존 `dash-cap-list`/`dash-cap` 스타일을 재사용한다.
- `dash-body--wide` 클래스(`:989`)는 `activePlanTab`이 그래프 뷰일 때 붙는데, 이는 기획 섹션 레이아웃용이며 change 목록 병존과 충돌하지 않는다(목록은 폭에 무관).

## planning 계보 불변 보장

- `:990~1138`의 기획 탭 바, PRD/features/IA/wire/flow 섹션, 각 승인 위저드(`PrdApprovalWizard`·`FeatureApprovalWizard`·`WireframeApprovalWizard`·`UserFlowApprovalWizard`), 핀 피드백(`WireframePinFeedback`), 유저플로우 좌표 저장(`onPlanningFlowNodeDragStop`)은 **한 줄도 수정하지 않는다.**
- `planTabsAvail`/`activePlanTab` 계산(`:912~920`)도 그대로 둔다 — change 목록 노출 여부만 이 배열에 대한 의존을 끊는다.

## 회귀 방지

- 기획문서 없는 프로젝트(wowa-app 등): 게이트 제거 후에도 `planTabsAvail.length === 0`이므로 기획 탭/섹션은 여전히 안 뜨고 change 목록만 뜬다 → 렌더 결과 동일. Playwright로 before/after 비교해 픽셀 회귀 없음 확인.
- change 0개 capability, capability 0개 프로젝트: 기존 `capabilities.length === 0 ? <p class="dash-empty"> : <ul>` 분기(`:1147~1160`)가 그대로 처리한다. 게이트 완화가 이 엣지를 새로 깨지 않는다.

## 의도적 제외 (이 change 범위 아님)

- **planning 뷰 재설계/재편**: 기획 섹션 레이아웃·스타일·상호작용 개선은 별도 change. 여기서는 건드리지 않는다.
- **capability 브레드크럼 재활성화**: `:958~964`의 `false && dashCapability` 비활성화는 2026-07-03 결정의 잔재다. change 목록→capChanges 진입은 목록 클릭으로 충분하므로, 브레드크럼 재활성화는 후속으로 남긴다.
- **change 뷰 자체(5종 탭)의 UI 변경**: `dashStage="views"` 렌더는 무관. 이 change는 "입구 노출"까지다.
- **서버/데이터 변경**: 없음. `capabilities`·capability 상세 fetch는 이미 존재하는 경로를 그대로 쓴다.
