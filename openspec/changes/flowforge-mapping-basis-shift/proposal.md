## Why

`flowforge-change-node-mapping`(노드에 연관 change in-place 매핑 UI)은 A·B·C·D 구현·검증을 마쳤고 UI 배선은 픽스처로 실증됐다. 그러나 **라이브 실데이터에서 노드 배지가 0개**다. 이 change는 그 배지 0의 근본 원인(매핑 데이터 기준)만 분리해 고친다. UI 배선은 이미 node-mapping이 완성했으므로, 이 change는 **데이터 조인 기준 전환**이라는 성격이 다른 아키텍처 뒷정리다.

**근본 원인 (node-mapping verify 중 코드·API로 실측 확정, 2026-07-11):**

노드에 배지가 뜨려면 한 capability 키 K가 세 조건을 모두 만족해야 한다:
1. `docs/planning/features.md`에 `<!-- capability: K -->` (트리 노드가 K를 가짐) — `docs.ts` `attachLinkedChanges`
2. `docs/spec.md`에 `## capability: K` (`charterCaps.has(K)` 통과) — `capabilityIndex.ts:94`
3. 어떤 **활성** change가 `specs/K/spec.md`를 가짐 (`byCapability.get(K)` 비어있지 않음) — `specDirsOf`

실측 결과:
- 조건 1∩2 만족 키 6개 존재(`planning-features-view`·`planning-prd-view`·`planning-features-generation` 등) — **spec.md는 예광탄이 아니라 최신 planning capability를 다 담고 있었다**(이전 가설 "charter 폐기라 spec.md가 비었다"는 부분 기각).
- **조건 3이 병목**: 활성 change 11개의 `specs/<dir>`은 전부 `flowforge-*` 새 기능군(node-mapping·pin-feedback·wireframe-iframe 등)이라 features.md capability 키(`planning-*`)와 **교집합 0**. features.md 기능을 구현한 change들은 **이미 전부 아카이브**됐는데(`capabilityIndex.ts`가 archive 제외), 매핑은 archive를 안 본다.

즉 배지 0의 직접 원인 = **(3a) 활성 change의 specs/dir 네이밍이 features.md capability와 안 맞음 + (3b) 정작 그 capability를 구현한 change는 archive에 있는데 매핑이 archive를 제외**. charter 기준(조건 2) 필터는 부차적 요인이며, 데이터 조인 기준을 features.md ∩ (활성+archive) change로 넓혀야 실배지가 뜬다.

관련 배경: 2026-07-02 backbone 안2 결정으로 `openspec-charter` 스킬은 폐기되고 `openspec-plan`이 대체됐다. charter(docs/spec.md) 개념은 폐기 방향인데 매핑 코드는 여전히 이를 진실의 원천으로 읽는다 — 그 정리도 이 change의 범위 안에서 함께 판단한다.

## What Changes

- **매핑 조인 기준 전환**: capability↔change 매핑의 필터 기준을 `charterCaps`(docs/spec.md) 중심에서 **features.md 요구사항 capability(`<!-- capability: 키 -->`)** 중심으로 전환한다. features.md에 선언된 capability를 진실의 원천으로 삼고, change의 `specs/<dir>`을 그와 조인한다. (design에서 charter 필터를 완전히 걷어낼지, features ∪ charter로 병합할지 확정 — wowa-app 회귀 고려.)
- **archive 제외 완화**: 완료된 기능의 change는 archive에 있으므로, 매핑 스캔이 `openspec/changes/archive/`도 포함하도록 완화한다(또는 옵션화). "이 노드는 archive된 change로 이미 구현됨" 신호가 뜨는 게 사용자 가치. (활성/archive 배지를 시각 구분할지 design에서 확정.)
- **change specs/dir 네이밍 정합(선택)**: 신규 change의 `specs/<dir>`을 features.md capability 키와 정합시키는 컨벤션을 문서화한다(강제 아님 — 조인이 네이밍 일치에 의존하므로).
- **읽기 전용 유지**: node-mapping과 동일하게 표시·진입만. 이 change는 데이터 파생 기준만 바꾼다.

## Capabilities

### Modified Capabilities
- `flowforge-change-node-mapping`(node-mapping이 신설한 매핑 파생)의 **데이터 조인 기준**을 수정한다. UI(배지·상세패널·진입)는 불변. `capabilityIndex.ts`의 `buildCapabilityIndex`/`attachLinkedChanges` 입력 원천(charter→features.md)과 스캔 범위(활성→활성+archive)를 바꾼다.

## Impact

- **서버(주로)**: `server/src/lib/capabilityIndex.ts` — `parseCharterCapabilities`(docs/spec.md) 의존을 features.md capability 파서로 교체/병합, `buildCapabilityIndex`의 archive 제외(`changeKey === "archive"`) 완화. `server/src/routes/docs.ts` — `attachLinkedChanges` 배선의 charter 인자 원천 변경.
- **회귀 위험(메모리 [[project_charter_deprecated_mapping_gap]] 경고)**: docs/spec.md를 읽는 코드가 `capabilityIndex` 외 `graph.ts`·`koreanLabels.ts`·`changes.ts`·`projects.ts`에 퍼져 있고, **wowa-app 등 다른 프로젝트도 docs/spec.md를 사용**한다. 매핑 기준만 바꾸고 다른 소비자는 건드리지 않도록 스코프를 좁히고, wowa-app planning 뷰 회귀를 반드시 검증한다.
- **배포/검증**: flowforge는 커밋≠라이브. VERIFY에서 재빌드 후 **실데이터로** 기획 기능명세 트리에 배지가 실제로 뜨는지 Playwright 실픽셀 확인 — node-mapping이 픽스처로만 실증한 배지 가치를 이 change가 실데이터로 실증한다.
- **선행**: `flowforge-change-node-mapping`(매핑 UI·파생 함수 골격). 이 change는 그 파생의 입력만 바꾸는 비파괴 확장.
