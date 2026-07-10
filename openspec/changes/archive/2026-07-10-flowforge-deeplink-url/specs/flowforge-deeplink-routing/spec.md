## ADDED Requirements

### Requirement: change 뷰 상태를 URL에 기록한다

flowforge는 change 뷰(views 단계)에 있을 때, 현재 프로젝트·change·탭을 URL 쿼리 `?project=<project>&change=<change>&tab=<tab>`로 `history.pushState` SHALL 한다(`tab ∈ prd|spec|flow|ia|wire`). change 뷰 진입(`openChangeViews`, `web/src/App.tsx:892-898`)과 탭 전환(`tabBtn`, `App.tsx:906-909`)이 이 기록의 트리거다. URL 형식의 정식 원본은 `https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=prd`다. 랜딩(grid)·skeleton·capChanges 단계에서는 change 딥링크 파라미터를 URL에 남기지 않는다(뷰 단계 상태만 URL이 표현).

#### Scenario: change 뷰 진입 시 URL 기록

- **WHEN** 사용자가 어떤 change의 5종 뷰로 진입한다(change 클릭 → views 단계, tab 기본 "prd")
- **THEN** URL이 `?project=<그 프로젝트>&change=<그 change>&tab=prd`를 반영하도록 pushState 된다

#### Scenario: 탭 전환 시 URL의 tab 갱신

- **WHEN** 사용자가 change 뷰에서 spec 탭으로 전환한다
- **THEN** URL이 `?project=X&change=Y&tab=spec`을 반영한다(project·change는 유지, tab만 갱신)

#### Scenario: 5종 탭 각각이 서로 다른 URL을 갖는다

- **WHEN** 사용자가 prd → spec → flow → ia → wire 탭을 차례로 누른다
- **THEN** 각 탭에서 URL의 `tab` 값이 각각 `prd`·`spec`·`flow`·`ia`·`wire`로 구별되게 바뀐다(탭마다 고유 딥링크)

### Requirement: URL로 change 뷰를 복원한다

flowforge는 마운트 시 `location.search`를 파싱해, `project`·`change`·`tab` 파라미터가 있으면 `selectedProject`·`selected`·`tab` 상태를 세팅하고 `dashStage`를 "views"로 진입 SHALL 한다. 5종 산출물 데이터 로딩은 기존 `[selected, selectedProject]` 데이터 로딩 effect(`web/src/App.tsx:217-244`)가 트리거되어 이뤄진다(신규 fetch 경로를 만들지 않고 기존 흐름에 연결). 서버는 `?project=`로 이미 크로스프로젝트 change를 해석한다(`web/src/api.ts:76-78`)므로 서버 변경은 없다.

#### Scenario: 딥링크 URL로 새로 접속하면 해당 탭이 복원된다

- **WHEN** 사용자가 `?project=X&change=Y&tab=spec` URL로 앱에 새로 접속한다
- **THEN** change Y의 spec 탭(기능명세서)이 views 단계로 복원되어 표시되고, 5종 데이터가 그 change 기준으로 로드된다

#### Scenario: tab 파라미터별 복원

- **WHEN** `tab=prd`·`tab=flow`·`tab=ia`·`tab=wire` 각각의 딥링크로 접속한다
- **THEN** 각각 PRD·유저플로우·IA 트리·와이어프레임 탭이 복원되어 표시된다

#### Scenario: 딥링크 파라미터가 없으면 기존 랜딩 유지

- **WHEN** 사용자가 쿼리 없는 URL(`/`)로 접속한다
- **THEN** 기존 동작대로 랜딩(grid, `dashStage` 초기값 "grid" `App.tsx:193`)에서 시작한다(하위호환 — 딥링크 도입이 기존 진입을 바꾸지 않는다)

### Requirement: 뒤로가기로 이전 탭/화면으로 돌아간다

flowforge는 `popstate` 이벤트를 구독해, 브라우저 뒤로/앞으로가기 시 그 시점 URL을 다시 파싱해 뷰 상태(project·change·tab, 또는 파라미터 부재 시 grid)를 동기화 SHALL 한다. 이로써 탭 전환·change 진입이 브라우저 히스토리로 되돌려진다.

#### Scenario: 탭 전환 뒤 뒤로가기

- **WHEN** 사용자가 prd 탭에서 spec 탭으로 전환한 뒤 브라우저 뒤로가기를 누른다
- **THEN** URL이 `tab=prd`로 돌아가고 뷰가 prd 탭으로 복귀한다

#### Scenario: change 진입 뒤 뒤로가기

- **WHEN** 사용자가 랜딩에서 어떤 change 뷰로 진입한 뒤 뒤로가기를 누른다
- **THEN** URL의 딥링크 파라미터가 사라지고 뷰가 진입 이전 화면(랜딩/grid)으로 돌아간다

### Requirement: 잘못된 파라미터를 안전하게 방어한다

flowforge는 유효하지 않은 딥링크 파라미터를 받아도 앱을 깨뜨리지 않고 안전하게 처리 SHALL 한다. `tab` 값이 5종(`prd|spec|flow|ia|wire`)이 아니면 기본 탭(prd)으로 폴백한다. 존재하지 않는 project/change로 데이터 로딩이 실패하면(기존 fetch가 non-ok에서 throw, `web/src/api.ts`) 기존 catch 경로가 상태바에 실패를 표시하고, 뷰는 랜딩(grid)으로 안전 폴백하거나 빈 상태로 남아 앱이 계속 동작한다.

#### Scenario: 알 수 없는 tab 값

- **WHEN** `?project=X&change=Y&tab=bogus`처럼 5종에 없는 tab으로 접속한다
- **THEN** tab이 기본값 prd로 폴백되어 PRD 탭이 표시되고, 앱은 정상 동작한다

#### Scenario: 존재하지 않는 change/project

- **WHEN** 존재하지 않는 project·change 파라미터로 접속해 5종 데이터 로딩이 실패한다
- **THEN** 상태바에 로드 실패가 표시되고(기존 `.catch(setStatus)` 경로), 앱은 크래시 없이 계속 동작한다(랜딩 폴백 또는 빈 뷰)

#### Scenario: 파라미터 일부 누락

- **WHEN** `?tab=spec`만 있고 project·change가 없는 등 딥링크에 필수 파라미터가 빠진 URL로 접속한다
- **THEN** change를 특정할 수 없으므로 랜딩(grid)으로 폴백한다(부분 파라미터로 잘못된 뷰를 열지 않는다)

## TDD Plan

- **Red**: URL 파싱/직렬화 헬퍼 테스트 — `?project=X&change=Y&tab=spec` → `{project, change, tab}` 파싱, 역방향 직렬화, 알 수 없는 tab→prd 폴백, 필수 파라미터 누락→null(랜딩). pushState 기록 테스트 — `openChangeViews`/탭 전환 시 `history.pushState`가 올바른 URL로 호출되는지(history mock). 마운트 복원 테스트 — 초기 `location.search`가 주어지면 `dashStage="views"`+올바른 selected/selectedProject/tab. popstate 테스트 — 이벤트 디스패치 시 상태 재동기화. 방어 테스트 — 로딩 실패 시 크래시 없음.
- **Green**: `parseDeepLink(search): {project, change, tab} | null` + `serializeDeepLink(state): string` 순수 헬퍼(신규, `web/src`). `openChangeViews`(`App.tsx:892-898`)와 `tabBtn`(`App.tsx:906-909`)에 pushState 호출 추가. 마운트 복원 useEffect 신규(파싱→setSelectedProject/setSelected/setTab/setDashStage("views")). popstate 리스너 useEffect 신규(파싱→상태 동기화 또는 grid 폴백). 데이터 로딩은 기존 `[selected, selectedProject]` effect(`App.tsx:217-244`) 재사용 — 신규 fetch 없음.
- **Refactor**: pushState URL 문자열 조립을 `serializeDeepLink` 한 곳으로 단일화(진입·탭전환·복원 후 URL 표현이 드리프트하지 않게). 파싱도 `parseDeepLink` 한 곳(마운트·popstate 공유).
- **Mock 대상**: `window.history.pushState`/`window.location.search`(jsdom history mock), `popstate` 이벤트 디스패치. 서버 fetch는 기존 테스트 방식(fetch mock) 재사용 — 서버 무변경이므로 계약 mock만. 실제 크로스프로젝트 해석은 서버(`?project=`)가 담당하므로 프론트 테스트는 URL↔상태 동기화만 검증.
