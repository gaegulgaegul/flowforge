# planning-wireframe-device (delta)

## ADDED Requirements

### Requirement: 와이어는 디바이스 프레임 안에 화면 레이아웃을 배치 렌더한다

The wireframe view SHALL render each screen as a low-fidelity mockup laid out inside a device frame — desktop (browser chrome + top menu + optional sidebar + body) or mobile (phone frame + top title bar + body + bottom menu bar) — placing elements as they appear on a real screen (NOT a vertical name-tag list). Rendering SHALL consume a `WireScreen2` layout data model (regions: topbar/sidebar/bottombar/body; body layout: grid/stack/tree/form; elements with kind/label/goto). In this change the layout data comes from a fixture (no human authoring path — the source is AI generation, a later change). Visual fidelity SHALL match the approved mockup (grayscale lo-fi).

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

### Requirement: 폐기된 element 세로박스 접근을 제거한다

The abandoned `planning-wireframe-elements` code (screenRegistry `<!-- element: -->` parsing, `ScreenElement`, `planningWireframeBuilder` box-stack projection) SHALL be removed, replaced by the device-frame model. No human element authoring syntax remains in features.md.

#### Scenario: element 파싱 잔재 제거

- **WHEN** 이 change 적용 후
- **THEN** screenRegistry에 element 파싱이 없고, features.md에 `<!-- element: -->` 주석이 없으며, 관련 테스트가 새 모델로 대체된다

## TDD Plan

- **Red**: (1) 레이아웃 빌더 — 픽스처 WireScreen2 데이터 파싱/제공 (2) 렌더러 컴포넌트는 web이라 verify 실픽셀(목업 대조).
- **Green**: shared 타입 + 픽스처 로더 + WireframeDeviceFrame + 라우트 + element 코드 제거.
- **Refactor**: 폐기 element 코드 삭제.
- Mock 대상: 없음.
