## Tasks

### Sequential: 블록 판별 단일화 (파서 export → userFlowDocs 소비)

- [x] 1.1 RED: `planningUserFlowBuilder` 단위 테스트에 `findFirstMermaidBlock` — (a) 정상 블록 open/close 인덱스 (b) ```` ```mermaid-example ```` 선행 시 진짜 블록을 가리킴 (c) 블록 없음 null. `userFlowDocs` 테스트에 example 블록 선행 문서에서 유효 제안 정상 apply(오도 skipped 아님) 회귀.
- [x] 1.2 GREEN: `parser/planningUserFlowBuilder.ts`에 기존 블록 추출 로직을 `findFirstMermaidBlock(lines)`로 export(파싱 동작 무변경 — 노출만, 기존 단위 테스트 회귀 0). `lib/userFlowDocs.ts`의 `firstMermaidCloseIdx` 제거하고 이를 소비.

### Sequential: 개행 보존 (공통 문자열 유틸 + 3 lib)

- [x] 2.1 RED: 3개 lib 테스트 각각에 CRLF 문서 왕복 — apply 후 기존 줄 CRLF 보존 + 패치/append 분만 변경(바이트 단언).
- [x] 2.2 GREEN: EOL 감지·복원 유틸(순수 함수 1개, D-1 "첫 감지" 결정론) 신설 후 `lib/docs.ts`(prd apply)·`lib/featureDocs.ts`·`lib/userFlowDocs.ts`의 split/join 지점에 적용.

### Sequential: 큐 clobber 완화 (3 lib)

- [x] 3.1 RED: 3개 lib 테스트 각각에 — apply 시작 스냅샷 이후 큐 파일에 신규 제안을 끼워 넣고 apply 완료 시 신규분 생존(처리 id만 제거) 단언.
- [x] 3.2 GREEN: 큐 재작성 직전 재독 후 차집합(D-2) — 검증은 스냅샷 기준 유지.

### Parallel Group 1 (서버 완료 후 — 서로 다른 파일, 동시 실행 가능)

- [x] 4.1 배치 상한: `routes/docs.ts` apply 3곳에 공유 상수(200) 게이트, 초과 400 `batch_too_large` — 라우트 통합 테스트(201건→400·문서/큐 불변, 200건→정상) 포함. [parallel]
- [x] 4.2 패널 UI 캡: `styles.css` 카드 목록 max-height 60vh+overflow-y, Feature·UserFlow 패널의 일괄 바를 배너 옆 상단으로 이동. [parallel]

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 5.1 VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(신규 RED 전부 + 기존 283+ 회귀 0) → UI: 대량 픽스처 큐(100건)로 패널 스크롤 캡·일괄 바 상단 실픽셀, 승인·반려 기존 흐름 회귀 없음, 콘솔 에러 0 전부 PASS
