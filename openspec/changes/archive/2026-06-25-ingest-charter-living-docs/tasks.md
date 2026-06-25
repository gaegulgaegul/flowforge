## Tasks

### Sequential: 공유타입 기반 (선행 필수 — 어댑터·프론트가 의존)
- [x] RED: `@flowforge/shared` 신규 타입(`DocsDecision`, `DecisionTimeline`) + `GraphNode`/`WireScreen`/`WireBox` 의 `seed?: boolean` 옵셔널 필드 타입 테스트 작성
- [x] GREEN: shared 타입 추가(비파괴 옵셔널), `npm -w shared run build` 로 dist 갱신

### Parallel Group 1 (독립 - 동시 실행 가능: 서로 다른 신규 파일, 선행=공유타입만)
- [x] RED: `server/src/lib/docs.ts` DOCS_ROOT 다중 스캔(`listDocsProjects`) + 경로안전(`resolveDocsDir`, `..`/화이트리스트 거부) 픽스처 테스트 작성 [parallel]
- [x] RED: `server/src/parser/charterUserFlowParser.ts` charter 라인문법(`## flow:`/`### 화면:`/`- step:`/`- goto:`·엔드포인트 goto) 읽기전용 파싱 테스트 작성 — charter 원본 정규식 동치 케이스 [parallel]
- [x] RED: `server/src/parser/charterPrdParser.ts` `## decision:` 이력(date/capability/why/what/success/status·superseded) 파싱 테스트 작성 [parallel]

### Parallel Group 2 (독립 - 동시 실행 가능: 각 RED 의 최소 GREEN, 서로 다른 파일)
- [x] GREEN: `docs.ts` 스캔 1단계 한정·심링크 비추적·traversal 거부 최소 구현 (실패 시 추측 금지, 근본원인부터) [parallel]
- [x] GREEN: `charterUserFlowParser.ts` 정규식을 charter_wireframe.py L24-27 동치로 포팅(원본 위치 주석), specParser 무수정 (실패 시 근본원인부터) [parallel]
- [x] GREEN: `charterPrdParser.ts` decision 배열·superseded 상태 최소 구현 (실패 시 근본원인부터) [parallel]

### Sequential: 어댑터 (선행=파서 3종 — 출력 의존)
- [x] RED: `server/src/parser/docsAdapter.ts` 테스트 작성 — 화면→GraphNode, 명시 goto→edge, 미정의 대상→dangling(target:null), step→WireBox(charter boxKind 규칙), SEED→`seed:true`(미마킹은 미세팅), 원본 wireframe.html 메타, decision→타임라인
- [x] GREEN: `docsAdapter.ts` charter→`@flowforge/shared` 직역 구현(휴리스틱 `isScreenSpec`/`flowTarget` 미사용, slug 는 specParser.slug 재사용) (실패 시 근본원인부터)

### Sequential: 라우트 (선행=어댑터)
- [x] RED: `server/src/routes/docs.ts` 테스트 작성 — `/api/docs/projects`, `/api/docs/:project(*)/{graph,wireframe,prd}`, 404(docs_not_found)·traversal 거부 케이스
- [x] GREEN: `routes/docs.ts` 구현 + `index.ts` 에 docsRouter 마운트(기존 graphRouter 무수정, additive) (실패 시 근본원인부터)
- [x] GREEN: 회귀 확인 — 기존 golden test + graph 라우트 테스트 전부 PASS 유지(무손상 증명)

### Parallel Group 3 (백엔드 완료 후 - 동시 실행 가능: 프론트 서로 다른 파일) [frontend-agent]
- [x] `web/src/api.ts` docs fetch 함수(`fetchDocsProjects`/`fetchDocsGraph`/`fetchDocsWireframe`/`fetchDocsPrd`) + 엔드포인트 URL 테스트·구현 [parallel] [frontend-agent]
- [x] `web/src/DecisionTimeline.tsx` 신규 — `## decision:` 타임라인 렌더(date/why/what/success/status, superseded 흐리게) [parallel] [frontend-agent]
- [x] graph/wire 어댑터(`graphAdapter.ts`/`WireframePanel.tsx`)에 SEED 배지(🟡, `seed:true` 만) + dangling 엣지 구분 표시 추가 [parallel] [frontend-agent]

### Sequential: 프론트 통합 (선행=Group 3 — 같은 App.tsx 통합)
- [x] GREEN: `web/src/App.tsx` 상주/변경 소스 토글 + docs 드롭다운(상주 모드 `/api/docs/projects`) + 모드별 fetch 분기(flow/wire/prd → docs 엔드포인트) (실패 시 근본원인부터)
- [x] GREEN: `App.tsx`/`PrdPanel.tsx` prd 탭 source별 분기(change=5섹션, docs=DecisionTimeline), 탭 5개 유지(추가 금지)
- [x] GREEN: wire 탭 "원본 보기" 링크(원본 wireframe.html 메타 있을 때) + flow 탭 노드 클릭 강조 동작 배선
- [x] GREEN: 상주 모드 빈 상태("상주 문서를 찾을 수 없음") + 변경 모드 완전 복귀(동작 불변) 확인

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [~] VERIFY: 5단계 게이트 — **코드 4단계 PASS / UI 1단계 미관찰(진입로 제거됨)**. (2026-06-24 검증, 2026-06-25 갱신)
  - ✅ 빌드: `npm run build` shared+server+web 전부 PASS (vite 204 modules, EXIT=0)
  - ✅ 타입체크: `npm run typecheck` 3 workspace 전부 PASS (EXIT=0)
  - ✅ 린트: `npm run lint` PASS (EXIT=0)
  - ✅ 테스트: `npm test` **82/82 passed** (11 suites — golden test 포함 = 기존 동작 무손상 확인)
  - ⚠️ UI(브라우저 직접 관찰): **미관찰 — 사유 변경**. 2026-06-25 후속 작업 'refactor(web): 소스 토글 제거'(커밋 f939a3d)에서 D5/D6의 source 토글·docs 드롭다운 진입로가 대시보드 단일화로 **의도적 제거**됨. 따라서 이 UI는 현재 화면에 존재하지 않아 실픽셀 관찰 대상이 아님(브라우저 부재가 아니라 진입로 제거). **단 docs 백엔드는 생존**: 라이브 `GET /api/docs/projects` → 200, `{projects:[flowforge,ssoksok,wowa-app]}` 실증. server.ts docsRouter 4라우트 + web api.ts fetchDocs* 무손상. 향후 대시보드 내 docs 뷰 재통합 시 프론트 진입로 복원 예정. **사용자 결정(2026-06-25): 백엔드만 살아있는 상태로 archive 승인.**
