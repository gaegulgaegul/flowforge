# planning-features-view (delta)

## ADDED Requirements

### Requirement: features 노드는 WHEN/THEN 시나리오를 저작·표시한다

WHEN a features.md node carries `<!-- when: … -->` and/or `<!-- then: … -->` inline comments below its header, the parser SHALL read them into `FeatureNode.when?`/`then?` (additive optional — absent when the comment is absent, same as memo), and the feature detail panel SHALL render the WHEN/THEN section only when at least one is present (fabricating nothing). WHEN neither comment exists, node data and the panel SHALL be unchanged (backward compatible).

#### Scenario: when/then 저작 → 상세 패널 표시

- **WHEN** 상세기능 헤더 아래에 `<!-- when: 저장 클릭 -->` `<!-- then: 목록으로 이동 -->`을 저작한 노드를 상세 패널에서 연다
- **THEN** 패널의 ⚡ 시나리오(WHEN/THEN) 섹션에 그 문구가 표시된다

#### Scenario: 한쪽만 있어도 렌더

- **WHEN** when만 있고 then이 없는(또는 반대) 노드를 연다
- **THEN** 있는 쪽만 표시되고 없는 쪽은 생략된다(빈 태그 없음)

#### Scenario: 주석 부재 = 현행 동작

- **WHEN** when/then 주석이 없는 기존 노드를 파싱·렌더한다
- **THEN** FeatureNode에 when/then 필드가 없고 상세 패널에 WHEN/THEN 섹션이 뜨지 않는다(회귀 0)

## TDD Plan

- **Red**: featureTreeBuilder 단위 — when/then 주석 파싱(양쪽·한쪽·부재), 다른 노드·capability·memo 무영향. memo 테스트 패턴 복제.
- **Green**: shared 필드 + RE_WHEN/RE_THEN + 어댑터 전달.
- **Refactor**: 없음(memo 동형).
- Mock 대상: 없음.
