# approval-wizard-extension

## Why

PRD 승인 위저드 예광탄(`approval-wizard-mode`)이 3라운드 검증을 거쳐 배포됐고 사용자가 확장을 승인했다(2026-07-07). 지금 features(속성 승인)·userflow(에지 승인)는 여전히 목록형 패널이라 3패널 UX가 다시 비대칭이 됐다 — 예광탄에서 검증된 위저드 UX(한 건씩 크게·진행·건너뛰기·탈출구·일괄 반영·이탈 내성)를 나머지 두 패널로 확장해 대칭을 회복한다.

## What Changes

- **공용 위저드 셸 추출(구조)**: `PrdApprovalWizard`의 골격(진행바·결정 점·버튼·탈출구·요약·체크포인트)을 카드 내용만 주입받는 공용 컴포넌트로 일반화. PRD는 이 셸로 마이그레이션(동작 무변경 — 구조 커밋 분리). 상태 순수 모듈(`prd-wizard-state`)은 이미 id 기반 제네릭이라 이름만 `wizard-state`로 정정.
- **features 승인 위저드(동작)**: 속성 제안을 위저드로 — 카드 내용은 기존 features 카드(nodePath 경로 + 속성 before/after 화살표) 재사용. 체크포인트 키 `features-wizard:<project>`.
- **userflow 승인 위저드(동작)**: 에지 제안을 위저드로 — 카드 내용은 기존 userflow 카드(실선/점선 에지·신규 화면 뱃지) 재사용. 큐가 stem(버전 파일)별이므로 체크포인트 키 `uflow-wizard:<project>:<stem>`.
- 세 위저드 모두 예광탄과 같은 계약: 건너뛰기=큐 잔존·요약에서 1회 일괄 반영(기존 청크 경로)·반영 실패 시 결정 보존·반영 성공 시 리셋·cross-project(및 cross-stem) tick 격리·stale 결정 폐기.
- 서버·shared 계약 무변경(API·큐 스키마 그대로. shared는 파일명 정정만).

## Capabilities

### New Capabilities

(없음)

### Modified Capabilities

- `planning-features-approval-apply`: 승인 UI 요구 추가 — 목록형 패널을 위저드 방식으로 대체(개별/일괄 능력은 위저드 결정+탈출구로 계승)
- `planning-userflow-approval-edit`: "유저플로우 탭에 승인 패널을 표시한다" 요구를 위저드 방식으로 대체 갱신(stem별 큐·체크포인트)

## Impact

- web: 공용 위저드 셸 신설, `FeatureApprovalPanel.tsx`·`UserFlowApprovalPanel.tsx` → 위저드로 교체(기존 패널 삭제 — 죽은 코드 금지), `PrdApprovalWizard.tsx` 셸 마이그레이션, App.tsx 배선(features/userflow appliedTick 격리)
- shared: `prd-wizard-state.ts` → `wizard-state.ts` rename(내용 무변, import 2곳 갱신)
- server: 무변경
- 테스트: 기존 333 회귀 0 + 셸 일반화 후 상태 모듈 테스트 유지
- Non-Goal: 서버 API 변경 / PRD 위저드 동작 변경 / 와이어프레임·WHEN/THEN(별도 논의 유지)
