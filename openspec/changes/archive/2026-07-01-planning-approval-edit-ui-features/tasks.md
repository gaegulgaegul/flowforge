## Tasks

### Sequential: 기초 — shared 타입 (선행 필수, 모든 후속이 의존)
- [x] shared `feature-suggestion-types.ts` 신설 — `FeatureSuggestion`(id·nodePath: string[]·op:"set-attrs"·priority?: FeaturePriority·status?: FeatureStatus·rationale?)·`FeatureSuggestionQueue`(version:1·suggestions[]). 기존 `FeaturePriority`/`FeatureStatus`(feature-tree-types) import 재사용. 6a `PrdApplyRequest`/`PrdApplyResult`는 그대로 재사용(apply body/result 형태 동일)이라 신설 안 함. `shared/src/index.ts`에 export 추가.

### Parallel Group 1 (독립 - 서로 다른 파일, 동시 실행 가능)
- [x] RED: `server/src/lib/__tests__/docsFeatureApproval.test.ts` 신설 — `readDocsFeatureSuggestions` 4케이스(정상/파일없음→빈큐/깨진JSON→빈큐/미인식 op·빈속성·부정 nodePath·화이트리스트밖 값 필터)·`writeDocsPlanningFeaturesAttrs` 6케이스(단일 노드 속성교체+산문/capability/서문 보존/속성줄 없는 노드 삽입/미실재 nodePath 스킵/불변식위반(노드수변함)→안씀/파싱실패→안씀)·`applyFeatureSuggestions` 4케이스(승인 반영/반려 제거·원본 불변/skipped 표면화/writeFailed 구분). 임시 픽스처 `<root>/<project>/docs/planning/{features.md,features.suggestions.json}`. [parallel]
- [x] SKILL.md 갱신: `openspec-plan/SKILL.md`(agentic-harness 소스)에 "features 속성 갱신 제안 → `features.suggestions.json`에 FeatureSuggestion(nodePath·set-attrs·priority/status)으로 쌓기 → flowforge UI에서 승인" 절차 명문화(6a PRD 절차의 features판). 직접 features.md 덮어쓰기 대신 제안 큐 경유임을 명시. [parallel]

### Sequential: server lib GREEN (같은 lib/docs.ts — 순차)
- [x] GREEN: `lib/docs.ts`에 `readDocsFeatureSuggestions(docsDir): FeatureSuggestionQueue` — `docs/planning/features.suggestions.json` existsSync 가드 + JSON.parse try/catch(실패→빈 큐)·`isValidFeatureSuggestion`로 항목 필터(op="set-attrs"·nodePath 문자열배열·priority/status 화이트리스트·둘 중 최소 1개 존재). throw 금지. 6a `readDocsPrdSuggestions` 패턴 복제.
- [x] GREEN: `lib/docs.ts`에 `writeDocsPlanningFeaturesAttrs(docsDir, patches: {nodePath, priority?, status?}[]): boolean` — features.md 원문 라인스캔으로 각 nodePath 대상 헤더(RE_HEADER 레벨+텍스트 매칭, 전체 경로로 유일성) 찾아 **직후 속성 줄(RE_ATTRS)만** 새 `(중요도:…, 상태:…)`로 교체(없으면 헤더 직후 삽입). 서문·산문·capability 주석·다른 줄 슬라이스 보존. **write 전 self-roundtrip**: buildDocsPlanningFeatures로 재파싱해 노드 개수·capability 키집합 불변 + 대상 노드 속성만 변경 검증 실패 시 false(안 씀). 미실재 nodePath는 patches에서 스킵. featureTreeBuilder의 RE_HEADER/RE_ATTRS와 정합.
- [x] GREEN: `lib/docs.ts`에 `applyFeatureSuggestions(docsDir, req: PrdApplyRequest): PrdApplyResult` — 큐 읽기→approve id의 nodePath→속성 patch 목록 구성→writeDocsPlanningFeaturesAttrs 호출(실패=writeFailed·큐 보존)→approve+reject id 큐에서 제거하고 재작성→결과. 미실재 id/nodePath는 skipped. 6a `applyPrdSuggestions` 골격 재사용(replacements 조립→트리 patch 조립으로 교체).

### Parallel Group 2 (server lib 완료 후 - 서로 다른 파일, 동시 실행 가능)
- [x] RED: `server/src/routes/__tests__/docsFeatureApproval.test.ts` 신설 — `GET planning-features-suggestions`(200/빈큐/경로조작404)·`POST .../apply`(200 applied·rejected·remaining·skipped/400 잘못된body/404 경로조작/422 불변식위반). [parallel]
- [x] GREEN: `routes/docs.ts`에 `GET /api/docs/:project(*)/planning-features-suggestions`(resolveDocsDir 재사용, readDocsFeatureSuggestions, 빈 큐도 200) 라우트 추가. [parallel]

### Sequential: server 라우트 통합 GREEN
- [x] GREEN: `routes/docs.ts`에 `POST /api/docs/:project(*)/planning-features-suggestions/apply` — resolveDocsDir 404·isPrdApplyRequest(6a 재사용) 400·applyFeatureSuggestions 호출·writeFailed 422·결과 JSON. (GET과 같은 파일이라 순차)

### Parallel Group 3 (백엔드 API 완료 후 - 서로 다른 파일, 동시 실행 가능)
- [x] GREEN: `web/src/api.ts`에 `fetchDocsFeatureSuggestions(project)`·`applyDocsFeatureSuggestions(project, {approve,reject})` 2함수 추가(6a fetch/apply 패턴 재사용, 422 메시지 명확화). [parallel]
- [x] GREEN: `web/src/FeatureApprovalPanel.tsx` 신설 — 6a PrdApprovalPanel 구조 참고, diff는 노드별 [현재 중요도/상태 → 제안 중요도/상태] before/after 카드(nodePath 경로 표시)+개별 [승인]/[반려]+하단 일괄, 큐 비면 null. [parallel]

### Sequential: web UI 통합 GREEN (App.tsx — features 섹션)
- [x] GREEN: skeleton 단계 features 섹션에 승인 UI 배선 — featureSuggestions 제안 큐 fetch(dashReqToken race 가드)·큐 ≥1건이면 FeatureApprovalPanel(트리 위)+개별/일괄 승인반려, 큐 비면 순수 읽기 트리 뷰. 승인·반려 제출→applyDocsFeatureSuggestions→features·큐 재조회. prototype.html 흐름을 React로 번역. featureApplyBusy 중복클릭 가드.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [x] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(server 단위·통합 신규 포함) → UI(Playwright 실픽셀: 로컬 DOCS_ROOT에 도그푸딩 features.md+features.suggestions.json 픽스처 심고 flowforge 기동 → 제안 큐 렌더·개별 승인→features.md 속성줄 교체 반영·산문/capability 보존·반려→원본 불변·큐 비면 순수 읽기 트리 뷰 전환을 실제 클릭+재조회로 관찰) 전부 PASS. 검증 서버는 PID 지정 kill. 픽스처 changeCount≥1 카드 조건 충족.
