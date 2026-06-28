## Why

예광탄 change `planning-stage-tracer`는 `docs/planning/prd.md`를 읽어 PRD를 렌더하는 길을 뚫었지만, 정작 그 파일을 가진 프로젝트가 docs 프로젝트로 **인식되지 않는 빚**을 남겼다. `server/src/lib/docs.ts`의 `hasDocs`가 charter 산출물(`user-flow.md` 또는 `PRD.md`)만 인정하기 때문에, charter 문서 없이 `docs/planning/prd.md`만 있는 "planning-only 프로젝트"는 `resolveDocsDir`/`listDocsProjects`가 모두 통과시키지 못해 `GET /api/docs/:project/planning-prd`가 404를 반환한다. 기획 단계(openspec-plan)는 charter 없이 planning 산출물부터 만드는 흐름이므로, planning-only 프로젝트가 인식되지 않으면 기획 단계 전체가 flowforge에서 보이지 않는다.

## What Changes

- `hasDocs(docsDir)`에 `planning/prd.md` 존재 여부를 OR 조건으로 추가한다. 즉 `user-flow.md` 또는 `PRD.md` 또는 `planning/prd.md` 중 하나라도 있으면 docs 프로젝트로 인식한다.
- 이 보강으로 `resolveDocsDir`(단일 프로젝트 해석)와 `listDocsProjects`(전체 스캔) 둘 다 자동 반영된다 — 둘 다 `hasDocs`를 단일 게이트로 거치기 때문.
- charter 문서가 있는 기존 프로젝트의 인식은 그대로 유지된다(OR 추가는 인식 범위를 넓힐 뿐 좁히지 않음).
- 경로안전 규칙(`..` 금지 + 화이트리스트)과 읽기전용 정책은 변경하지 않는다.

## Capabilities

### New Capabilities
- `planning-only-recognition`: charter 산출물 없이 `docs/planning/prd.md`만 가진 프로젝트를 flowforge가 docs 프로젝트로 인식하는 능력. `hasDocs` 게이트를 통해 `resolveDocsDir`/`listDocsProjects` 양쪽에 일관 적용된다.

### Modified Capabilities
<!-- planning-prd-view의 요구사항 텍스트(파일 읽어 PRD 제공)는 바뀌지 않는다. 그 전제(프로젝트 인식)를
     충족시키는 별도 능력을 추가하는 것이므로 modified로 두지 않는다. -->

## Impact

- **코드**: `server/src/lib/docs.ts`의 `hasDocs` 함수 1곳(주석 포함 시 인접 docstring). `resolveDocsDir`/`listDocsProjects`는 호출만 거치므로 코드 수정 없이 동작 변경.
- **테스트**: `server/src/lib/__tests__/docs.test.ts`에 planning-only 인식 케이스 추가. 기존 charter 인식 테스트는 회귀로 유지.
- **API**: `GET /api/docs/:project/planning-prd`가 planning-only 프로젝트에서도 200을 반환하게 됨(이전 404 → 정상).
- **의존성/외부 시스템**: 없음. 읽기전용, 신규 의존성 없음, 경로안전 불변.
