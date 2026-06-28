## Context

`server/src/lib/docs.ts`는 DOCS_ROOT 1단계 하위 `<project>/docs/`를 스캔해 charter 상주 docs를 읽는 읽기전용 모듈이다. 인식 판정은 `hasDocs(docsDir)` 단일 함수에 모여 있고, `resolveDocsDir`(단일 프로젝트 해석)와 `listDocsProjects`(전체 스캔)가 모두 이 게이트를 거친다. 현재 `hasDocs`는 `user-flow.md` 또는 `PRD.md`(charter 산출물)만 인정한다.

예광탄 `planning-stage-tracer`로 `docs/planning/prd.md`를 읽어 PRD를 렌더하는 길은 뚫렸지만, 정작 그 파일만 가진 planning-only 프로젝트는 `hasDocs`를 통과하지 못해 `resolveDocsDir`가 null을 돌려주고 `GET /api/docs/:project/planning-prd`가 404가 된다(apply 단계에서 기록된 Phase0 mismatch = 빚).

## Goals / Non-Goals

**Goals:**
- charter 문서 없이 `docs/planning/prd.md`만 있는 프로젝트를 docs 프로젝트로 인식한다.
- 인식을 `hasDocs` 단일 게이트에서 해결해 `resolveDocsDir`/`listDocsProjects` 양쪽에 자동·일관 반영한다.
- 기존 charter 프로젝트 인식과 경로안전·읽기전용 정책을 깨지 않는다(회귀 0).

**Non-Goals:**
- 기능명세(features.md)·유저플로우·와이어 등 다른 planning 산출물의 인식 추가(다음 change에서). 이번엔 `planning/prd.md` 하나로 인식 트리거를 여는 것까지만.
- charter 폐기·spec.md 변환·승인UI 등 본구현 후속 단계.
- 새 라우트·파서·타입 추가. 인식 게이트 한 줄만 넓힌다.

## Decisions

- **결정 1: OR 조건을 `hasDocs` 한 곳에만 추가.** `hasDocs(docsDir)`에 `existsSync(join(docsDir, "planning", "prd.md"))`를 세 번째 OR로 추가한다.
  - 대안 A(각 함수에 따로 검사): `resolveDocsDir`·`listDocsProjects` 두 곳을 고치면 규칙이 갈라져 drift 위험. 기각.
  - 대안 B(별도 `hasPlanning` 함수 신설): 단일 OR 한 줄에 함수를 새로 빼는 건 과한 추상화(ponytail 최소구현 위반). 기각.
  - → `hasDocs`가 이미 "docs 프로젝트냐"의 단일 진실 게이트이므로 거기에 OR 하나만 더한다.

- **결정 2: 와이어드 경로는 `join(docsDir, "planning", "prd.md")`.** 예광탄의 `buildDocsPlanningPrd`/라우트가 쓰는 경로(`planning/prd.md`)와 동일 문자열로 맞춘다. 인식 조건과 실제 읽기 경로가 어긋나면 "인식은 됐는데 404" 같은 새 빚이 생기므로 정확히 일치시킨다.

- **결정 3: 테스트는 기존 픽스처 패턴 재사용.** `docs.test.ts`의 `makeProject(root, project, files)` 헬퍼는 `docs/<file>` 평면 구조만 만든다. planning-only 케이스는 `planning/prd.md`처럼 하위 디렉토리가 필요하므로, 헬퍼에 의존하지 않고 테스트 내에서 `mkdirSync(join(root, project, "docs", "planning"), {recursive:true})` + `writeFileSync`로 직접 만든다(또는 헬퍼가 키의 `/`를 디렉토리로 처리하도록 최소 확장). 기존 테스트는 건드리지 않는다.

- **결정 4: audit 호환.** 이 capability의 핵심 검증 대상은 라우트가 아니라 라이브러리 동작이므로, archive 시 docs/spec.md 흡수 라인문법은 `assert:symbol hasDocs`(+ resolveDocsDir/listDocsProjects) 와 `invariant: readonly`(docs 모듈은 쓰기 없음), `invariant: no-traversal`(경로조작 차단)로 기록한다. endpoint assert는 planning-prd-view가 이미 보유하므로 중복 흡수하지 않는다.

## Risks / Trade-offs

- **[Risk] OR 추가가 의도치 않게 인식 범위를 넓혀 엉뚱한 디렉토리를 docs로 본다** → `planning/prd.md`라는 구체 경로만 추가하므로 임의 파일로 트리거되지 않음. charter-only/문서없음 회귀 테스트로 경계 고정.
- **[Risk] 인식 조건과 읽기 경로 불일치(결정 2 위반 시)** → 인식 경로 문자열을 예광탄 라우트와 동일하게 맞추고, planning-only 200 통합 테스트로 인식→읽기 세로관통을 한 번에 검증.
- **[Trade-off] charter 문서와 planning 문서가 둘 다 있는 프로젝트** → OR이므로 그냥 인식됨(중복 트리거 무해). 우선순위 개념 불필요.

## Migration Plan

- 순수 가산 변경(OR 추가). 기존 charter 프로젝트 동작 불변이므로 마이그레이션·롤백 데이터 없음. 롤백은 OR 한 줄 제거로 즉시.

## Open Questions

- 없음. 스코프가 `planning/prd.md` 단일 인식으로 닫혀 있다.
