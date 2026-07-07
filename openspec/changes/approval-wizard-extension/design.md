# approval-wizard-extension — design

## Context

PRD 위저드(`approval-wizard-mode`)가 검증 3라운드(C-1 skip 갇힘·C-2 cross-project 소실 수정 포함)를 거쳐 라이브에 있다. features/userflow는 목록형 패널(`FeatureApprovalPanel`·`UserFlowApprovalPanel`) 그대로다. 상태 순수 모듈(`shared/src/prd-wizard-state.ts`)은 제안 id 문자열만 다루는 제네릭이라 세 패널이 공유 가능하다(단위 테스트 16건 보유).

## Goals / Non-Goals

**Goals:**

- features·userflow 승인을 PRD와 동일한 위저드 UX로(3패널 대칭 회복)
- 위저드 골격 1벌 유지(3벌 복제 금지) — 카드 내용만 패널별 주입
- 예광탄에서 박제된 계약 전부 계승: skip 잔존 재등장·반영 실패 결정 보존·성공 시 리셋·tick 격리·stale 폐기

**Non-Goals:**

- 서버 API·큐 스키마 변경(무변경이 게이트)
- PRD 위저드 동작 변경(셸 마이그레이션은 픽셀·동작 동일해야 함)
- 목록형 뷰 병행 제공(사용자가 A 순수 위저드 확정 — 예광탄 결정 계승)

## Decisions

- **D-1 셸 추출 = render prop**: `ApprovalWizard<TSuggestion>`가 골격(배너·진행바+결정 점·[반려][건너뛰기][승인]·탈출구 링크·요약·체크포인트 IO·appliedTick 리셋)을 소유하고, `renderCard(s: TSuggestion)`와 `summaryLabel(s)` 만 패널별로 받는다. 카드 내부 마크업은 기존 세 패널 것을 그대로 이식(시각 회귀 0 목표).
- **D-2 구조/동작 분리 커밋**: ①shared rename(`wizard-state.ts`)+import 갱신 ②셸 추출+PRD 마이그레이션(동작 무변 — 실픽셀 대조) ③features 위저드 ④userflow 위저드. 각 단계 빌드·테스트 게이트.
- **D-3 체크포인트 키 규약**: `prd-wizard:<project>`(기존 유지 — 마이그레이션에서 키 바꾸지 않음, 사용자 체크포인트 보존) / `features-wizard:<project>` / `uflow-wizard:<project>:<stem>`. userflow는 stem 전환 시 위저드 key도 `<project>:<stem>`으로 리마운트(cross-stem 격리 — C-2 교훈의 stem 판).
- **D-4 appliedTick 3벌 독립**: `prdAppliedTick`·`featAppliedTick`·`uflowAppliedTick` 각각, openProject에서 전부 리셋. userflow는 stem 전환 시에도 리셋.
- **D-5 반영 경로 재사용**: features=`applyFeatures`(기존 applyInChunks 경유), userflow=`applyUserFlow`(동일). 반영 성공 시 해당 tick만 증가. 반영 대상 0(전부 skip)은 서버 무접촉 안내(M-1 계승 — 세 경로 모두).
- **D-6 기존 목록 패널 삭제**: `FeatureApprovalPanel.tsx`·`UserFlowApprovalPanel.tsx` 제거(죽은 코드 금지). 단 카드 내부 조각(속성 화살표·에지 표기)은 위저드 카드 렌더러로 이동해 재사용.

## Risks / Trade-offs

- 셸 일반화가 PRD 동작을 미묘하게 바꿀 위험 → 마이그레이션 커밋에서 PRD 위저드 실픽셀·시나리오(진입·skip·재진입 복원) 재확인을 verify에 포함.
- userflow는 큐가 stem별이라 "요약 일괄 반영" 단위도 stem — 여러 stem에 걸친 일괄은 없다(현행 계약 유지, 혼동 시 진행 표시에 stem 표기).
- web 테스트 러너 부재는 여전 — 상태 모듈은 jest, UI는 verify 실픽셀 의존(기존 한계 계승, 별도 결정 항목).

## 화면 구성 / UI

- 시각 기준 = 라이브 PRD 위저드(flowforge.gaegul.house)와 이 change의 `prototype.html`. **HTML은 명세이지 구현물이 아니다** — 기존 카드 마크업을 셸에 이식해 구현한다.
