## Why

flowforge 웹앱은 순수 in-memory SPA다 — 뷰 상태(프로젝트·change key·탭)가 전부 `useState`이고 URL 라우팅이 전혀 없다(`web/src/App.tsx`: dashStage 초기값 "grid" `:193`, `useSearchParams`/`history.pushState`/`location.search`/`popstate`/react-router grep 0건). 그래서 특정 change의 특정 탭을 가리키는 URL이 존재할 수 없고, 어떤 URL로 접속해도 항상 랜딩(grid)에서 시작한다. 이 부재 때문에 propose 완료 링크가 flowforge의 해당 change 뷰를 가리킬 수 없다(후속 change가 이 딥링크 위에 의존).

## What Changes

- change 뷰(5종 탭: PRD·기능명세서·유저플로우·IA·와이어)를 딥링크 URL로 열 수 있게 하는 **프론트 URL 라우팅**을 신설한다. URL 형식(확정): `https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=<tab>` (`tab ∈ prd|spec|flow|ia|wire`).
- **pushState 기록**: change 뷰 진입(`openChangeViews` `App.tsx:892-898`)과 탭 전환(`tabBtn` `App.tsx:906-909`)에서 `history.pushState`로 현재 상태를 위 URL에 반영한다.
- **마운트 복원**: 최초 진입 시 `location.search`를 파싱해 `selectedProject`/`selected`/`tab`을 세팅하고 `setDashStage("views")`로 진입시킨다. 5종 데이터 로딩은 기존 `[selected, selectedProject]` effect(`App.tsx:217-244`)가 그대로 트리거되어 이뤄진다(신규 fetch 경로 없음).
- **popstate 처리**: 브라우저 뒤로/앞으로가기에서 URL을 다시 파싱해 뷰 상태를 동기화(뒤로가기로 이전 탭/화면 복귀).
- **엣지 방어**: 잘못된/존재하지 않는 project·change 파라미터는 안전하게 랜딩(grid)으로 폴백하거나 상태바에 실패를 표시하고, 앱을 깨뜨리지 않는다.
- **서버 무변경**: 서버 API는 이미 `?project=X`로 크로스프로젝트 change를 해석한다(`web/src/api.ts:76-78` `withProject`). 이 change는 프론트 라우팅만 신설하고 서버 코드는 건드리지 않는다.

## Capabilities

### New Capabilities
- `flowforge-deeplink-routing`: change 뷰의 프로젝트·change·탭 상태를 URL 쿼리(`?project=&change=&tab=`)와 양방향 동기화한다. 상태 변경은 URL에 pushState로 기록되고, URL은 마운트·popstate 시 뷰 상태로 복원된다. 잘못된 파라미터는 랜딩으로 안전 폴백한다.

### Modified Capabilities
(없음)

## Impact

- **웹(프론트만)**: `web/src/App.tsx` — pushState 기록(`openChangeViews`·`tabBtn`), 마운트 복원 useEffect(신규), popstate 리스너(신규), URL 파싱/직렬화 헬퍼(신규). 데이터 로딩 effect(`App.tsx:217-244`)는 재사용(변경 없음).
- **서버**: 무변경. `withProject`(`web/src/api.ts:76-78`)로 이미 `?project=` 해석 지원.
- **shared**: 무변경(탭 타입 `Tab`은 `App.tsx:89`에 이미 존재).
- **배포**: flowforge는 커밋≠라이브 — VERIFY에서 `docker compose up -d --build`로 재빌드 후 실제 URL 클릭으로 5종 탭 복원을 확인한다(메모리 교훈: `reference_flowforge_deploy`).
- **무저촉 보장**: URL 파라미터가 없을 때(기존 접속)는 기존 동작(grid 랜딩)이 완전히 보존되어야 한다 — 하위호환.
