# design — approval-family-hardening

## Context

6a/6b 승인 편집 3종(prd `lib/docs.ts`·features `lib/featureDocs.ts`·userflow `lib/userFlowDocs.ts`)이 같은 골격(사이드카 큐 read → 승인분 문서 패치 → 큐 재작성)을 공유하며, 리뷰 실측이 잡은 공통 부채 5건이 남아 있다. 출처는 6b-userflow 3차 review.md(패밀리 공통 부채로 분류된 non-blocking들).

## Goals / Non-Goals

**Goals:** 5건(CRLF·clobber·배치 상한·블록 판별 단일화·대량 큐 UI 캡)을 한 change로 견고화. 승인/반려/skipped 의미·API 계약 무변경.

**Non-Goals:** proposal 참조. 특히 **3개 lib의 공통 골격 추상화는 하지 않는다** — 문서 구조가 달라(섹션 교체/속성 줄/에지 append) 억지 공통화는 6b-userflow design이 이미 기각한 결정.

## Decisions

- **D-1 개행 보존 = 감지 후 재사용**: 파일 읽을 때 첫 `\r\n` 존재 여부로 EOL을 감지, `join` 시 그 EOL로 되돌린다(혼합 개행은 다수결이 아니라 "첫 감지" — 결정론). 패치 줄 자체도 같은 EOL. 3개 lib 각각 같은 헬퍼 패턴(공통 유틸 1개는 허용 — 골격 추상화가 아니라 순수 문자열 함수).
- **D-2 큐 재작성 = 재독 후 차집합**: 시작 스냅샷을 기준으로 검증·패치하되, **쓰기 직전에 큐 파일을 재독**해 `처리된 id(approved+rejected)`만 제거하고 나머지(재독본에만 있는 신규 제안 포함)를 보존한다. 완전한 락은 아니지만(파일 락 없음 — 로컬 단일 사용자 전제) "apply 중 추가분 통삭제"라는 silent drop 창을 닫는다. 검증 자체는 스냅샷 기준 유지(재독본으로 검증을 다시 하지 않는다 — 승인 대상은 사용자가 화면에서 본 그 제안).
- **D-3 배치 상한 = 라우트 레벨 200**: `approve.length + reject.length > 200` → 400(`batch_too_large`). lib가 아닌 라우트에서 자르는 이유: 상한은 HTTP 표면의 방어이고 lib는 순수 로직 유지. 3 라우트 동일 상수 공유.
- **D-4 블록 판별 단일화 = 파서가 export**: `planningUserFlowBuilder`의 기존 mermaid 블록 추출 로직을 라인 인덱스 반환 형태로 export(`findFirstMermaidBlock(lines) → { openIdx, closeIdx } | null` — 내부 파싱은 무변경, 노출만). `userFlowDocs.firstMermaidCloseIdx`는 삭제하고 이를 소비 → append 위치와 파싱 대상이 항상 같은 블록. ```` ```mermaid-example ```` 선행 문서에서 유효 제안이 정상 반영되는 회귀 테스트 신설.
- **D-5 패널 UI 캡 = CSS 우선**: 카드 목록에 `max-height: 60vh; overflow-y: auto`, 일괄 바를 목록 밖(배너 옆 상단)으로 이동. Feature·UserFlow 패널이 같은 `feature-approval` 클래스 계열을 쓰므로 CSS 한 곳 + 패널 2곳 마크업 순서만.

## Risks / Trade-offs

- D-2는 락이 아니다 — 동시 apply 2건이 겹치면 여전히 후자 승리. 로컬 단일 사용자 전제에서 실질 위험은 "AI 생산자 vs 사람 apply"의 창이며 그건 닫힌다. 완전 해결(파일 락/원자적 rename)은 Non-Goal로 명시.
- D-4에서 파서 export 추가는 파서 파일 수정이지만 파싱 동작 무변경(기존 내부 로직 노출) — planningUserFlowBuilder 단위 테스트가 회귀 게이트.

## 화면 구성 / UI

- 신규 화면 없음 — 기존 승인 패널 2곳의 스크롤 캡과 일괄 바 위치만. 프로토타입 스크립트 판정에 따름.
