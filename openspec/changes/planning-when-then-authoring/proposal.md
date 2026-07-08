# planning-when-then-authoring

## Why

로드맵 ②(상세 패널)에서 상세기능 노드에 "언제(WHEN) 무엇을 하면 무엇이(THEN) 일어나는가"를 보여주려 했으나, features.md에 **그 데이터 원천 자체가 없어** 배선할 게 없었다. 상세 패널(`FeatureDetailPanel`)은 이미 `when`/`then`을 "있을 때만 렌더"하도록 준비돼 있고(:73-74·199), 데이터 경로만 비어 있다 — 연결화면(N:M) 때와 정확히 같은 구조. 이 원천을 저작 문법으로 채운다.

## What Changes

- **features.md 저작 문법 추가**: 노드(주로 상세기능) 헤더 아래 `<!-- when: … -->` `<!-- then: … -->` 인라인 주석. 기존 `<!-- memo: … -->`와 동일한 패턴(정규식 파싱·옵셔널·비파괴).
- **파서 확장**: `featureTreeBuilder`가 `RE_WHEN`/`RE_THEN`으로 읽어 `FeatureNode.when?`/`then?`(additive 옵셔널)에 실음. 없으면 필드 자체가 없다(memo 선례).
- **web 배선**: 어댑터가 파생 필드로 전달 → 상세 패널의 기존 WHEN/THEN 섹션이 실제로 뜬다(신규 UI 0 — 렌더는 이미 있음, 데이터만 연결).
- **후속(②)의 발판**: 와이어프레임 요소·동작이 이 WHEN/THEN을 소비할 예정(별도 change).

## Capabilities

### New Capabilities

(없음)

### Modified Capabilities

- `planning-features-view`: FeatureNode에 when/then 필드 + features.md 저작 문법 + 상세 패널 데이터 연결

## Impact

- shared: `FeatureNode.when?: string`·`then?: string`(additive — 기존 소비자 무영향)
- server: `featureTreeBuilder.ts` RE_WHEN/RE_THEN 파싱(memo와 동형, featureTreeBuilder 내부만)
- web: `featureTreeAdapter.ts`가 when/then 전달(FeatureDetailPanel은 무수정 — 이미 렌더)
- docs: `docs/planning/features.md`에 도그푸딩용 when/then 1~2건 저작(원천 실증)
- Non-Goal: 와이어프레임 요소(②, 별도 change) / WHEN/THEN의 유저플로우 에지케이스 자동 소비(후속) / AI 제안 생성(사람 저작 먼저)
