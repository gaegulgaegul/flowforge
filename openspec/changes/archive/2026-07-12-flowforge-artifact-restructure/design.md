## Context

flowforge Phase 3 — 산출물 5종을 4종으로 줄이고 기능명세 렌더를 바꾸는 구조 재정의. 세 피드백(기능명세 다이어그램 과함·IA 중복·"기능명세서" 이름 혼동)이 같은 **web 렌더 계층 + 산출물 탭**을 건드리므로 한 change로 묶는다. 서버 데이터 원천(파서·타입)은 대부분 무변경이고, 핵심 리스크는 단 하나 — **IA 제거가 화면 id 데이터를 잘못 건드리는 것**이다.

사전조사(코드 file:line 재확인):
- **기능명세 데이터는 순수 계층 트리다.** `shared/src/feature-tree-types.ts:23-68` `FeatureTreeNode`는 `children` 중첩만으로 위계 표현(요구사항>기능>상세기능). 다이어그램 엣지는 부모-자식 계층 외 정보를 안 실음 → 리스트로 무손실 전환 가능.
- **다이어그램 렌더는 web 전용.** `web/src/featureTreeAdapter.ts:105-194` `toFeatureTreeFlow`가 dagre `rankdir:"LR"`로 좌표를 계산하고 RF nodes/edges를 만든다. `web/src/FeatureNode.tsx`가 노드 컴포넌트. 서버(featureTreeBuilder)는 트리만 내보내고 좌표를 모른다 → 렌더 교체는 web 국소.
- **연결화면(screen link) 병합은 features 어댑터 안에 있다.** `featureTreeAdapter.ts:116-128`이 `screenRegistry?.screens/links`를 상세기능 라벨로 조인해 `screens` 칩을 붙인다. 이 조인은 리스트에서도 유지해야 한다(화면 id 소비처 ①).
- **화면 id 파서는 IA와 분리된 "병렬 파서"다.** `server/src/parser/screenRegistry.ts:1-6` 주석: *"화면(페이지)을 기획 명세의 1급 노드로 뽑고 … **병렬 파서**(featureTreeBuilder와 완전히 분리 — features 트리 렌더 회귀 0)"*. `RE_SCREEN = /<!--\s*screen:\s*([A-Za-z0-9_-]+)\s*-->/`(:21)가 `## 화면목록` 섹션의 `### ` 화면 노드를, `RE_SCREENS`(:22)가 상세기능→화면 N:M 링크를 파싱한다.
- **IA는 화면 레지스트리에 의존하지만 역은 아니다(단방향).** `server/src/parser/planningIaBuilder.ts:16,26`이 `buildScreenRegistry`를 import·호출해 IA 트리를 만든다. 즉 IA 빌더를 제거해도 `buildScreenRegistry`는 남는다.
- **화면 id 데이터원 라우트는 IA 라우트와 분리돼 있다.** `server/src/routes/docs.ts:160-176` `/api/docs/:project/planning-screens`가 레지스트리를 직접 서빙(화면 없으면 빈 배열 200). `docs.ts:179-197` `/api/docs/:project/planning-ia`는 별개 라우트(없으면 404). 유저플로우·와이어·기능명세 연결화면은 `planning-screens`를 쓴다(`web/src/api.ts:280` `fetchPlanningScreens`), IA를 안 쓴다.
- **feature→screen 딥링크만 IA 노드를 경유한다.** `web/src/App.tsx:390-403` `selectScreenInIa`가 기능명세 상세 패널의 화면 칩 클릭 시 `planningIaNodes`에서 `screenId` 동치로 찾아 IA 뷰로 전환한다. IA 제거 시 이 딥링크의 *타깃*이 사라진다(아래 D4에서 처리).

## Goals / Non-Goals

**Goals**
- 기능명세 뷰(planning + capability drill 2곳)를 다이어그램 → 들여쓴 계층 트리/아웃라인 리스트로 교체(밀도·검색·편집 우위). 연결화면 칩·뱃지(priority/status/audit)·상세 정보 보존.
- IA 뷰 제거(컴포넌트·어댑터·라우트·빌더·탭·상태·노드타입), 산출물 5종→4종.
- 두 계보의 "기능명세서" 레이블을 UI에서 구분되게.
- 🔴 **불변식: 화면 id 데이터·파싱이 IA 제거에도 그대로 살아있다** — 유저플로우·와이어·기능명세 연결화면의 조인키 회귀 0.

**Non-Goals**
- 서버 features 파서(featureTreeBuilder)·`FeatureTree`/`FeatureTreeNode` 타입 변경 → **의도적 제외**(렌더만 교체).
- `screenRegistry.ts`·`/api/docs/:project/planning-screens`·`fetchPlanningScreens` 변경 → **의도적 제외**(화면 id 데이터원 — 불변).
- features.md 화면목록 문법(`## 화면목록`, `<!-- screen: id -->`, `<!-- screens: a,b -->`) 변경 → **의도적 제외**.
- 유저플로우·와이어·PRD 뷰 로직 변경 → 범위 밖.
- harness(openspec-plan/propose) 변경 → harness는 IA를 안 만든다(무관).
- feature→screen 딥링크의 *새 타깃 뷰* 신설 → 별도 change(`flowforge-screen-crosslink`) 스코프. 이 change는 IA 제거로 인한 딥링크 처리만(D4).

## Decisions

### D1. 기능명세 렌더 = 계층 리스트(들여쓰기), 기존 FeatureNode 다이어그램 대체
`web/src/FeatureNode.tsx` + `toFeatureTreeFlow`(dagre 좌표계산·RF 캔버스)를 **계층 리스트 렌더**로 교체한다. `FeatureTree.root.children`(요구사항들)을 재귀로 순회해 `children` 깊이만큼 들여쓴 `<ul>`/tree 구조로 그린다. 각 항목은 지금 노드가 보여주던 정보를 그대로 싣는다 — 타입 태그(요구사항/기능/상세기능), priority·status 뱃지, 요구사항의 capability 칩·audit 뱃지(`FeatureNode.tsx:44-85` 로직), 상세기능의 연결화면 칩. dagre·ReactFlow 의존은 기능명세 경로에서 제거한다(다른 뷰는 여전히 RF 사용하므로 패키지는 유지).
- **이유**: 데이터가 순수 트리(children)라 좌표·엣지가 정보를 안 실음. 리스트는 세로 스캔·검색(브라우저 Ctrl+F)·조밀 표시에 유리하고 자동 레이아웃 비용 0.
- **대안 기각**: ①다이어그램 유지 = 피드백1 미해소. ②표(테이블) = 위계(children 중첩)를 못 살림(요구사항>기능>상세기능 3단). 들여쓴 트리가 위계를 직접 표현.
- **적용 2곳**: planning 기능명세(`App.tsx:1031-1043`, `featureNodes`/`featureEdges`)·capability drill 기능명세 서브트리(`App.tsx:1172-1183`, `capFeatureNodes`/`capFeatureEdges`). 둘 다 같은 리스트 컴포넌트를 재사용.

### D2. IA 제거 범위 = 렌더·라우트·빌더·탭·상태, 경계는 화면 레지스트리 앞에서 멈춘다
제거 대상(전부):
- **web 컴포넌트/어댑터**: `web/src/IANode.tsx`, `web/src/iaAdapter.ts`(`toIAFlow`), `web/src/IADetailPanel.tsx`.
- **web App.tsx**: `Tab` 유니언 `"ia"` 제거(`:89`), planTab 유니언 `"ia"` 제거(`:105`), `nodeTypes`의 `ia: IANode`(`:82`), 상태 `iaNodes/iaEdges/planningIaNodes/planningIaEdges/iaVerbose`(`:106,116-117,159-160`), effect(`:249,289`), `onIaNodeClick`(`:370`), IA 탭 버튼("IA 트리" `:943`, "화면 구조" `:994`), `iaVerbose` 토글 버튼(`:975-977`), IA 렌더 블록(planning `:1048-1067`, change `:1225-1229`), `planTabsAvail`의 ia push(`:915`), `dash-body--wide` 조건의 `"ia"`(`:989`).
- **web api.ts**: `fetchIA`(`:128`, `/api/changes/:id/ia`), `fetchDocsPlanningIa`(`:292`, `/api/docs/:project/planning-ia`).
- **server**: `iaBuilder.ts`, `planningIaBuilder.ts`, 라우트 `graph.ts:92`(`/api/changes/:id/ia`)·`docs.ts:179-197`(`/api/docs/:project/planning-ia`), 관련 import.
- **테스트**: `server/src/parser/__tests__/planningIaBuilder.test.ts` 제거.

추가 제거 대상(Explore 확인):
- **shared 타입**: `shared/src/ia-types.ts`(전체 — `IANodeKind`/`IANode`/`IATree`) + `shared/src/index.ts:11-14` re-export.
- **CSS**: `web/src/styles.css:68-106`(`.ia-node*` — "IA 트리 노드" 섹션). 🔴**단 `.feature-detail-*` CSS는 존치** — FeatureDetailPanel/FlowDetailPanel이 공유하므로 IADetailPanel 제거해도 이 클래스는 남긴다.
- **테스트**: `graphCrossProject.test.ts:67`의 뷰 루프 배열 `["graph", "ia", "wireframe", "prd", "spec-tree"]`에서 `"ia"` 제거(나머지 케이스는 green 유지).
- **web api import**: `api.ts:31-33`(`IAResponse` 타입)도 제거.

🔴 **경계(건드리지 않음 — 화면 id 존치)**: `server/src/parser/screenRegistry.ts`(전체), `shared/src/screen-types.ts`(전체) + `index.ts:91-93`, `docs.ts:160-176`(`/api/docs/:project/planning-screens`), `web/src/api.ts:279-284`(`fetchPlanningScreens`), `web/src/App.tsx`의 `planningScreens` 상태·fetch·`toFeatureTreeFlow` 배선, `featureTreeAdapter.ts:14,108,119-127,152,174`의 연결화면 조인, `FeatureDetailPanel`의 화면 칩(`:53-54,72,186-196`), `.feature-detail-*` CSS. `screenRegistry.ts`는 `node:fs`/`node:path`/`@flowforge/shared`만 import하고 IA 빌더를 import하지 않는다(역의존 0). `planningIaBuilder`가 `screenRegistry`를 import하는 **단방향** 의존이므로(D2·Explore 확인), 빌더만 지워도 레지스트리는 남는다.

### D3. 불변식 명시 — IA 제거는 화면 id를 절대 건드리지 않는다
**INVARIANT**: IA 관련 코드를 전부 제거한 뒤에도, ①`buildScreenRegistry`가 features.md 화면목록에서 `<!-- screen: id -->`를 파싱하고 ②`/api/docs/:project/planning-screens`가 `{screens, links}`를 서빙하고 ③기능명세 연결화면 칩·유저플로우·와이어의 화면 id 조인이 이전과 동일하게 동작한다. 이 불변식은 코드 구조상 보장된다 — 화면 레지스트리는 IA에 의존하지 않고(역방향 단방향), 별도 라우트로 서빙되며, `screenRegistry.ts` 주석이 "featureTreeBuilder와 완전히 분리"를 명시한다. 검증은 D5 골든 회귀로 결정론화한다.

### D4. feature→screen 딥링크(selectScreenInIa) 처리
IA 제거로 `selectScreenInIa`(`App.tsx:390-403`)의 타깃(`planningIaNodes`)이 사라진다. 이 핸들러는 `onSelectScreen={selectScreenInIa}`(`App.tsx:1240`)로 FeatureDetailPanel에 배선되고, FeatureDetailPanel은 화면 칩(`:53-54,72,186-196`)에서 `onSelectScreen(s.id)`(`:195`)를 호출한다. 이 change의 처리 = **딥링크 타깃(IA)만 떼되 화면 칩 자체는 유지**한다 — 칩 라벨은 화면 레지스트리(존치)에서 오므로 정보 손실 0. IA 뷰가 사라지므로 클릭 핸들러를 제거하거나 no-op/상태바 안내로 만든다(런타임 에러 0). 새 크로스링크 타깃 뷰 신설은 별도 change(`flowforge-screen-crosslink`) 몫이므로, 여기서는 **딥링크가 IA 부재로 깨지지 않게** 하는 것까지만 보장한다.
- **이유**: 연결화면 데이터(`screens` 칩)는 화면 레지스트리에서 오므로 존치. IA 뷰만 사라지므로 "IA로 딥링크"만 무효 → 그 코드경로를 제거하되 칩은 남긴다(불변식 D3과 정합).

### D4b. 화면 id 조인의 실제 소비처 — 정직한 한계 표기
Explore 정밀조사 결과 화면 id 공간이 **둘**로 나뉜다는 사실이 확인됐다: (1) `screenRegistry`(features.md `## 화면목록`) → 기능명세 연결화면 칩 + planning-IA. (2) spec/mermaid `screen-<slug>`(`wireframeBuilder.ts`·`planningUserFlowBuilder.ts`) → 유저플로우 ↔ change-와이어 1:1 대응. 이 change의 불변식(features.md 화면 id 존치)이 직접 지키는 것은 **공간(1)**이다. **정직한 한계**: 현 코드에서 유저플로우/planning-와이어가 `screenRegistry`의 화면 id를 *라이브로 조인*하는 경로는 확인되지 않았다(planning-와이어는 고정 픽스처 `buildDocsPlanningWireframe2`가 자체 `screenId`를 씀 — `docs.ts:210`). 즉 IA를 빼도 실질적으로 깨질 수 있는 유일한 소비처는 **기능명세 연결화면 칩**(+ 그 골든)뿐이다. 따라서 회귀 게이트는 공간(1) 골든(`planning-screens` 테스트 + 칩 조인)에 집중한다 — 공간(2)는 애초에 IA·screenRegistry와 무관해 영향 없음(변경 대상 아님).

### D5. 회귀 방지 = 화면 id 골든 + 5단계 게이트
IA 제거가 화면 id를 안 건드림을 **결정론으로** 입증한다:
- **화면 id 골든**: `server/src/routes/__tests__/docs.planning.test.ts`의 `describe("GET /api/docs/:project/planning-screens")` 케이스(파일 18-25행 `<!-- screen: home/settings -->` 픽스처, 108-137행 라우트 테스트)를 **제거 전/후 동일하게 green** 유지(회귀 0). 이 파일에 planning-ia 케이스는 없다(Explore 확인 — grep 0). ⚠️ `screenRegistry.ts` 자체 단위테스트는 부재(커버리지는 이 엔드포인트 테스트로만) → 리스트 전환·IA 제거가 화면 id를 안 건드림을 이 골든 + 라이브 픽셀로 이중 확인.
- **연결화면 조인 golden**: 기능명세 리스트에서 상세기능의 연결화면 칩이 화면 레지스트리와 동일 id로 붙는지(리스트 전환이 조인을 깨지 않는지) 단위 검증.
- **라이브 검증**: `docker compose up -d --build`로 반영 후 Playwright 실픽셀로 (1) 기능명세가 리스트로 렌더(다이어그램 아님) (2) IA 탭 부재(change·planning 양쪽) (3) 유저플로우·와이어에서 화면 id 링크 정상 (4) 두 "기능명세" 레이블이 구분됨을 확인.

### D6. 레이블 구분 방식 = 명시적 구분 레이블
change 탭(`App.tsx:941`)과 planning 탭(`App.tsx:993`)의 "기능명세서"를 서로 다른 레이블로 바꾼다(예: planning="기획 기능명세", change="명세(change)"). 노드 타입은 이미 코드상 분리(`specTree` vs `featureTree`, `App.tsx:82`)돼 있으므로 레이블만 조정하면 계보가 UI에서 구별된다. 툴팁으로 계보 출처(openspec-plan vs openspec-propose)를 부연할 수 있다.

## Risks / Trade-offs

- **🔴 위험(최상위): IA 제거가 화면 id를 깨뜨림** → 완화: D3 불변식 + D5 골든 회귀(제거 전후 `docs.planning.test.ts` planning-screens green). 화면 레지스트리는 IA에 역의존하지 않으므로 구조적으로 안전.
- **위험: 리스트 전환이 연결화면/뱃지/audit 정보를 누락** → 완화: 리스트가 FeatureNode(`:44-85`)가 렌더하던 필드 전부(태그·priority·status·capability·audit·연결화면·메모·when/then)를 싣는지 체크리스트로 확인 + 라이브 픽셀 비교.
- **위험: selectScreenInIa 딥링크가 IA 부재로 런타임 에러** → 완화: D4대로 IA 딥링크 코드경로 제거·칩은 유지·타깃 안전 처리(에러 0).
- **트레이드오프: 다이어그램의 자유 배치·줌 상실** → 데이터가 순수 트리라 배치 자유도가 정보를 안 실음(엣지=계층뿐). 리스트가 밀도·검색으로 상쇄.
- **위험: IA 노드타입(`ia: IANode`) 잔존 시 dead import** → 완화: `nodeTypes`·import·상태·effect까지 한꺼번에 제거, 빌드/타입체크로 dead ref 0 확인.

## Migration Plan

데이터 마이그레이션 없음 — features.md의 `## 화면목록`·`<!-- screen: id -->`는 그대로 유효하고 파싱도 불변. IA 산출물은 애초에 features.md/spec.md에서 파생 렌더였을 뿐 별도 저장물이 없다(제거해도 소스 데이터 손실 0). 기존 프로젝트(flowforge·쏙쏙)의 화면 id 링크는 유저플로우·와이어에서 그대로 동작한다.

## 화면 구성 / UI

이 change는 flowforge UI 변경이다(뷰 렌더 교체 + 탭 제거 + 레이블). 프로토타입 필요 여부는 apply 단계에서 판단하되, 검증은 `docker compose up -d --build` 후 Playwright 실픽셀로: 기능명세 리스트 렌더·IA 탭 부재·화면 id 링크 정상·레이블 구분 4점을 캡처한다. 화면 id 골든 회귀 0이 필수 게이트다.
