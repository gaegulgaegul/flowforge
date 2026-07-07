# panel-screen-deeplink

## Why

기능명세 상세 패널의 "연결된 화면 (N:M)" 칩은 현재 정적 텍스트라, 그 화면이 IA에서 어떤 위치인지 보려면 수동으로 IA 탭을 열어 눈으로 찾아야 한다. 원 change(`planning-panel-screen-links`)가 Non-Goal로 미뤄둔 딥링크를 이제 붙인다 — 칩 클릭 한 번으로 IA 뷰의 해당 화면 노드로 점프.

## What Changes

- 상세 패널의 화면 칩을 클릭 가능하게(`<span>`→`<button>`): 클릭 시 기획 IA 탭으로 전환 + 해당 화면 노드 선택(상세 패널 표시) — 자식 노드 목록이 이미 쓰는 `onSelectById` 딥링크 패턴과 동일 UX.
- 매칭은 **결정론 문자열 동치**: server IA 빌더가 화면 노드에 원본 `screenId`를 additive 옵션 필드로 실어주고, web은 그 값으로만 대상 노드를 찾는다(slug 복제 금지 — 거짓 연결 0 규약 계승).
- 대상 노드를 못 찾으면(레지스트리·IA 불일치) 이동하지 않고 상태바 안내만(저작 오류를 숨기지 않되 무해).

## Capabilities

### New Capabilities

(없음)

### Modified Capabilities

- `planning-panel-screen-links`: 화면 칩 표시 요구에 클릭 딥링크(IA 탭 전환+노드 선택) 요구 추가

## Impact

- server: `planningIaBuilder.ts` 화면 노드에 `screenId` 필드(additive) / shared `IANode.screenId?: string`(옵션 — 기존 소비자 무영향)
- web: `FeatureDetailPanel.tsx` 칩 버튼화 + `onSelectScreen` prop, `App.tsx` 핸들러(setPlanTab("ia")+planningIaNodes에서 screenId 매칭→setSelectedIa)
- Non-Goal: 유저플로우/와이어 뷰로의 딥링크(IA만 — 화면의 1급 뷰), IA→기능명세 역방향(기존 childRefs로 이미 유사 기능 존재)
