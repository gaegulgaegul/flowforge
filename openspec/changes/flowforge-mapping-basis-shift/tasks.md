# Tasks — flowforge-mapping-basis-shift

> capability↔change 매핑의 **데이터 조인 기준**을 charter(docs/spec.md)+활성전용에서
> features.md capability + (활성+archive) change로 전환한다. UI(node-mapping 산출물)는 불변.
> ⚠️ 이 tasks는 분리 시점 **스텁**이다. 착수 전 `openspec-propose`(또는 explore→propose)로 정식화하고,
> design.md에서 아래 D-결정들을 확정한 뒤 RED→GREEN으로 채운다.

## 선행: 설계 결정 (openspec-explore/propose에서 확정)

- [ ] D1. 조인 원천: charter 필터를 완전히 걷어낼지(features.md 단독) vs features ∪ charter 병합 — wowa-app 회귀 관점에서 택1
- [ ] D2. archive 스캔: 항상 포함 vs 옵션(쿼리/설정) — 활성/archive 배지 시각 구분 여부
- [ ] D3. specs/dir 네이밍 컨벤션: features.md capability 키와 정합 강제 vs 별도 조인 테이블
- [ ] D4. 회귀 방어 범위: docs/spec.md 다른 소비자(graph·koreanLabels·changes·projects)와 wowa-app 무저촉 보장 방법

## Group A: features.md capability 파서 (서버, 선행)

- [ ] A.1 (RED) `capabilityIndex.test.ts`에 features.md 기반 capability 추출 테스트 — features.md `<!-- capability: K -->` 집합을 조인 원천으로 쓰는 파생
- [ ] A.2 (GREEN) `parseCharterCapabilities`를 대체/보완하는 features.md capability 파서(또는 featureTreeBuilder RE_CAPABILITY 재사용) + `buildCapabilityIndex` 입력 원천 전환

## Group B: archive 제외 완화 (서버)

- [ ] B.1 (RED) archive change도 `byCapability`에 포함되는지 테스트(D2 결정 반영 — 항상/옵션)
- [ ] B.2 (GREEN) `capabilityIndex.ts`의 `changeKey === "archive"` 제외 로직 완화 + archive 배지 구분 필드(선택)

## Group C: 배선 + 회귀 (서버·web)

- [ ] C.1 `docs.ts` attachLinkedChanges 배선의 원천 인자 교체
- [ ] C.2 [회귀] wowa-app planning 뷰·docs/spec.md 다른 소비자(graph/koreanLabels/changes/projects) 무저촉 검증

## Sequential: 검증 게이트

- [ ] D.1 `docker compose up -d --build` 라이브 반영
- [ ] VERIFY: 5단계 게이트 + **실데이터로** flowforge 기획 기능명세 트리에 배지가 실제로 뜨는지 Playwright 실픽셀(node-mapping이 픽스처로만 실증한 배지 가치를 실데이터로 실증) + wowa-app 회귀 없음
