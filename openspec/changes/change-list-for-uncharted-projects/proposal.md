## Why

flowforge 대시보드에서 **기획 문서(`docs/planning/*`)가 없는 프로젝트는 change가 있어도 그 change의 문서(PRD·spec-tree·유저플로우·와이어·그래프)를 화면에서 볼 진입로가 전혀 없다.** 실측 확인된 고아 프로젝트 4개: `agentic-harness`(진행 change 3), `stock-league`(1), `wowa-wt-dashboard`(4), `wowa-wt-ios`(4).

원인: 과거 change `flowforge-change-node-mapping`(archive)이 "change 전역 목록(옛 capChanges 단계)을 제거하고 change는 **기능명세 노드 경유로만** 표시"로 바꿨다. 그 유일한 진입로가 `FeatureDetailPanel`의 `onOpenChange`(기능명세 트리 노드 클릭 → 상세 패널 → 연관 change 버튼, `web/src/App.tsx` openChangeViews 호출)인데, 이 경로는 **planning `features.md`가 있어야만 존재**한다. 기획 없는 프로젝트는 skeleton 단계가 빈 화면(`"이 프로젝트는 기획 문서가 없습니다"` 안내문, App.tsx:541)이라 노드 자체가 없고, change 문서에 도달할 방법이 사라졌다. 랜딩 카드의 `activeChangeNames` 칩(`ProjectGrid.tsx`)도 표시용이라 클릭되지 않는다.

이는 "노드 경유로만"이라는 설계가 **기획 없는 프로젝트를 놓친** 회귀 버그다. change 문서 뷰 자체는 살아 있는데 진입로만 끊겼다.

## What Changes

- 기획 문서가 없는 프로젝트(`hasCharter=false`)의 **skeleton 단계에 그 프로젝트의 change 목록을 렌더**하고, change 항목을 클릭하면 기존 `openChangeViews`로 5종 문서 뷰(views 단계)에 진입하게 한다.
- change 목록 데이터는 프로젝트 카드가 이미 갖고 있는 `activeChangeNames`(활성 change 이름 배열)와 완료(archived) change를 사용한다 — **기존 change 목록 API를 재사용**하고 새 서버 API를 만들지 않는다.
- 기획 **있는** 프로젝트의 기존 진입 경로(기능명세 노드 → 상세 패널 → 연관 change)는 **회귀 없이 그대로 유지**한다. 이 change는 "기획 없는 프로젝트"의 빈 화면을 change 목록으로 채우는 additive 수정이다.
- **BREAKING 아님**: 서버·DB·발행 인프라 무변경. 프론트(`web/src/App.tsx` 중심) 진입로만 추가. 골든 테스트(specParser/flowBinder)와 무관.

## Capabilities

### New Capabilities
- `uncharted-project-change-list`: 기획 문서가 없는 프로젝트의 skeleton 단계에서 그 프로젝트의 change 목록을 노출하고, change 클릭 시 5종 문서 뷰로 진입시킨다. 기획 있는 프로젝트의 기존 노드-경유 진입은 불변으로 유지한다.

### Modified Capabilities
(없음 — 기존 change 뷰(views)·기능명세 노드 경유 capability의 requirement는 바뀌지 않는다. 진입로만 additive로 추가.)

## Impact

- **프론트**: `web/src/App.tsx` — skeleton 단계 렌더 분기(`dashStage === "skeleton"`)에 `hasCharter=false`이고 change가 있을 때 change 목록 섹션을 추가. 각 항목 클릭 핸들러는 기존 `openChangeViews({key, displayName, project})` 재사용. 필요 시 change 목록을 위한 경량 컴포넌트/상태 추가.
- **데이터 소스**: 프로젝트 카드 `ProjectCard.activeChangeNames`(shared/dashboard-types) + 완료 change 수. 추가 조회가 필요하면 기존 `/api/projects/:project/capabilities/:cap/changes` 또는 `/api/changes` 재사용(신규 API 없음).
- **서버/DB/배포**: 무변경. 발행 인프라 그대로. `docker compose up -d --build`로 프론트 번들만 갱신.
- **회귀 위험**: 기획 있는 프로젝트의 skeleton(PRD/features/wire/flow 탭)과 change 뷰 진입은 건드리지 않는다. change 목록 렌더는 `hasCharter=false` 분기에서만.
- **테스트**: web(vitest) 컴포넌트/상호작용 테스트로 "기획 없는 프로젝트 → change 목록 렌더 → 클릭 → views 진입"을 커버. 라이브 실픽셀(Playwright)로 고아 4개 프로젝트 중 하나에서 change 문서 접근 실증.
