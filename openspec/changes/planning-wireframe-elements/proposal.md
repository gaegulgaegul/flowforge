# planning-wireframe-elements

## Why

5종 뷰 중 와이어프레임만 **기획 레이어에 원천이 없다**(로드맵 ③ 진단 그대로 — planning 와이어 산출물·빌더·라우트 전무). 화면목록(`## 화면목록`, `<!-- screen: id -->`)은 있으나 각 화면이 "무슨 요소(버튼·입력칸·텍스트)를 가지는가"를 담는 곳이 없어, 와이어를 봐도 "이 화면에 로그인 버튼·이메일 입력칸이 있다"가 안 보인다. 각 화면의 실제 요소·동작이 와이어 안에 그려져 보이게 한다(명섭 요구).

## What Changes

- **화면 요소 저작 문법**: `## 화면목록`의 각 화면(`### … <!-- screen: id -->`) 아래에 `<!-- element: <kind> "<라벨>" [-> detail:<상세기능> | screen:<이동대상>] -->` 인라인 주석. kind = 기존 5종(header/list/button/field/empty). when/then·memo와 동형의 additive 주석.
- **screenRegistry 확장**: `ScreenNode`에 `elements?: ScreenElement[]`(additive) — 라인 스캔 파서가 화면 헤더 컨텍스트 아래 element 주석을 읽음. 기존 id·label·N:M 링크 파싱 무변.
- **planning 와이어 빌더 신설**: `buildDocsPlanningWireframe(docsDir)` — 화면목록 → 각 화면을 `WireScreen`으로, 각 element를 `WireBox`로 투영. `planningIaBuilder`가 registry→IATree를 만든 병렬 패턴. change 경로 `buildWireframe`·golden 무저촉.
- **라우트 + web**: `GET /api/docs/:project/planning-wireframe` + 기획 뷰에 와이어 탭 → **기존 `WireframePanel` 재사용**(신규 렌더 컴포넌트 0).
- **①과 접점**: element의 `-> detail:<상세기능>` 매핑으로 "버튼(요소) → 그 상세기능 → 그 기능의 when/then(동작)"까지 이어진다. element의 `screen:` 이동은 WireBox.goto로 투영.
- **원천 = AI 추론 + 위저드 승인**: 요소는 사람이 매번 손저작하지 않고, AI가 features·화면목록·when/then에서 추론 제안 → 승인 위저드(방금 만든 파이프)로 사람과 함께 확인 → 승인분만 화면목록에 반영. **이 change는 저작 문법·파싱·렌더까지(수동 저작으로 실증), AI 제안 생성은 별도 후속 change**(위저드 파이프는 이미 있으니 제안 큐만 얹으면 됨).

## Capabilities

### New Capabilities

- `planning-wireframe-view`: 화면목록 요소를 읽어 planning 와이어를 렌더하는 능력(빌더·라우트·요소 파싱)

### Modified Capabilities

- `planning-features-view`: 화면 요소 저작 문법(`<!-- element: -->`)을 features.md 화면목록에 추가, screenRegistry가 파싱

## Impact

- shared: `ScreenNode.elements?: ScreenElement[]`(additive), `ScreenElement{kind, label, detail?, screen?}` 신규 타입
- server: `screenRegistry.ts` element 파싱(additive) + `planningWireframeBuilder.ts` 신설(WireBox 투영) + `routes/docs.ts` planning-wireframe 라우트
- web: `api.ts` fetchDocsPlanningWireframe + App.tsx 기획 와이어 탭(기존 WireframePanel 재사용)
- docs: features.md 화면 1~2개에 element 도그푸딩(원천 실증)
- Non-Goal: AI 요소 제안 생성(후속 change — 위저드 파이프 재사용) / change 경로 wireframeBuilder 통합(무저촉) / 하이피델리티 렌더(로우피델리티 유지)
