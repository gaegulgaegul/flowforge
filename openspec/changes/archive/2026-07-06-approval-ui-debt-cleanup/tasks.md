# approval-ui-debt-cleanup — tasks

## Tasks

### Sequential: shared 타입 (선행 필수)

- [x] 1.1 shared apply 결과 타입(prd/features/userflow)에 `queuePruneFailed?: true` 추가 — additive, 기존 소비자 무영향 확인(타입체크)

### Parallel Group 1 (server 3-lib RED — 서로 다른 테스트 파일, 독립 동시 실행 가능)

- [x] 2.1 RED prd: prune write 실패 주입 시 apply가 200+`queuePruneFailed` 반환 + 중복 id 큐 읽기 1건 유지 테스트 (docsPrdApproval 테스트 파일) [parallel]
- [x] 2.2 RED features: 동형 2건 (featureDocs 테스트 파일) [parallel]
- [x] 2.3 RED userflow: 동형 2건 + 중복 id 승인 1회=에지 1줄 + cd29898 느슨 skip 사유 단언 2건을 정확 `"<id>: <reason>"` 문자열로 강화 (userFlowDocs 테스트 파일) [parallel]

### Parallel Group 2 (server 3-lib GREEN — 서로 다른 소스 파일, 독립 동시 실행 가능)

- [x] 3.1 GREEN docs.ts: `prunePrdQueue` 호출 try/catch → 결과에 `queuePruneFailed`, `readDocsPrdSuggestions`에 id 유일성 필터(첫 항목 승리) [parallel]
- [x] 3.2 GREEN featureDocs.ts: 동형 (`pruneFeatureQueue`·read 필터) [parallel]
- [x] 3.3 GREEN userFlowDocs.ts: 동형 (`pruneUserFlowQueue`·read 필터) [parallel]

### Parallel Group 3 (web — 서로 다른 파일, server GREEN 후 동시 실행 가능)

- [x] 4.1 PrdApprovalPanel.tsx: 일괄 바 배너 직후 상단 이동 + 버튼 라벨 `(N건)` + 목록 `feature-approval-list` 래퍼 — FeatureApprovalPanel 구조 그대로 이식, 신규 CSS 0 (기존 클래스 재사용) [parallel]
- [x] 4.2 App.tsx: 3경로 apply 응답의 `queuePruneFailed` 고지 배선("문서에는 반영됐지만 큐 정리 실패 — 같은 제안이 다시 보이면 반려로 정리") + skipped 미리보기 매직 넘버 5 → `SKIPPED_PREVIEW_CAP` 상수 단일화 + 청크 실패 "재동기화" 단정 문구를 실동작(재조회) 서술로 정직화 [parallel]
- [x] 4.3 api.ts: 파일 중간 import 상단 이동 + 고아 주석 정리 (동작 무변경 — 구조 커밋 분리) + applyInChunks가 청크별 queuePruneFailed를 OR로 합산(무시 시 부분반영 은폐 — 4.2 배선의 전제) [parallel]

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [~] 5.1 VERIFY: 5단계 게이트 — 빌드 PASS(shared/server/web tsc+vite EXIT0) · 타입체크 PASS(strict tsc, 빌드에 포함) · 린트 PASS(워크스페이스 lint 스크립트 부재 → --if-present no-op EXIT0) · 테스트 PASS(server 28 suites 317, 기존 311 회귀 0 + 신규 6) · **UI 실픽셀 미실행(환경 제약: 헤드리스 브라우저 미설치 + curl 권한 차단)** → 대체로 소스 구조 검증: 3패널 JSX 대칭(feature-approval-bulk 상단+(N건)+feature-approval-list) 확인, CSS 번들 바이트 동일(index-Dy40K0Hk.css 34.47kB 무변경)로 신규 CSS 0 실증. **사람 실픽셀 확인 권장(러너/브라우저 있는 환경).**
