# 배포 전 최종 검토 — planning-panel-screen-links
검토일: 2026-07-05 / 검토 범위: 이 change의 diff만 — `server/src/routes/docs.ts`(planning-screens 라우트), `server/src/routes/__tests__/docs.planning.test.ts`, `web/src/api.ts`, `web/src/featureTreeAdapter.ts`, `web/src/App.tsx`, `web/src/FeatureDetailPanel.tsx` (커밋 a3316bb, 13a417a). 전체 앱 리뷰 아님.

## review criteria brief

- changeTypes: **backend**(라우트+jest 통합테스트) + **frontend**(tsx/ts 4파일) — 파일 확장자·경로 증거 기반
- criteria: 10개 전부 in-scope (frontend 변경 포함이므로 4·7도 적용)
- ruleSets: { resolvedFrom: [`~/.claude/rules/`], selected: [10-coding-style, 20-testing, 30-security, 60-design, 70-adversarial-review], absent: [] }
- designYardsticks:
  - decisions: D-1(원시 registry 노출, 서버 조인 기각) / D-2(라벨 문자열 동치만, 파서 키 규약 준수) / D-3(dangling id → label=id 강등, 숨기지 않음) / D-4(실패 = 필드 없음 강등, 섹션 자연 생략) / D-5(FeatureNodeData 타입 승격, 캐스트 제거)
  - nonGoals: WHEN/THEN 배선, IA·유저플로우 패널, 화면 딥링크, 빈 섹션 표시, 라벨 매칭 취약성 해소(Risks에서 명시적으로 범위 밖 선언)
- specsVerifyFocus: verify.json PASS 7/7, FAIL·검증안함·SKIP 0건, edge 게이트 충분(na 사유 타당) → 실증 미비로 인한 focus 항목 없음
- adversarialScope: **full change scope (NOT narrowed by this brief)**

**verify 입력 판정**: verify.json(2026-07-05 07:42)은 서버 3시나리오(jest + dist 실서버 실측)·web 4시나리오(gstack 실픽셀, 스크린샷 evidence/s4~s6 + fetch 실패 강등) 전부 PASS, edge 8분류 충분(na 2건 사유 합리 — HTTP 경로 파라미터 특성). 이 리뷰는 재검증하지 않고 이 실증을 전제로 판단한다.

## 반드시 수정해야 할 항목

- 없음

## 수정하면 좋은 항목

1. **같은 detailLabel의 링크가 여러 개일 때 첫 링크만 반영 — IA 뷰와 불일치 가능** (`web/src/featureTreeAdapter.ts:115`)
   - 파서는 `<!-- screens: -->` 주석 등장마다 link를 push한다(`server/src/parser/screenRegistry.ts:85`, 라벨별 병합 없음). 같은 라벨의 상세기능이 서로 다른 요구사항 아래에서 **각자 다른 화면 목록**을 선언하면 links에 같은 detailLabel 항목이 2개 생기는데, 어댑터는 `screenLinks.find()`로 **첫 번째만** 취해 두 번째 링크의 화면이 조용히 탈락한다.
   - 대조: 같은 registry를 소비하는 `planningIaBuilder`는 links 전체를 순회해 합집합을 만든다(`server/src/parser/planningIaBuilder.ts:36-40`) — 같은 데이터가 IA 뷰에는 나오고 상세 패널에는 안 나오는 소비자 간 불일치가 생길 수 있다.
   - D-2("같은 라벨은 같은 화면 목록을 받는다")의 전제는 저작자가 같은 목록을 쓴다는 것 — 저작이 어긋난 경우의 방어가 없다. **수정안**: detailLabel별 screenIds 합집합+중복 제거로 사전 인덱싱(아래 리팩토링 1과 동일 수정). 현재 실데이터(flowforge 링크 3건, 중복 라벨 없음)에서는 미발현이라 non-blocking.
2. **패널이 열린 채 registry가 늦게 도착하면 연결화면 섹션이 안 나타남 (재클릭 필요)** (`web/src/App.tsx:272`)
   - `selectedFeature`는 클릭 시점 node.data의 스냅샷. openProject에서 features와 planning-screens는 독립 fetch라, features 도착~screens 도착 사이에 노드를 클릭하면 패널은 screens 없는 스냅샷을 계속 들고 있다(featureNodes는 재구성돼도 패널은 stale). 기존 audit 배지(D-6)도 같은 패턴이라 **이 change가 새로 만든 결함은 아니고** 기존 수용된 동작과 일관 — 창이 짧고 재클릭으로 해소되므로 non-blocking. 고친다면 featureNodes 재구성 시 selectedFeature를 id로 재조회하는 공통 동기화 한 곳(65899ea의 dashboard stale 수정과 같은 계열).
3. **한 링크 안 중복 화면 id 미제거 → React key 중복 경고 가능** (`web/src/featureTreeAdapter.ts:116`, `web/src/FeatureDetailPanel.tsx:182`)
   - `<!-- screens: home, home -->`처럼 같은 id가 반복되면 파서는 그대로 통과시키고(`screenRegistry.ts:80-85` filter는 빈 문자열만 제거), 패널은 `key={s.id}`로 매핑해 key 중복 경고 + 배지 중복 표시. 저작 오류 케이스이고 콘솔 경고 수준이라 non-blocking — screensForDetail에서 id dedupe 한 줄이면 충분(1번 수정 시 함께).

## 현재 상태로 유지해도 되는 항목

- **라벨 문자열 매칭의 취약성**(라벨 수정 시 링크 단절): design.md Risks에 명시적으로 수용·범위 밖 선언된 트레이드오프. 이 change에서 키 체계를 바꾸지 않은 것이 옳다(D-2 준수).
- **`screensForDetail`의 선형 `find`**(상세노드 수 × links 수): 기획 문서 스케일(links 수 개~수십)에서 병목 아님. 1번 수정 시 Map 인덱싱으로 자연 해소되므로 별도 조치 불요.
- **fetch URL에 project 미인코딩**(`web/src/api.ts:225`): 기존 13개 fetcher 전부 동일 스타일(api.ts:151~301) — 이 change가 만든 부채가 아니며 라우트 `(*)` 와일드카드+resolveDocsDir 404가 방어. 고친다면 전 fetcher 일괄(별도 change).
- **라우트에서 registry null → 빈 `{screens:[],links:[]}` 매핑**: 파서 null(features.md 부재)의 의미를 다른 소비자(IA 빌더)가 쓰므로 라우트 계층 매핑이 맞는 자리. 주석으로 의도 설명돼 있음(docs.ts:149).
- **패널의 `screens.length > 0` 가드**: 어댑터가 빈 배열을 안 내는 불변식(D-4)과 중복이지만 기존 JSX 무변경 원칙(D-5) 준수 결과 — 방어적 중복으로 무해.

## 리팩토링 추천 항목

1. **links를 detailLabel 키 Map으로 사전 인덱싱(합집합+dedupe)** — 위 1·3번을 한 번에 해소하고 조회도 O(1)로. `screenLabelById`와 같은 자리(featureTreeAdapter.ts:107-118)에 대칭 배치, ~10줄.
2. **`toFeatureTreeFlow` 위치 인자 증가 추세**: audit(2번째)→registry(3번째)로 optional 위치 인자가 늘고 있다. 다음 파생 데이터가 추가되는 시점에 options 객체로 전환 권장(지금은 호출부 1곳이라 조기 리팩토링 불요).

## 적대적 검토 (4 페르소나)

- **파괴자**: ①중복 detailLabel 링크 시 첫 링크만 반영(수정하면 좋은 1 — IA 뷰와 불일치) ②registry 늦은 도착 시 열린 패널 stale(수정하면 좋은 2). fetch 실패·빈 registry·404·dangling id는 verify가 실증 PASS(D-4 강등 확인)라 재현 경로 없음.
- **신입 개발자**: 어댑터의 D-2/D-3/D-4 참조 주석이 design.md 없이도 인라인으로 의미를 설명해 양호. 발견 1건 — `toFeatureTreeFlow(planningFeatures, featureAudit ?? undefined, planningScreens ?? undefined)`의 위치 인자 나열(App.tsx:229-233)은 인자가 하나 더 늘면 순서 실수 여지(리팩토링 2로 등재).
- **보안 감사자**: 신규 공격면 없음 근거 — 읽기전용 GET, 경로조작은 resolveDocsDir+테스트(`..%2f` 404 실측)로 차단, 라벨 렌더는 React 텍스트 노드(JSX escape, `{s.label}`)로 XSS 벡터 없음, 로그·에러메시지에 민감정보 없음. 발견 1건(기존 패턴 지적) — 엔드포인트 무인증·rate limit 부재는 전 docs API 공통(로컬 도구 전제)으로 이 change 밖이나, 외부 노출 배포 시 전역 과제로 인지 필요.
- **게으른 시니어**: diff가 필요 최소에 근접 — 라우트 20줄(형제 패턴 재사용, 파서 무수정), web ~60줄(기존 audit 파생 패턴 복제), 새 의존성·새 추상화·새 컴포넌트 0. 발견 1건 — openProject 독립 fetch와 applyFeature 재조회 fetch가 이원화돼 있는데(App.tsx:421, :541) 재조회 쪽은 stale 방지에 필요하므로 삭제 불가, 다만 `.catch(() => null)` 흡수 방식이 두 곳에서 미묘하게 다른 형태(then/catch 체인 vs inline catch)로 중복 — 통합 여지는 있으나 지금 합치면 오히려 diff가 커져 그대로가 낫다. 안 짜도 될 코드는 없음.
- 2+ 페르소나 중복 발견(심각도 상승): 없음 — 각 발견이 단일 페르소나 소관.

## 디자인 리뷰 (조건부 게이트)

화면 작업 감지됨(tsx 변경). 단 렌더 JSX는 **무변경**(D-5: 이미 완성된 섹션에 데이터만 배선)이고, verify가 gstack 실픽셀 3장(evidence/s4-linked-screens.png·s5-no-link-omitted.png·s6-dangling)으로 링크 표시·섹션 생략·dangling 강등을 실증 완료 — 별도 /design-review 재실행 없이 그 증거로 갈음한다(**정적 검토** 아님, verify의 실행 검증 인용). 신규 시각 요소·스타일 변경 0이므로 criteria 4·7에 추가 발견 없음.

## 최종 배포 가능 여부

**배포 가능** — verify PASS 7/7(FAIL·SKIP 0, edge 충분) + 치명 결함 0건. "수정하면 좋은" 3건은 전부 저작 오류·타이밍 엣지의 non-blocking이며 현재 실데이터에서 미발현.

## 개선 우선순위 (제안)

1. detailLabel 링크 Map 인덱싱(합집합+dedupe) — 수정하면 좋은 1·3 + 리팩토링 1을 ~10줄로 동시 해소, IA 뷰와 소비자 일관성 확보
2. featureNodes 재구성 시 selectedFeature id 재조회 동기화 — audit 배지 stale까지 같이 고쳐지는 공통 수정(별도 change 권장, 기존 동작 변경이므로)
3. 전 fetcher project 인코딩 일괄 정리 — 이 change 밖 전역 부채, 별도 change
4. toFeatureTreeFlow options 객체 전환 — 다음 파생 필드 추가 시점에
