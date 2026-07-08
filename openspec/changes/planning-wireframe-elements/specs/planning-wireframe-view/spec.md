# planning-wireframe-view (delta)

## ADDED Requirements

### Requirement: 화면목록 요소를 읽어 planning 와이어를 렌더한다

WHEN the features.md `## 화면목록` screens carry `<!-- element: <kind> "<label>" [-> detail:<detailLabel>] [-> screen:<screenId>] -->` comments, the server SHALL provide `GET /api/docs/:project/planning-wireframe` that builds a `Wireframe` — each screen a `WireScreen`, each element a `WireBox` (kind ∈ the existing 5 kinds; goto = the resolved `screen:` target or null) — via a new `buildDocsPlanningWireframe`, without touching the change-path `buildWireframe` or its golden. The web SHALL render it with the existing `WireframePanel`. WHEN no elements are authored, the screen renders with no boxes (empty frame, no fabrication).

#### Scenario: 요소 저작 → 와이어 박스 렌더

- **WHEN** 화면 `login` 아래에 `<!-- element: field "이메일" -->` `<!-- element: button "로그인" -> screen:home -->`을 저작하고 planning 와이어를 연다
- **THEN** login 프레임에 입력 박스("이메일")와 버튼 박스("로그인")가 렌더되고, 로그인 박스의 goto가 home으로 해석된다

#### Scenario: 요소 없는 화면은 빈 프레임

- **WHEN** element 주석이 없는 화면을 렌더한다
- **THEN** 그 화면 프레임은 박스 없이 뜨고 지어내지 않는다(회귀 0)

#### Scenario: 골든·change 와이어 무저촉

- **WHEN** planning 와이어 빌더가 추가된다
- **THEN** change 경로 `buildWireframe`·golden 테스트·features 트리 파서는 무변경으로 통과한다

### Requirement: 요소는 상세기능에 매핑될 수 있다

An element's optional `-> detail:<detailLabel>` SHALL link it to a features detail node by exact-label match (같은 규약 as N:M screens, 거짓 연결 0), enabling the element→detail→when/then chain. A detail that matches no node yields no mapping (harmless).

#### Scenario: 요소 → 상세기능 매핑

- **WHEN** `<!-- element: button "저장" -> detail:저장처리 -->`를 저작한다
- **THEN** 그 버튼 요소가 상세기능 "저장처리"에 연결돼(문자열 동치), 그 기능의 when/then까지 사슬이 이어진다(소비는 web/후속)

## TDD Plan

- **Red**: (1) screenRegistry element 파싱(여러 개·순서·kind·detail/screen 옵션·없음, 기존 링크 무영향) (2) buildDocsPlanningWireframe(화면→WireScreen·element→WireBox·goto 해석·빈 화면) (3) golden 회귀 0.
- **Green**: shared 타입 + screenRegistry RE_ELEMENT + planningWireframeBuilder + 라우트 + web 탭.
- **Refactor**: 없음(WireframePanel 재사용).
- Mock 대상: 없음.
