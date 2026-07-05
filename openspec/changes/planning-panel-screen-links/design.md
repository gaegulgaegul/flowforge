# design — planning-panel-screen-links

## Context

- 원천: `server/src/parser/screenRegistry.ts`(병렬 파서, 골든 무관) — `buildScreenRegistry(docsDir)` → `{ screens: ScreenNode[], links: ScreenLink[] }`. `ScreenLink = { detailLabel, screenIds[] }`(상세기능 **라벨**이 연결 키 — 상세기능은 별도 id가 없고, 여러 요구사항 산하에 흩어진 같은 라벨은 같은 상세기능으로 본다는 것이 화면1급 예광탄의 기존 설계).
- 소비처(현재): `planningIaBuilder`(IA 뷰, 화면→상세기능 방향)뿐. 원시 registry를 노출하는 API 없음.
- UI 자리: `FeatureDetailPanel`에 "연결된 화면 (N:M)" 섹션이 **이미 구현**돼 있고 `screens?: {id,label}[]`가 있을 때만 렌더. 현재는 비정식 캐스트(`node as { screens?... }`)로 읽는 중 — 데이터가 없어 사문화.
- 실데이터: features.md에 `<!-- screens: -->` 링크 3건(skeleton·features 화면), `## 화면목록` 3화면.

## Goals / Non-Goals

**Goals:**
- 상세기능 노드 클릭 → 패널에 연결화면(N:M) 표시. 원천 소비만(파서 무수정), 라벨 문자열 동치 매칭.
- audit-capabilities와 동일한 "별도 엔드포인트 + web 어댑터 파생" 패턴 유지.

**Non-Goals:** proposal 참조(WHEN/THEN·IA/유저플로우 패널·화면 딥링크·빈 섹션 표시).

## Decisions

- **D-1 라우트 = 원시 registry 그대로 노출**: `GET /api/docs/:project/planning-screens` → `{ screens, links }`. 서버에서 detail별로 조인해서 주는 대안은 기각 — 조인 키(상세기능 라벨)는 web 어댑터가 노드를 이미 들고 있는 곳에서 붙이는 게 자연스럽고, 원시 registry는 후속(화면 딥링크·유저플로우 화면 필드)에도 재사용된다.
- **D-2 매칭 = 상세기능 라벨 ↔ `links[].detailLabel` 문자열 동치만**: screenRegistry의 기존 연결 키 규약을 그대로 따른다(새 키 발명 금지). 같은 라벨의 상세기능이 여러 요구사항 아래 있으면 전부 같은 화면 목록을 받는다 — 이는 파서의 의도된 동작(주석 명시)이므로 그대로 반영.
- **D-3 화면 id→label 해석은 registry.screens에서**: `screens` 필드는 `{ id, label }[]`로 파생(패널이 label을 렌더). link의 screenId가 `## 화면목록`에 없는 id를 가리키면(dangling) 그 항목은 `label = id`로 강등 표시(숨기지 않음 — 저작 오류가 화면에 드러나야 고쳐진다).
- **D-4 폴백 = 필드 없음 강등**: fetch 실패·registry null(화면목록 섹션 없음)·빈 links 전부 screens 필드 undefined → 패널 섹션 자연 생략(기존 "있을 때만 렌더"). 그래프·패널·다른 필드에 영향 0.
- **D-5 FeatureNodeData 타입 승격**: `screens?: readonly { id, label }[]`를 정식 필드로 추가하고 FeatureDetailPanel의 임시 캐스트 제거. 렌더 JSX는 무변경(이미 완성).

## Risks / Trade-offs

- **라벨 매칭의 취약성**: 상세기능 라벨을 고치면 링크가 끊긴다(미감사 화면처럼 조용히 사라짐). 이는 screenRegistry 설계 시점에 수용된 트레이드오프(상세기능 무id) — 이 change에서 키 체계를 바꾸지 않는다(범위 밖, 구조 결정은 별도).
- **dangling screen id**: D-3의 `label=id` 강등이 저작 오류를 화면에 노출하는 대신 미관을 해칠 수 있음 — 정직 우선(안2 원칙).

## 화면 구성 / UI

- 신규 화면·이동 없음 — 기존 상세 패널의 이미 구현된 섹션에 데이터만 배선. 프로토타입 스크립트 판정에 따름(화면 spec 없으면 스킵이 정상).
