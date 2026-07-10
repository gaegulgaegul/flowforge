# Tasks — flowforge-deeplink-url

> Phase 0 딥링크 URL 스킴. 프론트 URL 라우팅만 신설(서버 무변경). 데이터 로딩은 기존 `[selected, selectedProject]` effect(`web/src/App.tsx:217-244`) 재사용 — 신규 fetch 경로를 만들지 않는다. spec의 각 THEN이 아래 GREEN에 1:1 대응한다.

## Tasks

### Sequential: URL 헬퍼 기초 (선행 필수 — 파싱/직렬화 단일화)
- [x] RED: `parseDeepLink(search)`/`serializeDeepLink(state)` 순수함수 테스트 — `?project=X&change=Y&tab=spec`→`{project,change,tab}` 파싱, 역직렬화, 알 수 없는 tab→prd 정규화, project·change 누락→null(랜딩), `encodeURIComponent` 인코딩 (web에 테스트 러너 없음 — 순수함수는 typecheck로, App 배선은 VERIFY 라이브로 검증)
- [x] GREEN: `web/src/deeplink.ts` 신설 — `parseDeepLink`(URLSearchParams, tab 화이트리스트 5종, 필수 파라미터 검증) + `serializeDeepLink`(`?project=&change=&tab=` 조립). `Tab` 타입·화이트리스트는 deeplink.ts 단일 정의로 이관, App.tsx가 import 소비

### Parallel Group 1 (상태→URL 기록 — 서로 다른 진입점, 동시 실행 가능)
- [x] RED: pushState 기록 테스트 — `openChangeViews` 시 `history.pushState`가 `?project=&change=&tab=prd`로 호출, 탭 전환(`tabBtn`) 시 tab만 갱신된 URL로 호출 (history mock) [parallel] (web에 테스트 러너 없음 — App 배선은 VERIFY 라이브로 검증)
- [x] GREEN: `openChangeViews`에 pushState 추가 — 진입 시 `serializeDeepLink({project,change,tab:"prd"})`로 기록. change.project가 있을 때만(전역 진입 change는 왕복 불가라 URL 미기록) [parallel] [frontend]
- [x] GREEN: `tabBtn` onClick에 pushState 추가 — `setTab(key)` 후 현재 project·change+새 tab으로 기록(둘 다 있을 때만) [parallel] [frontend]

### Sequential: URL→상태 복원 (헬퍼 완료 후)
- [x] RED: 마운트 복원 테스트 — 초기 `location.search=?project=X&change=Y&tab=spec` 주어지면 `dashStage="views"`+selected=Y+selectedProject=X+tab=spec, 파라미터 없으면 grid 유지(하위호환), tab별(prd/flow/ia/wire) 복원 (web에 테스트 러너 없음 — VERIFY 라이브로 검증)
- [x] GREEN: 마운트 복원 useEffect 신설(`App.tsx`) — `parseDeepLink(location.search)`→있으면 `setSelectedProject`/`setSelected`/`setTab`/`setDashStage("views")`. `setSelected`가 기존 `[selected, selectedProject]` effect를 트리거해 5종 데이터가 로드됨(신규 fetch 없음) [frontend]

### Sequential: 뒤로가기 (복원 로직 재사용)
- [x] RED: popstate 테스트 — 탭 전환 후 popstate 디스패치 시 이전 tab으로 복귀, change 진입 후 popstate 시 파라미터 사라지고 grid로 복귀 (web에 테스트 러너 없음 — VERIFY 라이브로 검증)
- [x] GREEN: popstate 리스너 useEffect 신설(`App.tsx`) — `parseDeepLink(location.search)`→결과 있으면 상태 재동기화(+stage views), 없으면 `setDashStage("grid")`. `goToStage`가 views를 떠날 때 딥링크 없는 URL(`location.pathname`)로 pushState [frontend]

### Sequential: 엣지 방어
- [x] RED: 방어 테스트 — 알 수 없는 tab→prd 폴백, 존재하지 않는 change/project 로딩 실패 시 크래시 없이 상태바 표시(기존 `.catch(setStatus)`), 필수 파라미터 일부 누락→grid 폴백 (web에 테스트 러너 없음 — tab 정규화는 typecheck+deeplink.ts 로직으로, 나머지는 VERIFY 라이브로 검증)
- [x] GREEN: 방어 확인 — tab 정규화는 `parseDeepLink`(unknown tab→prd)에서 처리됨. 로딩 실패는 기존 `[selected,selectedProject]` effect의 `.catch((e)=>setStatus(...))` 경로가 담당 — 복원은 `setSelected`/`setSelectedProject`만 세팅하고 fetch를 추가하지 않아 이 경로를 그대로 재사용(추가 catch 없음) [frontend]

### Sequential: 정합 검증
- [x] REFACTOR: URL 조립/파싱이 `serializeDeepLink`/`parseDeepLink` 한 곳으로 단일화됨(진입·탭전환·복원·popstate 모두 헬퍼 경유, 인라인 `?project=...` 조립 없음). views 이탈은 `location.pathname`(파라미터 제거)만 씀. Tab 화이트리스트도 deeplink.ts 단일 정의. 서버·shared 무변경 확인

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 있음) 전부 PASS. UI는 `docker compose up -d --build` 재빌드 후(flowforge 커밋≠라이브) 실제 URL `https://flowforge.gaegul.house/?project=X&change=Y&tab=<t>`을 5종 탭 각각으로 열어 복원 확인 + 탭 전환 시 URL 갱신 + 뒤로가기 복귀를 라이브 실픽셀로 검증. 쿼리 없는 `/` 접속이 기존 grid 랜딩을 유지하는지(하위호환) 확인
