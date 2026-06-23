## Context

Flowforge는 openspec change의 파일(spec.md/proposal.md/design.md)을 단방향으로 읽어 manyfast식 산출물로 파생하는 읽기전용 시각화 도구다. 기존 3종(유저플로우 그래프·IA 트리·와이어프레임)은 `server/src/parser/*Builder.ts` → `routes/graph.ts` 엔드포인트 → `web/src/api.ts` → `App.tsx` 탭 + 어댑터/컴포넌트의 일관된 파이프라인을 따른다. 이번 변경은 그 파이프라인에 **PRD 5섹션**과 **기능명세서 3단 트리** 두 산출물을 같은 패턴으로 추가한다.

제약:
- TS strict + `noUncheckedIndexedAccess` + ESM(NodeNext). 골든 동치 테스트(specParser)는 깨지면 안 된다.
- 새 외부 의존성 도입 지양(rules/90-tech-evaluation). 마크다운 처리는 자체 정규식으로 충분하면 패키지 안 쓴다.
- spec.md는 SSOT, 모든 산출물은 읽기 파생. 이번 두 뷰는 layout overlay 같은 쓰기조차 없는 **순수 읽기**다.

## Goals / Non-Goals

**Goals:**
- change의 proposal.md+design.md에서 PRD 5섹션을 파생해 읽기전용 표시. 소스에 없는 섹션은 빈 섹션으로 표면화(지어내지 않음).
- capability/Requirement/Scenario를 3단 트리로 펼쳐(Scenario를 count가 아닌 노드로) 읽기전용 표시.
- 기존 IA/와이어 파이프라인 패턴을 그대로 복제해 일관성·유지보수성 확보.

**Non-Goals:**
- 중요도·상태 편집, AI 수정-승인 루프(manyfast 기능이나 SSOT 단방향 원칙과 충돌 → 의도적 비채택).
- PRD/spec-tree의 영속 저장(layout overlay 같은 쓰기 없음).
- 기존 산출물(그래프/IA/와이어) 동작 변경. iaBuilder 출력은 불변 유지(골든·기존 테스트 보호).
- 마크다운 완전 파싱(AST). 섹션 분할 수준이면 충분.

## Decisions

### D1. PRD 소스 = proposal.md + design.md (spec.md 아님)
manyfast PRD 5섹션(개요/핵심가치/타겟·시나리오/성공지표/속성설정)은 "왜·무엇을·누구에게·성공기준·제약"으로, openspec에서 이 정보는 spec.md(Requirement/Scenario)가 아니라 **proposal.md/design.md**에 산다. wowa `implement-ios-app`에서 실측한 매핑:

| PRD 섹션 | 소스 헤더 |
|---|---|
| 개요 | proposal `## Why` + `## What Changes` |
| 핵심가치 | proposal `## Why` + design `## Goals / Non-Goals` |
| 타겟·시나리오 | design `## Context` + `## 화면 구성 / UI` |
| 성공지표 | design `## Risks / Trade-offs` + `## Open Questions` |
| 속성설정 | proposal `## Impact` |

대안(spec.md에서 PRD 합성)은 정보가 없어 LLM 합성이 필요 → 지어내기 위험 + 결정적 파생 불가 → 기각. 헤더 매칭은 공백·대소문자 유연하게(예: "Goals / Non-Goals" ≈ "goals/non-goals"), 매칭 실패 시 빈 섹션.

### D2. 마크다운 섹션 분할 = 자체 정규식 유틸 (`parser/markdown.ts`)
`## 헤더` 라인 기준으로 본문 블록을 자르는 순수 함수 `splitSections(md): Map<headerKey, body>`. headerKey는 소문자+공백정규화. 새 패키지(marked 등) 도입 안 함 — 분할만 필요하고 렌더는 프론트가 담당. 이 유틸은 PRD에서 쓰고, 필요 시 향후 재사용.

### D3. spec-tree = specParser 재사용 + 새 타입, iaBuilder는 안 건드림
`specParser.parseSpecText`가 이미 Requirement/Scenario(title/when/then)를 준다. `specTreeBuilder.buildSpecTree(changeDir)`는 iaBuilder의 capability 수집 패턴을 참고하되 **별도 함수**로 작성하고, Scenario를 leaf 노드(`kind: 'detail'`, title + when/then 요약)로 변환한다. iaBuilder를 수정하면 골든/기존 IA 테스트 리스크 → 공통화는 "출력 동일 보장" 가능할 때만 리팩토링 단계에서. 새 타입 `SpecTreeNode { id, kind: 'requirement'|'feature'|'detail', label, detail?, when?, then?, children }` + `SpecTree { root }`.

### D4. 렌더 방식 — PRD=문서형, spec-tree=ReactFlow 트리 재사용
- PRD: ReactFlow 부적합(노드 그래프 아님, 긴 텍스트 문서). 단순 스크롤 문서 컴포넌트 `PrdPanel.tsx`로 5섹션 세로 렌더. 마크다운→HTML은 경량 처리(줄바꿈·리스트·강조 최소 지원, 또는 `<pre>`+기본 스타일). WireframePanel이 이미 비-ReactFlow 패널이라 선례 있음.
- spec-tree: IA 트리와 동형(부모-자식 위계 그래프) → `iaAdapter.toIAFlow`와 같은 dagre LR 트리 어댑터 패턴 복제(`specTreeAdapter.ts` + 노드 컴포넌트). 3단 색상 구분(요구사항/기능/상세기능). 상세기능 노드만 WHEN/THEN 표시.

### D5. 엔드포인트 = 기존 graph.ts 라우터에 2개 추가
`GET /api/changes/:id(*)/prd` → `{ id, prd }`, `GET /api/changes/:id(*)/spec-tree` → `{ id, tree }`. 기존 `safe()` 미들웨어 + `resolveChangeDir`(경로조작 차단) 그대로. 새 라우터 파일 불필요.

## Risks / Trade-offs

- **헤더 매칭이 change마다 표현이 달라 빈 섹션 과다** → 매칭 유연화(공백/대소문자/유사 표기) + 빈 섹션을 에러 아닌 "없음"으로 표면화(기존 dangling 철학과 동일). archive change는 design.md가 없을 수 있음 → design 기반 섹션은 가능한 만큼만.
- **spec-tree와 iaBuilder 로직 중복** → 일단 별도 함수로 안전하게 두고(골든 보호 우선), 동치 보장되는 부분만 리팩토링 단계에서 추출. 중복 < 골든 테스트 깨짐 리스크.
- **마크다운 자체 렌더의 빈약함**(표/코드블록 깨짐) → 1차는 단락·리스트·강조만. 실제 proposal/design은 대부분 그 수준. 필요 시 후속에서 경량 렌더러 평가(tech-evaluation 체크리스트 통과 시).
- **PRD가 design.md 없는 archive change에서 반쪽** → 정상 동작(빈 섹션). 사용자에게 "이 change엔 design.md 없음" 맥락이 빈 섹션 플레이스홀더로 전달됨.

## Migration Plan

- 순수 추가(새 파일·새 라우트·새 탭). 기존 엔드포인트/빌더/타입 무변경 → 롤백은 새 파일 제거 + 탭/라우트 추가분 revert로 충분. DB·인프라 변경 없음.
- 배포 영향 없음(같은 단일 컨테이너, 새 의존성 없음). `npm run build` 통과 + 신규 빌더 단위테스트 + 골든 테스트 그린이 게이트.

## 화면 구성 / UI
- 화면 구조·흐름의 명세는 기존 App.tsx 탭 패턴(유저플로우/IA트리/와이어프레임 + PRD/기능명세서)을 단일 출처로 한다. 이 변경은 웹 내부 탭 추가일 뿐 새 화면 전이(딥링크)가 없어 별도 prototype.html 대상이 아니다. PRD=세로 문서 패널, 기능명세서=좌→우 dagre 트리(IA와 동형).

## Open Questions
<!-- 현재 미해결 사항 없음. 마크다운 렌더 깊이는 1차 최소 구현으로 확정. -->
