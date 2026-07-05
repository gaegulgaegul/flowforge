# 상세 패널 연결화면(N:M) 배선

## Why

노드 클릭 상세 패널(FeatureDetailPanel)은 "연결된 화면 (N:M)" 섹션을 **이미 갖추고 있는데**(있을 때만 렌더, 지어내지 않음 원칙) 데이터를 실어주는 배선이 없어 항상 숨어 있다. 정작 원천 데이터는 존재한다 — features.md의 `<!-- screens: a,b -->` 링크(화면 1급 노드 예광탄, `screenRegistry`)가 상세기능↔화면 N:M을 이미 파싱하고 있고, 현재 3개 상세기능에 실데이터가 있다. 기획 IA 뷰는 이 데이터로 "화면→상세기능" 방향을 보여주지만, 기능명세 패널에서 "이 상세기능이 **어느 화면에** 나타나는가"(역방향)는 볼 수 없다. 파서도 UI 자리도 다 있는데 중간 배선만 빠진 상태 — 로드맵 ②(상세 패널 필드 완성)의 사용자 확정 범위다(WHEN/THEN은 기획 문서에 원천이 없어 별도 논의로 제외, 2026-07-05 명섭 1번 선택).

## What Changes

기능명세 상세 패널의 상세기능 노드에 연결화면(N:M) 필드를 배선한다.

- **screen registry 노출 라우트 신설(server)**: `GET /api/docs/:project/planning-screens` — `buildScreenRegistry(docsDir)` 결과(`{ screens, links }`)를 그대로 반환. registry가 없으면(화면목록 섹션 부재) 빈 registry 200. 기존 planning-* 라우트의 프로젝트 해석·404 패턴 재사용.
- **web 병합**: featureTreeAdapter가 registry를 받아 **상세기능 노드 라벨 ↔ `links[].detailLabel` 문자열 동치**로 그 노드의 `screens: { id, label }[]`(화면 id→label은 `registry.screens`에서 해석)를 파생. audit 병합과 나란한 web 파생 패턴. fetch 실패·빈 registry는 필드 없음 강등(그래프·패널 렌더 유지).
- **패널 타입 정리**: FeatureDetailPanel이 `(node as { screens?: ... })` 캐스트로 읽던 screens를 `FeatureNodeData`의 정식 옵셔널 필드로 승격(렌더 로직은 기존 그대로 — 이미 완성돼 있음).

**Non-Goals**: WHEN/THEN 저작 문법(원천 없음 — 사용자 별도 논의), IA·유저플로우 패널 화면 필드, 화면 클릭 시 해당 화면으로 이동(딥링크 — 후속), 링크 없는 상세기능에 빈 섹션 표시(기존 "있을 때만 렌더" 유지), featureTreeBuilder·screenRegistry 파서 수정(둘 다 무변경 — 소비만).

## Capabilities

### New Capabilities
- `planning-panel-screen-links`: 기능명세 상세 패널에서 상세기능이 연결된 화면(N:M)을 표시하는 능력. 원천은 screenRegistry(features.md `<!-- screens: -->` 링크) 읽기전용 소비, 매칭은 상세기능 라벨 문자열 동치만.

### Modified Capabilities
<!-- 없음. screen-first-class-node(IA 뷰)·기존 패널 요구는 무변경 — additive 배선. -->

## Impact

- **신규 server**: `routes/docs.ts` 라우트 1개(`GET /api/docs/:project/planning-screens`). `screenRegistry.ts` 무수정(기존 export 소비).
- **수정 web**: `api.ts`(fetch 1개), `featureTreeAdapter.ts`(screens 파생 + FeatureNodeData 필드 승격), `App.tsx`(기능명세 뷰 로드부 병렬 fetch 1개 추가). `FeatureDetailPanel.tsx`는 캐스트 제거만(렌더 무변경).
- **수정 테스트**: 라우트 통합(registry 반환·빈 registry·404), 어댑터 파생은 웹 테스트러너 부재로 라우트+실픽셀로 커버(기존 관행).
- **🔴 수정 금지**: `featureTreeBuilder.ts`·`screenRegistry.ts`·`planningIaBuilder.ts`·`specParser.ts`·`flowBinder.ts`·`graphBuilder.ts`·`__golden__/`·기존 `planning-features`/`planning-ia` 응답 스키마.
- **의존성**: 신규 npm 패키지 없음.
