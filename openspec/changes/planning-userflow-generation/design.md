## Context

OpenSpec 기획 단계 본구현 3단계. 1단계(planning-only 인식)·2단계(기능명세서)가 archive 완주됐고, 예광탄 패턴(스킬 생성 → flowforge 렌더)이 두 번 검증됐다. 이번엔 manyfast 세 번째 산출물 = 유저플로우(화면 흐름 그래프)를 추가한다.

flowforge엔 이미 user-flow 그래프 자산이 풍부하다(조사됨, file:line): `shared/graph-types.ts`(SpecGraph/GraphNode/GraphEdge/LayoutOverlay), `web/graphAdapter.ts`(SpecGraph→ReactFlow, dagre + overlay 병합), `web/SpecNode.tsx`(4타입 start/section/screen/action 색상 노드), `lib/changes.ts`(readOverlay/writeOverlay = `viz/graph-overlay.json`), `routes/graph.ts`(PUT layout + isLayoutOverlay 검증). 단 입력 형식이 갈린다: change user-flow는 `graphBuilder`(spec.md THEN NLP 바인딩), charter user-flow는 `charterUserFlowParser`(`### 화면:`/`- goto:` 자체 문법). 기획 3단계는 **Mermaid flowchart** — 둘 다와 다르다.

## Goals / Non-Goals

**Goals:**
- openspec-plan 스킬에 유저플로우 생성 단계를 기능명세 다음(의존성 순서)으로 추가한다.
- flowforge가 Mermaid flowchart를 SpecGraph로 파싱해 렌더한다(라이브러리 없이).
- 드래그 좌표를 overlay JSON에 저장한다(docs 첫 쓰기 라우트).
- 도그푸딩으로 세로관통(스킬→Mermaid→그래프 렌더→드래그 저장→overlay 재조회) 실증.

**Non-Goals:**
- 와이어프레임(4단계)·spec.md 변환(4단계)·매핑 역방향 인덱스(5단계)·승인 UI(6단계).
- Mermaid 전체 문법 지원(subgraph, class, 스타일 등) — flowchart 노드+엣지 핵심만. 미지원 라인은 무시(throw 안 함).
- 기존 change/charter user-flow 파이프라인 수정(무수정 — SpecGraph 타입만 공유).

## Decisions

- **결정 1: 타입 = SpecGraph 재사용(분리 안 함).** 2단계는 FeatureTree를 분리했지만 유저플로우는 SpecGraph(GraphNode/GraphEdge/LayoutOverlay)를 그대로 쓴다. 근거: SpecGraph는 이미 change·charter user-flow가 공유하는 **공용 그래프 타입**이고, 유저플로우도 본질이 화면 그래프라 같은 형태. web graphAdapter(dagre+overlay 병합)·SpecNode 4타입 렌더가 그대로 맞는다. (2단계 features는 트리+속성이라 SpecTree와 성격이 달라 분리했지만, 여기선 같은 그래프.)

- **결정 2: Mermaid 파싱 = 라이브러리 없이 직접 정규식.** flowchart 핵심만 파싱: (a) 방향 선언 `flowchart TD|LR` 무시(렌더는 dagre가 함), (b) 노드 정의 `ID모양텍스트모양` — `(["..."])` stadium=start, `["..."]` box=screen, `{"..."}` diamond=action, `(("..."))` circle=section 등 모양→kind 매핑, (c) 엣지 `A --> B` / `A -->|label| B`. 미지원 라인(subgraph/class/%%주석)은 건너뜀.
  - 대안(mermaid 라이브러리): 파싱만 필요한데 렌더용 거대 의존성(수백KB)을 추가하는 건 과함(게으름 사다리 ③ 위반). flowchart 부분 문법은 정규식 수십 줄로 충분. 기각.
  - 노드 모양 판정은 charterUserFlowParser/graphBuilder가 쓰는 slug·kind 패턴을 참고하되 Mermaid 전용 파서로 신설(`planningUserFlowBuilder.ts`).

- **결정 3: overlay 저장 = docs 첫 쓰기, changes.ts 패턴 이식.** `docs/planning/user-flow/<group>-vN.overlay.json`에 좌표 저장. `lib/changes.ts`의 readOverlay/writeOverlay(viz/graph-overlay.json) 시그니처를 참고해 `lib/docs.ts`에 docs용 read/write를 둔다. 경로만 다르고 IO는 동일(JSON 정렬 write, 디렉토리 자동 생성). 명세 .md와 overlay JSON을 짝으로 둬 버전(-vN)별 좌표 분리.
  - 보안: docs는 그동안 읽기전용 SSOT였다. 쓰기 추가는 (1) project=resolveDocsDir 화이트리스트 (2) group/version=파일명 화이트리스트(`[A-Za-z0-9_-]`, `..` 금지) (3) body=isLayoutOverlay 런타임 검증 — 3중 가드. overlay만 쓰고 .md는 절대 안 건드림.

- **결정 4: capability 분리 = generation(스킬)/view(flowforge).** 1·2단계 교훈: 스킬 동작은 flowforge 코드에 endpoint/symbol 없어 docs/spec.md 흡수 시 audit 거짓연결. generation 보류, view만 흡수.

- **결정 5: 버전 목록·선택.** user-flow/ 디렉토리를 readdir해 `<group>-vN.md` 목록 제공. web은 여러 버전이면 선택 UI(없으면 최신/단일). manyfast 버전 누적 정책.

## Risks / Trade-offs

- **[Risk] docs 첫 쓰기 라우트 = 새 공격면** → 3중 가드(결정3 보안)로 차단. 경로조작·잘못된 body scenario를 spec에 명시하고 테스트로 고정.
- **[Risk] Mermaid 파싱이 다양한 작성 스타일에 취약**(노드 모양 변형, 멀티라인 등) → flowchart 핵심 문법만 지원하고 미지원은 무시(throw 안 함, safe). 스킬이 규약대로 생성하므로 정상 경로 안전. 테스트로 정상·비정상 픽스처 검증.
- **[Trade-off] overlay read/write가 changes.ts와 유사**(경로만 다름) → 공통 추출 안 함(결정3). 얇은 함수 중복 < 두 경로 결합. changes.ts(viz/, change용)와 docs.ts(user-flow/, 기획용)는 관심사가 다르다.

## Migration Plan

- 순수 가산(신규 빌더·라우트·overlay IO·렌더 배선·스킬 단계). 기존 동작 불변. 롤백 = 신규 파일 제거 + 라우트/배선 되돌리기. overlay JSON은 git에 커밋되므로 좌표 이력도 보존(도그푸딩 overlay 제외).

## Open Questions

- 없음. 명세 문법(Mermaid)·타입(SpecGraph)·overlay 범위(읽기+쓰기)·보안 가드 전부 확정.

## 화면 구성 / UI
- 화면 구조·흐름의 명세는 `prototype.html`을 단일 출처로 한다(DESIGN.md 없어 와이어프레임). **이 HTML은 명세이지 구현물이 아니다** — web이면 React+ReactFlow(기존 graphAdapter/SpecNode 재사용)로 같은 유저플로우 그래프를 번역해 구현한다. 드래그→좌표 저장 흐름은 결정3(overlay PUT)에 따른다.
