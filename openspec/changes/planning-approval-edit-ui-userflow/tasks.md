## Tasks

### Sequential: shared 타입 + 큐 lib (RED → GREEN, 의존 축)

- [x] 1.1 GREEN: `shared/src/user-flow-suggestion-types.ts` 신설 — `UserFlowSuggestion { id; op: 'add-edge'; from: string; to?: string; newNode?: { id: string; label: string }; edgeKind: 'happy' | 'edgecase'; label?: string; rationale?: string }`(to/newNode는 정확히 하나), `UserFlowSuggestionQueue { version: 1; suggestions: readonly UserFlowSuggestion[] }`. index 배럴 export.
- [x] 1.2 RED: `server/src/lib/__tests__/userFlowDocs.test.ts` 신설 — (a) 큐 읽기: 부재→빈 큐·깨진 JSON→빈 큐·무효 제안(필드 결손, to·newNode 둘 다/둘 다 없음) 필터 (b) 검증: from 부재·newNode id 기존 충돌(대소문자 무시)·라벨 `"`·`|`·개행 → skipped (c) 중복 에지(from·to·kind 동일 기존재) → skipped 멱등 (d) append가 첫 mermaid 블록 닫는 펜스 직전에 들어감 (e) 반려는 문서 바이트 불변 (f) self-roundtrip: 기존 노드·에지 보존+신규 에지 일치, **무력화 프로브**(방어 return true 강제 시 red).
- [x] 1.3 GREEN: `server/src/lib/userFlowDocs.ts` 신설 — `readUserFlowSuggestions(docsDir, stem)`(필터 포함), `applyUserFlowSuggestions(docsDir, stem, body: PrdApplyRequest): PrdApplyResult`(검증→append→self-roundtrip→쓰기, 위반 시 writeFailed·원본 보존). 재파싱은 `planningUserFlowBuilder`의 기존 라인 파싱 경로 소비만(파서 무수정). stem은 기존 `isSafeFlowToken` 게이트 재사용.

### Sequential: 라우트 (lib GREEN 의존)

- [x] 2.1 RED: 라우트 통합 테스트 — `GET .../planning-user-flow-suggestions?flow=<stem>` 목록·부재 빈 큐 200, `POST .../apply?flow=<stem>` 승인 반영(재조회 그래프에 에지)·반려 문서 불변·skipped 표면화·방어 위반 422·존재하지 않는 프로젝트/경로조작/무효 stem 404.
- [x] 2.2 GREEN: `server/src/routes/docs.ts`에 라우트 2개 — 기존 planning-* 프로젝트 해석·404 패턴과 6b-features apply 라우트(422) 패턴 재사용. 계약 = `PrdApplyRequest`/`PrdApplyResult` 재사용(신규 타입 금지).

### Parallel Group 1 (서버 완료 후 — 서로 다른 파일, 동시 실행 가능)

- [ ] 3.1 web fetch/apply: `web/src/api.ts`에 `fetchUserFlowSuggestions(project, flow)`·`applyUserFlowSuggestions(project, flow, body)` 추가. [parallel]
- [ ] 3.2 승인 패널: `web/src/UserFlowApprovalPanel.tsx` 신설 — FeatureApprovalPanel 구조 차용(빈 큐 null·개별/일괄·rationale), 카드에 from→to·실선/점선 표기·라벨. 신규 노드 제안은 "신규 화면" 뱃지. [parallel]

### Sequential: App 배선 (패널·API 완료 후)

- [ ] 4.1 `web/src/App.tsx` 유저플로우 탭 배선 — flow 탭 로드부에서 현재 stem 큐 fetch, 그래프 위에 패널 렌더, 승인/반려 콜백 → apply 후 유저플로우 그래프·큐 재조회(dashReqToken race 가드 기존 패턴), skipped 표면화 메시지. 버전(stem) 전환 시 해당 stem 큐로 갱신.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 5.1 VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(신규 단위·통합 + 무력화 프로브 포함, 기존 회귀 0) → UI: 실데이터(또는 픽스처 큐)로 유저플로우 탭 실픽셀 — 제안 카드 렌더, 승인→에지가 그래프에 실제 추가(점선 에지케이스 포함), 반려→문서 불변, 빈 큐 패널 미렌더, 콘솔 에러 0 전부 PASS
