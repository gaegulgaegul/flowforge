## Context

flowforge는 `OPENSPEC_ROOT/changes/<id>/specs/*/spec.md`(OpenSpec WHEN/THEN 포맷)만 입력으로 받는다. 빌더가 전부 `changeDir`(절대경로) 단일 진입점에 묶여 있고(`graphBuilder`/`iaBuilder`/`wireframeBuilder`/`prdBuilder`/`specTreeBuilder` 모두 `(changeDir)` 시그니처), 화면·전환은 `flowBinder.ts`의 휴리스틱(`isScreenSpec`: SCREEN_TOKENS≥3 && >API_TOKENS / `flowTarget`: `NAV_RE` 동사 + 별칭 매칭, dangling 가능)으로 **추론**한다.

charter(agentic-harness 소유)는 상주 `docs/`에 화면·전환을 **명시 데이터**로 적어둔다. 본 design은 explore 산출물(`flowforge/docs/EXPLORE_charter_docs_ingest.md`, 도로로 작성)을 **단일 진실**로 삼아 결정 D1~D6을 캡처한다.

**확정 제약(반드시 준수):**
- change 단위 동작 깨지 말 것(하위호환) — 기존 라우트·빌더·`specParser`·golden test 무손상.
- docs/ 읽기는 **additive** — docs/ 없으면 docs 모드 비활성(빈 상태), change 모드는 그대로.
- charter 산출물 스키마는 **agentic-harness 소유** — flowforge는 정규식을 **읽기전용으로 TS 포팅 소비**만. charter 문법/산출물 변경 0.

**근거가 된 코드 사실(검증됨):**
- `changes.ts` `changesRoot()` = `process.env.OPENSPEC_ROOT ?? join(cwd, "openspec")` 후 `changes/` 추가. `resolveChangeDir`는 `..` 금지 + `/^[A-Za-z0-9_\-/]+$/` 화이트리스트로 경로 탈출 방지.
- charter `charter_wireframe.py`: `RE_FLOW=^##\s+flow:\s*(.+)`, `RE_SCREEN=^###\s+화면:\s*(.+)`, `RE_STEP=^\s*[-*]\s*step:\s*(.*\S)`, `RE_GOTO=^\s*[-*]\s*goto:\s*(.*\S)` (모두 IGNORECASE).
- charter `charter_status.py`: `RE_FLOW_GOTO_EP=^\s*[-*]\s*goto:\s*\(?\s*(GET|POST|PUT|DELETE|PATCH)\s+(/\S+?)\)?\s*$` — `goto: (METHOD /path)` 형태 판별.
- charter PRD.md: `## decision: <ID>` + 불릿 `date`/`capability`/`why`/`what`/`success`/`status`(active|superseded-by:<ID>). **append 이력**.
- flowforge 공유타입: `GraphNode {id,kind:NodeKind,label,specName}` (`NodeKind='start'|'section'|'screen'|'action'`), `GraphEdge {id,source,target:string|null,label,scenario,dangling}`, `WireBox {kind:WireBoxKind,label,goto:string|null,dangling}` (`WireBoxKind='header'|'list'|'button'|'field'|'empty'`), `WireScreen {id,title,boxes}`, `Prd {sections}`.

## Goals / Non-Goals

**Goals:**
- charter 상주 `docs/user-flow.md`를 두 번째 입력 모드로 읽어, **휴리스틱 없이** 화면=노드/goto=엣지로 직역한 그래프·와이어프레임을 그린다(D1·D3·D4).
- 상주(docs)/변경(change) 두 레이어를 UI 소스 토글로 공존시킨다(D5).
- `docs/PRD.md`의 `## decision:` 이력을 decision 타임라인으로 따로 렌더한다(D6 부분 — prd 탭 source 분기).
- SEED(미검증) 마킹을 배지로 시각화(#5).
- `DOCS_ROOT` 아래 다중 docs/를 스캔해 드롭다운 선택(#1).

**Non-Goals (후속 change로 분리):**
- charter spec.md의 `assert:endpoint`/`metric`/`invariant`/`assert:symbol` 본격 파싱·시각화(explore 미해결 #2) — 이번엔 `charterUserFlowParser`만 만들고 charter spec.md 파서는 만들지 않는다.
- `goto:(METHOD /path)` ↔ spec.md `assert:endpoint` 교차검증(dangling endpoint audit, explore 미해결 #3).
- charter wireframe.html을 **재현(pixel-match)** 하는 것 — 우리는 user-flow.md에서 ReactFlow로 **재렌더**하고, charter 원본 HTML은 "원본 보기" 링크로만 둔다.
- charter 4단계 산출물(contexts/ 분할·glossary·context-map·owner) 시각화 — 범위 밖.
- IA 탭의 docs 지원 — 이번 범위는 flow/wire/prd 3탭만 docs 모드 지원(ia/spec 탭은 docs 모드에서 비활성 또는 빈 상태).

## Decisions

### D1 — 입력 모드: `/api/docs/*` 라우트 신설 + 어댑터 (택: B)
별도 docs 라우트(`/api/docs/projects`, `/api/docs/:project(*)/{graph,wireframe,prd}`)를 기존 `/api/changes/*`와 **병렬**로 둔다. 어댑터(`docsAdapter.ts`)가 charter 문법 → `@flowforge/shared` 공유타입으로 변환한다.
- **왜**: 제약이 "change 단위 깨지 말 것 + additive"인데 별도 라우트가 **격리를 코드 구조로 보장**한다. change 경로(라우트·빌더·specParser·golden test)에 손을 1도 안 댄다.
- **거부된 대안 A (DOCS_ROOT env + docsDir를 빌더에 분기)**: 빌더가 두 입력 스키마를 모두 알아야 해서 `graphBuilder` 등 기존 코드가 오염된다(하위호환 위험↑).
- **거부된 대안 C (docs를 가상 change로 어댑트해 기존 빌더 재사용)**: charter→OpenSpec **손실 변환**(assert/metric/invariant 버려짐) + 가짜 change 혼란. charter의 명시성을 낭비.

### D1 보강 — DOCS_ROOT 기본값: env + 다중 docs 스캔 (resolved open #1)
`DOCS_ROOT`(기본 `cwd`) 아래에서 `<project>/docs/{user-flow.md|PRD.md}`를 가진 디렉토리들을 스캔해 `/api/docs/projects`로 목록 노출 → 프론트 드롭다운에서 선택(change 드롭다운과 동일 UX).
- **왜**: flowforge 자기 `docs/`도 있고(`flowforge/docs/spec.md` 존재) 쏙쏙 등 외부 프로젝트 docs/(`/home/gaegul/ssoksok/docs/`)도 대상이라, 단일 고정 경로로는 부족. 사용자 결정.
- **경로 안전**: `changes.ts`의 `resolveChangeDir` 패턴 그대로 차용 — `..` 금지 + `/^[A-Za-z0-9_\-/]+$/` 화이트리스트, `DOCS_ROOT` 밖 탈출 방지. 스캔 깊이는 1단계(`<DOCS_ROOT>/<project>/docs/`)로 한정해 과도한 디렉토리 워킹·심링크 추적 방지.
- **거부된 대안**: `DOCS_ROOT` 기본 `cwd/docs`(단일) — flowforge 자기 docs만 보여 외부 프로젝트를 못 봄.

### D2 (최소) — charter user-flow 파싱: 별도 `charterUserFlowParser` (specParser 개조 금지)
charter `user-flow.md` 라인문법을 **읽기전용 TS 정규식으로 포팅**(`RE_FLOW`/`RE_SCREEN`/`RE_STEP`/`RE_GOTO`를 charter_wireframe.py와 **동치**로). 기존 `specParser.ts`(OpenSpec WHEN/THEN, golden test 1:1 고정)는 **건드리지 않는다**.
- **왜**: `specParser`는 Python charter와 golden test로 동치 고정돼 있어 개조하면 change 동작이 깨질 위험. charter user-flow는 전혀 다른 문법이므로 별도 파서가 안전하고 정직.
- **범위 한정**: 이번엔 spec.md(charter `## capability:`/`assert:`/`metric:`) 파서는 **안 만든다**. graph/wire 직결에 user-flow.md만 필요. assert/metric 시각화는 Non-Goal.
- **소유 경계**: charter 정규식을 읽기전용 포팅만 — charter 쪽 파일 변경 0.

### D3 — user-flow.md → 그래프 직역 (휴리스틱 제거)
- `### 화면: <명> (<컴포넌트>, <경로>)` → `GraphNode {id:"screen-"+slug(명), kind:"screen", label:명, specName:명}`. `isScreenSpec` **미사용**(명시됨).
- `- goto: <화면명>` → `GraphEdge {source:현재화면, target: 매칭되면 그 화면 id / 매칭 실패 시 null, dangling: 매칭 실패}`. `flowTarget`/`NAV_RE` **미사용**. dangling은 **대상 화면명이 같은 user-flow.md 화면 목록에 없을 때만**(추론 dangling과 의미 다름 — 여기선 "명시했는데 그 화면이 정의 안 됨" = 진짜 누락 신호).
- `- goto: (METHOD /path)` → API 호출 엣지. MVP에선 그래프에 `kind:"action"` 노드 or 엣지 라벨로 표현(교차검증은 Non-Goal, 단순 표시만).
- **slug 함수는 flowforge `specParser.slug` 재사용**(소문자화·비영숫자→`-`·trim, 빈 값→`x`) — id 규칙 일관.
- **거부된 대안**: 없음(explore에서 D3은 단일안).

### D4 — wireframe: user-flow.md 재렌더(ReactFlow/WireScreen) + 원본 HTML 보기 링크
- `### 화면:` → `WireScreen {id, title}`. `- step: <액션>` → `WireBox {kind: boxKind(액션), label:액션, goto: 다음 goto 화면명 or null, dangling}`. `boxKind`는 charter `charter_wireframe.py`와 **동일 키워드 규칙**(목록/리스트→list, 버튼/저장/촬영/활성화/클릭/전송→button, 없음/빈/empty→empty, 제목/title/헤더/표시→header, 그 외 field). flowforge `wireframeBuilder.boxKind`와도 같은 뿌리라 거의 일치.
- charter 원본 `docs/wireframe.html`이 있으면 "원본 보기" 링크(새 탭/iframe)로 보조 노출 — 재렌더 결과와 진실 비교 가능.
- **왜 재렌더(정적 서빙 아님)**: flowforge의 가치는 인터랙티브 시각화. iframe 박제는 그걸 죽임. boxKind가 이미 charter와 같은 뿌리라 재렌더 손실 미미.
- **거부된 대안**: charter wireframe.html **정적 서빙만** — flowforge의 편집/레이아웃 저장과 단절, iframe 박제.

### D5 — UI: 상주(docs)/변경(change) 소스 토글
상단에 소스 토글("변경 / 상주") 추가. 토글이 change면 기존 `/api/projects`+`/api/changes/*`, docs면 `/api/docs/projects`+`/api/docs/*`. 같은 탭 UI(flow/wire/prd) 재사용.
- **왜**: charter docs는 "프로젝트당 하나의 상주문서"라 change 목록과 성격이 다르다(드롭다운에 섞으면 1개짜리 목록이 어색). 토글이 두 레이어(상주 vs 변경)를 UI로 직접 반영 — charter-living-docs의 두 레이어 설계와 정합.
- **거부된 대안**: 드롭다운에 `docs:상주문서`를 가상 항목 추가 — 레이어 개념이 흐려지고 1개짜리 목록이 어색.

### D6 (부분) — PRD: prd 탭을 source별 분기 (resolved open #4)
탭 5개(`prd|spec|flow|ia|wire`) **유지**. `prd` 탭이 change 모드면 기존 5섹션(`buildPrd`), docs 모드면 `docs/PRD.md`의 `## decision:` 이력을 **decision 타임라인**(date/capability/why/what/success/status, status가 superseded면 흐리게)으로 렌더. **5섹션 매핑 안 함**(구조가 완전히 다름 — charter=이력 누적, flowforge=현재 진실 5섹션).
- **왜 탭 분기(새 탭 아님)**: 탭 개수 안 늘리고 두 구조를 모드로 분리. 사용자 결정.
- **거부된 대안**: 새 `decisions` 탭 추가 — 탭이 6개로 늘고 change 모드에선 빈 탭이 됨.

### #5 — SEED 배지 (resolved open #5, MVP 포함)
charter docs의 `SEED`(사람검토 전 = 미검증) 마킹을 그래프 노드·와이어 박스·decision 항목에 **배지**(🟡SEED 또는 옅은 색)로 표시. 공유타입 `GraphNode`/`WireScreen`/`WireBox`에 `seed?: boolean` **옵셔널 필드 추가**(비파괴 — change 경로는 안 채우면 undefined).
- **SEED 판정**: charter docs에서 SEED 마킹이 어떻게 표기되는지 어댑터가 읽어 화면/decision 단위로 `seed` 플래그 세팅(파일/섹션 헤더의 SEED 토큰 또는 charter 규약 기준 — apply 단계에서 charter 산출물 실데이터로 정확 위치 확인).
- **왜 MVP 포함**: 미검증 데이터를 검증된 것처럼 보여주면 정직성 위반. 작은 추가 작업으로 큰 신뢰 이득. 사용자 결정.

## Risks / Trade-offs

- **[charter user-flow.md 문법이 미래에 바뀌면 어댑터가 깨진다]** → charter 정규식을 한 곳(`charterUserFlowParser.ts`)에 모으고, **소스에 charter 원본 정규식 위치를 주석으로 명시**(charter_wireframe.py L24-27). 파싱 실패/미매칭 라인은 버리지 말고 카운트해 진단 노출. charter 스키마 소유는 agentic-harness이므로, 변경 시 flowforge 어댑터만 따라 포팅하면 됨(읽기전용 소비 = 결합 최소).
- **[DOCS_ROOT 다중 스캔이 무거운 디렉토리(node_modules 등)를 훑을 위험]** → 스캔 깊이 1단계 한정(`<DOCS_ROOT>/<project>/docs/`), `docs/` 디렉토리에 `user-flow.md` 또는 `PRD.md`가 있는 경우만 후보로. 심링크 비추적. `resolveChangeDir`와 동일한 화이트리스트 정규식으로 경로 탈출 방지.
- **[재렌더 와이어프레임이 charter 원본 wireframe.html과 미세하게 다를 수 있다]** → boxKind 키워드 규칙을 charter_wireframe.py와 **명시적으로 동일하게** 포팅. "원본 보기" 링크로 사용자가 직접 대조 가능(진실 1개 보존).
- **[SEED 마킹의 실제 표기를 design 시점에 100% 확정 못 함]** → apply 단계에서 charter 산출물 실데이터(`flowforge/docs/`·`ssoksok/docs/`)로 SEED 토큰 위치를 확인 후 어댑터에 반영. seed 필드는 옵셔널이라 미검출 시에도 안전(배지 없음 = 검증된 것으로 표시되지 않게, 기본은 배지 미표시이되 SEED 발견 시 표시).
- **[공유타입에 seed 필드 추가가 change 경로에 새는 것]** → 옵셔널(`seed?: boolean`)이라 기존 빌더는 안 채움(undefined). change 모드 그래프/와이어는 SEED 배지 없음 — 무손상.

## Migration Plan

1. **공유타입 추가**(비파괴): `@flowforge/shared`에 `DocsDecision`/`DecisionTimeline` 타입, `GraphNode`/`WireScreen`/`WireBox`에 `seed?: boolean`. `npm -w shared run build`로 dist 갱신.
2. **백엔드 라우트/파서/어댑터 추가**: `lib/docs.ts` → `parser/charterUserFlowParser.ts` → `parser/charterPrdParser.ts` → `parser/docsAdapter.ts` → `routes/docs.ts` 마운트. 기존 파일 무수정.
3. **프론트 docs 모드**: `api.ts` docs fetch 함수 → `App.tsx` 소스 토글·docs 드롭다운·prd 탭 분기 → SEED 배지 표현 → decision 타임라인 컴포넌트.
4. **검증**: 기존 golden test + 라우트 테스트 **전부 PASS 유지**(무손상 증명). docs 라우트 신규 테스트 추가. 실제 `flowforge/docs/`·`ssoksok/docs/`를 DOCS_ROOT로 띄워 화면 직접 관찰(grounding).
- **롤백**: 신규 파일 제거 + `routes/docs.ts` 마운트 한 줄 제거 + 공유타입 옵셔널 필드 제거 → change 모드 완전 원복(라우트·빌더 무수정이라 부작용 없음).

## 화면 구성 / UI

- 화면 구조·흐름·이동(소스 토글, 탭 전환, 노드 클릭, 원본 보기 링크 등)의 명세는 `prototype.html` 을 **단일 출처**로 한다. (DESIGN.md 가 없어 와이어프레임 골격으로 렌더됨 — 디자인 토큰 미반영.) **이 HTML 은 명세이지 구현물이 아니다 — WebView/iframe 으로 그대로 쓰지 말고**, 웹 프론트(React+ReactFlow)로 같은 화면·흐름을 **번역해 구현**한다.

## Open Questions

(propose 단계에서 resolved — 아래는 확정 기록)
- ~~#1 DOCS_ROOT 기본값~~ → **env + 다중 docs 스캔**(D1 보강).
- ~~#4 PRD 탭 배치~~ → **prd 탭 source별 분기**(D6).
- ~~#5 SEED 배지~~ → **MVP 포함, 배지 표시**(#5).
- (후속 change로 분리, 본 change 범위 밖) explore 미해결 #2(assert/metric 시각화)·#3(goto↔assert 교차검증).
- (apply 단계 확인) charter docs에서 SEED 마킹의 **정확한 표기 위치**(파일 헤더 vs 섹션 vs 라인) — 실데이터로 확정.
