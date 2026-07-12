# flowforge-feature-list-view

기능명세서 뷰를 ReactFlow 노드-엣지 다이어그램이 아니라 **들여쓴 계층 트리/아웃라인 리스트**로 렌더하는 능력. 원본 데이터(`FeatureTreeNode` children 중첩)·서버 파서·연결화면 조인은 무변경, web 렌더 계층만 교체한다. planning 기능명세와 capability drill-down 기능명세 두 진입점 모두 적용된다.

## ADDED Requirements

### Requirement: 기능명세 뷰가 들여쓴 트리/리스트로 렌더된다
기능명세서 뷰는 ReactFlow 노드-엣지 다이어그램이 아니라, `FeatureTree.root.children`을 `children` 깊이만큼 들여쓴 **계층 트리/아웃라인 리스트**로 렌더 SHALL 한다. dagre 자동 레이아웃(`featureTreeAdapter.ts:105-194`의 `rankdir:"LR"`)과 캔버스 패닝/줌은 이 뷰에서 쓰지 않는다. 데이터 원천(`shared/src/feature-tree-types.ts`의 `FeatureTree`/`FeatureTreeNode`)과 서버 파서(featureTreeBuilder)는 변경하지 않는다.

#### Scenario: 기능명세 뷰가 다이어그램이 아니라 리스트로 렌더된다
- **WHEN** 기능명세서 뷰를 연다(planning 기능명세 또는 capability drill-down 기능명세)
- **THEN** 요구사항>기능>상세기능 위계가 `children` 깊이만큼 들여쓴 트리/리스트로 표시되고, ReactFlow 캔버스 노드-엣지 다이어그램은 렌더되지 않는다

#### Scenario: 두 진입점 모두 리스트로 전환된다
- **WHEN** planning 기능명세(`App.tsx:1031-1043`)와 capability drill-down 기능명세 서브트리(`App.tsx:1172-1183`)를 각각 연다
- **THEN** 두 진입점 모두 같은 리스트 렌더로 표시된다(다이어그램 잔존 0)

### Requirement: 리스트가 다이어그램의 표시 정보를 무손실로 보존한다
전환된 리스트는 기존 `FeatureNode`(`web/src/FeatureNode.tsx:44-85`)가 노드에 싣던 표시 정보를 **전부** 보존 SHALL 한다: 타입 태그(요구사항/기능/상세기능), priority·status 뱃지, 요구사항 노드의 capability 칩·audit 뱃지(정합/불합/미감사), 상세기능 노드의 연결화면 칩, 메모·when/then. 정보 누락 없이 렌더 방식만 리스트로 바뀐다.

#### Scenario: 뱃지·칩·태그가 리스트 항목에 그대로 표시된다
- **WHEN** priority·status·capability·audit·연결화면·메모가 있는 features.md를 리스트로 렌더한다
- **THEN** 각 항목에 타입 태그·priority/status 뱃지·capability 칩·audit 뱃지·연결화면 칩·메모가 다이어그램 때와 동일하게 표시된다

#### Scenario: 상세기능의 연결화면 칩이 화면 레지스트리와 같은 id로 붙는다
- **WHEN** 상세기능에 `<!-- screens: id -->` 링크가 있는 features.md를 리스트로 렌더한다
- **THEN** 상세기능 항목에 연결화면 칩이 화면 레지스트리(`featureTreeAdapter.ts:116-128` 조인)와 동일 화면 id로 표시된다(조인 회귀 0)

## TDD Plan

- **Red/Green/Refactor**: web 렌더 교체는 web 단위테스트가 없는 코드영역(Explore 확인: `web/src`에 단위테스트 0)이므로, 검증 = (1) 서버 features 파서(featureTreeBuilder)·`FeatureTree` 타입이 무변경임을 grep/타입체크로 확인 (2) 연결화면 조인 골든 — 리스트가 `screenRegistry` 링크와 동일 화면 id로 칩을 붙이는지 검증(공간(1) 조인 불변) (3) `docker compose up -d --build` 후 Playwright 실픽셀로 리스트 렌더·다이어그램 부재·뱃지/칩 보존을 관찰(grounding).
- **Mock 대상**: 없음(렌더 교체 + 산출물 관찰). 데이터 원천이 불변이므로 서버 픽스처 재사용.
