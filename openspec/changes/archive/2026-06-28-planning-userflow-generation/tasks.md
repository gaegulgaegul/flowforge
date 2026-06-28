## Tasks

### Sequential: overlay IO 선행 (빌더·라우트 둘 다 의존)
- [x] GREEN: `server/src/lib/docs.ts`에 docs용 overlay 읽기/쓰기 + user-flow 디렉토리 IO 추가 — `readDocsUserFlowOverlay(docsDir, group, version)`(`user-flow/<group>-vN.overlay.json` 읽기, 없으면 null)·`writeDocsUserFlowOverlay(...)`(좌표 JSON 쓰기, 디렉토리 자동생성)·`listDocsUserFlows(docsDir)`(user-flow/ readdir → `<group>-vN` 목록). group/version 파일명 화이트리스트(`[A-Za-z0-9_-]`·`..` 금지). changes.ts readOverlay/writeOverlay 패턴 참고(경로만 다름). docs 첫 쓰기 — 명세 .md는 안 건드림.

### Parallel Group 1 (overlay IO 후 — 서로 다른 파일/레포, 동시 실행 가능)
- [x] RED: `server/src/parser/__tests__/planningUserFlowBuilder.test.ts` — Mermaid 픽스처를 SpecGraph로 파싱(노드 모양 `(["x"])`/`["x"]`/`{"x"}`→kind, 엣지 `A-->B`·`A-->|label|B`→source/target/label, 미지원 라인 무시, 파일 없으면 null) [parallel]
- [x] RED: `server/src/routes/__tests__/docs.test.ts`에 planning-user-flow 통합 케이스 추가 — GET 200+graph+layout, PUT layout 저장→overlay 파일 기록·재조회 반영, 경로조작 4xx, 잘못된 body 4xx [parallel]
- [x] GREEN: openspec-plan SKILL.md(agentic-harness 소스)에 "유저플로우 생성" 단계 추가 — 기능명세 다음 의존성 순서, 게이트(기능 ≥1), Mermaid flowchart 규약(노드 모양→타입, 엣지, 폴더 버전 -vN) 명문화. 다른 레포라 flowforge 파일과 독립 [parallel]

### Sequential: server GREEN 빌더 (RED 통과)
- [x] GREEN: `server/src/parser/planningUserFlowBuilder.ts` 신설 — `buildDocsPlanningUserFlow(docsDir, group, version)`가 `user-flow/<group>-vN.md`의 ```mermaid 코드블록을 정규식으로 파싱해 SpecGraph 빌드(mermaid 라이브러리 없이). 노드 모양→kind 매핑(stadium=start/box=screen/diamond=action 등), 엣지 `-->`·`-->|label|`, 미지원 라인 throw 없이 무시. 파일 없으면 null. slug 재사용. 테스트 실패 시 추측 금지·근본원인부터

### Sequential: server GREEN 라우트 (빌더+overlay IO 통합)
- [x] GREEN: `server/src/routes/docs.ts`에 `GET /api/docs/:project(*)/planning-user-flow`(buildDocsPlanningUserFlow + readDocsUserFlowOverlay + listDocsUserFlows → `{ project, graph, layout, versions }`, 파일없음 404) + `PUT /api/docs/:project(*)/planning-user-flow/layout`(isLayoutOverlay 검증 + writeDocsUserFlowOverlay, group/version 화이트리스트, 경로조작·잘못된body 4xx) 추가. resolveDocsDir·isLayoutOverlay·safe() 재사용. 기존 graph.ts/docsAdapter 무수정

### Parallel Group 2 (server 완료 후 — 서로 다른 파일, 동시 실행 가능)
- [x] GREEN: web `api.ts`에 `fetchDocsPlanningUserFlow(project, group?, version?)` + `saveDocsPlanningUserFlowLayout(...)` 추가(기존 fetchGraph/saveLayout 패턴) [parallel] [frontend-agent]
- [x] GREEN: web `App.tsx` skeleton 단계에 유저플로우 섹션 배선 — graphAdapter/SpecNode 재사용 ReactFlow 렌더, 드래그→PUT 저장(dashReqToken race 가드), 버전 선택(여럿이면). 기존 change/charter graph 렌더·FeatureTree·SpecTree 무영향 [parallel] [frontend-agent]

### Sequential: 도그푸딩 (세로관통 실증)
- [x] GREEN: flowforge 자체 `docs/planning/user-flow/main-v1.md`(Mermaid flowchart로 기획 단계 화면 흐름) 생성 — DOCS_ROOT 기동→GET planning-user-flow 200+graph 확인(노드11·엣지12·kind start/screen/action), PUT layout→overlay JSON 기록 재조회 확인({"ok":true,"saved":1})

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [x] VERIFY: 5단계 게이트 통과 — 빌드(shared→server→web PASS) → 타입체크(워크스페이스 3개 PASS) → 린트(PASS) → 테스트(142/142, planningUserFlowBuilder 포함, change/charter user-flow·FeatureTree·SpecTree 회귀 0) → UI(Playwright 실픽셀 PROJECTS_ROOT/DOCS_ROOT=/home/gaegul PORT=8904: flowforge 카드 클릭→[data-testid=planning-user-flow] .react-flow__node 11개 렌더·엣지12·라벨 정확·콘솔에러0, 노드 드래그→onNodeDragStop→PUT 저장→overlay JSON에 11노드 좌표 기록 재조회 확인) 전부 PASS
