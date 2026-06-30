# planning-spec-conversion

openspec-plan 스킬이 유저플로우 다음 끝단에서 `docs/planning/features.md`의 요구사항을 `docs/spec.md`의 audit 라인문법(capability 헤더 + assert/invariant/metric)으로 변환하는 능력. charter의 spec.md 생성 역할을 흡수해, plan이 만든 기획 산출물이 audit 기준 명세까지 이어진다. charter의 B등급 게이트(audit_match 파서 재사용·화이트리스트·metric 강제·validate·idempotency)를 이식한다.

## ADDED Requirements

### Requirement: openspec-plan이 features.md를 docs/spec.md로 변환한다
openspec-plan 스킬은 유저플로우 다음(끝단) 단계에서 `docs/planning/features.md`의 각 요구사항을 `docs/spec.md`의 capability 블록으로 변환 SHALL 한다. features.md 요구사항 헤더 직후의 `<!-- capability: <영문키> -->` 주석에서 영문키를 가져와 `## capability: <영문키> — <한글>` 헤더로 쓴다(영문키 불변 — change `specs/<키>/`와 set 멤버십으로 연결되므로). 기능명세 없이 spec.md 변환을 단독 실행하지 않는다(manyfast 순차 게이트 — 유저플로우까지 끝난 뒤).

#### Scenario: features.md 요구사항이 capability 블록으로 변환된다
- **WHEN** `docs/planning/features.md`에 `<!-- capability: <키> -->`를 단 요구사항이 있는 프로젝트에서 openspec-plan의 spec.md 변환 단계를 실행한다
- **THEN** `docs/spec.md`에 그 요구사항이 `## capability: <키> — <한글>` 헤더 + 기능별 assert/invariant/metric 라인으로 생성된다

#### Scenario: 영문 capability 키가 보존된다
- **WHEN** 변환된 docs/spec.md의 capability 헤더를 본다
- **THEN** features.md의 `<!-- capability: -->` 영문키가 글자 그대로 유지돼, change `specs/<키>/`와 set 멤버십으로 연결될 수 있다

### Requirement: 변환된 spec.md는 audit 라인문법을 따른다
생성되는 `docs/spec.md`의 각 capability 블록은 openspec-audit의 라인문법(spec-schema.md)을 SHALL 따른다. `assert:endpoint`의 METHOD는 화이트리스트(GET/POST/PUT/DELETE/PATCH)만, `invariant:<kind>`의 kind는 화이트리스트(no-traversal/readonly/not-fabricated/safe-4xx)만 쓴다. 각 capability에 `metric:` 라인을 1개 이상 두되 placeholder(빈값·`<목표값>`·TODO)가 아닌 실제 지표여야 한다(charter §9#6 metric MANDATORY 이식). 코드에 없는 endpoint/symbol을 지어내지 않는다(not-fabricated — 거짓연결 0).

#### Scenario: 변환 결과가 audit 파서로 거짓연결 없이 파싱된다
- **WHEN** 변환된 docs/spec.md를 audit_match.parse_spec으로 파싱하고 capability별 assert:endpoint/assert:symbol을 코드와 대조한다
- **THEN** assert한 endpoint/symbol이 전부 코드에 실재해 거짓연결(FAIL)이 0이다 (없는 것은 assert하지 않고 behavior로만 기술)

#### Scenario: metric MANDATORY 게이트가 placeholder를 거른다
- **WHEN** 변환된 docs/spec.md에 charter_status.py validate 게이트를 돌린다
- **THEN** capability마다 feature ≥1 + non-placeholder metric ≥1을 만족해 `no-metric`/`no-feature` 위반이 없다

### Requirement: 변환 단계는 charter_status.py 게이트를 재사용한다
openspec-plan의 spec.md 변환 단계는 게이트 검증을 위해 charter에서 이관한 `charter_status.py`(공용 게이트 스크립트)를 **재구현하지 않고 호출** SHALL 한다. `--mode validate`(cap마다 feature≥1+metric≥1)와 `--mode detect`(spec.md 있으면 revise — idempotency)를 `--audit-skill <openspec-audit 경로>`와 함께 호출해, audit_match 파서를 공유한다(키 drift 0). 이미 docs/spec.md가 있으면 통째로 덮어쓰지 않고 비거나 미완인 capability만 갱신한다(영문키 보존).

#### Scenario: validate 게이트가 변환 끝단에서 호출된다
- **WHEN** spec.md 변환을 마친 직후 게이트를 돌린다
- **THEN** charter_status.py `--mode validate --audit-skill <audit>`이 audit_match를 import해 검증하고, 위반이 있으면 사용자에게 표면화한다(honesty gate)

#### Scenario: 재실행 시 기존 spec.md를 보존한다 (idempotency)
- **WHEN** 이미 docs/spec.md가 있는 프로젝트에서 변환 단계를 다시 실행한다
- **THEN** charter_status.py `--mode detect`가 `revise`로 판정하고, 기존 capability·영문키를 보존하며 미완 부분만 갱신한다

## TDD Plan

- **Red/Green/Refactor**: 스킬 문서(SKILL.md) 절차 추가는 코드 테스트 대상이 아님. 검증 = (1) SKILL.md에 spec.md 변환 단계·audit 라인문법 규약·게이트 호출·영문키 보존이 명문화됐는지 grep (2) 도그푸딩으로 flowforge `docs/planning/features.md`를 `docs/spec.md`로 변환한 뒤 audit_match.parse_spec으로 거짓연결 0, charter_status.py validate 통과를 실제 실행해 확인. 변환은 LLM 절차이므로 코드 단위테스트가 아니라 산출물 관찰(grounding)로 검증한다.
- **Mock 대상**: 없음(문서 절차 + 실행 검증).
