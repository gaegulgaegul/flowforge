# approval-wizard-mode — tasks

## Tasks

### Sequential: 상태 모델 (선행 필수 — 검증 가능한 순수 로직 분리)

- [x] 1.1 위저드 상태 순수 모듈 신설 (shared 또는 web/src/lib): 결정 맵(`approve|reject|skip`)·cursor 전이·탈출구(미결정 일괄)·요약 카운트·**체크포인트 대조(현재 큐 ids와 차집합 → stale 결정 폐기)** — 프레임워크 무의존 순수 함수
- [x] 1.2 RED: 상태 모듈 단위 테스트 — 결정→다음 이동, 건너뛰기=반영 제외, 탈출구=미결정만 채움, 요약 카운트 일치, stale id 폐기, 반영 페이로드(approve/reject 분리·skip 제외) 생성

### Sequential: 위저드 UI (상태 모듈 위에)

- [x] 2.1 `PrdApprovalWizard.tsx` 신설 — 목업 모드 A 번역: 진행바+결정 점(n/N), 카드 1건(섹션 제목·사유·현재↔제안 diff — 기존 prd-approval 카드 마크업/클래스 재사용), [✕ 반려][건너뛰기][✓ 승인], 하단 탈출구 링크 2개, 요약 화면(카운트+결정 목록+[결정 반영하기]+[처음부터 다시])
- [x] 2.2 localStorage 체크포인트 배선 — 키 `prd-wizard:<project>`, 결정 변경 시 저장, 진입 시 복원(+stale 폐기), 반영 성공 시 삭제, 파싱 실패는 새 세션 폴백
- [x] 2.3 App.tsx 교체 배선 — PrdApprovalPanel → PrdApprovalWizard, [결정 반영하기]=기존 applyInChunks 재사용(성공/부분실패 고지 경로 그대로), 기존 PrdApprovalPanel.tsx 삭제(죽은 코드 금지)
- [x] 2.4 styles.css 위저드 스타일 — 진행바·점·카드 폭·요약. 기존 승인 패널 토큰(연두 보더·diff 배경) 재사용, 모바일(≤820px) 세로 스택 유지

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] 3.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 317 회귀 0 + 상태 모듈 신규) → UI 실픽셀(격리 픽스처: 진입 즉시 1건·결정 진행·건너뛰기·탈출구·요약·[결정 반영하기] 후 문서/큐 갱신·재진입 복원) 전부 PASS
  - 빌드: shared/server/web + vite 프로덕션 빌드 PASS. 타입체크: 3워크스페이스 clean. 린트: 프로젝트에 린터 미구성(`--if-present` 스킵, 검증 대상 없음). 테스트: 333/333 PASS(기존 317 + 신규 상태모듈 16, 회귀 0). UI 실픽셀: 격리 픽스처 + 헤드리스 브라우저로 7시나리오 관찰 PASS, 콘솔 에러 0.
