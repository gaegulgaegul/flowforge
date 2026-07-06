# approval-wizard-mode — design

## Context

PRD 승인 패널은 직전 change(`approval-ui-debt-cleanup`)에서 목록형(상단 일괄 바+캡 목록)으로 견고화됐으나, 사용자가 목업 비교 후 **순수 위저드(A)** 를 확정했다(2026-07-06, https://wizard-mockup-deploy.vercel.app — 이 목업이 화면 구성·흐름의 1차 기준). 서버 계약(큐 read/POST apply/청크 상한/queuePruneFailed)은 직전 change로 견고한 상태라 **UI 레이어만 교체**한다.

## Goals / Non-Goals

**Goals:**

- PRD 승인을 위저드 UX로: 진입 즉시 1건 크게 → 결정 → 다음, 진행 n/N, 건너뛰기, 요약 후 일괄 반영
- 이탈 내성: localStorage 체크포인트로 재진입 시 결정 복원(stale 안전)
- 대량 큐 능력 계승: 탈출구(남은 것 모두 승인/반려) — 청크 경로 재사용

**Non-Goals:**

- features/userflow 패널 위저드화(예광탄 검증 후 후속 change)
- 서버 API·큐 스키마 변경(무변경이 게이트)
- 결정의 서버측 저장(체크포인트는 클라이언트 localStorage만 — 사이드카 큐 오염 금지)
- 실행취소(undo)·건별 즉시 반영(2-2 기각됨)

## Decisions

- **D-1 사용자 확정 4결정이 단일 출처다**: ①A 순수 위저드 ②2-3 일괄 반영+localStorage 이탈 내성 ③건너뛰기 필요 ④PRD 예광탄. 목업의 모드 A 화면 구성(진행바+점·카드·3버튼)이 시각 기준.
- **D-2 결정 상태 모델**: 클라이언트에서 `Record<suggestionId, "approve"|"reject"|"skip">`. skip은 반영 대상 아님(큐 잔존). [결정 반영하기] = approve 목록+reject 목록으로 기존 `applyInChunks` 1회 호출(200건 상한·청크·queuePruneFailed 고지 전부 그대로 소비).
- **D-3 localStorage 체크포인트**: 키 = `prd-wizard:<project>`. 값 = `{ids: 큐 스냅샷 id 배열, decisions, cursor}`. **재진입 시 현재 큐와 대조해 큐에 없는 id의 결정은 폐기**(stale 안전 — 다른 경로로 큐가 바뀌었을 수 있음). 반영 성공 시 체크포인트 삭제. JSON 파싱 실패·용량 초과는 조용히 새 세션으로 폴백(체크포인트는 편의지 데이터가 아님).
- **D-4 탈출구 의미**: [남은 것 모두 승인/반려] = 미결정(건너뜀 포함? 아님 — 아직 안 본 것+건너뛴 것 중 **미결정만**) 전부를 해당 결정으로 채우고 요약으로 점프. 요약에서 [결정 반영하기] 전까지는 서버 무접촉(2-3 일관).
- **D-5 컴포넌트 경계**: 신규 `PrdApprovalWizard.tsx`로 만들고 App.tsx에서 기존 `PrdApprovalPanel` 자리에 교체 배선. 기존 PrdApprovalPanel.tsx는 삭제(죽은 코드 금지 — 10-coding-style). diff 두 컬럼·승인/반려 버튼 등 카드 내부 마크업/클래스는 재사용.
- **D-6 반영 실패 처리**: applyInChunks 실패·부분 실패 시 기존 고지 경로(재조회+정직 고지) 그대로. 실패해도 체크포인트는 남겨 재시도 가능하게(반영 성공 시에만 삭제).

## Risks / Trade-offs

- 목록 조망이 사라진다 — 사용자가 A를 인지하고 확정(진행 점 + 배너 "제안 N건"으로 최소 조망 유지). 후속에서 필요하면 요약 화면에 전체 결정 목록이 조망 역할.
- 반영 전 결정은 브라우저에만 있다 — localStorage로 이탈은 견디지만 브라우저 프로필이 바뀌면 소실(큐 원본은 불변이라 데이터 위험 0, 재검토 가능).
- 직전 change의 "목록+상단 일괄 바" spec 요구를 대체 — delta spec의 MODIFIED로 정직하게 문서화(몰래 덮지 않음).

## 화면 구성 / UI

- 화면 구조·흐름의 명세는 **A/B 목업의 모드 A**(https://wizard-mockup-deploy.vercel.app, /home/gaegul/wizard-mockup-deploy/index.html)와 이 change의 `prototype.html`을 단일 출처로 한다. **HTML은 명세이지 구현물이 아니다** — React(기존 승인 패널 클래스 재사용)로 번역해 구현한다.
