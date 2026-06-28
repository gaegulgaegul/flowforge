## Tasks

### Parallel Group 1 (독립 - 동시 실행 가능: 서로 다른 레포/파일)
- [x] openspec-plan 스킬 SKILL.md 신설 (PRD 5섹션 생성 단계만) — agentic-harness 소스 `/home/gaegul/agentic-harness/plugins/agentic-harness/skills/openspec-plan/SKILL.md`. 저장 위치 `docs/planning/prd.md`, manyfast 원형 5섹션 고정, 빈 섹션 표면화 규칙 명시. [parallel]
- [x] RED: `buildDocsPlanningPrd` 단위 테스트 작성 [parallel] — `server/`에 임시 docs 픽스처로 planning/prd.md 주면 5섹션 Prd 반환, 없으면 빈 PRD/null.

### Sequential: server 빌더 구현
- [x] GREEN: `server/src/parser/prdBuilder.ts`에 `buildDocsPlanningPrd(docsDir)` 추가 — `readDocsFile(docsDir, "planning/prd.md")`로 읽어 기존 5섹션 파서 재사용(중복 구현 금지).

### Parallel Group 2 (빌더 완료 후 - 동시 실행: 서로 다른 파일)
- [x] RED: 라우트 통합 테스트 작성 [parallel] — `GET /api/docs/:project/planning-prd` 200+5섹션 / 없는 project 404 / `..` 경로조작 차단(safe-4xx).
- [x] RED: "원본 일치" 검증 테스트 작성 [parallel] — planning/prd.md 고유 문구가 응답 prd에 포함(proposal.md 변환 아님).

### Sequential: server 라우트 구현
- [x] GREEN: `server/src/routes/docs.ts`에 `GET /api/docs/:project/planning-prd` 라우트 추가 — `resolveDocsDir`로 경로 해석(경로안전 재사용) 후 `buildDocsPlanningPrd` 호출, `{ project, prd }` 반환.

### Sequential: web 배선 (server API 완료 후)
- [x] GREEN: `web/src/api.ts`에 `fetchDocsPlanningPrd(project)` 추가 + `App.tsx`에서 호출해 기존 `PrdPanel`에 전달 (새 컴포넌트/타입 만들지 않음).

### Sequential: 도그푸딩 입력 생성
- [ ] openspec-plan 절차대로 flowforge 자체의 PRD를 생성해 `flowforge/docs/planning/prd.md`로 저장 (이 "기획 단계 신설"을 5섹션 PRD로). 기존 `docs/PRD.md`·`docs/spec.md`는 건드리지 않음.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI 전부 PASS. UI는 DOCS_ROOT=flowforge로 기동 후 `GET /api/docs/flowforge/planning-prd` 200+5섹션 확인 + Playwright 실픽셀로 PrdPanel 5섹션 렌더 + 원본 고유 문구 화면 표시 관찰(그림자 아닌 실체).
