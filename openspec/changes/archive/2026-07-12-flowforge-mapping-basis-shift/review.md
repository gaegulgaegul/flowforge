# 배포 전 최종 검토 — flowforge-mapping-basis-shift
검토일: 2026-07-12 / 검토 범위: 이 change 의 diff 및 직접 영향 파일만 (전체 앱 아님)

**검토 범위 (스코프)** — `git log --grep 'mapping-basis'` + 커밋 diff 로 확정:
- `server/src/lib/capabilityIndex.ts` (단독 소유 — 핵심 로직: `parseFeatureCapabilities` 신설, `buildCapabilityIndex` archive 재귀 + `archived` 플래그)
- `server/src/routes/docs.ts:144-152` (planning-features 라우트 배선: 조인 원천 `parseCharterCapabilities`→`parseFeatureCapabilities`)
- `shared/src/dashboard-types.ts:56-64` (`CapabilityChangeLink.archived?` 옵셔널 필드 additive)
- `server/src/lib/__tests__/capabilityIndex.test.ts`, `server/src/routes/__tests__/docs.test.ts`, `server/src/routes/__tests__/projects.test.ts` (회귀 테스트)
- 커밋: `acbb418`(feat), `8d7b409`(projects 부작용 회귀 테스트 + design 정직표기), `700981d`(merge), `75e4ab6`(verify PASS)

**변경타입**: backend 주 (서버 lib·라우트·shared 타입) + 소량 shared 타입. **frontend 변경 없음** — node-mapping 배지 렌더 로직 무변경, 입력 데이터 기준(charter→features.md)만 전환. 따라서 criteria 4(UX/UI)·7(반응형)은 "해당 없음(배지 렌더 무변경)".

**실증 검증 입력 (verify.json, 재실행 아님)**: `finalJudgment=PASS`, scenario 4/4 PASS, `archiveGate.open=true`, edge게이트 3 요구사항 전부 "충분". 서버 테스트 22/22 PASS(라이브 curl 실응답 포함), web 1/1(라이브 실픽셀 `evidence/vmap-ff-features.png`). 이 검토는 그 실증분을 **판단 입력으로 인용**하며 재실행하지 않는다.

---

## 반드시 수정해야 할 항목
- 없음

치명(critical) 티어에 올릴 항목 없음. 근거: (1) verify.json PASS·archiveGate open, (2) 핵심 로직 `capabilityIndex.ts`는 읽기전용 파일시스템 스캔·순수 함수(공유 가변상태·쓰기 없음)라 race/데이터손상 표면 없음, (3) 시그니처 불변 설계(D4)로 projects.ts 회귀 방어가 테스트로 고정됨(`projects.test.ts` GREEN, 45 tests PASS 실측). 추측성 치명 항목은 이 티어에 넣지 않는다.

## 수정하면 좋은 항목
- **[정직 표기 — 부작용, 이미 design 결정됨] projects.ts 카드에 archive change 노출** (`server/src/lib/capabilityIndex.ts:147-154` 완화가 공통 소비자 `server/src/routes/projects.ts:97` `buildCapabilityIndex(charterCaps, …)`에도 전파). archive 완화(D2)가 `buildCapabilityIndex` 스캔 범위 자체를 넓히므로, node-mapping 배지뿐 아니라 projects capability 대시보드 카드의 `changes` 응답에도 archive change 가 additive 로 나타난다. **이는 design.md D4(93-98줄)에 "의도된 additive·비파괴 확장"으로 명시·회귀 테스트(`projects.test.ts` archive 부작용 케이스)로 고정된 결정이다 — 버그가 아니다.** 다만 사용자(대시보드를 보는 사람)가 "왜 projects 카드에 완료된 change 가 갑자기 뜨지?"로 혼동할 수 있는 **trade-off** 이므로 고지한다. 국소화가 필요해지면 후속에서 `buildCapabilityIndex`에 옵션 플래그(D2에서 미채택)를 추가하는 경로가 design 에 이미 열려 있다. → **오지적 아님(design 존중), 릴리스 노트/대시보드 툴팁에 "완료(archive)된 change 포함" 표기 권장** 수준.
- **`RE_FEATURE_CAP` 정규식 중복 정의** (`capabilityIndex.ts:24` vs `server/src/parser/featureTreeBuilder.ts:20`). 두 곳이 글자단위 동일(`/<!--\s*capability:\s*([A-Za-z0-9_-]+)\s*-->/`)임을 실측 확인했고, 정합성이 조인의 **암묵적 전제**다(design D1: "featureTreeBuilder RE_CAPABILITY 동형"). 지금은 주석으로만 연결돼 있어, 한쪽만 바뀌면 좌변(노드 capability)과 조인 필터가 소리 없이 어긋난다. 상수를 한 곳에서 export 해 공유하거나, 두 정규식이 동치임을 강제하는 단위 테스트를 추가하면 좋다(기술부채 방어). 현재는 회귀 위험 낮음(양쪽 다 안정 코드).

## 현재 상태로 유지해도 되는 항목
- **archive 완화를 옵션/쿼리 게이트 없이 "항상 포함"으로 둔 것** (D2). "완료돼 archive된 change 의 capability 도 배지로 표시"가 spec Scenario 의 사용자 가치라, 게이트 없는 단순 구현이 정합적. verify 가 이 결정 하에 PASS.
- **`archived?: boolean` 옵셔널 additive 필드** (`dashboard-types.ts:56-64`). 기존 소비자 무시 가능, 후속 시각 구분 여지만 데이터로 실어둠. 배지 UI 는 이 change 에서 불변(설계 원칙 준수). 과잉구현 아님 — spec 이 활성/archive 구분 데이터를 요구.
- **글자단위 정확 비교 유지, 유사도/별칭 맵 미도입** (D3). "거짓연결 0" 불변식(기존 성공 기준)을 지키는 올바른 절제. 안 짠 코드가 정답.
- **`parseCharterCapabilities` 미삭제** (`capabilityIndex.ts:34`). projects.ts 가 계속 소비 — charter 파서 제거는 이 change 범위 밖(폐기 로드맵 별도). 스코프 규율 준수.
- **비파괴 폴백**: features.md 부재 시 빈 Set → 배지 0. wowa-app 라이브 404(`planning_features_not_found`) 크래시 없이 폴백 확인(verify scenario 3).

## 리팩토링 추천 항목
- **정규식 단일 출처화** (위 "수정하면 좋은" 항목과 동일). `RE_FEATURE_CAP`/`RE_CAPABILITY`를 공유 모듈에서 export 하거나 동치성 테스트로 잠근다. 우선순위 낮음(현재 동작 정상).
- **archive 스캔 깊이 상수화**: `capabilityIndex.ts:147-154`의 "archive 1단계 재귀"가 주석으로만 근거화("archive 안에 또 archive 없음"). 미래에 archive 구조가 바뀌면 깨질 수 있으니, dated 디렉토리 컨벤션(`2026-MM-DD-*`)을 코드 레벨 가드/주석 링크로 명시하면 좋다. 단 현재 `isDir(datedDir)` 가드가 stray 파일을 안전히 스킵함을 실측 확인 — 즉시 위험 없음.

## 적대적 검토 (4 페르소나) — 전체 change 스코프 (brief 로 좁히지 않음)
- **파괴자 (Saboteur)**: archive 대량/조인 실패 경로를 공격. → `buildCapabilityIndex`는 `readdirSync`/`statSync` **읽기전용** 순수 스캔이라 race·데이터손상 없음(verify 동시성 na 근거와 일치). archive 하위 stray 파일(비-dated)이 섞이면? → `isDir(datedDir)` 가드로 안전 스킵 실측 확인(현 archive 29개 전부 date-prefixed dir). `dirNamesOf`/`specDirsOf` 모두 `try/catch → []` 폴백이라 읽기 실패가 크래시로 전파 안 됨. **발견**: archive 스캔은 매 `/planning-features` 요청마다 동기 파일시스템 순회(현 change 스캔 = 활성 + archive 29 dated dir × specs 하위). 캐싱 없음 — 규모가 수백 change 로 커지면 요청당 동기 IO 병목 가능(현재는 밀리초, 성능 계약 없음, 배지 파생이라 verify 가 대량=na 처리). 지금 치명 아님, 규모 성장 시 재검토 신호.
- **신입 개발자 (New Hire)**: 6개월 뒤 이해 가능한가. → 함수·변수명이 의도를 설명(`processChange`, `allowedCaps`, `archived`), 주석이 D1~D4 설계 결정과 근거를 촘촘히 연결. **발견**: `buildCapabilityIndex(allowedCaps, …)`가 "source-agnostic 필터"라는 핵심(왜 projects.ts 가 안 깨지는지)은 주석에만 있고 시그니처만 보면 안 드러남 — 호출 두 곳(docs.ts=features / projects.ts=charter)이 서로 다른 집합을 주입한다는 사실이 코드 추적 없이는 비자명. 위 "정규식 중복" 도 신입이 밟을 함정(한쪽만 고침). 심각도 낮음(주석이 방어).
- **보안 감사자 (Security Auditor)**: 파일시스템 스캔 경로로 무엇을 공격하나. → `changesRoot`/`changeDir`/`datedDir`는 모두 서버가 조립한 경로(`join(dirname(dir), "openspec", "changes")`, `readdirSync` 결과)로, **사용자 입력이 경로에 안 들어간다**(path traversal 표면 없음). 정규식은 line 단위 exec, 입력은 features.md 파일 내용(서버 소유) — ReDoS 위험 낮음(`[A-Za-z0-9_-]+` 백트래킹 폭발 없는 문자클래스). 로그·에러에 민감정보 노출 없음(404 는 `planning_features_not_found` 코드만). **발견**: 없음(깨끗함 근거 = 사용자 입력이 스캔 경로/정규식 대상에 도달하지 않음).
- **게으른 시니어 (Lazy Senior)**: 이거 안 짜도 됐나. → diff 는 필요 이상으로 크지 않다. `parseFeatureCapabilities`는 기존 `parseCharterCapabilities`와 대칭 신설(featureTreeBuilder 정규식 재사용, 새 의존성 0). archive 완화는 기존 루프에 분기 1개 추가(`processChange` 헬퍼로 활성/archive 중복 제거 — 오히려 중복 줄임). `archived?` 필드는 spec 이 요구한 데이터. **발견**: `RE_FEATURE_CAP`를 featureTreeBuilder 에서 import 하지 않고 재선언한 것은 "안 짜도 될 코드"(중복 1건) — 표준/기존 자산 재사용으로 없앨 수 있었다. 그 외 과잉구현(불필요 추상화·래퍼·새 의존성) 없음.
- **2+ 페르소나 중복 발견 (심각도 상승)**: **정규식 중복 정의**를 신입(함정)·게으른 시니어(안 짜도 될 코드) 2개 페르소나가 발견 → 심각도 한 단계 상승. 단 상승 후에도 "수정하면 좋은/리팩토링" 티어(치명 아님) — 양쪽 정규식이 현재 동치임을 실측 확인했고 즉시 회귀 없음. 배포 차단 사유 아님.

## 디자인 리뷰
화면 변경 없음(배지 렌더 로직·UI 무변경, diff 에 화면 파일·`prototype.html` 없음) → **디자인 리뷰 생략**. criteria 4(UX/UI)·7(반응형)은 "해당 없음(frontend 변경 없음)".

## 최종 배포 가능 여부
**배포 가능** (치명 0건)

근거: verify.json PASS·archiveGate open(실증), 스코프 국소화·시그니처 불변 설계로 회귀 방어가 테스트로 고정(45 tests PASS 실측), 보안 표면 없음(사용자 입력이 스캔 경로/정규식에 미도달), 파괴자·게으른 시니어 발견은 전부 비-치명(규모 성장 신호 + 정규식 중복 = 기술부채 티어). projects.ts archive 노출은 design 이 명시·테스트로 고정한 **의도된 additive 확장**이라 배포 차단 아님(사용자 고지로 충분). archive 진행 가능.

## 개선 우선순위 (제안)
1. **[고지, 코드수정 아님] projects.ts 카드 archive change 노출 trade-off** — 배포 자체는 OK. 대시보드 사용자 혼동 방지를 위해 릴리스 노트/툴팁에 "완료(archive)된 change 포함" 1줄. (영향: 사용자 인지, design 결정 존중)
2. **정규식 단일 출처화** (`capabilityIndex.ts:24` ↔ `featureTreeBuilder.ts:20`) — 2 페르소나 중복 발견. 한쪽만 바뀌면 좌변/조인 필터 무언 불일치. export 공유 또는 동치성 테스트. (영향: 미래 회귀 방어, 우선순위 중)
3. **archive 스캔 성능/캐싱** — 요청당 동기 파일시스템 순회. 현재 밀리초·성능 계약 없음이나 change 수백 규모 성장 시 재검토. (영향: 미래 확장성, 우선순위 낮음)
4. **archive 스캔 깊이 컨벤션 코드화** — dated 디렉토리 구조 가정을 주석→가드로 승격. `isDir` 가드가 현재 안전망. (영향: 구조 변경 내구성, 우선순위 낮음)
