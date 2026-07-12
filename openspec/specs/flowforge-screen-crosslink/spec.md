## ADDED Requirements

### Requirement: 유저플로우 화면 노드에서 연관 와이어프레임을 상호참조한다

flowforge는 유저플로우 노드를 선택했을 때, 그 노드가 화면(page) 종류이면 그 **화면 id를 조인키로** 대응하는 와이어프레임(`WireScreen2`)을 찾아 상세 패널 안에 **프리뷰(또는 wire 탭 딥링크)** 로 SHALL 표시한다. 화면 id는 유저플로우·IA·와이어가 공유하는 기존 조인키다(`shared/src/wire-screen2-types.ts:61`, `server/src/parser/planningWireframeFixture.ts:5-6`). 유저플로우 `GraphNode.id`(`uflow-<slug>-<mermaidId>`)는 바레 화면 id가 아니므로, 화면 노드에 실린 바레 `screenId`(IA `web/src/iaAdapter.ts:28`과 동형)로 매칭한다. 피드백9(유저플로우에서 와이어가 안 보임)를 해소한다.

#### Scenario: 화면 노드 선택 시 연관 와이어 프리뷰 표시

- **WHEN** 사용자가 유저플로우에서 어떤 화면(page) 노드를 선택하고, 그 화면 id에 대응하는 와이어(`WireScreen2`)가 존재한다
- **THEN** 유저플로우 상세 패널에 그 화면의 와이어프레임 프리뷰(`WireframeDeviceFrame` 재사용) 또는 wire 탭으로 가는 딥링크가 표시된다

#### Scenario: 흐름 섹션과 병존

- **WHEN** 사용자가 와이어가 연결된 화면 노드를 선택한다
- **THEN** 기존 나가는/들어오는 흐름(전이) 섹션(`FlowDetailPanel`)은 그대로 유지되고, 연관 와이어 섹션이 그 아래(또는 옆)에 추가로 표시된다(기존 흐름 뷰 회귀 0)

### Requirement: 유저플로우 화면 노드에서 연관 기능명세 상세기능을 역조회한다

flowforge는 유저플로우 화면(page) 노드를 선택했을 때, 그 **화면 id를 연결화면으로 가진 기능명세 상세기능 목록**을 역조회해 상세 패널에 SHALL 표시한다. 역조회 원천은 이미 파생된 상세기능↔화면 N:M 링크(`screenRegistry.links`의 `ScreenLink.detailLabel`·`ScreenLink.screenIds`, `server/src/parser/screenRegistry.ts`)를 화면 id 기준으로 역인덱싱한 것이다(`featureTreeAdapter`는 상세기능→화면 정방향만 파생 `web/src/featureTreeAdapter.ts:124-128`; 이 change는 화면→상세기능 역방향 인덱스를 추가한다). 피드백12(유저플로우 노드가 어떤 기능과 연관됐는지 모름)를 해소한다.

#### Scenario: 화면 노드 선택 시 연관 상세기능 목록 표시

- **WHEN** 사용자가 유저플로우에서 어떤 화면(page) 노드를 선택하고, 그 화면 id를 연결화면으로 가진 상세기능이 하나 이상 있다
- **THEN** 유저플로우 상세 패널에 그 화면과 연관된 기능명세 상세기능 라벨 목록이 표시된다

#### Scenario: 상세기능 항목에서 기능명세로 딥링크(선택 시)

- **WHEN** 사용자가 연관 상세기능 목록의 한 항목을 클릭한다
- **THEN** 기능명세(spec) 탭의 그 상세기능 노드로 이동하거나, 최소한 그 상세기능이 어느 화면과 연관됐는지 라벨로 명확히 식별된다(딥링크는 선택, 라벨 표시는 필수)

### Requirement: 연결이 없거나 화면 노드가 아니면 빈 상태로 안전 처리한다

flowforge는 선택된 유저플로우 노드에 연결된 와이어/상세기능이 없거나, 노드가 화면(page) 종류가 아니면(시작·섹션·행동), 상호참조 섹션을 **빈 상태 안내로 표시하거나 생략**하고 앱을 깨뜨리지 SHALL 않는다. 화면 id가 어떤 와이어/링크와도 매칭되지 않는 경우(dangling)도 동일하게 빈 상태로 처리한다(숨기되 크래시 없음). 기존 흐름 섹션의 빈 상태 UX(`FlowDetailPanel`의 "나가는 전이 없음" 등)와 동형으로 처리한다.

#### Scenario: 화면 id 매칭 0개

- **WHEN** 사용자가 화면 노드를 선택했으나 그 화면 id에 대응하는 와이어도, 연관 상세기능도 하나도 없다
- **THEN** 연관 와이어/기능 섹션이 빈 상태 안내("연결된 와이어 없음"/"연관 기능 없음")로 표시되거나 섹션이 생략되고, 앱은 정상 동작한다

#### Scenario: 화면 종류가 아닌 노드(시작/섹션/행동)

- **WHEN** 사용자가 화면(page)이 아닌 노드(시작·섹션·행동 종류)를 선택한다
- **THEN** 상호참조(와이어/기능) 섹션은 표시되지 않고(화면 허브가 아니므로), 기존 흐름 섹션만 정상 표시된다

#### Scenario: dangling 화면 id

- **WHEN** 유저플로우 화면 노드의 화면 id가 화면목록(`screenRegistry`)이나 와이어(`planningWireScreens`) 어디에도 없는 값이다
- **THEN** 매칭 결과가 빈 상태로 처리되어(id를 숨기지 않고 빈 안내), 상호참조 섹션이 크래시 없이 빈 상태로 렌더된다

## TDD Plan

- **Red**: 화면 id 역인덱스 순수 헬퍼 테스트 — `screenRegistry.links`(상세기능→화면 N:M) → `Map<screenId, detailLabel[]>` 역인덱싱, 화면 id별 와이어(`WireScreen2`) lookup, 매칭 0개→undefined/빈배열, dangling id→빈 결과. 유저플로우 화면 노드 `screenId` 파생 테스트 — 화면(page) 노드에만 바레 `screenId`가 실리고, 화면이 아닌 노드(시작/섹션/행동)엔 없음(undefined). 패널 렌더 테스트 — 화면 노드 선택 시 연관 와이어 프리뷰+연관 상세기능 목록 섹션 렌더, 연결 0개→빈 상태, 화면 아님→섹션 미노출.
- **Green**: 화면 id → 연관 상세기능 역인덱스(`screenRegistry.links` 기반, `web/src` 순수 헬퍼 신규) + 화면 id → 와이어 lookup(`planningWireScreens`에서). `FlowDetailPanel`에 화면 노드일 때만 연관 와이어(`WireframeDeviceFrame` 프리뷰/딥링크)·연관 기능 섹션 추가. `graphAdapter`(또는 서버)에서 화면 노드에 바레 `screenId` 파생. `App.tsx`에서 `planningWireScreens`·`planningScreens`(screenRegistry)를 `FlowDetailPanel`에 조인해 전달.
- **Refactor**: 화면 id 역인덱싱과 와이어 lookup을 한 헬퍼로 단일화(IA의 `screenId` 매칭 방식 `App.tsx:390-403`과 정합 — 동일 조인키 문자열 동치 규칙). 빈 상태 UX는 기존 `feature-detail-empty` CSS/패턴 재사용(신규 스타일 최소화).
- **Mock 대상**: `screenRegistry`·`planningWireScreens`·유저플로우 화면 노드 data 픽스처(정상 매칭/0개 매칭/dangling/화면 아님 4케이스). 서버 fetch는 기존 방식대로 mock — 서버는 `screenId` 파생 안을 택할 때만 단위 테스트 추가(정방향 정합: mermaidId 접미 소문자 = 바레 화면 id). 실제 라이브 조인은 VERIFY의 Playwright 실픽셀에서 관찰.
