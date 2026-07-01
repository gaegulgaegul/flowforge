## Tasks

### Sequential: 기초 — shared 타입 (선행 필수, 모든 후속이 의존)
- [x] shared `prd-suggestion-types.ts` 신설 — `PrdSuggestion`(id·section: PrdSectionKey·op:"replace"·proposedBody·rationale?)·`PrdSuggestionQueue`(version:1·suggestions[])·`PrdApplyRequest`(approve:string[]·reject:string[])·`PrdApplyResult`(applied·rejected·remaining·skipped[]). 기존 `PrdSectionKey` import 재사용(새 어휘 안 만듦). `shared/src/index.ts`에 export 추가.

### Parallel Group 1 (독립 - 서로 다른 파일, 동시 실행 가능)
- [x] RED: `server/src/lib/__tests__/docsPrdApproval.test.ts` 신설 — `readDocsPrdSuggestions` 4케이스(정상/파일없음→빈큐/깨진JSON→빈큐/미인식 section·op 필터)·`writeDocsPlanningPrd` 4케이스(단일섹션 교체+나머지 보존/H1 title 서문 보존/미실재 섹션 스킵/파싱실패→안 씀)·`applyPrdSuggestions` 4케이스(승인 반영/반려 제거·원본 불변/skipped 표면화/같은 섹션 순서 결정론). 임시 픽스처 `<root>/<project>/docs/planning/{prd.md,prd.suggestions.json}`. [parallel]
- [x] SKILL.md 갱신: `openspec-plan/SKILL.md`(agentic-harness 소스)에 "PRD 갱신 제안 → `prd.suggestions.json`에 PrdSuggestion으로 쌓기 → flowforge UI에서 승인" 절차 명문화(line 234 미구현 항목 채움). 직접 prd.md 덮어쓰기 대신 제안 큐 경유임을 명시. [parallel]

### Sequential: server lib GREEN (같은 lib/docs.ts — 순차)
- [x] GREEN: `lib/docs.ts`에 `readDocsPrdSuggestions(docsDir): PrdSuggestionQueue` — `docs/planning/prd.suggestions.json` existsSync 가드 + JSON.parse try/catch(실패→빈 큐)·`isValidPrdSuggestion`로 항목 필터(section 5키·op="replace"만). throw 금지. (overlay read 패턴 참고)
- [x] GREEN: `lib/docs.ts`에 `writeDocsPlanningPrd(docsDir, replacements: Partial<Record<PrdSectionKey,string>>): boolean` — 원본 prd.md 읽어 **첫 H2(`## 개요`) 앞 서문(H1 title 포함) 그대로 보존** + 5섹션(splitSections 역방향)을 고정순서로 조립, replacements에 있는 섹션만 교체. 5섹션 파싱 실패 시 false(안 씀). 원자적 전체 문자열 1회 write. `buildDocsPlanningPrd`의 한국어 섹션 제목과 정합.
- [x] GREEN: `lib/docs.ts`에 `applyPrdSuggestions(docsDir, req: PrdApplyRequest): PrdApplyResult` — 큐 읽기→approve id의 section→proposedBody 맵 구성(같은 섹션은 배열 순서 뒤가 이김)→writeDocsPlanningPrd 호출(실패=반영0·skipped 표면화)→approve+reject id를 큐에서 제거하고 큐 재작성→결과 반환. 미실재 id·미실재 섹션은 skipped.
- [x] GREEN: `lib/docs.ts`에 `isPrdApplyRequest(v):v is PrdApplyRequest` 런타임 검증(approve·reject가 string[]인지) — `isLayoutOverlay` 패턴 복제.

### Parallel Group 2 (server lib 완료 후 - 서로 다른 파일, 동시 실행 가능)
- [x] RED: `server/src/routes/__tests__/docsPrdApproval.test.ts` 신설 — `GET planning-prd-suggestions`(200/빈큐/경로조작404)·`POST .../apply`(200 applied·rejected·remaining·skipped/400 잘못된body/404 경로조작/422 파싱실패). [parallel]
- [x] GREEN: `routes/docs.ts`에 `GET /api/docs/:project(*)/planning-prd-suggestions`(resolveDocsDir 재사용, readDocsPrdSuggestions, 빈 큐도 200) 라우트 추가. [parallel]

### Sequential: server 라우트 통합 GREEN
- [x] GREEN: `routes/docs.ts`에 `POST /api/docs/:project(*)/planning-prd-suggestions/apply` — resolveDocsDir 404·isPrdApplyRequest 400·applyPrdSuggestions 호출·파싱실패 422·결과 JSON 반환. (GET과 같은 파일이라 순차)

### Parallel Group 3 (백엔드 API 완료 후 - 서로 다른 파일, 동시 실행 가능)
- [x] GREEN: `web/src/api.ts`에 `fetchDocsPrdSuggestions(project)`·`applyDocsPrdSuggestions(project, {approve,reject})` 2함수 추가(기존 fetch 패턴 재사용). [parallel]
- [x] RED: `web/src/__tests__` 없으면 스킵 — web은 실픽셀 verify로 검증(프론트 테스트러너 부재는 기존과 동일). 승인 UI 컴포넌트 로직은 최소화. [parallel]

### Sequential: web UI 통합 GREEN (App.tsx + PrdPanel — 같은 흐름)
- [x] GREEN: skeleton 단계 PRD 섹션에 승인 UI — 제안 큐 fetch(dashReqToken race 가드)·큐 ≥1건이면 섹션별 제안 카드(현재 vs 제안)+개별 [승인]/[반려]+하단 [모두 승인]/[모두 반려], 큐 비면 순수 읽기 뷰. 승인·반려 제출→applyDocsPrdSuggestions→PRD·큐 재조회. `PrdPanel` 확장 또는 승인 래퍼 컴포넌트. prototype.html 흐름을 React로 번역.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [x] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(server 단위·통합 신규 포함) → UI(Playwright 실픽셀: 로컬 DOCS_ROOT에 도그푸딩 prd.md+prd.suggestions.json 픽스처 심고 flowforge 기동 → 제안 큐 렌더·개별 승인→prd.md 섹션 교체 반영·반려→원본 불변·큐 비면 순수 읽기 뷰 전환을 실제 클릭+재조회로 관찰) 전부 PASS. 검증 서버는 PID 지정 kill.
