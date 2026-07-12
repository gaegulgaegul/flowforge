# 배포 전 최종 검토 — flowforge-screen-crosslink
검토일: 2026-07-12 / 검토 범위: 이 change 의 diff 만 (전체 앱 아님)

**검토 범위 (crosslink diff 한정, 커밋 cdfafab·591b2d4·cebb126·d51ffe9)**
- `shared/src/graph-types.ts` — `GraphNode.screenId?: string` 옵셔널 추가 (비파괴)
- `server/src/parser/planningUserFlowBuilder.ts` — 화면 노드에 바레 `screenId`(mermaidId 소문자) 파생 + 테스트
- `web/src/screenCrosslink.ts` — 순수 조인 헬퍼 4종 (신규) + `web/src/__tests__/screenCrosslink.test.ts`
- `web/src/FlowDetailPanel.tsx` — 화면 노드 상호참조 2섹션(와이어/기능명세) + `web/src/__tests__/FlowDetailPanel.test.tsx`
- `web/src/App.tsx` — 조인 인덱스(useMemo)·crosslink 배선(부분)
- `web/src/graphAdapter.ts` — `SpecNodeData.screenId` 통과
- `web/src/styles.css` — `.flow-detail-wire-preview` 프리뷰 스케일 규칙(8줄)

> 병합 커밋 2299ca8 에 artifact-restructure 가 섞여 있으나, 그 파일들(wireDocs·capabilityIndex·auditTrigger 등)은 **본 review 범위 밖**으로 제외했다.

**change 타입**: frontend(패널 UI·CSS·조인 헬퍼·App 배선) + backend(파서 screenId 파생·shared 타입). → criteria 4·7 in-scope, 디자인 리뷰 게이트 발동.
**rule 세트**: `~/.claude/rules/` 에서 해석 — 10-coding-style, 20-testing, 30-security, 60-design, 70-adversarial-review 적용. `.claude/rules/`(repo) 부재.
**design yardstick**: D1(서버가 바레 screenId 부여, web 파싱보다 채택)·D2(역인덱스 Map)·D3(와이어 lookup Map, 첫등장 유지)·D4(패널은 조인 안 함·App 이 조인)·D5(딥링크 약결합 — 인앱 탭 전환 폴백 허용). **의도적 제외**: 양방향 편집·change 경로 조인·새 화면 id 스킴·기능명세 라벨 딥링크(라벨 표시만 필수).

**verify 입력 (실증 — openspec-verify, 재실행 아님)**: `verify.json` finalJudgment=**PASS**, archiveGate.open=true. scenario 7/7 PASS·FAIL 0·검증안함 0·SKIPPED 0. edgeCase 3요구 전부 "충분". server 12/12·web 13/13(헬퍼 8 + 패널 5) + gstack 라이브 실픽셀 5시나리오. android/ios=적용불가(웹 SPA). → **깨끗한 검증 입력**이며, 아래 판단은 이 위에서 이루어진다.

**본 review 의 실행 관찰(정적 검토와 구분)**: 라이브 `http://localhost:8812` 를 browse 로 구동해 유저플로우 탭→화면 노드 `uflow-x-skeleton`(프로젝트 기획 뷰) 클릭 → 상세 패널에 (a)🖥️ 연관 와이어프레임 = `WireframeDeviceFrame` 라이브 프리뷰(`wf-df-desktop`) + "와이어 탭에서 열기 ▶", (b)📋 연관 기능명세 = 칩 2개(`planning-prd 라우트 조회`, `planning-features 라우트 조회`)가 렌더됨을 **실관찰**. 데스크탑 스크린샷·DOM assert 확인. 모바일(390px) 바텀시트 CSS 확인(border-radius·full-width·translateY) + **페이지 수평 스크롤 0**. 앱 콘솔 에러 0(신규 로드 시). 0매칭/dangling 빈 상태는 verify.json 스크린샷(vxl-10)으로 실증분 인용(본 세션에선 해당 노드가 뷰포트 밖이라 재클릭은 timeout — verify 실증분으로 대체).

---

## 반드시 수정해야 할 항목
- 없음

(치명 티어 요건인 `file:line` 증거를 동반한 배포 차단급 결함이 발견되지 않았다. verify PASS·라이브 실관찰·앱 콘솔 에러 0.)

## 수정하면 좋은 항목

- **`web/src/App.tsx:926` — "와이어 탭에서 열기 ▶" 가 특정 화면으로 포커스하지 않고 wire 탭만 연다.** `openWireForScreen = (_screenId) => { setPlanTab("wire"); ... }` — 인자 `_screenId` 가 언더스코어 prefix(미사용)다. 사용자는 그 화면의 와이어를 기대하고 클릭하지만, 와이어 탭의 기본(첫 화면)이 열린다. `WireframeDeviceFrame` 은 `focusTarget`(`WireframeDeviceFrame.tsx:104`)으로 특정 screenId·device 포커스를 이미 지원하므로, 그 화면으로 스크롤/활성화하면 UX 가 완결된다. **단 design D5 가 "약결합 — 인앱 탭 전환 폴백"을 명시적으로 허용**하므로 배포 차단은 아니다(의도된 폴백). 후속 딥링크 change 에서 focusTarget 배선 권장. (criteria 4)

- **`web/src/styles.css:727-734` — `.flow-detail-wire-preview` 의 `transform: scale(0.6)` + `width: 167%` + `margin-bottom: -40%` 조합이 취약하다.** 라이브에서 겹침·오버플로우 없음을 실측(preview.bottom < features.top, 페이지 수평 스크롤 0)했으나, 세 매직값이 서로 상쇄로만 성립한다 — 프리뷰 콘텐츠 높이가 바뀌면 `-40%` 음수 마진이 과보정/미보정될 수 있다(하드코딩된 비율 가정). `transform-origin` + 컨테이너 `overflow: hidden` 로 clip 하거나 CSS `zoom`/aspect-ratio 박스로 대체하면 견고해진다. (criteria 7·기술부채)

- **`web/src/FlowDetailPanel.tsx:220` — 연관 기능명세 칩 컨테이너가 `feature-detail-badges` 클래스를 쓰지만, 개별 칩은 `feature-detail-screen`(연결화면 칩 스타일) 이다.** 시각적으로는 일관(teal 칩)하나 클래스 의미가 어긋난다(badges 안에 screen 칩). 라이브 렌더는 정상이므로 기능 문제는 아니지만, 6개월 뒤 유지보수자가 혼동할 수 있다(신입 페르소나). 클래스명을 용도에 맞게 정리하면 좋다. (criteria 1)

## 현재 상태로 유지해도 되는 항목

- **`web/src/screenCrosslink.ts` 전체 — 순수 헬퍼 4종.** 파일 IO·React 의존 0, `null|undefined` 방어(`registry?.links ?? []`, `screenId === undefined` early return), Map 기반 O(1)/O(n) lookup. 8개 단위 테스트로 정상 N:M·0매칭·dangling·빈/미제공·같은 id 여러 디바이스 첫등장 유지까지 커버. D2/D3 설계 결정 그대로 구현. 과잉구현 없음.

- **`server/src/parser/planningUserFlowBuilder.ts:175` — screenId 파생 한 줄.** `...(n.kind === "screen" ? { screenId: n.mermaidId.toLowerCase() } : {})` — `exactOptionalPropertyTypes` 하에서 화면 아닌 노드는 키 자체를 생략(비파괴). IA 의 screenId 부여와 대칭(D1 채택 근거). 파서 단위 테스트가 화면=screenId·시작/행동=undefined 를 못박음.

- **`shared/src/graph-types.ts` `GraphNode.screenId?`** — 옵셔널·비파괴. change/골든 경로는 undefined. 3층(shared/server/web) 변경이 최소 폭.

- **`FlowDetailPanel.tsx:188` `isScreen` 가드** — 화면 노드가 아니면 상호참조 섹션 자체를 안 그림(E.1). 기존 흐름 뷰 회귀 0(라이브·jsdom 병행 확인). 데이터는 App 이 조인해 props 주입, 패널은 조인 안 함 — `FlowDetailPanel.tsx:8` "조인/서버 왕복 없음" 원칙 유지.

- **`selectFeatureLabelFromFlow`(App.tsx:933) 가 라벨 식별(status)만 하고 딥링크 안 함** — design D2/D.2 가 "라벨 표시 필수, 딥링크 선택(features 노드 id 는 `feat-...`라 라벨 문자열 딥링크 취약)"을 명시. 의도된 범위이므로 누락이 아님(게으른 시니어 오지적 방지).

## 리팩토링 추천 항목

- **와이어 프리뷰 스케일 CSS(styles.css:727)를 매직 비율 3개 대신 컨테이너 클리핑 패턴으로.** (위 "수정하면 좋은" 두번째와 동일 — 기술부채 티어로 재수록)
- **`onOpenWire` 시그니처를 살려 focusTarget 딥링크 완결.** 후속 `flowforge-deeplink-url` change 와 병합 시 `_screenId` → 실제 화면 포커스로 승격.

## 적대적 검토 (4 페르소나)

- **파괴자 (Saboteur)**: dangling screenId·화면 아닌 노드·연결 0개 엣지를 공격 → 모두 방어됨. `wireForScreen`/`detailLabelsForScreen` 이 `undefined`·미존재 id 를 `null`/`[]` 로 반환하고(screenCrosslink.ts:39,65), 패널은 빈 상태 문구로 렌더(FlowDetailPanel.tsx:211,234). verify.json E.2/E.3 스크린샷(vxl-10, graphAlive=13, 무크래시)이 실증. **동시성/race**: 읽기 전용 useMemo 파생(쓰기 없음)이라 해당 없음. **잔여 리스크 1건**: `openWireForScreen` 이 `setSelectedFlow(null)` 로 패널을 닫으면서 wire 탭 전환 — 전환 중 사용자가 기대한 화면이 안 열림(위 "수정하면 좋은" 1번). 크래시는 아님.
- **신입 개발자 (New Hire)**: `screenCrosslink.ts`·주석·명명(`buildScreenToDetailLabels`/`wireForScreen`)이 의도를 잘 설명. **발견 1건**: `styles.css:727` 의 `width:167%`·`margin-bottom:-40%` 는 유래 주석이 없어 6개월 뒤 "왜 167%?" 를 유발한다(scale 0.6 의 역수 1/0.6≈167% 라는 계산 근거가 코드에 없음). **발견 2건**: 기능명세 칩이 `feature-detail-badges` 컨테이너 + `feature-detail-screen` 아이템으로 클래스 의미가 섞임(위 criteria 1).
- **보안 감사자 (Security Auditor)**: 인젝션/민감정보 노출 벡터 탐색 → 없음. screenId 는 서버 파서가 `mermaidId.toLowerCase()`(영숫자 slug)에서만 파생 — 사용자 입력 주입 경로 없음. detailLabel/와이어 title 은 React 텍스트 노드로 렌더(자동 이스케이프). **주의 관찰**: `WireframeDeviceFrame` 이 `crosslink.wire.html`(features.md 파생 와이어 HTML)을 프리뷰로 렌더하는데, 이 html 은 **본 change 가 만든 게 아니라 기존 와이어 산출물**을 재사용할 뿐(신규 XSS 표면 추가 0). html 신뢰 경계는 와이어 저작(승인 위저드) change 소관 — 본 change 범위 밖이나, 프리뷰 재사용으로 표면이 넓어지지 않음을 확인. 인증/인가·rate limit 은 읽기 파생이라 무관.
- **게으른 시니어 (Lazy Senior)**: "이거 안 짜도 됐나?" → **과잉구현 없음**. (1) 조인키를 web 에서 id 문자열 파싱(안 B)으로 파생하면 서버 무변경으로 됐지만, design D1 이 "id 포맷 변경 시 조용한 dangling" 위험 때문에 서버 부여(안 A)를 근거와 함께 택함 — 정당한 트레이드오프(더 짠 게 아니라 더 견고). (2) `WireframeDeviceFrame` 을 새로 안 만들고 `hideControls` 프리뷰 모드로 재사용 — 기존 컴포넌트 활용(YAGNI 준수). (3) 역인덱스/lookup 을 별 라이브러리 없이 표준 `Map` 으로 — 새 의존성 0. **발견(경미)**: `buildWireById` 의 "같은 id 여러 디바이스 → 첫등장 유지" 주석이 실제로는 desktop 이 먼저 온다는 데이터 순서 가정에 의존(screenCrosslink.ts:52). 지금은 맞지만 데이터 순서가 바뀌면 mobile 프리뷰가 잡힐 수 있음 — 한 줄 방어(device==="desktop" 우선)로 견고해지나, 필수는 아님(현재 데이터 정합).
- **2+ 페르소나 중복 발견 (심각도 상승)**: `styles.css:727` 프리뷰 스케일 CSS 를 **신입(매직값 주석 없음)** + **파괴자(비율 상쇄 취약)** 가 함께 지적 → 심각도 한 단계 상승. 단 라이브 실측상 오버플로우·겹침이 실제로는 발생하지 않으므로(preview.bottom < features.top, 페이지 수평 스크롤 0) 여전히 "**수정하면 좋은/기술부채**" 티어(배포 차단 아님). file:line 있음(styles.css:727-734).

## 최종 배포 가능 여부

**배포 가능**

근거: verify.json PASS(scenario 7/7·edge 3/3 충분·FAIL 0·SKIP 0) + 본 세션 라이브 실관찰(데스크탑 상호참조 정상·앱 콘솔 에러 0·모바일 페이지 수평 스크롤 0). "반드시 수정" 티어 0건. 발견된 항목은 전부 UX 완결도/CSS 견고성/명명 정리 수준으로 배포를 막지 않으며, design Decisions(특히 D5 약결합)에 부합하는 의도된 선택이거나 후속 딥링크 change 로 자연히 승격될 항목이다. → **openspec-archive 진행 가능.**

## 개선 우선순위 (제안)

1. **(중) 와이어 탭 열기 딥링크 focusTarget 배선** — `App.tsx:926` `openWireForScreen` 이 특정 화면으로 포커스하도록. 사용자가 기대한 화면이 바로 열림(UX 완결). 후속 `flowforge-deeplink-url` change 와 병합이 자연스러움.
2. **(중·심각도상승) 프리뷰 스케일 CSS 견고화** — `styles.css:727` 매직 비율 3개 → 컨테이너 클리핑/aspect-ratio 로. 2페르소나 중복 지적, file:line 확정. 현재 미발현이나 프리뷰 높이 변화에 취약.
3. **(하) 기능명세 칩 클래스 의미 정리** — `FlowDetailPanel.tsx:220` badges 컨테이너 + screen 아이템 혼용. 시각 정상, 유지보수 가독성만.
4. **(하) `buildWireById` device 우선 방어** — `screenCrosslink.ts:52` desktop 명시 우선(현재 데이터 순서 의존). 데이터 순서 변경 대비.
