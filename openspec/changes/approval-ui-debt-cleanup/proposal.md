# approval-ui-debt-cleanup

## Why

승인 패밀리(PRD·features·userflow) 리뷰 4회가 non-blocking으로 남긴 부채가 누적됐다. 특히 (a) PRD 승인 패널만 구식 레이아웃이라 3패널 UX가 비대칭이고, (b) 문서 write 성공 후 큐 재작성 write가 실패하면 문서는 변형됐는데 500만 뜨고 승인분이 큐에 고아로 남는다(userflow는 재승인 시 duplicate-edge로 영구 skipped — 정확히 지난 change가 없앤 "재시도 오경보"의 부활 경로). 리뷰가 반복 재기재한 잔여를 방치하면 다음 change마다 같은 지적이 복사된다 — 지금 한 번에 닫는다.

주의: 리뷰 잔여 목록 중 CRLF 보존은 approval-family-hardening에서 이미 해결됐음을 실측 확인(3-lib 전부 detectEol 경유) — 이 change 범위가 아니다.

## What Changes

- **PRD 승인 패널 3중 비대칭 해소** (web): 일괄 바를 배너 직후 상단으로 이동, 버튼 라벨에 건수 `(N건)` 표기, 카드 목록을 `feature-approval-list` 스크롤 캡 래퍼로 감쌈 — FeatureApprovalPanel/UserFlowApprovalPanel과 동일 구조로 통일. 기존 CSS 재사용, 신규 CSS 없음.
- **큐 재작성 write 실패 표면화** (server 3-lib 동형): 문서 패치 후 큐 prune write(`prunePrdQueue`/`pruneFeatureQueue`/`pruneUserFlowQueue`)가 throw하면 500 대신, 문서 반영은 성공했고 큐 정리만 실패했음을 apply 결과(`queuePruneFailed`)로 정직하게 고지. silent 500 + 부분 상태 은폐 금지.
- **큐 중복 id 유일성 필터** (server 3-lib 읽기 경로): 같은 id 제안 2건 + 승인 1회 → 에지 2줄 append되는 실측 결함(userflow 1차 리뷰 [낮음]) 차단 — 읽기 시 첫 항목만 유지.
- **web 위생 3건**: skipped 미리보기 매직 넘버 5 이중 인라인 상수화(App.tsx), api.ts 파일 중간 import 상단 이동+고아 주석 정리, 청크 실패 고지의 "재동기화" 단정 문구를 실동작에 맞게 정직화.
- **skip 사유 단언 강화** (tests): cd29898 커밋의 느슨한 skip 사유 단언 2건을 정확한 사유 문자열 매칭으로 박제(리뷰 3차·4차 계승 항목).

## Capabilities

### New Capabilities

(없음)

### Modified Capabilities

- `planning-prd-approval-apply`: 승인 패널 대량 큐 UI 요구(상단 일괄 바+건수+목록 캡)를 PRD 패널에도 적용, 큐 재작성 write 실패 시 부분반영 상태 고지 요구 추가
- `planning-features-approval-apply`: 큐 재작성 write 실패 시 부분반영 상태 고지, 큐 중복 id 유일성 요구 추가
- `planning-userflow-approval-edit`: 큐 재작성 write 실패 시 부분반영 상태 고지, 큐 중복 id 유일성 요구 추가

## Impact

- web: `web/src/PrdApprovalPanel.tsx`(레이아웃), `web/src/App.tsx`(상수화·고지 문구), `web/src/api.ts`(import 정리)
- server: `server/src/lib/docs.ts`·`featureDocs.ts`·`userFlowDocs.ts`(prune try/catch + 결과 필드, 읽기 dedup)
- shared: apply 결과 타입에 `queuePruneFailed?: boolean` 추가(additive — 기존 소비자 무영향)
- 테스트: 기존 311개 회귀 0 + 신규(write 실패 주입·중복 id·단언 강화)
- 명시적 Non-Goal(후속 change): 상세 패널 연결화면 딥링크 / 타 프로젝트 change 5종뷰 404(라우트 프로젝트 파라미터화) / cors·인증 / 파일 락·원자적 write 헬퍼 / web 테스트 러너 도입
