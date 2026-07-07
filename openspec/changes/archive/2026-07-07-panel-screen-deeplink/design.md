# panel-screen-deeplink — design

## Context

상세 패널 화면 칩(`FeatureDetailPanel.tsx` 연결화면 섹션)은 `<span>` 정적 렌더다. 같은 패널의 자식 노드 목록은 `<button onClick={() => onSelectById?.(c.id)}>`로 딥링크가 이미 배선돼 있어 패턴이 검증돼 있다. IA 화면 노드 id는 `screen-${slug(screen.id)}`(server 생성)라 web이 registry 원본 id로 직접 찾을 수 없다 — slug를 web에 복제하면 drift 위험.

## Goals / Non-Goals

**Goals:** 칩 클릭 → 기획 IA 탭 + 해당 화면 노드 선택. 매칭 실패는 무해(이동 없음+안내).
**Non-Goals:** 유저플로우/와이어 딥링크, IA→기능명세 역방향, slug 로직 공유화.

## Decisions

- **D-1 매칭 원천 = server가 실어주는 원본 id.** `IANode.screenId?: string`(옵션, additive)을 planningIaBuilder가 화면 노드에만 세팅. web은 `planningIaNodes.find(n => n.data.screenId === chip.id)` 문자열 동치만 — slug 복제 금지, 거짓 연결 0(레지스트리 규약 계승).
- **D-2 이동 = 기존 상태 전이 재사용.** `setPlanTab("ia")` + 매칭 노드의 data로 `setSelectedIa(...)`(IA 상세 패널 오픈) + 기능명세 상세 패널 닫기(패널 상호배타 유지). 신규 라우팅 인프라 없음.
- **D-3 실패 = 조용한 강등.** 매칭 0이면 탭 전환도 하지 않고 상태바에 "IA에서 화면을 찾지 못했습니다: <label>"만. 저작 오류(화면목록↔IA 불일치)를 숨기지 않되 화면을 깨지 않는다.
- **D-4 iaAdapter가 screenId를 노드 data로 전달** — 어댑터 파생 필드 패턴(childRefs·parentLabel 선례) 그대로.

## Risks / Trade-offs

- IA 트리가 아직 로드 전(planningIaNodes 빈 배열)일 때 클릭 → 매칭 실패 처리로 안내(D-3). IA는 openProject에서 병렬 로드되므로 실사용 창은 짧다.
- shared 타입에 옵션 필드 추가는 기존 소비자(change IA 뷰) 무영향(옵션이므로) — 빌드로 검증.

## 화면 구성 / UI

- 신규 화면 없음 — 칩이 버튼이 되는 것뿐(기존 `feature-detail-screen` 클래스에 hover/cursor만 추가). 이동 목적지는 기존 IA 뷰+IA 상세 패널.
