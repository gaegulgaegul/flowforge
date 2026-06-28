## Why

OpenSpec 기획 단계(openspec-plan) 본구현 3단계. 1단계(planning-only 인식)·2단계(기능명세서)가 archive 완주됐고, manyfast 기획 파이프라인의 세 번째 산출물 = **유저플로우**를 만든다. 유저플로우는 화면 흐름(요구사항이 어떤 화면들을 거쳐 동작하는지)을 그래프로 표현하며, 기능명세서(features.md)에 기능이 ≥1 있어야 진행하는 manyfast 순차 게이트의 다음 단계다. PRD(왜)·기능명세(무엇)에 이어 유저플로우(어떻게 흐르나)까지 채워야 flowforge가 비추는 기획이 흐름까지 완성된다.

## What Changes

- **openspec-plan 스킬에 "유저플로우 생성" 단계 추가** (agentic-harness): 기능명세 다음(의존성 순서)에 `docs/planning/user-flow/<group>-vN.md`를 **Mermaid flowchart**로 생성하는 절차·노드 타입 규약을 명문화한다. 게이트 = 기능명세에 기능 ≥1. 폴더 버전 누적(-vN).
- **명세 = Mermaid flowchart** + **좌표 = 별도 overlay JSON**(`<group>-vN.overlay.json`, 명세와 짝). mermaid 라이브러리 없이 flowchart 노드/엣지만 정규식 직접 파싱.
- **flowforge가 유저플로우를 읽어 그래프로 렌더 + 드래그로 좌표 저장** (flowforge): SpecGraph 타입 재사용(공용 그래프 타입 — change/charter user-flow와 공유). web graphAdapter/SpecNode 4타입 재사용. **docs에 첫 쓰기 라우트(PUT layout)** 추가 — change의 viz/graph-overlay.json + PUT layout 패턴을 docs/planning에 이식.
- 새 의존성 없음. 읽기 라우트 경로안전 유지, 쓰기 라우트는 경로조작 차단 + overlay 런타임 검증.

## Capabilities

### New Capabilities
- `planning-userflow-generation`: openspec-plan 스킬이 기능명세 다음 단계에서 `docs/planning/user-flow/<group>-vN.md`를 Mermaid flowchart 명세로 생성하는 능력. (스킬 절차 — flowforge 코드 밖. 1·2단계 generation 보류 패턴과 동일.)
- `planning-userflow-view`: flowforge가 `docs/planning/user-flow/<group>-vN.md`의 Mermaid를 파싱해 SpecGraph로 렌더하고, 드래그 좌표를 `<group>-vN.overlay.json`에 저장하는 능력. 라우트 `GET /api/docs/:project/planning-user-flow`(그래프+layout) · `PUT /api/docs/:project/planning-user-flow/layout`(좌표 저장 — docs 첫 쓰기). overlay 읽기 우선·dagre 폴백.

### Modified Capabilities
<!-- 기존 change user-flow(graph.ts)·charter user-flow(docsAdapter)는 무수정. SpecGraph 타입은 공용이라 확장 없이 재사용. modified 없음. -->

## Impact

- **agentic-harness**: `skills/openspec-plan/SKILL.md`에 유저플로우 생성 단계 추가(features 단계 옆), frontmatter 갱신.
- **flowforge server**: `parser/planningUserFlowBuilder.ts` 신규(Mermaid flowchart → SpecGraph), `lib/docs.ts`에 overlay 읽기/쓰기 + user-flow 디렉토리 IO 추가(docs 첫 쓰기 — viz overlay 패턴 이식), `routes/docs.ts`에 GET/PUT planning-user-flow 라우트.
- **flowforge web**: `api.ts` fetch/save 함수, `App.tsx` 유저플로우 섹션 배선(graphAdapter/SpecNode 재사용, 드래그→PUT 저장, 버전 선택).
- **도그푸딩**: flowforge 자체 `docs/planning/user-flow/main-v1.md`(Mermaid) 생성.
- **무영향**: change user-flow(`graphBuilder`/`graph.ts`)·charter user-flow(`charterUserFlowParser`/`docsAdapter`)·FeatureTree(2단계)·SpecTree. 의존성·외부 시스템.
- **보안 주의**: docs 첫 쓰기 라우트 — `resolveDocsDir` 경로조작 차단 + `isLayoutOverlay` 검증 필수. overlay 파일명도 group/version 화이트리스트 검증.
