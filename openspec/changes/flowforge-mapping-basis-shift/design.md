# Design — flowforge-mapping-basis-shift

> capability↔change 매핑의 **데이터 조인 기준**을 charter(docs/spec.md)+활성전용에서
> features.md 요구사항 capability + (활성+archive) change로 전환한다. UI(node-mapping 산출물)는 불변.
> 아래 D1~D4는 소스·라이브 데이터를 실측해 확정했다(추측 아님).

## 배경 실측 (2026-07-12, 이 worktree 라이브 데이터)

배지가 뜨려면 한 capability 키 K가 세 조건을 모두 만족해야 한다(node-mapping 파생):
1. `docs/planning/features.md`에 `<!-- capability: K -->` — `attachLinkedChanges`가 노드에서 조회.
2. (현행) `docs/spec.md`에 `## capability: K` — `buildCapabilityIndex(charterCaps, …)`의 `charterCaps.has(K)`.
3. 어떤 change가 `specs/K/spec.md`를 가짐 — `specDirsOf` (현행은 `changeKey === "archive"` 제외).

**실측 결과:**
- features.md capability 키 11개: `lightweight-item-memo`, `planning-features-generation`,
  `planning-features-view`, `planning-only-recognition`, `planning-prd-generation`,
  `planning-prd-view`, `planning-userflow-generation`, `screen-first-class-node`,
  `spec-md-build-artifact`, `unified-item-graph`, `userflow-edgecase-branches`.
- 그중 **구현 change가 존재하는 6개**(`planning-features-generation/view`,
  `planning-prd-generation/view`, `planning-userflow-generation`, `planning-only-recognition`)는
  **전부 `openspec/changes/archive/2026-*/` 안**에 있다. 활성 change(`flowforge-*`,
  `propose-flowforge-link`, `planning-audit-trigger`)의 `specs/<dir>`은 features.md 키와 **교집합 0**.
- 따라서 배지 0의 **직접 병목 = 조건 3의 archive 제외**. 조건 2(charter 필터)는 spec.md에
  없는 features 키(`screen-first-class-node`·`unified-item-graph` 등 5개)를 추가로 드롭하지만,
  실제로 그 5개는 구현 change 자체가 없어 배지 후보가 아니다. **조인 원천을 features.md로 바꾸고
  archive를 포함**하면 6개 키에 실배지가 뜬다.

## D1. 조인 원천 — features.md 단독으로 전환 (charter 필터 제거)

**결정:** `docs.ts`의 node-mapping 조인에서 조인 필터 집합을 `parseCharterCapabilities(spec.md)`가
아니라 **features.md 요구사항 capability 집합**으로 바꾼다(features.md 단독, charter 병합 아님).

**근거:**
- charter(docs/spec.md)는 backbone 안2(2026-07-02)로 폐기 방향이고, `openspec-charter` 스킬은
  `openspec-plan`으로 대체됐다. 매핑이 폐기 원천을 진실로 읽는 것이 근본 문제였다.
- node-mapping 배지의 좌변(노드)은 이미 features.md capability다(`attachLinkedChanges`가
  `node.capability`로 조회). 조인 필터도 features.md로 맞추는 것이 **동일 원천 정합**이다.
- features ∪ charter 병합은 하지 않는다 — 병합해도 배지가 늘지 않고(조건 3이 병목),
  폐기 원천을 계속 읽는 부채만 남는다.

**구현 방식(회귀 안전 핵심):** `buildCapabilityIndex(allowedCaps: Set<string>, changesRoot)`의
**시그니처·의미는 그대로 둔다**(source-agnostic — "허용 capability 집합으로 필터"). 바꾸는 건
`docs.ts`가 **어떤 집합을 주입하느냐**뿐이다:
- 현행: `buildCapabilityIndex(parseCharterCapabilities(spec.md), …)`
- 변경: `buildCapabilityIndex(parseFeatureCapabilities(features.md), …)`

이렇게 하면 `buildCapabilityIndex`를 **동시에 소비하는 `projects.ts`(capability 카드 대시보드)는
전혀 건드리지 않는다** — projects.ts의 카드 목록은 charter capability 자체가 UI 계약이므로 계속
`parseCharterCapabilities`를 쓴다(D4 참조). 원천 전환은 node-mapping 배지 경로에만 국소화된다.

`parseFeatureCapabilities`는 featureTreeBuilder의 `RE_CAPABILITY`(`<!-- capability: KEY -->`)와
**동일 정규식**을 쓴다(키 변형 없음, 글자단위). features.md가 없으면 빈 Set → 배지 0(비파괴).

## D2. archive 스캔 — 항상 포함 (archive/ 한 단계 재귀)

**결정:** `buildCapabilityIndex`가 `openspec/changes/archive/` **하위 dated 디렉토리(1단계)**도
스캔하도록 `changeKey === "archive"` 제외를 완화한다. 옵션/쿼리 게이트는 두지 않는다(항상 포함).

**근거:**
- 완료된 기능의 change는 archive에 있는 것이 정상 라이프사이클이다. "이 노드는 archive된
  change로 이미 구현됨"이 사용자 가치(spec Scenario). 활성 전용이면 완성 기능이 영원히 배지 0.
- archive 디렉토리 구조 실측: `openspec/changes/archive/2026-06-28-planning-features-generation/specs/…`.
  즉 `archive/` 바로 아래가 **dated change 래퍼**다. 따라서 `archive`를 만나면 그 안을 한 단계
  더 읽어 각 dated 디렉토리를 change로 취급한다(중첩 재귀는 불필요 — archive 안에 또 archive 없음).

**change 키 표기:** archive change의 `changeKey`는 dated 디렉토리명 그대로
(`2026-06-28-planning-features-generation`). `byCapability`에는 활성/archive를 **병합**해 담는다
(배지는 "연관 change 있음"만 표시 — node-mapping UI 불변).

**활성/archive 시각 구분(선택):** `CapabilityChangeLink`에 **옵셔널** `archived?: boolean`을
additive로 더한다(비파괴 — 기존 소비자는 무시). 배지 UI 변경은 이 change 범위 밖(node-mapping
산출물 불변 원칙). 후속 change가 이 플래그로 시각 구분을 붙일 수 있게 데이터만 실어둔다.

## D3. specs/dir 네이밍 — 별도 조인 테이블 없음, 글자단위 정합 유지

**결정:** 신규 조인 테이블/별칭 맵을 도입하지 않는다. change `specs/<dir>` == features.md
capability 키 **글자단위 정확 비교**(trim만, 유사도 X)를 그대로 유지한다. 컨벤션은 문서화만.

**근거:**
- 기존 성공 기준이 "거짓연결 0"(`capabilityIndex.ts` 주석, 기존 459 테스트). 유사도·정규화·별칭을
  넣으면 그 불변식이 깨진다. 조인은 네이밍 일치에 의존한다는 사실을 컨벤션으로 명시하는 것으로 족하다.
- archive의 dated 디렉토리명(`2026-06-28-planning-features-generation`)은 change 키지, capability
  키가 아니다. 조인은 여전히 그 안의 `specs/<dir>`(예: `planning-features-view`) vs features 키로
  이뤄진다 — dated 접두어는 조인에 안 쓰인다(specDirsOf가 specs/ 하위만 읽음).

## D4. 회귀 방어 범위 — buildCapabilityIndex 시그니처 불변 + 원천 전환 국소화

**docs/spec.md의 다른 소비자와 wowa-app을 저촉하지 않는 방법:**

1. **`buildCapabilityIndex` 시그니처·기존 동작 불변** → 이 함수를 쓰는 `projects.ts`(capability 카드
   대시보드)는 무손상. projects.ts는 계속 `parseCharterCapabilities`로 charter 카드를 만든다
   (그 UI 계약이 charter capability라서 — 매핑 배지와 별개 관심사). 기존 459 테스트 그대로 GREEN 유지.
2. **원천 전환은 `docs.ts` planning-features 라우트 한 곳에만** — `graph.ts`·`koreanLabels.ts`·
   `changes.ts`는 애초에 `capabilityIndex`를 import하지 않는다(grep 확인). `parseCharterCapabilities`는
   `koreanLabels.parseCapabilityLabels`와 별개 함수라 교체와 무관.
3. **`parseCharterCapabilities`는 삭제하지 않는다** — projects.ts가 계속 쓴다. features 파서는
   병행 신설(`parseFeatureCapabilities`). charter 파서 제거는 이 change 범위 밖(폐기 로드맵 별도).
4. **wowa-app 등 타 프로젝트 무저촉:** 원천이 features.md든 spec.md든, 그 프로젝트에 파일이 없으면
   빈 Set → 배지 0(현행과 동일). features.md가 있는 프로젝트만 배지가 새로 뜬다 — 이는 회귀가
   아니라 의도된 신규 표시(비파괴 확장). archive 포함도 change 스캔 추가일 뿐 기존 활성 매핑을
   빼지 않는다(부분집합→상위집합, 기존 배지 유지).

**테스트로 방어할 불변식:**
- (A) features.md capability 파서가 `<!-- capability: K -->`를 정확히 뽑고 spec.md 문법과 섞이지 않음.
- (B) archive 하위 dated change가 `byCapability`에 포함되고 `archived=true` 플래그가 붙음.
- (C) 활성 change는 여전히 포함되고 `archived` 미표기(또는 false) — archive 완화가 활성을 밀어내지 않음.
- (D) `buildCapabilityIndex`의 기존 시그니처/거짓연결-0/unlinked 동작 불변(기존 459 테스트 회귀 0).
- (E) [회귀] projects.ts 경로(charter caps 주입)가 그대로 동작 — 기존 projects 테스트 GREEN.

## 불확실성 (정직 표기)

- **VERIFY 라이브 실픽셀(tasks D.1/VERIFY)**: `docker compose up -d --build` + Playwright 실배지
  확인은 이 worktree(격리)에서 라이브 배포·브라우저 구동 권한이 없으면 **검증 안 함**으로 보고한다.
  단위/통합 테스트로 조인 로직은 실증하되, 실배지 픽셀은 배포 환경에서 별도 확인이 필요하다.
