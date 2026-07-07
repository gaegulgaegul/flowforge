# approval-wizard-mode

## Why

승인 패널의 카드 목록은 제안이 여러 건일 때 "한눈에 안 들어오고 텍스트를 훑기 어렵다"는 사용자 피드백이 있었다(2026-07-06). 승인은 본질이 한 건씩 내리는 결정이므로, UI도 결정 단위로 — 한 번에 한 건을 크게 보여주고 결정하면 다음으로 넘어가는 위저드 방식으로 바꾼다. A/B 인터랙티브 목업(https://wizard-mockup-deploy.vercel.app) 비교 후 사용자가 **A(순수 위저드)**를 확정했다.

## What Changes

사용자 확정 결정 4개(2026-07-06, 목업 비교 후):

- **순수 위저드(A)**: PRD 승인 패널의 카드 목록 뷰를 위저드로 대체 — 진입 즉시 1건씩 크게(현재↔제안 diff), 결정하면 다음 건. 진행 표시 n/N + 결정 점(승인/반려/건너뜀 색).
- **일괄 반영 + 이탈 내성(2-3)**: 위저드 동안 결정은 로컬에만 쌓이고, 마지막 요약에서 [결정 반영하기] 1회로 서버 반영(기존 apply 경로·청크 재사용). 결정은 localStorage에 체크포인트 — 중간에 닫아도 재진입 시 이어서 검토. 큐가 그 사이 바뀌면 stale 결정은 폐기(안전).
- **건너뛰기(3)**: [건너뛰기] 버튼 — 건너뛴 제안은 큐에 남는다(다음 진입 때 다시 나옴).
- **대량 큐 탈출구**: 위저드 하단 [남은 것 모두 승인]/[남은 것 모두 반려] — 기존 일괄 처리 능력을 위저드 안에서 계승(직전 change가 견고화한 청크 경로 그대로).
- **예광탄 범위(4)**: PRD 패널만. features/userflow 패널은 무변(검증 후 후속 change로 확장).

## Capabilities

### New Capabilities

(없음)

### Modified Capabilities

- `planning-prd-approval-apply`: 패널 UI 요구 재정의 — 카드 목록+상단 일괄 바(직전 change의 요구)를 위저드(1건씩+진행+건너뛰기+탈출구+요약 일괄 반영)로 **대체**. 일괄 처리·건수 표시 능력은 탈출구/진행 표시로 계승. 서버 API·큐 계약은 무변경.

## Impact

- web: `PrdApprovalPanel.tsx` → 위저드 컴포넌트로 재작성(또는 신규 `PrdApprovalWizard.tsx`+교체), `App.tsx` 배선 소폭, styles.css 위저드 스타일
- server: **무변경** (기존 POST apply·청크 상한·queuePruneFailed 그대로 소비)
- localStorage: 결정 체크포인트(프로젝트+문서 키, 제안 id 단위) — 신규 클라이언트 상태
- features/userflow 승인 패널: 무변(명시적 범위 밖)
- 직전 change `approval-ui-debt-cleanup`의 PRD 패널 목록 요구와 충돌 → 이 change의 delta가 그 요구를 대체(문서로 정직하게 처리)
