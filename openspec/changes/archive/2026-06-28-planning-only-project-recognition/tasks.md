## Tasks

### Parallel Group 1 (RED — 서로 다른 테스트 파일, 동시 실행 가능)
- [x] RED: `server/src/lib/__tests__/docs.test.ts`에 planning-only 인식 테스트 추가 — (1) `planning/prd.md`만 있는 프로젝트의 `resolveDocsDir`가 docs 경로 반환 (2) `listDocsProjects` 목록에 포함 (3) charter-only 프로젝트 회귀(여전히 인식) (4) 셋 다 없으면 null. 하위 디렉토리(`docs/planning/`)는 테스트 내에서 직접 `mkdirSync(recursive)`로 생성 [parallel]
- [x] RED: `server/src/routes/__tests__/docs.test.ts`에 planning-only 프로젝트(`planning/prd.md`만)로 `GET /api/docs/:project/planning-prd`가 404 아닌 200+5섹션 반환하는 통합 테스트 추가(인식→읽기 세로관통) [parallel]

### Sequential: GREEN (단일 통합 지점 — 두 RED를 한 번에 통과)
- [x] GREEN: `server/src/lib/docs.ts`의 `hasDocs(docsDir)`에 `existsSync(join(docsDir, "planning", "prd.md"))`를 세 번째 OR로 추가(기존 user-flow.md/PRD.md 검사 보존). 인식 경로는 예광탄 라우트의 `planning/prd.md`와 동일 문자열로 맞춤. docstring 한 줄 보강(기존 docs.ts 코멘트 스타일 유지). 테스트 실패 시 추측 금지·근본원인부터.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [x] VERIFY: 5단계 게이트 통과 — 빌드(tsc exit 0) → 타입체크(tsc --noEmit exit 0) → 린트(루트 workspace lint exit 0) → 테스트(server 119/119, 신규4 RED→GREEN, 회귀0) 전부 PASS. UI 변경 없음(라이브러리/API 한정)이라 UI 단계 N/A.
