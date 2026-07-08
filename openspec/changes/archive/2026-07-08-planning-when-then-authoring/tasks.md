# planning-when-then-authoring — tasks

## Tasks

### Sequential: 데이터 경로 (memo 선례 복제)

- [x] 1.1 RED: featureTreeBuilder 단위 테스트 — `<!-- when: -->` `<!-- then: -->` 파싱(양쪽·when만·then만·부재), capability/priority/memo·다른 노드 무영향 (memo 테스트 패턴 복제)
- [x] 1.2 GREEN: shared `FeatureNode.when?: string`·`then?: string`(additive) + featureTreeBuilder RE_WHEN/RE_THEN(RE_MEMO 동형, featureTreeBuilder 내부만) + featureTreeAdapter가 노드 data로 when/then 전달(FeatureDetailPanel 무수정 — 이미 렌더)

### Sequential: 도그푸딩 + 검증 게이트 (마지막 필수 — dev-verify)

- [x] 2.1 flowforge docs/planning/features.md 상세기능 1~2건에 실제 when/then 저작(원천 실증 — 예: "planning-features 라우트 조회"에 when="탭 클릭"·then="그 프로젝트 5종 뷰 로드")
- [x] 2.2 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 384 회귀 0 + when/then 신규) → UI 실픽셀(격리 픽스처: when/then 저작 노드 클릭 → 상세 패널 ⚡ 시나리오 섹션 표시, 한쪽만·부재 케이스, 기존 노드 회귀 0) 전부 PASS
