## Context

OpenSpec 기획 단계 본구현 2단계. 예광탄(`planning-stage-tracer`)이 PRD 생성→렌더 세로관통(buildDocsPlanningPrd→라우트→PrdPanel)을 실증했고, 1단계(`planning-only-project-recognition`)가 planning-only 프로젝트 인식을 뚫었다. 이번엔 manyfast 기획 파이프라인의 두 번째 산출물(기능명세서)을 같은 패턴으로 추가한다.

flowforge엔 이미 change spec.md를 트리로 그리는 자산이 있다(조사됨, file:line): `shared/src/spec-tree-types.ts`(SpecTree/SpecTreeNode), `server/src/parser/specTreeBuilder.ts`(change/specs/*.md → SpecTree), `web/src/SpecTreeNode.tsx`+`specTreeAdapter.ts`(ReactFlow dagre LR 렌더). 단 `SpecTreeNode`엔 priority/status 필드가 없고, change spec.md는 `### Requirement`/`#### Scenario` 형식이라 기획 features.md(3단 트리 + 속성 + capability 키)와 형식·용도가 다르다.

## Goals / Non-Goals

**Goals:**
- openspec-plan 스킬에 features.md 생성 단계를 PRD 다음(의존성 순서)으로 추가한다.
- features.md 스키마를 확정·문서화한다(3단 위계 + 속성 + capability 키).
- flowforge가 features.md를 읽어 전용 FeatureTree로 파싱·렌더한다.
- 도그푸딩으로 세로관통(스킬→features.md→FeatureTree 렌더)을 실증한다.

**Non-Goals:**
- 유저플로우(3단계)·와이어(4단계)·spec.md 변환(4단계)·매핑 역방향인덱스(5단계)·승인UI(6단계). 이번은 features 생성·렌더까지만.
- features.md 단독 프로젝트의 hasDocs 인식 추가(1단계는 planning/prd.md만 인정 — features.md 단독 인식은 필요해지면 별도 change). 도그푸딩 flowforge는 charter docs·planning/prd.md를 보유해 인식엔 문제없음.
- 기존 change spec-tree(SpecTree) 타입·렌더 수정(분리 전략 핵심 — 무수정).

## Decisions

- **결정 1: 타입 전략 = B(별도 FeatureTree 분리).** (사용자 확정 2026-06-28) 기존 `SpecTree`에 priority/status/capability를 확장하지 않고 `shared/src/feature-tree-types.ts`에 전용 `FeatureTree`/`FeatureNode`를 신설한다.
  - 대안 A(SpecTree 확장): 코드 최소지만 change spec-tree(안 변하는 명세뷰)와 기획 features(5·6단계서 진화)를 한 타입에 묶어 결합 비용 발생. priority/status는 change spec엔 본질적으로 없는 개념이라 항상 빈 옵션 필드가 타입을 더럽힘. 기각.
  - → 기획 트리가 진화해도 change 렌더에 영향 0인 깔끔한 경계를 택함(코드 중복 감수).

- **결정 2: features.md 파싱 문법 = 마크다운 헤더 위계 + 인라인 속성/주석.**
  - 3단 위계: 요구사항 `## `, 기능 `### `, 상세기능 `#### `.
  - capability 키: 요구사항 헤더 직후 줄 `<!-- capability: <영문키> -->`.
  - 속성: 노드 헤더 끝 또는 직후 줄 `(중요도: 낮음|중간|높음, 상태: 시작전|진행중|완료|중단)`.
  - 파싱은 `markdown.ts`의 라인 기반 헤더 인식을 참고하되, 헤더 레벨(##/###/####)로 위계를 잡으므로 `splitSections`(섹션 맵)보다 **순차 스캔**이 적합하다. capability/속성은 정규식 추출.
  - 근거: PRD는 고정 5섹션이라 splitSections가 맞았지만, features는 가변 깊이 트리라 헤더 레벨 순차 파싱이 자연스럽다.

- **결정 3: dagre 레이아웃은 내부 참고만, 공유 추출 안 함.** `featureTreeAdapter`는 `specTreeAdapter`의 dagre LR 로직을 **읽고 참고**하되 features 전용으로 둔다. 공통 레이아웃 유틸로 추출하면 두 어댑터가 다시 결합되므로(결정1 위배) 하지 않는다. dagre 호출은 수 줄이라 중복이 결합보다 싸다.

- **결정 4: capability 분리 = generation(스킬) / view(flowforge).** 1단계 교훈(메모리 §6.5): 스킬 동작은 flowforge 코드에 endpoint/symbol이 없어 docs/spec.md 흡수 시 audit 거짓연결을 낸다. 그래서 `planning-features-generation`(스킬 절차)과 `planning-features-view`(flowforge 코드)를 별도 capability로 두고, archive 흡수 때 view만 흡수하고 generation은 보류한다(1단계 generation 보류와 동일).

- **결정 5: 라우트·경로안전은 예광탄 PRD 패턴 복제.** `GET /api/docs/:project/planning-features`, `resolveDocsDir` 재사용(경로조작 차단), `safe()` 래퍼(500→안전), 파일없음 404. 새 보안 코드 0.

## Risks / Trade-offs

- **[Risk] features.md 파싱이 헤더 레벨에 민감 — 사용자가 ##/### 깊이를 틀리면 위계 깨짐** → 스킬이 스키마대로 생성하므로 정상 경로는 안전. 빌더는 예상 밖 깊이를 만나면 가장 가까운 상위에 매달거나 무시(throw 안 함, safe). 테스트로 정상·비정상 픽스처 검증.
- **[Risk] 코드 중복(featureTreeAdapter ↔ specTreeAdapter dagre)** → 의도된 트레이드오프(결정1·3). 중복 < 결합. dagre 호출이 작아 유지비 낮음.
- **[Trade-off] capability 키가 features.md엔 있지만 아직 change와 실제 연결은 5단계** → 이번엔 키를 파싱·표시까지만. 역방향 인덱스(drill-down)는 5단계. 키 형식(kebab-case)만 미리 맞춰 둠.

## Migration Plan

- 순수 가산(신규 타입·빌더·라우트·렌더·스킬 단계). 기존 동작 불변이라 마이그레이션 데이터 없음. 롤백은 신규 파일 제거 + 라우트/탭 배선 되돌리기.

## Open Questions

- 없음. 스키마·타입 전략·파싱 문법 전부 확정.

## 화면 구성 / UI
- 화면 구조·흐름의 명세는 `prototype.html`을 단일 출처로 한다(DESIGN.md 없어 와이어프레임으로 렌더됨). **이 HTML은 명세이지 구현물이 아니다** — WebView로 그대로 쓰지 말고, web이면 React+ReactFlow로 같은 화면(FeatureTree 트리)을 번역해 구현한다. priority/status/capability 시각화는 결정1(전용 FeatureNode)에 따른다.
