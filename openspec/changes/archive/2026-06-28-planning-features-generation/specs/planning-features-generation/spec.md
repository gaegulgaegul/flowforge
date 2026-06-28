# planning-features-generation

openspec-plan 스킬이 PRD 생성 다음 단계에서 `docs/planning/features.md`를 manyfast식 3단 트리 기능명세서로 생성하는 능력. 이 산출물은 기획↔구현 매핑의 출발점(요구사항별 capability 키)이다.

## ADDED Requirements

### Requirement: openspec-plan이 features.md를 의존성 순서로 생성한다
openspec-plan 스킬은 PRD(`docs/planning/prd.md`)가 존재하는 상태에서 `docs/planning/features.md`를 생성 SHALL 한다. PRD의 개요·핵심가치를 입력 맥락으로 삼아 요구사항을 도출하며, PRD 없이 features만 단독 생성하지 않는다(manyfast 순차 게이트).

#### Scenario: PRD 다음 단계로 features.md 생성
- **WHEN** `docs/planning/prd.md`가 있는 프로젝트에서 openspec-plan의 기능명세 단계를 실행한다
- **THEN** `docs/planning/features.md`가 3단 트리 + 노드 속성 + capability 키 스키마로 생성된다

### Requirement: features.md는 확정 스키마를 따른다
생성되는 `features.md`는 SHALL 다음 스키마를 따른다: (1) 3단 위계 = 요구사항(`## ` 헤더) → 기능(`### ` 헤더) → 상세기능(`#### ` 헤더), (2) 각 요구사항 헤더 직후 줄에 capability 키 주석 `<!-- capability: <영문키> -->`, (3) 각 노드(요구사항/기능/상세기능)에 속성 표기 `(중요도: 낮음|중간|높음, 상태: 시작전|진행중|완료|중단)`를 헤더 끝 또는 직후 줄에 둔다. 영문키는 kebab-case로 change의 `specs/<키>/` 디렉토리명과 일치시킬 수 있어야 한다.

#### Scenario: 요구사항에 capability 키가 부여된다
- **WHEN** features.md의 요구사항 노드를 본다
- **THEN** 각 요구사항에 `<!-- capability: <영문키> -->` 주석이 있어 매핑의 출발점이 된다

#### Scenario: 노드에 중요도·상태 속성이 있다
- **WHEN** features.md의 요구사항/기능/상세기능 노드를 본다
- **THEN** 중요도(낮음/중간/높음)와 상태(시작전/진행중/완료/중단) 속성이 표기돼 있다

## TDD Plan

- **Red/Green/Refactor**: 스킬 문서(SKILL.md) 절차 추가는 코드 테스트 대상이 아님. 검증은 (1) SKILL.md에 features 생성 단계·스키마 명문화 존재 grep (2) 도그푸딩으로 생성한 flowforge `docs/planning/features.md`가 스키마를 만족하는지 확인. 코드 동작은 planning-features-view spec에서 검증.
- **Mock 대상**: 없음(문서 절차).
