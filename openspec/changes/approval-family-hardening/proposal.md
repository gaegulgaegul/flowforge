# 승인 편집 패밀리 공통 부채 정리 (6a·6b hardening)

## Why

6a(PRD)·6b-features·6b-userflow 승인 편집을 잇달아 리뷰하면서, 개별 change에선 non-blocking으로 분류됐지만 **패밀리 공통이라 한 번에 고치는 게 맞는** 부채 5건이 누적됐다(전부 3차 review까지의 실측/정적 발견, 출처: `2026-07-05-planning-approval-edit-ui-userflow/review.md` 등). 사용자 확정 범위(2026-07-05 명섭 3번 — 로드맵 ④-b).

## What Changes

1. **CRLF 보존**: `featureDocs`·`userFlowDocs`가 `split(/\r?\n/)`→`join("\n")`으로 CRLF 문서를 apply 한 번에 전체 LF로 조용히 변환(실측). 원문 개행 스타일을 감지해 그대로 보존한다 — "한 줄만 패치" 계약을 바이트 수준까지.
2. **큐 clobber 완화**: apply가 시작 시점 큐 스냅샷을 통째로 재작성해, apply 진행 중 AI가 추가한 신규 제안이 흔적 없이 삭제될 수 있다(정적). 큐 재작성 직전에 파일을 재독해 **처리한 id만 제거**하는 방식으로 교체(6a·6b-features·6b-userflow 3곳 공통).
3. **apply 배치 상한**: prd/features/userflow apply 라우트에 approve+reject 합계 상한(예: 200)을 두고 초과는 400 — 사이드카 큐 경유 무상한 배치가 동기 재파싱(O(n²) 실측 866ms@400)으로 이벤트 루프를 막는 가용성 리스크 차단.
4. **mermaid 블록 판별 단일화**: `userFlowDocs.firstMermaidCloseIdx`(startsWith — ```` ```mermaid-example ````도 매칭)와 파서 `extractMermaid`(정규식)가 두 벌로 어긋나, example 블록이 앞서면 유효 제안 전부가 오도 사유(`label-not-parse-safe`)로 skipped(실측). 블록 판별을 파서 쪽 한 곳으로 단일화해 소비.
5. **대량 큐 UI 캡**: 승인 패널(Feature·UserFlow 공통)에 max-height+overflow 스크롤과 일괄 버튼 상단 고정 — 카드 100건이 ~13,000px로 늘어져 일괄 버튼이 가장 멀어지는 역설(실측 스크린샷) 해소.

**Non-Goals**: 중복 id 큐 필터·라벨 길이 상한·에러 메시지 String(e) 정리(낮음 — 후속 묶음), 원자적 write(temp+rename — 코드베이스 전반 패턴이라 별도 결정), skipped 인라인 배너 UX 개선, 에지 삭제/수정 op.

## Capabilities

### Modified Capabilities
- `planning-prd-approval-apply`: apply 배치 상한 + 큐 재독 후 처리분만 제거(스냅샷 clobber 제거) + CRLF 보존. 승인/반려/skipped 의미는 무변경.
- `planning-features-approval-apply` (main spec 키: planning-approval-edit 계열 — 실제 키는 openspec/specs에서 확인해 맞춘다): 동일 3건.
- `planning-userflow-approval-edit`: 동일 3건 + mermaid 블록 판별 단일화(오도 사유 해소).

### New Capabilities
<!-- 없음 — 전부 기존 능력의 견고화(요구 강화). -->

## Impact

- **수정 server**: `lib/docs.ts`(prd apply)·`lib/featureDocs.ts`·`lib/userFlowDocs.ts`(개행 보존·큐 재독·블록 판별 소비), `routes/docs.ts`(배치 상한 3곳), `parser/planningUserFlowBuilder.ts`에 블록 판별 export 추가(파싱 로직 무변경 — 기존 내부 함수 노출만. 골든 무관 확인됨).
- **수정 web**: `styles.css`(패널 캡·overflow)·승인 패널 2곳(일괄 바 상단 이동 시).
- **테스트**: CRLF 왕복·clobber(적용 중 추가분 생존)·상한 400·example 블록 선행 문서 정상 apply — 각 RED 신설. 기존 283+ 회귀 0.
- **🔴 수정 금지**: `specParser`·`flowBinder`·`graphBuilder`·`__golden__/`·apply 계약(PrdApplyRequest/Result)·기존 라우트 경로.
- **의존성**: 신규 npm 패키지 없음.
