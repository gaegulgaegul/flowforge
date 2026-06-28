## Why

OpenSpec 기획 단계(openspec-plan)의 본구현 2단계. 1단계(`planning-only-project-recognition`)로 planning-only 프로젝트 인식까지 뚫렸고, 예광탄으로 PRD 생성→렌더 세로관통이 실증됐다. 이제 manyfast 기획 파이프라인의 **두 번째 산출물 = 기능명세서**를 만든다. 기능명세서는 단순한 문서가 아니라 **기획↔구현 매핑의 출발점**이다 — 각 요구사항에 부여하는 `capability` 키가 나중에 change의 `specs/<키>/`와 set 멤버십으로 연결돼, flowforge가 "이 기능 = PRD섹션 + 유저플로우 + 이 기능을 건드리는 change들"을 한 화면에 묶는 기반이 된다. PRD만으론 이 매핑 골격이 안 생긴다.

## What Changes

- **openspec-plan 스킬에 "기능명세서 생성" 단계 추가** (agentic-harness): PRD 다음(의존성 순서)에 `docs/planning/features.md`를 manyfast식 3단 트리로 생성하는 절차를 명문화한다.
- **features.md 스키마 확정**: 3단 위계(요구사항→기능→상세기능) + 노드 공통 속성 2개(중요도 낮음/중간/높음, 상태 시작전/진행중/완료/중단) + 요구사항 노드에 capability 키(`<!-- capability: <영문키> -->`).
- **flowforge가 features.md를 읽어 트리로 렌더** (flowforge): 타입 전략 **B(분리)** — 기존 `SpecTree`(change spec.md용)에 확장하지 않고 features 전용 `FeatureTree`/`FeatureNode` 타입·렌더를 신설한다. change spec-tree 타입/렌더는 **무수정**(분리 핵심).
- 읽기전용·경로안전 불변. 새 의존성 없음.

## Capabilities

### New Capabilities
- `planning-features-generation`: openspec-plan 스킬이 PRD 다음 단계에서 `docs/planning/features.md`를 3단 트리 + 속성 + capability 키 스키마로 생성하는 능력. (스킬 절차 — flowforge 코드 밖. 1단계 generation 흡수 보류 패턴과 동일.)
- `planning-features-view`: flowforge가 `docs/planning/features.md`를 읽어 전용 `FeatureTree`로 파싱하고 ReactFlow 트리로 렌더하는 능력. 라우트 `GET /api/docs/:project/planning-features`, 전용 타입·빌더·렌더 컴포넌트(change spec-tree와 분리). priority/status/capability 시각화.

### Modified Capabilities
<!-- 기존 spec-tree-view(change spec.md 트리)는 분리 전략상 무수정. planning-prd-view도 무관. modified 없음. -->

## Impact

- **agentic-harness**: `plugins/agentic-harness/skills/openspec-plan/SKILL.md`에 features 생성 단계 추가(예광탄 PRD 단계 옆).
- **flowforge shared**: `shared/src/feature-tree-types.ts` 신규(FeatureTree/FeatureNode).
- **flowforge server**: `parser/featureTreeBuilder.ts`(또는 prdBuilder 옆) `buildDocsPlanningFeatures(docsDir)` 신규, `routes/docs.ts`에 `GET /api/docs/:project/planning-features` 추가(resolveDocsDir 재사용).
- **flowforge web**: `FeatureNode.tsx`·`featureTreeAdapter.ts` 신규(specTreeAdapter dagre 로직 일부 참고), `api.ts` `fetchDocsPlanningFeatures`, `App.tsx` 기능명세 탭 배선.
- **도그푸딩**: flowforge 자체 `docs/planning/features.md` 생성(세로관통 실증).
- **무영향**: change spec-tree(SpecTree) 타입·`specTreeBuilder`·`SpecTreeNode.tsx`·`specTreeAdapter.ts`(분리 전략). planning-prd-view. 의존성·외부 시스템.
