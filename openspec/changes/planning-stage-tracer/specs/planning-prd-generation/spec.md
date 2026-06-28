## ADDED Requirements

### Requirement: openspec-plan 스킬이 PRD를 생성한다
openspec-plan 스킬(예광탄 범위)은 사용자 입력으로부터 PRD를 생성해 대상 프로젝트의 `docs/planning/prd.md`에 SHALL 쓴다. PRD는 manyfast 원형 5섹션 고정 스키마를 따른다: 개요 / 핵심가치 / 타겟·시나리오 / 성공지표 / 속성설정. 섹션의 순서와 제목은 고정이며 임의로 바꾸지 않는다.

#### Scenario: PRD 5섹션 생성
- **WHEN** 사용자가 프로젝트 설명과 함께 openspec-plan을 PRD 생성 단계로 실행한다
- **THEN** `docs/planning/prd.md`가 생성되고, 그 안에 `## 개요`·`## 핵심가치`·`## 타겟·시나리오`·`## 성공지표`·`## 속성설정` 5개 섹션이 이 순서로 존재한다

#### Scenario: 빈 섹션은 지어내지 않는다
- **WHEN** 입력에 특정 섹션(예: 성공지표)의 근거가 전혀 없다
- **THEN** 해당 섹션을 그럴듯하게 지어내지 않고, 비어있음을 표면화한다(빈 섹션으로 남기거나 "(미정)" 표기)

### Requirement: PRD는 charter 상주문서와 분리된 위치에 저장된다
openspec-plan이 만드는 PRD는 신규 디렉토리 `docs/planning/`에 SHALL 저장하며, 기존 charter 상주문서(`docs/spec.md`, `docs/PRD.md`)를 수정하거나 덮어쓰지 않는다.

#### Scenario: 신규 디렉토리에만 쓴다
- **WHEN** openspec-plan이 PRD를 쓴다
- **THEN** `docs/planning/prd.md`에만 쓰고, `docs/PRD.md`·`docs/spec.md`는 변경되지 않는다

## TDD Plan

이 capability는 **스킬 문서(SKILL.md)** 산출물이라 자동화 테스트보다 절차·산출물 형태가 핵심이다. 검증은 verify 단계에서 "스킬 절차대로 PRD를 생성하면 5섹션 파일이 나오는가"로 실증한다(예광탄에서는 flowforge 도그푸딩용 `docs/planning/prd.md`를 실제로 만들어 capability 2의 입력으로 쓴다).

- **Red**: (해당 없음 — 문서 산출물)
- **Green**: openspec-plan/SKILL.md 신설 — PRD 5섹션 생성 절차만. 저장 위치 `docs/planning/prd.md`, 빈 섹션 표면화 규칙 명시.
- **Refactor**: 추후 기능명세·유저플로우 단계를 같은 SKILL.md에 순차 게이트로 확장(이 change 밖).
- Mock 대상: 없음.
