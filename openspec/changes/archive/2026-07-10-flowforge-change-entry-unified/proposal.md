# flowforge-change-entry-unified

## Why

flowforge에서 openspec change 문서(5종 뷰: PRD/기능명세/유저플로우/IA/와이어)를 보는 진입로가 **기획문서(docs/planning/) 유무에 따라 갈린다.**

`web/src/App.tsx`의 skeleton 단계 렌더 분기(`:989~1162`)를 보면:

- **기획문서가 있는 프로젝트**(flowforge 자신·ssoksok 등) → `planTabsAvail`에 최소 하나 이상 담기고, 하단 "change 목록(capability별)" 블록(`:1144~1162`)이 `planTabsAvail.length === 0` 조건이라 **아예 렌더되지 않는다.** 결과적으로 change 5종 뷰로 가는 유일한 입구(capability→change→views)가 사라진다.
- **기획문서가 없는 프로젝트**(wowa-app 등) → `planTabsAvail.length === 0`이라 change 목록이 뜨고, capability 클릭 → change 클릭(`openChangeViews`, `:892`) → 5종 탭으로 진입할 수 있다.

즉 flowforge에서 **flowforge 자신의 change 문서를 볼 수 없다.** 기획문서를 갖춘 프로젝트일수록 change 뷰가 막히는 역설이 생긴다. 이 게이트는 2026-07-03 "기획문서 있으면 그래프가 뼈대라 하단 목록을 숨긴다"는 결정(주석 `:1139~1143`)에서 온 것이지만, change 뷰 자체를 못 보게 만드는 부작용이 확인됐다.

## What Changes

- **`planTabsAvail.length === 0` 게이트를 완화**한다. change 목록 블록(`:1144~1162`)이 이 조건에 묶여 있어 기획문서 있는 프로젝트에서 숨겨지는 것을 없애, **모든 프로젝트에서 change 목록이 항상 노출**되도록 한다.
- 기획문서가 있는 프로젝트는 **기획 탭(plan-tabs)과 change 목록이 병존**해 렌더된다. 기획 탭은 위쪽에 그대로, change 목록은 그 아래에 함께 표시된다.
- change 목록에서 capability 클릭(`openCapability`, `:865`) → change 클릭(`openChangeViews`, `:892`) → 5종 뷰 진입(`dashStage="views"`) 경로는 **기존 그대로 재사용**한다(새 데이터·라우트 없음).
- **planning 뷰는 무변경.** PRD/기능명세/IA/와이어/유저플로우 렌더, 승인 위저드, 핀 피드백, 유저플로우 좌표 저장 등 기획 계보(`:990~1138`)는 한 줄도 건드리지 않는다. 이 change는 "숨겨진 change 입구를 다시 노출"하는 최소 변경이다.

## Capabilities

- **New**: `flowforge-change-entry` — 프로젝트의 기획문서 유무와 무관하게 change 5종 뷰로 가는 진입로(capability별 change 목록)를 항상 노출한다.
- **Modified**: (없음)

## Impact

- **프론트만.** `web/src/App.tsx` skeleton 단계 렌더 분기 1지점(`:1144`의 `planTabsAvail.length === 0` 게이트) 완화. 서버·API·DB·데이터 스키마 변경 없음.
- capability 브레드크럼(`:958~964`)은 2026-07-03 결정으로 `false &&` 비활성 상태다. 이 change의 목표는 change 목록 재노출까지이며, 브레드크럼 재활성화는 이 범위 밖(의도적 제외, design.md 참조).
- 되돌리기: 게이트 조건 하나를 원복하면 끝. 비파괴.
- 검증: flowforge는 `docker compose up -d --build`로 라이브 반영(커밋≠라이브). Playwright로 실픽셀 확인(`~/.cache/ms-playwright`) — flowforge를 열어 기획 탭 + change 목록 병존, capability→change→5종 뷰 진입을 실관찰.
