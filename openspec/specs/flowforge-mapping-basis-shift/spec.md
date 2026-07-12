# flowforge-mapping-basis-shift

> ⚠️ 분리 시점 **스텁 spec**이다. `openspec-propose`로 정식화 시 아래 Requirement를 D1~D4 결정에 맞춰 확정한다.

## MODIFIED Requirements

### Requirement: capability↔change 매핑의 조인 원천을 features.md로 전환한다
`flowforge-change-node-mapping`이 신설한 노드↔change 매핑 파생은, capability 진실의 원천을 폐기 방향인 charter(`docs/spec.md`)가 아니라 `docs/planning/features.md`의 요구사항 capability(`<!-- capability: 키 -->`)로 SHALL 삼는다. UI(배지·상세패널·진입)는 불변이며 데이터 조인 기준만 바뀐다.

#### Scenario: features.md capability로 실배지가 뜬다
- **WHEN** features.md 요구사항 capability K를 구현한 change(활성 또는 archive)가 `specs/K/`를 가진다
- **THEN** 그 K를 가진 요구사항 노드에 연관 change 배지가 실데이터로 표시된다(픽스처 불필요)

### Requirement: archive된 change도 매핑 스캔에 포함한다
완료돼 archive된 change가 구현한 capability도 노드 배지로 SHALL 표시한다(활성 전용 스캔이던 것을 완화). 활성/archive 구분 표기 여부는 설계 결정(D2)에 따른다.

#### Scenario: archive change가 노드에 매핑된다
- **WHEN** features.md capability K를 구현한 change가 `openspec/changes/archive/` 하위에 있다
- **THEN** 그 K 노드에 해당 change가 연관으로 표시된다(archive 제외로 누락되지 않는다)

### Requirement: 다른 docs/spec.md 소비자와 다른 프로젝트를 저촉하지 않는다
매핑 기준 전환은 `capabilityIndex` 조인에 한정되며, `graph.ts`·`koreanLabels.ts`·`changes.ts`·`projects.ts` 등 docs/spec.md의 다른 소비자와 wowa-app 등 타 프로젝트 planning 뷰를 SHALL 회귀시키지 않는다.

#### Scenario: wowa-app planning 뷰 무저촉
- **WHEN** 매핑 기준을 전환한 뒤 wowa-app 등 다른 프로젝트를 연다
- **THEN** 기존 planning 뷰·라벨·그래프 동작이 변하지 않는다
