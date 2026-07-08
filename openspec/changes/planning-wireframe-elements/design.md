# planning-wireframe-elements — design

## Context

조사(2026-07-08) 실측: planning 와이어 원천·빌더·라우트 전무. 화면목록(`## 화면목록`)은 `<!-- screen: id -->`로 화면 3개를 1급 정의하나 요소를 담는 곳 없음. 렌더는 `WireframePanel.tsx`(박스 5종 KIND_LABEL)가 `Wireframe{screens[]{boxes[]{kind,label,goto}}}`(shared/wireframe-types.ts)를 그림 — **박스가 최소 단위, 요소 개념 없음**. 서버 와이어 빌더는 change spec 경로(`buildWireframe`, golden 대상)와 charter docs 경로(`buildDocsWireframe`)로 갈림. screenRegistry는 라인 스캔+헤더 컨텍스트 추적이라 새 주석을 additive로 얹기 자연스럽다(featureTreeBuilder가 when/then/memo 붙인 선례 동형).

### manyfast 대조 (상시 규칙)

manyfast 와이어(reference_manyfast_spec §5): 유저플로우 페이지를 "실제 UI요소(버튼·텍스트·입력)+화면간 이동"으로 시각화, 유저플로우 1개당 와이어 1개, **재생성 only·읽기전용**. 유저플로우 노드타입 4종에 **"행동(클릭·입력)"이 1급 프리미티브**로 있음 — ②의 요소·동작에 해당. 내부모델=한 캔버스 아이템 그래프(요구사항·기능·상세기능·페이지)의 여러 뷰. **단 manyfast의 요소 렌더 스키마는 비공개** — flowforge가 자체 문법을 정한다. 우리 방향: manyfast의 "행동 프리미티브"를 화면 요소(element)로 두되, 요소↔상세기능(N:M)↔when/then 사슬로 뷰-데이터 정합(종착지 사상)에 얹는다.

## Goals / Non-Goals

**Goals:**

- 화면목록의 각 화면에 요소(버튼·입력칸 등)를 저작 → planning 와이어에 박스로 렌더
- 기존 골든(flowBinder/change wireframeBuilder)·features 트리 파서 무저촉(additive)
- WireframePanel 재사용(신규 렌더 UI 0)
- 요소↔상세기능↔when/then 접점(①과 연결)

**Non-Goals:**

- AI 요소 제안 생성(후속 — 위저드 승인 파이프 재사용) / change 경로 통합 / 하이피델리티

## Decisions

- **D-1 요소 문법 = when/then/memo 동형 주석.** 화면 헤더(`###`) 아래 `<!-- element: <kind> "<라벨>" -->` (+선택 `-> detail:<상세기능라벨>` `-> screen:<이동화면id>`). kind=기존 WireBoxKind 5종(새 종류 안 만듦 — WireframePanel 재사용). 한 화면에 여러 element(순서 보존, memo와 달리 배열).
- **D-2 screenRegistry additive.** `ScreenNode.elements?: ScreenElement[]` — 라인 스캔이 `currentScreenLabel` 컨텍스트에서 `RE_ELEMENT` 매칭. id/label/N:M 링크 파싱 무변(기존 테스트 회귀 0). ScreenElement=`{kind, label, detail?, screen?}`.
- **D-3 planning 와이어 빌더 신설(병렬 패턴).** `buildDocsPlanningWireframe(docsDir)` — screenRegistry 화면 → `WireScreen{id,title,boxes}`, element → `WireBox{kind, label, goto}`(goto = element.screen을 화면 id로 해석, 없으면 null). detail 매핑은 web 상세용으로 별도 전달(WireBox는 goto만). planningIaBuilder(registry→IATree) 병렬 — change buildWireframe·golden 무저촉.
- **D-4 라우트·web = 기존 재사용.** `GET /api/docs/:project/planning-wireframe`(resolveDocsDir 재사용). web은 fetchDocsPlanningWireframe + 기획 와이어 탭에서 **기존 WireframePanel**에 전달(신규 컴포넌트 0). planTabsAvail에 와이어 추가.
- **D-5 원천 실증 = 수동 저작.** 이 change는 문법·파싱·렌더까지(features.md 화면 1~2개에 element 손저작으로 도그푸딩). AI 제안 생성은 별도 change(위저드 파이프 재사용 — 제안 큐 IO만 추가). 사용자 결정("AI 추론+위저드 승인")의 인프라는 이미 있으니 순서만 분리.

## Risks / Trade-offs

- 화면목록이 무거워짐(화면마다 element 나열) — additive·옵셔널이라 강제 아님, AI 제안이 나중에 채우는 게 본래 계획(수동은 실증용 최소).
- detail 매핑 문자열 동치(상세기능 라벨) — 연결화면 N:M과 같은 규약(거짓 연결 0 계승). 없는 상세기능 가리키면 매핑 없음(무해).
- web 테스트 러너 부재 계승 — 파싱·빌더는 server jest, 렌더는 verify 실픽셀.

## 화면 구성 / UI

- 시각 기준 = 기존 WireframePanel(모바일 프레임+박스 5종)과 이 change prototype. **HTML은 명세이지 구현물 아님** — 기존 컴포넌트 재사용. 신규 박스 종류·CSS 0.
