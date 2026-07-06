# approval-ui-debt-cleanup — design

## Context

승인 패밀리 3경로(PRD 섹션 교체 / features 속성 패치 / userflow 에지 append)는 같은 골격을 공유한다: 사이드카 큐 읽기 → 결정론 검증 → 문서 패치 write → 큐 prune write. approval-family-hardening까지의 리뷰 4회가 non-blocking으로 남긴 잔여 중, 실측으로 현존이 확인된 것만 이 change가 다룬다(2026-07-06 조사, file:line 검증).

현재 상태(증거):

- `web/src/PrdApprovalPanel.tsx:90-109` — 일괄 바가 목록 하단, 버튼에 건수 없음, 목록 캡 래퍼 없음. features(`FeatureApprovalPanel.tsx:108-129`)·userflow(`UserFlowApprovalPanel.tsx:64-85`)는 상단 바+`(N건)`+`feature-approval-list` 래퍼.
- 문서 write → 큐 prune write 순서(무보호): `docs.ts:266→320`, `featureDocs.ts:252→269`, `userFlowDocs.ts:269→287`. prune 내부 write(`docs.ts:331-335`·`featureDocs.ts:275-279`·`userFlowDocs.ts:298-302`)가 throw하면 문서는 변형됐는데 라우트 safe()가 500으로 삼켜 부분 상태가 은폐된다.
- 큐 읽기 3곳(`readDocsPrdSuggestions`·features·userflow 동형)은 `filter(isValid*)`만 하고 id 유일성 검증 없음 — 같은 id 2건+승인 1회면 userflow는 에지 2줄 append(1차 리뷰 실측).
- `web/src/App.tsx:538-539` skipped 미리보기 상한 5가 인라인 이중, `web/src/api.ts:185-187` 파일 중간 import, 청크 실패 고지가 "재동기화했습니다"로 단정(실제로는 재조회 시도).

## Goals / Non-Goals

**Goals:**

- 3패널 승인 UX 완전 대칭(PRD 패널을 features/userflow 구조로 통일)
- 큐 prune write 실패의 정직한 표면화 — 문서 반영 성공/큐 정리 실패의 부분 상태를 결과로 고지
- 큐 중복 id로 인한 이중 반영 차단(읽기 시 유일성)
- 리뷰가 재기재해 온 web 위생 3건·느슨한 단언 2건 종결

**Non-Goals:**

- 상세 패널 연결화면 딥링크(후속 change — 원 change가 Non-Goal로 선언한 기능 추가)
- 타 프로젝트 change 5종뷰 404(라우트 프로젝트 파라미터화 — 후속 change)
- cors 와일드카드·인증(모든 리뷰가 별도 change 권고 — 실제 공격 경로라 따로)
- 파일 락·원자적 write(temp+rename) 헬퍼 — 로컬 단일 사용자 전제, 골격 추상화 금지 방침 유지
- web 테스트 러너 도입(별도 결정 필요)
- CRLF 보존 — family-hardening에서 이미 해결(재작업 금지)

## Decisions

- **D-1 PRD 패널은 구조 이식, 신규 스타일 금지.** `feature-approval-list` 래퍼·상단 일괄 바·`(N건)` 라벨을 FeatureApprovalPanel과 동일 구조로 가져온다. `prd-approval-*` 카드 내부 클래스는 유지(카드 내용 구조는 PRD 고유 — 섹션 diff 뷰). CSS 추가 0을 게이트로 삼는다.
- **D-2 prune 실패는 throw 대신 결과 필드.** 3-lib의 prune 호출부를 try/catch로 감싸고 apply 결과에 `queuePruneFailed?: true`(additive, shared 타입)를 실어 라우트가 200으로 반환한다 — 문서 패치는 이미 성공했으므로 500은 거짓말이다. web은 이 필드를 보고 "문서엔 반영됐지만 큐 정리에 실패했습니다 — 같은 제안이 다시 보이면 반려로 정리하세요"를 고지한다. 문서 write 자체의 실패는 기존대로 예외(500) — 그건 진짜 실패다.
- **D-3 중복 id는 읽기 경계에서 첫 항목 승리.** 3개 read 함수에 `Set` 기반 유일성 필터 1줄(동형). 쓰기 측 방어(생산자 수정)는 하지 않는다 — 생산자는 외부(AI 스킬)라 신뢰 경계 밖이고, 소비 경계 방어가 3경로를 한 번에 덮는다.
- **D-4 고지 문구는 실동작 서술.** "재동기화했습니다"(단정) → "화면을 다시 불러왔습니다. 목록이 실제 상태입니다" 계열로, 코드가 실제 하는 일(재조회)만 말한다. 매직 넘버 5는 `SKIPPED_PREVIEW_CAP` 상수 1곳.
- **D-5 단언 강화는 기존 테스트 수선.** cd29898의 skip 사유 단언 2건을 정확 문자열(`"<id>: <reason>"` 형식) 매칭으로 조인다. 신규 테스트 파일 없이 해당 테스트만.

## 화면 구성 / UI

- PRD 승인 패널 구조 변경의 화면 흐름 명세는 `prototype.html`을 단일 출처로 한다(DESIGN.md 부재 → 와이어프레임). **이 HTML은 명세이지 구현물이 아니다** — 실제 구현은 기존 React 컴포넌트(FeatureApprovalPanel 구조 이식)로 번역한다. 목록 캡·상단 일괄 바·건수 표기의 시각 기준은 이미 라이브에 있는 features/userflow 패널이 1차 기준이다.

## Risks / Trade-offs

- `queuePruneFailed`를 200으로 반환하므로 이 필드를 무시하는 소비자는 실패를 모른다 → web 고지 배선을 같은 change에서 완결하고, 시나리오로 박제한다.
- 중복 id 첫 항목 승리는 뒤 항목이 "다른 내용의 같은 id"일 때 조용히 버린다 — 큐 생산 규약상 id는 유일해야 하므로 정당하나, 사유를 알 수 없다는 트레이드오프(로그 없음, 로컬 전제 수용).
- PRD 패널 구조 변경은 web 자동 테스트 사각(러너 부재)이라 실픽셀 검증에 의존 — verify에서 3패널 나란히 실증 필수.
