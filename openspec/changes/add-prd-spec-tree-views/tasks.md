## Tasks

### Parallel Group 1 (shared 타입 — 독립 파일, 동시 실행 가능)
- [x] RED: prdBuilder/specTreeBuilder가 참조할 타입 컴파일 확인용 최소 테스트 골격 [parallel]
- [x] `shared/src/prd-types.ts` 정의 — `PrdSection { key: 'overview'|'value'|'target'|'metrics'|'attributes'; title; body: string; empty: boolean }`, `Prd { sections: PrdSection[] }` [parallel]
- [x] `shared/src/spec-tree-types.ts` 정의 — `SpecTreeNodeKind = 'change'|'requirement'|'feature'|'detail'`, `SpecTreeNode { id; kind; label; detail?; when?; then?; children: SpecTreeNode[] }`, `SpecTree { root: SpecTreeNode }` [parallel]

### Sequential: shared barrel export
- [x] `shared/src/index.ts`에 prd-types·spec-tree-types export 추가 + `npm run build --workspace shared` 통과

### Sequential: 마크다운 분할 유틸 (PRD 빌더 선행 의존)
- [x] RED: `parser/__tests__/markdown.test.ts` — `splitSections(md)`가 `## 헤더`로 본문 블록을 자르고 headerKey를 공백·대소문자 정규화하는지(헤더 없음/중복/끝블록 케이스)
- [x] GREEN: `server/src/parser/markdown.ts` — `splitSections(md): Map<string, string>` 순수 함수 구현 (실패 시 추측수정 금지, 근본원인부터)

### Parallel Group 2 (server 빌더 — 서로 다른 파일, 동시 실행 가능)
- [x] RED: `parser/__tests__/prdBuilder.test.ts` — proposal/design 픽스처에서 5섹션 매핑, 소스 누락 시 `empty:true`, design.md 없을 때 부분 채움 [parallel]
- [x] GREEN: `server/src/parser/prdBuilder.ts` — `buildPrd(changeDir): Prd`. proposal.md+design.md 읽어 splitSections → D1 매핑테이블로 5섹션 조립, 없는 소스는 빈 섹션 [parallel]
- [x] RED: `parser/__tests__/specTreeBuilder.test.ts` — capability/Requirement/Scenario 3단 트리, Scenario를 노드로 펼침(0개·다수), 상세기능 노드의 when/then 포함 [parallel]
- [x] GREEN: `server/src/parser/specTreeBuilder.ts` — `buildSpecTree(changeDir): SpecTree`. 기존 specParser 재사용, Scenario를 detail leaf로 변환. iaBuilder는 건드리지 않음 [parallel]

### Sequential: server 라우트 (graph.ts 단일 파일 — 순차 필수)
- [x] GREEN: `server/src/routes/graph.ts`에 `GET /api/changes/:id(*)/prd` → `{ id, prd }` 추가 (safe() + resolveChangeDir)
- [x] GREEN: `server/src/routes/graph.ts`에 `GET /api/changes/:id(*)/spec-tree` → `{ id, tree }` 추가
- [x] `npm run build --workspace server` + `npm test` (골든 동치 테스트 포함 전부 그린)

### Sequential: web API 클라이언트 (api.ts 단일 파일 — 순차 필수)
- [x] `web/src/api.ts`에 `fetchPrd(id): Promise<{id, prd}>`, `fetchSpecTree(id): Promise<{id, tree}>` 추가 (기존 fetch 패턴)

### Parallel Group 3 (web 뷰 컴포넌트 — 서로 다른 파일, 백엔드 완료 후 동시 실행)
- [x] `web/src/PrdPanel.tsx` — 5섹션 세로 문서 렌더, 빈 섹션은 "해당 문서에 없음" 플레이스홀더로 구분 표시 [parallel] [frontend]
- [x] `web/src/specTreeAdapter.ts` + `web/src/SpecTreeNode.tsx` — iaAdapter 패턴 복제, dagre LR 3단 트리, 상세기능 노드만 WHEN/THEN 표시, 3단 색상 구분 [parallel] [frontend]

### Sequential: web 탭 통합 (App.tsx 단일 파일 — 순차 필수)
- [x] `web/src/App.tsx`에 PRD·기능명세서 탭 2개 추가 + 상태(prd/specTree fetch·로드) 배선, 기존 탭 패턴 그대로
- [x] `npm run build --workspace web` 통과 (TS strict + vite build)

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드(shared→server→web) → 타입체크 → 린트 → 테스트(골든+신규 빌더) → UI(브라우저에서 PRD 5섹션·기능명세서 3단 트리 실제 렌더 확인) 전부 PASS
