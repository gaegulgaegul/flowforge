## ADDED Requirements

### Requirement: 와이어 지점 단위 피드백을 기록한다

flowforge는 사용자가 와이어 위 특정 지점을 클릭해 남긴 자유 텍스트 피드백을 `POST /api/docs/:project/planning-wireframe-feedback`로 받아 feedback 사이드카 파일에 append SHALL 한다. 피드백 아이템은 대상 화면 id(`WireScreen2.id`) + 자유 텍스트 + 타임스탬프 + **클릭 좌표(xPct·yPct, 0~100)** + 영역(region, 좌표에서 자동 인식)을 담는다(지점 단위 — 위치가 의미를 가짐). flowforge는 피드백을 파일에 기록만 하고 AI를 호출하지 않는다(A안 파일 릴레이 — 읽기 거울 원칙 유지). 이는 flowforge에서 사용자 텍스트가 서버로 가는 최초의 write 경로다(기존 유일 write는 유저플로우 좌표 overlay).

#### Scenario: 와이어 지점에 피드백 남기기

- **WHEN** 사용자가 화면 `<grid>`의 특정 좌표(예: 본문 50%,55%)를 클릭해 "이 카드 그리드를 세로 리스트로"라는 피드백을 제출한다
- **THEN** feedback 사이드카에 { screenId, text, ts, xPct, yPct, region }가 append 되고(좌표에 묶임), flowforge는 AI를 호출하지 않는다

#### Scenario: 좌표 유효성 방어

- **WHEN** xPct/yPct가 0~100 범위를 벗어나거나 숫자가 아닌 값으로 피드백이 제출된다
- **THEN** 서버가 그 요청을 거부한다(400) — 좌표 없는·범위 밖 지점 피드백을 기록하지 않는다

#### Scenario: 피드백 write는 flowforge의 유일한 사람→AI 역방향 경로

- **WHEN** 피드백 write 경로를 검사한다
- **THEN** 자유 텍스트가 서버로 가서 파일에 기록되며, 그 파일은 외부 스킬이 읽어 재생성에 쓴다(flowforge는 재생성을 실행하지 않음)

#### Scenario: 빈 텍스트·미존재 화면 방어

- **WHEN** 빈 텍스트이거나 존재하지 않는 화면 id로 피드백이 제출된다
- **THEN** 빈 텍스트는 거부하고, 알 수 없는 화면 id는 기록하지 않거나 명시적으로 거부한다(쓰레기 피드백 방지)

### Requirement: 재생성분을 재조회로 반영한다

외부 스킬이 feedback을 읽어 해당 화면만 AI 재생성해 제안 큐를 갱신하면, flowforge는 재조회(새로고침)로 갱신된 `WireScreen2` 레이아웃을 표시 SHALL 한다. 재생성은 피드백이 남은 화면 단위로 격리되어, 피드백 없는 다른 화면의 승인분은 영향받지 않는다.

#### Scenario: 그 화면만 재생성 반영

- **WHEN** 화면 `<home>`에 피드백을 남긴 뒤 스킬이 재생성해 큐를 갱신하고, 사용자가 재조회한다
- **THEN** `<home>` 화면만 갱신된 레이아웃으로 바뀌고, 피드백 없는 다른 화면은 기존 승인분 그대로다

#### Scenario: 재생성 전에는 기존 레이아웃 유지

- **WHEN** 피드백을 남겼지만 아직 스킬이 재생성하지 않은 상태에서 화면을 본다
- **THEN** 기존 레이아웃이 유지되고(즉시 바뀌지 않음), 피드백이 접수됐음을 사용자가 알 수 있다(A안 릴레이 특성)

### Requirement: 인플레이스 핀 피드백 UI

flowforge 와이어 뷰는 와이어 위에서 ⌘(cmd/ctrl)+클릭(또는 핀 모드 후 클릭)으로 특정 지점을 지목해 그 자리에 자유 텍스트를 입력·제출하는 UI를 제공 SHALL 한다(Figma 코멘트식 인플레이스). 클릭한 좌표에 팝오버(textarea)가 뜨고, 저장하면 그 좌표에 핀 마커가 꽂힌다. 핀·목록 클릭 시 그 피드백이 재열린다. 데스크탑/모바일·화면별 핀은 분리된다. 화면별 입력칸 나열 방식이 아니다.

#### Scenario: 와이어 지점 클릭 → 팝오버 → 핀

- **WHEN** 핀 모드에서(또는 ⌘+클릭으로) 와이어의 한 지점을 클릭한다
- **THEN** 클릭한 그 좌표에 팝오버(텍스트 입력)가 뜨고, 위치(영역·좌표%)가 표시되며, 저장하면 그 자리에 핀이 꽂히고 그 화면 id+좌표로 피드백이 기록된다

#### Scenario: 제출 후 접수 표시 + 재열림

- **WHEN** 지점 피드백을 저장한다
- **THEN** 접수됨이 표시되고 목록/핀에 반영되며, 핀이나 목록 항목을 클릭하면 그 피드백이 다시 열려 확인·수정할 수 있다

## TDD Plan

- **Red**: feedback write 테스트 — 화면에 피드백 append(screenId·text·ts), 빈 텍스트 거부, 미존재 화면 id 방어. 재조회 시 갱신 화면만 바뀌고 타 화면 승인분 불변. UI: 화면별 textarea 렌더·제출→write 호출.
- **Green**: `appendWireframeFeedback(docsDir, {screenId, text})` — feedback 사이드카 append(features suggestions write 패턴 참고, 단 방향이 사람→파일). 라우트 `POST .../planning-wireframe-feedback`. web: 화면별 피드백 입력 컴포넌트(신규 textarea) + 제출 핸들러.
- **Refactor**: 위저드 셸의 화면 순회·체크포인트 상태(`wizard-state.ts`) 재사용. feedback write와 approval apply의 self-roundtrip 방어 공유.
- **컨테이너 제약**: flowforge 컨테이너 홈 마운트가 RO면 feedback write 실패(audit-trigger `/home/gaegul:...:ro` 전례). write 대상이 컨테이너에서 쓰기 가능한 볼륨(docs-root)인지 apply 단계에서 확인하고, RO면 write 경로 규약을 조정한다.
- Mock 대상: 없음(파일 IO는 tmp 픽스처, 외부 스킬 재생성은 범위 밖이라 큐 갱신을 픽스처로 시뮬레이션).
