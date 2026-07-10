## ADDED Requirements

### Requirement: 와이어는 화면별 HTML 문서를 iframe에 렌더한다

와이어 뷰 SHALL, 각 화면을 좌표 없는 요소 박스(WireScreen2 elements)가 아니라 **화면별 HTML 문서**로 렌더하며, 그 문서를 iframe 안에 표시한다. 진짜 HTML이므로 렌더 결과는 실제 화면에 근접한다(피드백4 해소). 디바이스 프레임(데스크탑=브라우저 크롬, 모바일=폰 프레임)과 화면 목록·화면 전환 UI는 유지하되, 프레임 본문은 iframe이 채운다. 폐기 대상인 `WireframeDeviceFrame`의 요소 배열 렌더러는 planning 와이어 경로에서 제거된다.

#### Scenario: 화면별 HTML을 iframe에 표시

- **WHEN** 와이어 화면 하나(HTML 문서)를 렌더한다
- **THEN** 그 화면의 HTML 문서가 iframe 안에 표시되고, 좌표 없는 회색 박스 근사가 아니라 실제 마크업이 그려진다

#### Scenario: 데스크탑/모바일 프레임 유지

- **WHEN** device가 desktop/mobile인 화면을 렌더한다
- **THEN** 해당 디바이스 프레임(브라우저 크롬 / 폰 프레임) 안에 iframe이 배치되고, 디바이스 토글·화면 탭으로 화면을 전환할 수 있다

#### Scenario: 폐기된 박스 렌더러 미사용

- **WHEN** planning 와이어 렌더 경로를 검사한다
- **THEN** `WireScreen2` 요소 배열을 CSS grid/flex 박스로 근사하던 렌더러가 더 이상 planning 와이어에 쓰이지 않고, iframe HTML 렌더러가 원천이다

### Requirement: 와이어 HTML의 폼·입력·버튼은 실제로 동작한다

와이어 HTML에 폼·입력·버튼 등 상호작용 요소가 있을 때 SHALL, 클릭·입력·제출이 (sandbox 허용 범위 안에서) 실제로 동작한다 — 정적 회색 박스가 아니다(피드백5 해소). 문자 입력, 버튼 클릭 반응, 문서 내 화면 전환이 iframe 안에서 일어난다.

#### Scenario: 입력칸에 실제 입력이 된다

- **WHEN** 와이어 HTML의 input/textarea를 클릭하고 타이핑한다
- **THEN** 입력한 값이 실제로 반영된다(정적 플레이스홀더가 아님)

#### Scenario: 버튼·폼이 반응한다

- **WHEN** 와이어 HTML의 버튼을 클릭하거나 폼을 제출한다
- **THEN** onChange/onInput/onClick/onSubmit 등 문서에 정의된 동작이 iframe 안에서 실행된다

#### Scenario: 문서 내 화면 전환은 iframe 안에 갇힌다

- **WHEN** 와이어 HTML 안의 화면 전환(링크·스크립트 네비게이션)이 발생한다
- **THEN** 전환은 iframe 안에서만 일어나고 flowforge 상위 앱을 벗어나지 않는다(상세는 `flowforge-wireframe-sandbox-security`)

### Requirement: 렌더 원천은 화면별 HTML 문서다 (BREAKING)

와이어 렌더의 데이터 원천 SHALL, 좌표 없는 `WireScreen2[]`(regions/elements)가 아니라 화면별 HTML 문서(화면 id·title·device·html)의 집합이다. `buildDocsPlanningWireframe2`와 `GET /api/docs/:project/planning-wireframe` 응답이 이 새 계약을 반환한다. 이전 요소 배열 스키마와 호환되지 않는다(BREAKING). 승인분 원천이 없거나 깨졌으면 안전 폴백(빈 상태 또는 최소 폴백 문서)하며 렌더가 죽지 않는다.

#### Scenario: 응답이 HTML 문서를 담는다

- **WHEN** `GET /api/docs/:project/planning-wireframe`를 호출한다
- **THEN** 응답의 각 화면은 좌표 없는 요소 배열이 아니라 id·title·device·html(문서 문자열)을 담는다

#### Scenario: 원천 부재·손상 시 안전 폴백

- **WHEN** 승인분 HTML 원천이 없거나 JSON이 깨졌다
- **THEN** 렌더는 throw하지 않고 빈 상태(또는 최소 폴백 문서)로 안전하게 처리한다

### Requirement: 핀 피드백 좌표계는 iframe 표면 기준으로 재계산된다

와이어가 iframe으로 전환되면 SHALL, 핀 피드백 오버레이는 iframe **위** 레이어에 위치하고, 핀 좌표(xPct/yPct)는 iframe 요소의 바운딩 박스 기준으로 계산된다. sandbox iframe 내부 DOM에는 접근할 수 없으므로(보안 경계) 좌표는 iframe 내부 요소가 아니라 iframe 표면 상대 위치다. 핀은 화면·디바이스별로 분리되고, 저장된 핀은 그 표면 좌표에 다시 표시된다.

#### Scenario: 핀은 iframe 표면 좌표에 찍힌다

- **WHEN** 와이어(iframe) 위를 ⌘/핀모드로 클릭한다
- **THEN** 클릭 지점이 iframe 요소 바운딩 박스 기준 xPct/yPct(0~100)로 계산되어 그 좌표에 핀이 찍히고, iframe 내부 DOM 접근 없이 처리된다

#### Scenario: 저장된 핀 재표시

- **WHEN** 저장된 핀이 있는 화면을 다시 연다
- **THEN** 핀이 iframe 표면의 같은 xPct/yPct 위치에 다시 표시된다

## TDD Plan

- **Red**:
  - iframe에 화면별 HTML이 표시되고, 폐기된 요소 박스 렌더러 클래스(`wf-df-el--*`)가 planning 와이어에 없음을 확인하는 컴포넌트 테스트.
  - 응답 계약 변경 테스트 — `planning-wireframe` 응답 각 화면이 `html` 문서를 담고 요소 배열이 아님을 검증.
  - 폼/입력/버튼 실동작 테스트(Playwright) — input 타이핑 반영·버튼 클릭 반응을 실측.
  - 원천 부재·손상 시 안전 폴백(throw 안 함) 단위 테스트.
  - 핀 좌표 재계산 테스트 — iframe 바운딩 박스 기준 xPct/yPct 산출·재표시.
- **Green**: iframe 렌더러 최소 구현, 응답 계약 교체, 핀 오버레이 좌표 재계산.
- **Refactor**: 디바이스 프레임 크롬(토글·탭)은 재사용, 본문만 iframe로 교체(게으름 위계 — 프레임 재작성 금지).
- **UI 검증**: `docker compose up -d --build`로 라이브 반영 후 Playwright 실픽셀로 실화면 근접·입력 동작 확인.
