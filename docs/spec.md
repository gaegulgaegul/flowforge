# flowforge 상주 기능명세 (spec.md)

> 상주 문서 — flowforge의 현재 기능 명세를 단일 출처로 둔다. (charter 예광탄 산출물, 2026-06-23)
> upsert 모드: 기능별 섹션을 현재 상태로 최신화. 출처: `openspec/specs/` + archive change.
> ⚠️ 예광탄 단계 — 두 capability(spec-tree-view, prd-view)만 담음. charter 스킬 정식화 전 수동 생성.

## capability: spec-tree-view

change의 capability·Requirement·Scenario를 `요구사항→기능→상세기능` 3단 트리로 펼쳐 읽기전용으로 표시한다.

### 기능: 기능명세서 3단 트리 파생 (`GET /api/changes/:id/spec-tree`)
- change의 capability→Requirement→Scenario를 3단 트리로 파생해 반환한다.
- 상세기능(Scenario) 노드는 title + WHEN/THEN 요약을 담는다.
- Scenario는 개수가 아니라 개별 노드로 펼친다.
- Scenario 없는 Requirement도 단독 노드로 처리하고 실패하지 않는다.
- 읽기전용 — 트리 편집·저장 기능 없음.
- path traversal(`..`)·존재하지 않는 id → 4xx, 디렉토리 밖 파일 안 읽음.

### 기능: 기능명세서 트리 웹 렌더
- 기능명세서 탭에서 3단 트리를 읽기전용으로 렌더한다(단별 시각 구분).
- 상세기능 노드는 Scenario title + WHEN/THEN 요약을 노출한다.

## capability: prd-view

change의 `proposal.md`+`design.md`를 manyfast 고정 5섹션으로 파생해 읽기전용 PRD로 표시한다.

### 기능: PRD 5섹션 파생 (`GET /api/changes/:id/prd`)
- proposal.md+design.md를 고정 5섹션(overview/value/target/metrics/attributes)으로 파생한다.
- 섹션 순서: 개요→핵심가치→타겟·시나리오→성공지표→속성설정.
- 섹션별 소스 매핑: 개요=proposal `## Why`+`## What Changes`, 핵심가치=proposal `## Why`+design `## Goals / Non-Goals`, 타겟=design `## Context`+`## 화면 구성 / UI`, 성공지표=design `## Risks / Trade-offs`+`## Open Questions`, 속성=proposal `## Impact`.
- 매핑 소스 헤더 없으면 빈 섹션(empty:true)으로 표면화, 내용 지어내지 않음.
- design.md 없으면 4xx 대신 PRD 반환하되 design 기반 섹션만 빈 섹션 처리.
- path traversal(`..`)·존재하지 않는 id → 4xx, 디렉토리 밖 파일 안 읽음.

### 기능: PRD 웹 렌더
- PRD 탭에서 5섹션을 고정 순서로 읽기전용 렌더한다(마크다운).
- 빈 섹션은 "해당 문서에 없음" 플레이스홀더로 시각 구분한다.
