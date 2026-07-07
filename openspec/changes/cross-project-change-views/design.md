# cross-project-change-views — design

## Context

`changesRoot()`(server/src/lib/changes.ts:13-16)는 `OPENSPEC_ROOT ?? cwd/openspec` 단일 루트만 안다. 5종 뷰 라우트(routes/graph.ts, GET 6·PUT 1)는 전부 이 루트 기준 `resolveChangeDir(id)`로 해석 → 타 프로젝트 change는 404 `change_not_found`. 반면 projects 라우트는 `resolveProjectDir(project)`(화이트리스트: PROJECTS_ROOT 1단계 하위 실재 디렉토리 + `..` 차단)로 프로젝트별 `openspec/changes`를 이미 정상 해석한다. web은 change 클릭 시 `setSelected(key)`만 하고 프로젝트 컨텍스트를 버린다(`ChangeSummary`에 project 없음).

## Goals / Non-Goals

**Goals:**

- 프로젝트 카드에서 진입한 change의 5종 뷰가 그 프로젝트의 openspec에서 열린다(404 dead-end 해소)
- 기존 소비자 무영향: `?project=` 부재 시 현행 글로벌 루트 동작 그대로(하위호환 100%)
- 경로 안전: project는 기존 화이트리스트 검증만 통과(임의 경로 열람 0)

**Non-Goals:**

- 라우트 URL 재설계(REST nested 경로 신설 안 함 — 쿼리 파라미터가 최소 diff)
- RO 마운트 프로젝트의 layout 저장 가능화(실패는 기존 안내 경로로 무해)
- change 목록·카드 UI 변경

## Decisions

- **D-1 쿼리 파라미터, nested 라우트 아님.** `GET /api/changes/:id/graph?project=<name>` — 기존 6 GET+1 PUT 시그니처 유지에 옵션만 추가. nested(`/api/projects/:project/changes/:id/*`) 신설은 라우트 7개 복제+기존 유지로 표면이 2배가 되어 기각. 쿼리 부재=글로벌 루트(현행 동작 불변)가 하위호환 게이트.
- **D-2 프로젝트 검증 = resolveProjectDir 재사용.** projects.ts의 화이트리스트 로직을 공용으로 옮기거나(server lib) import해 재사용 — 새 검증 코드 금지(no-traversal 규약 계승). 검증 실패는 404(존재 노출 최소화, 기존 패턴).
- **D-3 change 해석 = changesRootFor(dir) 파생.** `resolveChangeDir(id, rootDir?)` 시그니처 확장(기본값=현행 changesRoot()) — 호출부 무수정 하위호환. change id 자체도 기존 검증(`..` 차단·실재 확인) 경로 그대로.
- **D-4 web은 컨텍스트만 나른다.** `ChangeSummary.project?: string`(additive — server가 capability detail 응답에 세팅), openChangeViews가 selected와 함께 project를 state로 보관, 5 fetcher+saveLayout이 있으면 쿼리로 부착. 글로벌(기존) 경로로 열린 change는 project 없이 현행 그대로.
- **D-5 RO 저장 실패 = 정직 안내.** 타 프로젝트 layout PUT이 EROFS/EACCES면 기존 safe() 에러 경로 → 상태바 "이 프로젝트는 읽기전용이라 배치 저장이 안 됩니다" 계열 안내. 데이터 불변, 뷰는 계속 동작.

## Risks / Trade-offs

- OPENSPEC_ROOT 프로젝트와 PROJECTS_ROOT 하위 같은 프로젝트가 중복일 때(flowforge 자신) 두 경로 모두 유효 — 같은 디렉토리를 가리키므로 무해하나, web은 카드 진입 시 일관되게 project를 붙인다(혼선 방지).
- viz/graph-overlay.json 쓰기가 타 프로젝트 git 작업트리를 건드릴 수 있음 — 대상 프로젝트 gitignore에 없을 수 있다(wowa 선례는 있음). RO 마운트가 실질 가드이고, 쓰기 성공 환경에서는 사용자 의도(드래그 저장)로 간주. 문서에 명시.

## 화면 구성 / UI

- 신규 화면 없음 — 기존 5종 뷰가 타 프로젝트 change에서도 열리는 것뿐.
