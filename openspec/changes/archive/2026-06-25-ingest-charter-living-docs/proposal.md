## Why

flowforge는 본래 "spec → 유저플로우/와이어프레임 시각화" 도구지만, 화면·전환(goto)을 **휴리스틱으로 추론**한다(`flowBinder.ts`의 `isScreenSpec`로 화면 판정, `flowTarget`/`NAV_RE`로 THEN에서 goto 추론 → dangling 발생). 그런데 charter(agentic-harness 소유)가 만든 상주 `docs/user-flow.md`는 그 화면·goto를 이미 **명시 데이터**로 적어둔다(`## flow:` / `### 화면:` / `- step:` / `- goto:`). flowforge가 `docs/`를 두 번째 입력 모드로 읽으면 **추론을 정답지(ground truth)로 대체**해 더 정확한 그래프/와이어프레임을 그릴 수 있다. 핵심 장벽은 두 스키마가 다르다는 것(charter 라인문법 ≠ OpenSpec WHEN/THEN)이라 **읽기전용 어댑터**가 본 change의 본질이다.

## What Changes

본 change는 explore 산출물(`flowforge/docs/EXPLORE_charter_docs_ingest.md`)의 결정 D1·D3·D4·D5를 **예광탄(MVP)** 으로 구현한다. D2(charter spec.md 파싱)·D6(PRD decision 타임라인)는 user-flow 직결에 필요한 최소만 포함하고, spec.md의 assert/metric 시각화·goto↔assert 교차검증은 **후속 change로 분리**한다(charter-living-docs 단계별 검증 원칙 상속).

- **(D1) `/api/docs/*` 라우트 신설**: 기존 `/api/changes/:id/*`와 병렬로 docs 전용 라우트 추가. change 경로·빌더·`specParser`는 **무손상**(하위호환). `DOCS_ROOT` 환경변수(기본 `cwd`)로 다중 프로젝트 docs/를 스캔하고 `/api/docs/projects`로 목록 노출(드롭다운 선택).
- **(D2 최소) `charterUserFlowParser` 신설**: charter `user-flow.md` 라인문법을 **읽기전용으로 TS 포팅**(charter `charter_wireframe.py`의 `RE_FLOW`/`RE_SCREEN`/`RE_STEP`/`RE_GOTO` 동치). 기존 `specParser`는 **개조 금지**(golden test 1:1 고정). spec.md(charter) 본격 파싱(assert/metric/invariant)은 **이번 범위 밖**.
- **(D3) user-flow.md → 그래프 직역**: `### 화면:` → `GraphNode {kind:"screen"}`, `- goto: <화면명>` → `GraphEdge`(대상 화면명 매칭 실패 시에만 dangling), `- goto: (METHOD /path)` → API 호출 엣지. **휴리스틱 `isScreenSpec`/`flowTarget` 미사용**.
- **(D4) user-flow.md → 와이어프레임 재렌더**: `### 화면:` → `WireScreen`, `- step:` → `WireBox`(boxKind는 charter `charter_wireframe.py`와 동일 키워드 규칙). charter 원본 `wireframe.html`은 "원본 보기" 링크로 보조 노출.
- **(D5) 상주/변경 소스 토글 UI**: 상단에 "변경(change) / 상주(docs)" 소스 토글 추가. docs 모드면 docs 드롭다운 + docs 엔드포인트로 같은 탭 UI(flow/wire/prd) 재사용.
- **(D6 부분) PRD 탭 source별 분기**: 탭 5개(`prd|spec|flow|ia|wire`) 유지. `prd` 탭이 change 모드면 기존 5섹션, docs 모드면 `docs/PRD.md`의 `## decision:` 이력을 **decision 타임라인**으로 렌더(5섹션 매핑 안 함).
- **(#5) SEED 배지**: charter docs의 `SEED`(사람검토 전 = 미검증) 마킹을 그래프 노드·와이어 박스·decision 항목에 **배지**로 표시(미검증 데이터 시각 경고).

## Capabilities

### New Capabilities
- `docs-ingest`: charter 상주 `docs/`(user-flow.md·PRD.md)를 두 번째 입력 모드로 읽는 백엔드 — `DOCS_ROOT` 스캔, `/api/docs/projects` 목록, `/api/docs/:project/{graph,wireframe,prd}` 라우트, charter→flowforge 공유타입 읽기전용 어댑터, SEED 마킹 보존.
- `docs-visualization`: docs 입력을 시각화하는 프론트엔드 — 상주/변경 소스 토글, docs 드롭다운, flow/wire 탭의 docs 데이터 렌더, prd 탭의 decision 타임라인 분기, SEED 배지, charter 원본 wireframe.html "원본 보기" 링크.

### Modified Capabilities
<!-- 없음. 기존 change 경로(라우트·빌더·specParser)는 무손상 — additive only. -->

## Impact

- **신규 백엔드**: `server/src/lib/docs.ts`(DOCS_ROOT 스캔·해석, `changes.ts` 패턴 차용), `server/src/parser/charterUserFlowParser.ts`(charter user-flow 라인문법 읽기전용 포팅), `server/src/parser/docsAdapter.ts`(charter→`@flowforge/shared` GraphNode/Edge·Wireframe·decision 변환), `server/src/parser/charterPrdParser.ts`(`## decision:` 이력 파싱), `server/src/routes/docs.ts`(`/api/docs/*`).
- **신규/수정 공유타입**: `@flowforge/shared`에 `DocsDecision`/`DecisionTimeline` 타입 추가, `GraphNode`/`WireScreen`/`WireBox`에 `seed?: boolean` 필드 **추가(옵셔널, 비파괴)**.
- **수정 프론트엔드**: `web/src/api.ts`(docs 엔드포인트 fetch 함수 추가), `web/src/App.tsx`(소스 토글·docs 드롭다운·prd 탭 분기), `web/src/PrdPanel.tsx`(decision 타임라인 분기 또는 신규 `DecisionTimeline.tsx`), graph/wire 어댑터에 SEED 배지 표현.
- **무손상(하위호환)**: `server/src/routes/graph.ts`, `server/src/lib/changes.ts`, 모든 기존 빌더(`graphBuilder`/`iaBuilder`/`wireframeBuilder`/`prdBuilder`/`specTreeBuilder`), `specParser.ts`, golden test — **변경 0**. docs/ 없으면 docs 모드 비활성(빈 상태).
- **소유 경계**: charter 스키마는 agentic-harness 소유 → flowforge는 정규식을 **읽기전용으로 포팅 소비**만. charter 문법/산출물 **변경 0**.
- **의존성**: 신규 npm 패키지 없음(기존 express/정규식만).
