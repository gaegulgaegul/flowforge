## Why

flowforge는 산출물(PRD·기능명세·유저플로우·IA·와이어)을 각각 **따로** 보여주기만 하고, 화면(page) id를 허브로 산출물끼리 상호참조하는 UI가 없다. 데이터 레벨에선 화면 id를 조인키로 공유하도록 이미 설계돼 있는데(정합) UI가 안 이어준다. 그 결과 두 갈래로 같은 불편이 터진다:

- **피드백9(와이어 안 보임)**: 유저플로우 노드를 선택하면 상세 패널(`web/src/FlowDetailPanel.tsx`)이 나가는/들어오는 **흐름(전이)만** 보여준다. 그 화면(page)에 대응하는 **와이어프레임이 안 보인다** — 화면을 보려면 별도로 wire 탭으로 이동해 눈으로 찾아야 한다.
- **피드백12(기능 연관 안 보임)**: 유저플로우 노드를 선택해도 그 노드가 **기능명세서의 어떤 기능(상세기능)과 연관됐는지** 알 수 없다. 기능↔화면 데이터는 이미 있는데(`web/src/featureTreeAdapter.ts`: 상세기능 노드에 `screens` 파생 필드) 유저플로우 쪽에서 역조회하는 UI가 없다.

정합 근거(조사 확정): 유저플로우·IA·와이어가 같은 화면 id를 공유하도록 설계됐다(`shared/src/wire-screen2-types.ts:61` "안정 식별자(화면목록 `<!-- screen: id -->`와 공유 — 유저플로우·IA와 정합)", `server/src/parser/planningWireframeFixture.ts:5-6`). 화면 id 원천 = `features.md` 화면목록(`server/src/parser/screenRegistry.ts`). 즉 조인키는 이미 존재한다 — **런타임 조인(유저플로우 노드↔와이어 화면, 유저플로우 노드↔기능명세)만 UI/코드에 없다**(조사: `App.tsx`에 wireframe↔flow 조인 0건, userFlow 상세 패널에 screen 참조 0건).

## What Changes

- **유저플로우 노드 클릭 → 화면 허브 상호참조**를 유저플로우 상세 패널(`FlowDetailPanel`)에 신설한다. 화면(page) 종류 노드를 선택하면 기존 흐름(전이) 섹션에 더해 두 섹션이 뜬다:
  - **연관 와이어프레임**: 그 화면 id에 대응하는 와이어(`WireScreen2`)의 프리뷰(`WireframeDeviceFrame` 재사용) 또는 wire 탭 딥링크. 화면 id를 조인키로 `planningWireScreens`에서 lookup.
  - **연관 기능명세**: 그 화면 id를 연결화면으로 가진 기능명세 **상세기능 목록**을 역조회한다. `featureTreeAdapter`가 이미 파생하는 상세기능↔화면 링크(`screenRegistry.links`, `ScreenLink.screenIds`)를 화면 id 기준으로 역인덱싱한다.
- **화면 id 조인키 파생**: 유저플로우 `GraphNode.id`는 `uflow-<slug>-<mermaidId>` 형태라 바로 조인키가 아니다(`server/src/parser/planningUserFlowBuilder.ts:191-194`). 화면(page) 종류 노드에 **바레 화면 id**(`WireScreen2.id`/`ScreenNode.id`와 동치)를 실어준다 — IA가 이미 쓰는 방식(`web/src/iaAdapter.ts:28` `screenId`, server가 실어줌)을 유저플로우 화면 노드에도 동일하게 적용해 조인키를 명시한다.
- **빈 상태 안내**: 화면에 연결된 와이어/기능이 0개이거나 화면(page) 종류가 아닌 노드(시작·섹션·행동)면, 상호참조 섹션을 생략하거나 빈 상태 문구를 표시한다(기존 흐름 섹션의 빈 상태 UX와 동형).
- **읽기 전용 상호참조**: 이 change는 **읽기 상호참조(보기·딥링크)만** 신설한다. 유저플로우에서 와이어/기능을 편집하거나 링크를 양방향 추가하는 UI는 범위 밖(의도적 제외).

## Capabilities

### New Capabilities
- `flowforge-screen-crosslink`: 유저플로우 화면(page) 노드를 선택하면, 그 화면 id를 조인키로 (a)대응 와이어프레임 프리뷰/딥링크와 (b)연관 기능명세 상세기능 목록을 상호참조로 표시한다. 화면 id는 유저플로우·IA·와이어·기능명세가 공유하는 기존 조인키를 활용하며, 연결이 없거나 화면 노드가 아니면 빈 상태로 안전하게 처리한다(읽기 전용 상호참조).

### Modified Capabilities
(없음 — 유저플로우/와이어/기능명세 각 산출물의 렌더링 자체는 불변. 상호참조 오버레이만 추가한다.)

## Impact

- **웹(프론트 주로)**: `web/src/FlowDetailPanel.tsx` — 화면 노드일 때 "연관 와이어프레임"·"연관 기능명세" 섹션 추가(`WireframeDeviceFrame` 프리뷰 재사용, 딥링크 콜백). `web/src/App.tsx` — 유저플로우 상세 패널에 `planningWireScreens`(이미 로드됨 `:164`)·`planningScreens`(`screenRegistry`, 이미 로드됨 `:139`)를 조인해 넘기는 배선, 화면 id 역인덱스 파생. `web/src/graphAdapter.ts` — 화면 노드 `SpecNodeData`에 조인용 `screenId` 필드 추가(선택 파생).
- **서버**: 화면(page) 종류 유저플로우 노드에 바레 `screenId`를 실어주려면 `server/src/parser/planningUserFlowBuilder.ts`(또는 `server/src/lib/userFlowDocs.ts`)에 파생 로직 추가 가능(IA의 `screenId` 부여 방식과 동형). 대안: web adapter에서 `uflow-<slug>-<mermaidId>`의 mermaidId 접미를 소문자화해 조인키로 파생(서버 무변경). 설계에서 택1 확정.
- **shared**: 화면 노드에 `screenId`를 서버가 실어주는 안을 택하면 `GraphNode`(`shared/src/graph-types.ts`)에 옵셔널 `screenId` 필드 추가(비파괴 — change/골든 경로는 undefined).
- **배포**: flowforge는 커밋≠라이브 — VERIFY에서 `docker compose up -d --build`로 재빌드 후 실제 화면(page) 노드 클릭 → 와이어 프리뷰/기능 목록 표시를 Playwright 실픽셀로 확인한다(메모리 교훈: `reference_flowforge_deploy`, `reference_verify_static_first_gate`).
- **선행/연동**: 딥링크 URL change(`flowforge-deeplink-url`)가 있으면 "노드→와이어 화면" 상호참조를 wire 탭 딥링크(`?...&tab=wire`)로 자연스럽게 연결할 수 있다(약한 선행 — 없으면 인앱 프리뷰/탭 전환으로 폴백).
- **무저촉 보장**: 화면 id 매칭이 0개이거나 화면 노드가 아닌 노드에서는 기존 유저플로우 상세 패널 동작(흐름 섹션만)이 완전히 보존된다.
