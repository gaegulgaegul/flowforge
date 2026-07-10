# Design — flowforge-deeplink-url

> Phase 0(딥링크 URL 스킴). flowforge change 뷰 5종 탭을 딥링크 URL로 열 수 있게 하는 프론트 URL 라우팅. 이후 propose 완료 링크가 flowforge를 가리키게 하는 후속 change가 이 위에 의존한다.

## 배경 / 위치

flowforge 웹앱(`web/src/App.tsx`)은 순수 in-memory SPA다. 뷰 상태 3종이 전부 `useState`:
- `selected`(change key, `App.tsx:99`), `selectedProject`(`App.tsx:102`), `tab`(`App.tsx:103`, 타입 `Tab = "prd"|"spec"|"flow"|"ia"|"wire"` `App.tsx:89`), `dashStage`(`App.tsx:193`, 초기값 "grid").
- 진입 흐름: grid → skeleton → capChanges → views. change 5종 탭 진입 = `openChangeViews`(`App.tsx:892-898`)가 `setSelected`+`setSelectedProject`+`setTab("prd")`+`setDashStage("views")`.
- URL 라우팅 부재 확정: `useSearchParams`/`history.pushState`/`location.search`/`popstate`/react-router grep 0건. 어떤 URL로 접속해도 항상 grid에서 시작.

## URL 스킴 (확정)

```
https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=<tab>
                                  tab ∈ prd | spec | flow | ia | wire
```
- `project`: change가 속한 프로젝트 키(서버가 `?project=`로 크로스프로젝트 해석, `web/src/api.ts:76-78` `withProject`).
- `change`: change key(`ChangeSummary.key`).
- `tab`: 5종 탭. 값이 5종 밖이면 `prd`로 폴백.
- 세 파라미터가 딥링크의 최소 단위. `project`/`change`가 없으면 change를 특정할 수 없어 랜딩(grid).

## D1. pushState vs hash — pushState 선택

- **pushState 채택.** 이유: (1) 서버가 이미 쿼리스트링(`?project=`)을 해석·수용한다 — hash(`#`)는 서버로 전송되지 않아 이 서버 계약과 어긋난다. (2) 프로덕션은 flowforge.gaegul.house 단일 페이지(vite build → cloudflared) — 어떤 경로든 index.html을 서빙하므로 pushState의 딥링크 새로고침(서버 라우트 없음) 문제가 없다(SPA 폴백). (3) `?query` 형태가 서버 `withProject` 계약과 문자 그대로 동일해 사람이 읽고 공유하기에도 자연스럽다.
- hash 라우팅은 서버 무관 SPA에 안전하지만, 여기선 서버가 쿼리를 이미 소비하므로 pushState가 계약 정합적이다.

## D2. 상태↔URL 동기화 지점 (App.tsx)

**상태 → URL (write, pushState):**
- `openChangeViews`(`App.tsx:892-898`): change 뷰 진입 시. setState 후 `history.pushState(null, "", serializeDeepLink({project, change, tab:"prd"}))`.
- `tabBtn`(`App.tsx:906-909`)의 onClick: 탭 전환 시. `setTab(key)` 후 현재 `selectedProject`/`selected`+새 `key`로 pushState.
- 랜딩/skeleton/capChanges로 돌아가는 `goToStage`(`App.tsx:900-904`): views를 떠날 때 딥링크 파라미터를 지운 URL(`/`)로 pushState(뷰 단계 상태만 URL이 표현).

**URL → 상태 (read):**
- 마운트 복원 useEffect(신규): 최초 1회 `parseDeepLink(location.search)` → 있으면 `setSelectedProject`/`setSelected`/`setTab`/`setDashStage("views")`.
- popstate 리스너 useEffect(신규): 뒤로/앞으로가기 시 `parseDeepLink(location.search)` → 상태 재동기화, 파라미터 없으면 grid로.

## D3. 마운트 복원 로직 — 기존 데이터 흐름에 연결 (신규 fetch 없음)

핵심: **데이터 로딩 경로를 새로 만들지 않는다.** 기존 `[selected, selectedProject]` 데이터 로딩 effect(`App.tsx:217-244`, `fetchGraph`/`fetchIA`/`fetchWireframe`/`fetchPrd`/`fetchSpecTree`)가 `selected`가 세팅되는 순간 5종을 전부 로드한다(`if (!selected) return`). 마운트 복원은 `selectedProject`/`selected`를 세팅하기만 하면 이 effect가 자동 트리거되어 데이터가 온다. 따라서 복원 useEffect의 책임은 URL 파싱 + 4개 setState(project·change·tab·stage)뿐.

```
mount useEffect (1회):
  const dl = parseDeepLink(location.search)
  if (!dl) return                       // 파라미터 없음 → grid 유지(하위호환)
  setSelectedProject(dl.project)
  setSelected(dl.change)                // ← 이게 App.tsx:217 effect를 트리거 → 5종 fetch
  setTab(dl.tab)                        // 5종 밖이면 parseDeepLink이 이미 prd로 정규화
  setDashStage("views")
```

## D4. 뒤로가기 처리

- popstate 리스너에서 `parseDeepLink(location.search)` 재실행:
  - 결과 있음 → project/change/tab 재세팅(+ stage "views"). change가 이전과 다르면 `[selected, selectedProject]` effect가 다시 fetch.
  - 결과 없음(랜딩 URL) → `setDashStage("grid")`(+ 필요 시 selected 클리어).
- pushState는 히스토리 엔트리를 쌓으므로 진입·탭전환이 브라우저 히스토리에 남고, 뒤로가기가 그걸 되짚는다.

## D5. 헬퍼 — 순수 함수로 파싱/직렬화 단일화

- `parseDeepLink(search: string): { project: string; change: string; tab: Tab } | null`
  - `URLSearchParams`로 `project`·`change`·`tab` 추출.
  - `project` 또는 `change` 없으면 `null`(랜딩 폴백).
  - `tab`이 5종(`prd|spec|flow|ia|wire`)이 아니면 `prd`로 정규화.
- `serializeDeepLink(s: { project: string; change: string; tab: Tab }): string`
  - `?project=&change=&tab=` 조립(`encodeURIComponent`로 안전 인코딩 — `withProject`와 동일 관례).
- 두 헬퍼를 신규 파일(`web/src/deeplink.ts` 등)에 두고 진입·탭전환·마운트·popstate가 공유 → URL 표현 드리프트 방지.

## 보안 / 엣지 방어

- **입력 검증**: `tab`은 화이트리스트(5종)로 정규화 — 임의 값이 뷰로 새지 않는다. `project`/`change`는 서버가 openspec 하위 경로 해석 시 방어(이 change의 서버 무변경 전제 — 기존 API의 경로 방어를 신뢰). 프론트는 값을 그대로 fetch 쿼리로 전달하되 `encodeURIComponent`로 인코딩.
- **존재하지 않는 change/project**: 기존 fetch가 non-ok에서 throw(`web/src/api.ts`)하고, `[selected, selectedProject]` effect의 각 `.catch((e)=>setStatus(...))`(`App.tsx:231,234,237,240,243`)가 상태바에 실패를 표시 → 크래시 없음. 뷰는 빈 상태 또는 grid 폴백.
- **파라미터 조작**: URL은 사용자가 임의 편집 가능 — 화이트리스트 정규화 + 서버 경로 방어 이중으로, 잘못된 값이 앱을 깨거나 서버 파일시스템을 벗어나게 하지 않는다.
- **XSS 없음**: 파라미터는 fetch 쿼리·상태값으로만 쓰이고 `innerHTML` 등에 주입하지 않는다(React 텍스트 렌더).

## 의도적 제외 (이 change 범위 밖)

- **propose 완료 링크가 flowforge를 가리키는 배선**: 이 딥링크 스킴을 소비하는 쪽(openspec propose 완료 알림 링크)은 후속 change. 이 change는 URL로 열 수 있는 상태를 만들기만 한다.
- **skeleton/capChanges 단계의 딥링크**: URL은 change 뷰(views) 상태만 표현. 뼈대·capability별 change 목록 딥링크는 범위 밖.
- **탭 내 세부 상태의 URL 반영**: IA verbose 토글(`iaVerbose`), 선택된 노드, 스크롤 위치 등 탭 내부 상태는 URL에 담지 않는다(change·탭 단위까지만).
- **서버 라우팅/리다이렉트**: 서버 무변경. SPA index.html 폴백이 딥링크 새로고침을 처리한다는 프로덕션 전제에 의존.
- **react-router 등 라우터 라이브러리 도입**: 상태 3종·경로 1개라 네이티브 `history`/`URLSearchParams`로 충분(신규 의존성 지양, tech-evaluation 원칙).

## 검증

- flowforge는 커밋≠라이브(`reference_flowforge_deploy`) — VERIFY에서 `docker compose up -d --build`로 재빌드 후 실제 URL(`https://flowforge.gaegul.house/?project=X&change=Y&tab=<t>`)을 5종 탭 각각으로 열어 복원·뒤로가기를 라이브 실픽셀로 확인한다.

관련: [[project_manyfast_clone]](flowforge 자체구축), [[reference_flowforge_deploy]](재빌드 필수), `web/src/api.ts:76-78`(서버 `?project=` 계약).
