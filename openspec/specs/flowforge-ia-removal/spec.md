# flowforge-ia-removal

## Purpose

IA(화면구조) 뷰를 산출물에서 제거하는 능력(5종→4종: PRD·기능명세·유저플로우·와이어). IA는 유저플로우·와이어가 이미 화면을 다루므로 별도 뷰의 가치가 낮아, IA 렌더 컴포넌트·어댑터·라우트·서버 빌더·탭을 제거한다. 🔴 **핵심 불변식**: 화면 id 파싱(`screenRegistry.ts`)·`/api/docs/:project/planning-screens` 라우트·화면 id 데이터는 존치해, 기능명세 연결화면·유저플로우·와이어의 화면 id 조인이 회귀 없이 유지된다(제거하는 것은 IA 렌더뿐이고 화면 id 데이터원은 건드리지 않는다).

## Requirements

### Requirement: IA 뷰가 산출물에서 제거된다 (5종→4종)
flowforge는 IA(화면구조) 뷰를 더 이상 제공하지 SHALL NOT 한다. change 뷰의 "IA 트리" 탭(`App.tsx:941`)과 planning 뷰의 "화면 구조" 탭(`App.tsx:994`), 그 렌더 블록(change `App.tsx:1225-1229`, planning `App.tsx:1048-1067`), `iaVerbose` 토글(`App.tsx:975-977`), IA 노드타입 등록(`App.tsx:82`의 `ia: IANode`), `Tab`/planTab 유니언의 `"ia"`(`App.tsx:89,105`)를 제거한다. 남는 산출물은 4종(PRD·기능명세·유저플로우·와이어)이다.

#### Scenario: change 뷰에 IA 탭이 없다
- **WHEN** change를 선택해 5종(→4종) 뷰 탭 목록을 본다
- **THEN** "IA 트리" 탭이 없고, PRD·기능명세·유저플로우·와이어 4종만 노출된다

#### Scenario: planning 뷰에 화면 구조(IA) 탭이 없다
- **WHEN** 프로젝트 기획(planning) 뷰의 탭 목록을 본다
- **THEN** "화면 구조"(IA) 탭이 없고, PRD·기능명세·유저플로우·와이어 4종만 노출된다

#### Scenario: IA 컴포넌트·어댑터·상태·토글이 코드에서 제거된다
- **WHEN** 빌드·타입체크를 돌린다
- **THEN** `IANode`/`iaAdapter.toIAFlow`/`IADetailPanel`·`ia: IANode` 노드타입·`iaNodes/iaEdges/planningIaNodes/planningIaEdges/iaVerbose` 상태·`onIaNodeClick`·IADetailPanel 마운트가 제거돼 dead reference 0으로 통과한다

### Requirement: IA 서버 빌더와 라우트가 제거된다
IA를 만들던 서버 빌더(`server/src/parser/iaBuilder.ts`, `server/src/parser/planningIaBuilder.ts`)와 라우트(`GET /api/changes/:id/ia` — `graph.ts:91-102`; `GET /api/docs/:project/planning-ia` — `docs.ts:178-196`), web fetch(`api.ts:127-130` `fetchIA`, `api.ts:289-295` `fetchDocsPlanningIa`), IA 전용 shared 타입(`shared/src/ia-types.ts`)을 제거 SHALL 한다.

#### Scenario: IA 라우트가 더 이상 응답하지 않는다
- **WHEN** `GET /api/changes/:id/ia` 또는 `GET /api/docs/:project/planning-ia`를 호출한다
- **THEN** 그 라우트는 등록돼 있지 않다(404 라우트 미존재 — 핸들러 제거됨)

#### Scenario: IA 서버 빌더 파일이 제거된다
- **WHEN** 서버 파서 디렉토리를 확인한다
- **THEN** `iaBuilder.ts`·`planningIaBuilder.ts`가 없고, 서버 빌드가 dead import 0으로 통과한다

### Requirement: IA 제거가 화면 id 데이터·파싱을 건드리지 않는다 (불변식)
IA 관련 코드를 전부 제거한 뒤에도, features.md 화면목록(`## 화면목록`)의 화면 id 마커(`<!-- screen: id -->`) 파싱(`server/src/parser/screenRegistry.ts`)과 `/api/docs/:project/planning-screens` 라우트(`docs.ts:160-176`)·`fetchPlanningScreens`(`api.ts:279-284`)·화면 id 데이터는 그대로 유지 SHALL 한다. 화면 레지스트리는 IA에 역의존하지 않으므로(단방향: `planningIaBuilder`→`screenRegistry`) IA 빌더 제거는 레지스트리를 손상시키지 않는다.

#### Scenario: 화면 id 파싱이 IA 제거 후에도 동작한다
- **WHEN** IA 코드를 전부 제거한 뒤 `<!-- screen: home -->`·`<!-- screen: settings -->`를 담은 features.md에 대해 `GET /api/docs/:project/planning-screens`를 호출한다
- **THEN** `{screens: [{id:"home",...},{id:"settings",...}], links: [...]}`가 IA 제거 전과 동일하게 반환된다(화면 id 골든 회귀 0)

#### Scenario: 유저플로우·와이어의 화면 id 조인이 유지된다
- **WHEN** IA 제거 후 유저플로우·와이어·기능명세 연결화면 뷰를 연다
- **THEN** 화면 id로 연결되는 링크·칩이 IA 제거 전과 동일하게 동작한다(조인키 데이터원 `screenRegistry`·`planning-screens` 불변)

#### Scenario: feature→screen 딥링크가 IA 부재로 깨지지 않는다
- **WHEN** IA 제거 후 기능명세 상세 패널의 연결화면 칩을 클릭한다
- **THEN** 칩은 여전히 화면 라벨을 표시하고(화면 레지스트리에서 옴), 클릭이 런타임 에러 없이 처리된다(구 IA 딥링크 타깃 제거·no-op/안내 처리)

## TDD Plan

- **Red/Green/Refactor**: (1) **화면 id 골든(회귀 0 필수)** — `server/src/routes/__tests__/docs.planning.test.ts`의 `planning-screens` 케이스(18-25행 `<!-- screen: home/settings -->` 픽스처, 108-137행)를 IA 제거 전/후 동일하게 green 유지. 이 테스트가 IA 제거가 화면 id를 안 건드림을 결정론으로 입증한다. (2) 제거 대상 IA 테스트(`planningIaBuilder.test.ts`) 삭제, `graphCrossProject.test.ts:67`의 뷰 루프 배열에서 `"ia"` 제거(나머지 케이스 green 유지). (3) `docker compose up -d --build` 후 Playwright 실픽셀로 change·planning 양쪽 IA 탭 부재 + 유저플로우/와이어 화면 id 링크 정상을 관찰.
- **Mock 대상**: 없음(엔드포인트 골든 + 라이브 관찰). `screenRegistry.ts` 자체 단위테스트는 부재이므로 `/planning-screens` 엔드포인트 골든이 화면 id 회귀 가드다.
