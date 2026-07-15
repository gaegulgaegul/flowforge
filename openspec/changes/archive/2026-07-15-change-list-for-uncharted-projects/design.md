## Context

flowforge 대시보드는 3단계 계층이다: `grid`(프로젝트 카드) → `skeleton`(기획 뼈대) → `views`(change 5종 문서 뷰). change 문서(views)로 가는 유일한 진입로는 기능명세 트리 노드 클릭 → `FeatureDetailPanel.onOpenChange` → `openChangeViews`(`web/src/App.tsx:830`)이며, 이 경로는 planning `features.md`가 있어야만 존재한다.

`hasCharter=false`인 프로젝트는 `openProject`(App.tsx:537~541)에서 `dashStage="skeleton"`으로 가되 `"이 프로젝트는 기획 문서가 없습니다"` 안내문만 세우고, skeleton 렌더 블록(App.tsx:993~)은 planning 문서 4종(`planningPrd`/`planningFeatures`/`planningWireScreens`/`planningUserFlow`)이 있을 때만 콘텐츠를 그린다. 그래서 기획 없는 프로젝트는 **완전 빈 화면**이고 change 문서에 도달할 수 없다.

핵심 자산(신규 개발 최소화):
- `dashProject`는 `ProjectCard` 타입(App.tsx:185)이라 `activeChangeNames?: string[]`(shared/dashboard-types.ts:33)·`archivedChangeCount?: number`(:31)에 접근할 수 있다.
- `openChangeViews(change: ChangeSummary)`(App.tsx:830)는 `{ key, displayName, project? }`(api.ts:58)만 받으면 views 단계로 진입시키고 딥링크 URL까지 기록한다.
- 활성 change 이름은 `dashProject.activeChangeNames`로 이미 로드돼 있다 — 추가 서버 조회 없이 목록을 그릴 수 있다.

## Goals / Non-Goals

**Goals:**
- 기획 문서가 없는 프로젝트(`hasCharter=false`)의 skeleton 단계에서 그 프로젝트의 **활성 change 목록**을 노출한다.
- change 항목 클릭 → 기존 `openChangeViews`로 5종 문서 뷰(views) 진입. 클릭 대상은 `{ key: name, displayName: name, project: dashProject.name }`로 매핑.
- 기획 **있는** 프로젝트의 기존 동작(기능명세 노드 경유 진입, PRD/features/wire/flow 탭)은 **완전 불변**.

**Non-Goals:**
- **완료(archive) change 목록**은 이번 범위 밖. 카드에 `archivedChangeCount`(개수)만 있고 이름 배열이 없어 별도 서버 조회가 필요하다 — 진입로 복원이라는 본 목적엔 활성 change만으로 충분하므로 후속 change로 미룬다. (넣으려면 `archivedChangeNames` 필드 또는 전용 API 신설이 필요.)
- 옛 `capChanges`(capability→change) 단계의 전면 부활은 하지 않는다. `flowforge-change-node-mapping`이 의도적으로 없앤 "전역 change 목록"을 되살리는 게 아니라, **기획 없는 프로젝트 한정으로** change 진입로만 보충한다.
- 서버 API·DB·발행 인프라 신규/변경 없음.

## Decisions

1. **진입로 위치 = skeleton 단계, `hasCharter=false` 분기 한정.** `openProject`가 이미 기획 없는 프로젝트를 `skeleton`으로 보내므로(App.tsx:537~541), skeleton 렌더 블록(App.tsx:993 `dashStage === "skeleton"`)에서 `!dashProject.hasCharter && activeChangeNames.length > 0`일 때 change 목록 섹션을 렌더한다. 새 DashStage를 추가하지 않는다(계층 3단 유지).

2. **데이터 소스 = `dashProject.activeChangeNames` 재사용.** 추가 fetch 없음. 각 이름 문자열 → `openChangeViews({ key: name, displayName: name, project: dashProject.name })`. `project`를 실어주므로 딥링크 URL(`?project=&change=&tab=prd`)까지 정상 기록된다(뒤로/새로고침 복원 됨).

3. **렌더 형태 = 경량 리스트(버튼 목록).** 각 change 이름을 클릭 가능한 버튼으로. 기존 skeleton의 안내문("기획 문서가 없습니다")은 유지하되, 그 아래에 "이 프로젝트의 change" 목록을 추가한다(안내문이 "change는 목록에서 진입"임을 반영하도록 문구도 조정). ReactFlow/그래프 아닌 순수 리스트라 골든/캔버스와 무관.

4. **기획 있는 프로젝트 회귀 0.** change 목록 섹션은 `!hasCharter` 가드 안에서만 렌더 → 기획 있는 프로젝트의 skeleton(탭·패널)은 코드 경로가 갈라져 영향 없음. 회귀 테스트로 고정.

5. **완료 change는 정직하게 미표시.** `archivedChangeCount > 0`이어도 이번엔 활성만 보여준다. 필요하면 "완료 N건은 목록 미표시(후속)" 같은 정직한 신호를 둘 수 있으나, 지어낸 링크는 만들지 않는다.

## 화면 구성 / UI

- 화면 구조·흐름은 skeleton 단계(기획 없는 프로젝트)의 change 리스트 → 클릭 → views(5종 탭) 전환이다. 이 change는 기존 flowforge 대시보드 안의 진입로 보충이라 별도 prototype.html보다 라이브 실픽셀(Playwright)로 검증한다(고아 프로젝트에서 change 문서 접근 실증).

## Risks / Trade-offs

- **활성 change 0 + 완료만 있는 프로젝트**: `activeChangeNames`가 비고 `archivedChangeCount>0`인 프로젝트는 여전히 빈 목록(진입 불가). 이번 Non-Goal이라 정직하게 "활성 change 없음(완료 N건)"으로 표기하거나 빈 상태를 둔다. 완전 해결은 완료 change API 후속.
- **`hasCharter` 판정 신뢰**: 이 값이 틀리면(기획 있는데 false) 엉뚱하게 리스트가 뜰 수 있으나, 기존 `openProject` 분기가 이미 이 값으로 갈리므로 새 위험은 아니다.
- **딥링크 project 매핑**: `dashProject.name`(프로젝트 키, 영문)을 project로 실어야 딥링크가 복원된다. displayName(한글)을 넣으면 안 됨 — 기존 openChangeViews 규약(영문 키) 준수.
