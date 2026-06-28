## Tasks

### Sequential: 전용 타입 신설 (선행 필수 — server/web 둘 다 의존)
- [x] GREEN: `shared/src/feature-tree-types.ts` 신설 — `FeatureTree`/`FeatureNode`(kind: requirement|feature|detail, label, capability?(요구사항만), priority, status, children). 기존 spec-tree-types.ts는 무수정(분리). shared index에 export 추가.

### Parallel Group 1 (타입 후 — 서로 다른 파일/레이어, 동시 실행 가능)
- [x] RED: `server/src/parser/__tests__/featureTreeBuilder.test.ts` — features.md 픽스처를 3단 FeatureTree로 파싱(capability 주석 `<!-- capability: x -->`→requirement.capability, `(중요도: 높음, 상태: 진행중)`→priority/status, 3단 위계, 파일 없으면 null). 임시 디렉토리 픽스처 [parallel]
- [x] RED: `server/src/routes/__tests__/docs.test.ts`에 planning-features 통합 케이스 추가 — features.md 있는 프로젝트 200+tree, 파일없음 404, 경로조작 404 [parallel]
- [x] GREEN: openspec-plan SKILL.md(agentic-harness 소스)에 "기능명세서 생성" 단계 추가 — PRD 다음 의존성 순서, features.md 스키마(3단 위계 ##/###/#### + capability 주석 + 중요도/상태 속성) 명문화. 다른 레포라 flowforge 파일과 독립 [parallel]

### Sequential: server GREEN (featureTreeBuilder + 라우트 — RED 통과)
- [x] GREEN: `server/src/parser/featureTreeBuilder.ts` 신설 — `buildDocsPlanningFeatures(docsDir)`가 `docs/planning/features.md`를 헤더 레벨(##/###/####) 순차 파싱으로 FeatureTree 빌드. capability 주석·`(중요도/상태)` 정규식 추출. 파일 없으면 null. 예상 밖 깊이는 throw 없이 safe 처리(markdown.ts 라인 인식 참고). 테스트 실패 시 추측 금지·근본원인부터
- [x] GREEN: `server/src/routes/docs.ts`에 `GET /api/docs/:project(*)/planning-features` 추가 — resolveDocsDir 재사용(경로안전), buildDocsPlanningFeatures 호출, null이면 404, `{ project, tree }` 반환(예광탄 planning-prd 라우트 패턴 복제). safe() 래퍼

### Parallel Group 2 (server 완료 후 — 서로 다른 파일, 동시 실행 가능)
- [x] GREEN: web `FeatureNode.tsx` + `featureTreeAdapter.ts` 신설 — FeatureTree→ReactFlow nodes/edges(specTreeAdapter dagre LR 로직 내부 참고, 전용 유지). kind별 구분 + priority/status 시각화(색/뱃지) + 요구사항 capability 키 표시. SpecTreeNode/specTreeAdapter 무수정 [parallel] [frontend-agent]
- [x] GREEN: web `api.ts`에 `fetchDocsPlanningFeatures(project)` + `App.tsx`에 기능명세 뷰 배선(planning features state, 탭/표시). change spec-tree 렌더 무영향 [parallel] [frontend-agent]

### Sequential: 도그푸딩 (세로관통 실증)
- [x] GREEN: flowforge 자체 `docs/planning/features.md` 생성 — 기획 단계 기능명세 스키마대로(요구사항 몇 개 + capability 키 + 속성). DOCS_ROOT 기동→API 200+tree 확인

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [x] VERIFY: 5단계 게이트 통과 — 빌드(전체 workspace EXIT0) → 타입체크(EXIT0) → 린트(EXIT0) → 테스트(server 129/129, 신규10, 회귀0 특히 change spec-tree 그대로 PASS) → UI(Playwright 실픽셀 기능명세 트리 17노드·3단 위계·capability 칩·priority/status 뱃지·콘솔에러0) 전부 PASS
