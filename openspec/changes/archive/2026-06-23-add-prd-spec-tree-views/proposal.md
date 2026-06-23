## Why

Flowforge는 openspec change를 manyfast식 산출물 5종으로 시각화하는 도구다. 현재 유저플로우 그래프·IA 트리·와이어프레임 3종은 구현됐으나, manyfast 파이프라인의 **첫 두 산출물인 PRD와 기능명세서가 빠져** 있다. manyfast 논리상 PRD·기능명세서가 후속 산출물(유저플로우·IA·와이어)의 상위 기준이므로, 이 둘이 없으면 "change를 보면 전체 그림이 잡힌다"는 도구의 목적이 미완성이다. Phase 4를 마무리해 산출물 5종을 완성한다.

## What Changes

- **PRD 5섹션 읽기전용 뷰 추가** — change의 `proposal.md` + `design.md`를 읽어 manyfast 고정 5섹션(개요·핵심가치·타겟/시나리오·성공지표·속성설정)으로 파생해 보여준다. spec.md가 아니라 proposal/design이 PRD의 1차 소스다(`## Why`/`## Impact` 등 실재 섹션에서만 끌어오고, 매칭 안 되는 섹션은 "해당 문서에 없음"으로 비운다 — 정보를 지어내지 않는다).
- **기능명세서 3단 트리 읽기전용 뷰 추가** — `요구사항(capability) → 기능(Requirement) → 상세기능(Scenario)` 3단 트리. 기존 IA 트리가 capability/requirement까지만 만들고 Scenario를 count로만 표현하는 것과 달리, Scenario를 **트리 노드로 펼치고** title + WHEN/THEN 요약을 노출한다.
- **읽기전용 파생 원칙 유지** — 기존 IA/와이어와 동일하게 spec.md/proposal.md/design.md를 단방향으로 읽어 파생만 한다. manyfast의 중요도·상태 편집, AI 수정-승인 루프는 만들지 않는다(이번 범위 밖, 의도적 비채택).
- web 캔버스에 **탭 2개 추가**(PRD, 기능명세서) — 기존 유저플로우/IA트리/와이어프레임 탭 패턴 그대로.

## Capabilities

### New Capabilities
- `prd-view`: change의 proposal.md + design.md를 manyfast 고정 5섹션(개요/핵심가치/타겟·시나리오/성공지표/속성설정)으로 파생해 읽기전용으로 표시하는 PRD 뷰. 섹션 소스가 없으면 빈 섹션으로 표면화한다.
- `spec-tree-view`: change의 capability·Requirement·Scenario를 `요구사항→기능→상세기능` 3단 트리로 펼쳐 읽기전용으로 표시하는 기능명세서 뷰. 상세기능 노드는 Scenario title + WHEN/THEN 요약을 담는다.

### Modified Capabilities
<!-- 기존 spec-level 요구사항 변경 없음. PRD/기능명세서는 기존 산출물(그래프/IA/와이어)을 건드리지 않고 새 파생 뷰만 추가한다. -->

## Impact

- **server**: `server/src/parser/`에 PRD 파서(`prdBuilder.ts` — proposal/design 섹션 추출)와 기능명세서 빌더(`specTreeBuilder.ts` — capability/requirement/scenario 3단)를 신설. `server/src/routes/graph.ts`에 `GET /api/changes/:id/prd`, `GET /api/changes/:id/spec-tree` 라우트 추가(기존 `safe()` 미들웨어 + `resolveChangeDir` 패턴). specParser는 Requirement/Scenario를 이미 추출하므로 spec-tree는 재사용 가능, PRD는 proposal/design 마크다운 섹션 분할 로직이 신규.
- **shared**: `shared/src/prd-types.ts`, `shared/src/spec-tree-types.ts` 신설(기존 ia-types/wireframe-types 패턴). barrel(index.ts) export 추가.
- **web**: `web/src/api.ts`에 `fetchPrd`/`fetchSpecTree` 추가. `web/src/App.tsx`에 탭 2개 + 상태 추가. PRD 뷰 컴포넌트(`PrdPanel.tsx`, 문서형 5섹션 렌더)와 기능명세서 트리 컴포넌트(`SpecTreePanel.tsx` 또는 ReactFlow 어댑터+노드) 신설.
- **dependencies**: 신규 외부 의존성 없음(기존 React/ReactFlow/Express/marked-free 마크다운 처리 — 필요 시 경량 마크다운 섹션 분할은 정규식으로 자체 구현, 새 패키지 도입 지양).
- **tests**: 골든 동치 테스트(specParser) 유지. 신규 빌더(prdBuilder/specTreeBuilder)에 단위 테스트 추가. 기존 graph/ia/wireframe 라우트·빌더는 **읽기 전용**(변경 없음).
- **데이터/인프라**: 무변경. 파일 기반 파생(쓰기 없음, layout overlay 같은 영속도 없음 — 순수 읽기 뷰). Postgres·새 컨테이너·도메인 없음.
