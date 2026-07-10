## Why

flowforge 와이어는 1단계(`planning-wireframe-device`)에서 디바이스 프레임 렌더러까지 완성됐지만, 레이아웃 원천이 **하드코딩 픽스처**(`buildDocsPlanningWireframe2`)라 실제 프로젝트의 와이어를 그리지 못한다. 명섭 님 확정 원칙은 "원천 100% AI 생성, 사람은 확인·피드백만"이다. 이 change는 그 픽스처 자리를 **AI 생성 레이아웃**으로 대체하고, 사람이 화면별로 자유 피드백을 남기면 **그 화면만 다시 그려지는** 대화형 루프를 붙여, 와이어를 "보고 → 고쳐달라고 하고 → 다시 그려지는" 실사용 도구로 완성한다.

## What Changes

- **픽스처 → AI 생성 제안 큐로 원천 교체**: `buildDocsPlanningWireframe2`가 고정 픽스처 대신 승인된 AI 생성 레이아웃(`WireScreen2[]`)을 반환한다. 사람 저작 경로는 여전히 없다.
- **와이어 제안 큐(read/apply)**: 외부 스킬이 생성한 `WireScreen2` 제안을 `*.suggestions.json` 사이드카로 받아, 기존 features/userflow 위저드와 동형으로 승인/반려 → 승인분만 반영. self-roundtrip 방어·422·배치상한 계약 복제.
- **화면별 피드백 → 재생성 (B형, A안 파일 릴레이)**: 각 화면에 자유 텍스트 피드백을 남기면 flowforge가 **feedback 사이드카에 write만** 한다. 외부 스킬이 그 피드백을 읽어 **그 화면만** AI 재생성해 제안 큐를 갱신하고, flowforge는 재조회로 새 레이아웃을 표시한다. flowforge는 LLM을 부르지 않는다(읽기 거울 원칙 유지).
- **화면별 피드백 입력 UI 신설**: flowforge 최초의 "사람 텍스트 → 서버 write" 경로(자유 텍스트 입력 → feedback 사이드카).
- 폐기 잔재 없음(element 세로박스는 1단계에서 제거 완료).

## Capabilities

### New Capabilities
- `planning-wireframe-generation`: 외부 스킬이 기능명세+유저플로우+화면목록을 입력으로 `WireScreen2[]` 와이어 레이아웃 제안을 생성하는 계약(생성 주체=flowforge 밖, features/userflow-generation과 동형이나 산출=JSON 제안 큐).
- `planning-wireframe-approval-queue`: 와이어 레이아웃 제안 큐(`*.suggestions.json`) 읽기 — 파일 부재·깨진 JSON 안전 폴백, id dedup, throw 금지.
- `planning-wireframe-approval-apply`: 승인/반려 반영 — 승인분만 와이어 원천에 반영(`buildDocsPlanningWireframe2` 결과가 승인분을 반환), self-roundtrip 방어·writeFailed 422·queuePruneFailed 부분반영 고지.
- `planning-wireframe-feedback`: 화면별 자유 텍스트 피드백을 feedback 사이드카에 write(A안 파일 릴레이) + 재생성분 재조회 반영. flowforge 최초의 사람→AI 역방향 write 경로.

### Modified Capabilities
- `planning-wireframe-device`: 레이아웃 원천이 "픽스처(사람 저작 없음)"에서 "AI 생성 승인분"으로 바뀐다 — 스펙의 "In this change the layout data comes from a fixture" 전제가 갱신된다(렌더 요구사항 자체는 불변, 데이터 원천만 변경).

## Impact

- **서버**: `server/src/parser/planningWireframeFixture.ts`(`buildDocsPlanningWireframe2` 교체), 신규 와이어 제안 큐 lib(`docs.ts`/`featureDocs.ts`/`userFlowDocs.ts` 원형 복제), 신규 feedback write lib, `server/src/routes/docs.ts`(제안 큐 read/apply 라우트 + feedback write 라우트).
- **웹**: `web/src/App.tsx`(와이어 탭에 피드백 입력·재조회), 신규 와이어 승인 위저드(`ApprovalWizard` 셸 재사용) + 화면별 피드백 입력 컴포넌트(신규 textarea→write). 렌더러 `WireframeDeviceFrame.tsx`는 재사용(무변경 목표).
- **shared**: 신규 와이어 제안 아이템 타입 + 피드백 아이템 타입(`wire-screen2-types.ts` 옆).
- **외부 스킬(flowforge 밖)**: AI 와이어 생성·재생성 로직은 이 change 범위 밖(계약·자리만 정의). openspec-plan 계열이 담당.
- **컨테이너 제약 확인 필요**: flowforge 컨테이너의 홈 마운트가 RO면 feedback write가 실패한다(audit-trigger 때 `/home/gaegul:...:ro` 전례) → write 대상 볼륨 규약을 design/spec에서 확정.
- **무저촉 보장**: change 경로 wireframeBuilder·WireframePanel·golden 테스트 무변경 통과.
