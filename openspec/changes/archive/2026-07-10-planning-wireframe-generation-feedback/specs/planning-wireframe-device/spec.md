## MODIFIED Requirements

### Requirement: 와이어는 디바이스 프레임 안에 화면 레이아웃을 배치 렌더한다

The wireframe view SHALL render each screen as a low-fidelity mockup laid out inside a device frame — desktop (browser chrome + top menu + optional sidebar + body) or mobile (phone frame + top title bar + body + bottom menu bar) — placing elements as they appear on a real screen (NOT a vertical name-tag list). Rendering SHALL consume a `WireScreen2` layout data model (regions: topbar/sidebar/bottombar/body; body layout: grid/stack/tree/form; elements with kind/label/goto). The layout data comes from AI-generated, human-approved layouts (via `planning-wireframe-generation` → `planning-wireframe-approval-apply`), no longer from a hardcoded fixture; there is still no human authoring path for layouts (the source is AI generation; humans only confirm and give feedback). Visual fidelity SHALL match the approved mockup (grayscale lo-fi).

#### Scenario: 데스크탑 프레임에 배치 렌더

- **WHEN** device=desktop인 화면 레이아웃(상단 메뉴+사이드+본문 그리드)을 렌더한다
- **THEN** 브라우저 크롬 안에 상단 메뉴·사이드 메뉴·본문 그리드가 실제 화면처럼 배치되어 회색조로 그려진다(세로 목록 아님)

#### Scenario: 모바일 프레임에 배치 렌더

- **WHEN** device=mobile인 화면 레이아웃을 렌더한다
- **THEN** 폰 프레임 안에 상단 타이틀바·본문·하단 메뉴바가 배치되어 그려진다

#### Scenario: 요소 클릭 → 화면 이동

- **WHEN** goto가 있는 요소(버튼·카드 등)를 클릭한다
- **THEN** 해당 대상 화면으로 전환된다

#### Scenario: change 경로 와이어·골든 무저촉

- **WHEN** 새 디바이스 프레임 렌더러가 추가된다
- **THEN** change 경로 wireframeBuilder·WireframePanel·golden 테스트는 무변경으로 통과한다(planning 와이어만 새 렌더러)

#### Scenario: 원천이 승인된 AI 생성분이다

- **WHEN** 와이어 레이아웃 데이터의 원천을 검사한다
- **THEN** 고정 픽스처가 아니라 승인된 AI 생성 레이아웃(`buildDocsPlanningWireframe2`가 승인분 반환)이며, 사람이 레이아웃을 손저작하는 경로는 없다
