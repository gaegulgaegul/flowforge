# 배포 전 최종 검토 — flowforge-artifact-restructure

검토일: 2026-07-12 / 검토 범위: 이 change 의 diff(커밋 `0b52cf1`)와 직접 영향 파일만 — 전체 앱 아님.

**검토 대상 파일(20개, +341/-1198):**
- **web (렌더 전환·IA 제거):** `web/src/FeatureListView.tsx`(신규 137L), `web/src/featureTreeAdapter.ts`(다이어그램→리스트 어댑터 `toFeatureTreeList`), `web/src/App.tsx`(253L diff — 두 진입점 배선·IA 상태/effect/핸들러 제거·레이블), `web/src/deeplink.ts`(change 뷰 탭 5→4, `ia` 제거), `web/src/api.ts`(`fetchIA`/`fetchDocsPlanningIa`/`IAResponse` 제거), `web/src/styles.css`(`.ia-node*`·다이어그램 노드 CSS 제거, `.feature-list-*` 추가), 삭제 4종: `IANode.tsx`/`iaAdapter.ts`/`IADetailPanel.tsx`/`FeatureNode.tsx`.
- **server (IA 빌더·라우트 제거):** `server/src/routes/graph.ts`(`/api/changes/:id/ia` 제거), `server/src/routes/docs.ts`(`/api/docs/:project/planning-ia` 제거), 삭제 2종: `iaBuilder.ts`/`planningIaBuilder.ts`, 테스트 삭제: `planningIaBuilder.test.ts`, `graphCrossProject.test.ts`(뷰 루프 배열 `ia` 제거).
- **shared (IA 타입 제거):** 삭제 `ia-types.ts`, `index.ts`(re-export 제거), `screen-types.ts`(주석만 갱신 — 코드 무변경).

**검토 방식:** 정적 diff 리뷰 + verify.json(실증 입력) + 라이브 재확인(browse — `http://localhost:8812` 실픽셀). "정적 검토"와 "실행 검증"을 항목마다 구분 표기.

**verify.json 판단 입력 요약:** finalJudgment=**PASS**, scenario 14/14 PASS, FAIL/검증안함/SKIPPED 0, edge게이트 6요구 전부 "충분", archiveGate.open=true. → 실증 실패 근거가 없으므로 "반드시 수정" 티어는 clean 이 기준선. 이 리뷰는 verify 를 재실행하지 않고 그 결과를 근거로 판단한다.

**review criteria brief (in-session):**
- changeTypes: **[frontend, backend]** — frontend 신호: `.tsx/.ts` web 렌더 파일·`prototype.html` 존재·`styles.css`. backend 신호: `server/src/routes/*.ts` 라우트 제거·`server/src/parser/*.ts` 빌더 삭제·jest 테스트. doc 신호(부수): openspec md·주석.
- criteria in/out: 1 유지보수성=in / 2 과잉구현=in / 3 병목=in(제거 위주라 표면 작음) / 4 UX·UI=**in**(web 변경) / 5 예외처리=in / 6 보안=in / 7 반응형=**in**(web 변경) / 8 확장성=in / 9 치명=in / 10 기술부채=in. out-of-scope 없음(frontend+backend 둘 다라 4·7 포함).
- ruleSets.resolvedFrom: `~/.claude/rules/`. selected: 10-coding-style, 20-testing, 30-security, 60-design, 70-adversarial-review. absent: 없음.
- designYardsticks(design.md Decisions): D1 리스트 렌더·D2 IA 제거 경계(화면 레지스트리 앞에서 멈춤)·D3 화면 id 불변식·D4 딥링크 안전처리·D5 골든 회귀·D6 레이블 구분. Non-Goals(의도적 제외): featureTreeBuilder/`FeatureTree` 타입 무변경, screenRegistry/planning-screens 무변경, features.md 화면목록 문법 무변경, 유저플로우/와이어/PRD 로직 무변경, **feature→screen 새 타깃 뷰 신설은 별도 change(`flowforge-screen-crosslink`)** — 이 change 는 딥링크가 IA 부재로 안 깨지게만.
- specsVerifyFocus: verify.json 6요구 전부 PASS·edge 충분 → 오지적 방지용으로만 소비(추가 FAIL 근거 없음).
- adversarialScope: full change scope (NOT narrowed by this brief).

---

## 반드시 수정해야 할 항목

- 없음

verify.json 이 6요구/14시나리오 전부 PASS·edge게이트 충분·archiveGate.open=true 로 실증했고, 정적 diff 리뷰·라이브 재확인(아래)에서도 배포를 막을 file:line 결함을 찾지 못했다. 치명 티어는 추측 금지 규칙상 비운다.

## 수정하면 좋은 항목

- **[유지보수/기술부채] `SpecTreeNode.tsx` 주석에 삭제된 `IANode` 잔재 참조** — `web/src/SpecTreeNode.tsx:2,7` 이 "IANode와 동형"/"IANode 팔레트 계열"이라고 주석에 남아 있다. `IANode.tsx` 는 이 change 로 삭제됐으므로 6개월 뒤 신입이 존재하지 않는 파일을 찾게 된다. 코드는 무영향(주석만)이라 치명 아님. 한 줄 갱신 권장.
- **[유지보수] 리스트 `<li>` 항목이 계층 시맨틱을 안 실음** — `FeatureListView.tsx:131-135` 는 평탄화된 `<li>` 들을 한 `<ul>` 밑에 flat 으로 나열하고 위계는 CSS `--feature-depth` 좌측 패딩(`styles.css`)으로만 표현한다. 스크린리더/접근성 관점에서 요구사항>기능>상세기능 중첩이 DOM 트리로 드러나지 않는다. 이 change 의 spec THEN 은 "들여쓴 트리/리스트로 표시"까지만 요구하므로 acceptance 는 충족(과충족 아님). 접근성 강화는 후속으로 충분.
- **[테스트/기술부채] FeatureListView·`toFeatureTreeList` 단위테스트 부재** — spec 의 TDD Plan 이 "web/src 단위테스트 0" 을 근거로 라이브 픽셀 검증으로 대체했고 verify 가 실픽셀로 커버했다(정당한 설계 결정). 다만 어댑터 `toFeatureTreeList`(연결화면 조인·audit 병합·linkedChanges 상속·평탄화)는 순수함수라 web 단위테스트 없이도 vitest/jest 로 테스트 가능한 로직이다. 회귀 안전망으로 후속 보강 권장(이 change 배포를 막을 사유는 아님 — 조인 회귀는 서버 `planning-screens` 골든 8/8 + 라이브 칩 교차확인으로 이미 실증됨).

## 현재 상태로 유지해도 되는 항목

- **IA 제거의 경계가 design.md D2/D3 불변식을 정확히 지킴** — `screenRegistry.ts`·`shared/src/screen-types.ts`(코드)·`/api/docs/:project/planning-screens`·`fetchPlanningScreens` 무변경. 라이브 curl 재확인: `planning-ia`=404, `planning-screens`=200, `planning-features`=200. 화면 id 데이터원 회귀 0(정적 + 라이브 실증).
- **`screen-types.ts` 변경이 주석 한정** — diff 확인 결과 `predictive` 주석의 stale IA 참조를 "IA 뷰는 flowforge-ia-removal 로 제거됨" 으로 갱신한 것뿐, 타입·코드 무변경. Non-Goal("screen-types 무변경") 위반 아님 — 오히려 오해 소지 있던 주석을 바로잡음.
- **레이블 구분(D6)이 라이브에서 확인됨** — planning 탭 `기획 기능명세`(App.tsx), change 탭 `명세(change)`(App.tsx). 라이브 plan-tabs=[PRD, 기획 기능명세, 와이어프레임, 유저플로우](IA 부재), 두 계보 레이블 상이. 노드타입은 이미 `specTree` vs `featureTree` 로 코드 분리돼 있어 레이블만 조정.
- **D4 딥링크 안전처리가 런타임 에러 0** — `App.tsx` `selectScreenInIa`→`selectScreenChip` 로 축소, IA 타깃 참조 제거·상태바 안내 no-op 로 처리. 라이브 클릭 재확인: 상태바 `연결 화면: 기획 뷰 (유저플로우 탭의 해당 화면 노드에서 상호참조를 볼 수 있습니다)` 표시, 탭 전환 없음, console error 0.
- **삭제 파일 7종 전부 부재 + dead reference 0** — `IANode.tsx`/`iaAdapter.ts`/`IADetailPanel.tsx`/`FeatureNode.tsx`/`iaBuilder.ts`/`planningIaBuilder.ts`/`ia-types.ts` 모두 absent. 라이브 web/server 소스에 IA 라이브 참조 0(SpecTreeNode.tsx 주석 2건만). verify: typecheck exit 0·server jest 528/528 green.

## 리팩토링 추천 항목

- **`FeatureListView.tsx` 의 시각 토큰(KIND_STYLE/PRIORITY_COLOR/STATUS_COLOR/AUDIT_BADGE)이 삭제된 FeatureNode 와 "정렬"이란 주석으로만 동기화됨** — 원래 `FeatureNode.tsx` 가 이 상수들을 갖고 있었고 리스트로 옮기며 "FeatureNode.KIND_STYLE과 정렬" 주석을 달았다(`FeatureListView.tsx:18,25,32,40`). 이제 FeatureNode 는 삭제됐으니 "정렬 대상" 이 사라져 이 색상 상수들이 단일 진실원(single source)이 됐다 — 오히려 상태가 나아졌다. 다만 change spec-tree(`SpecTreeNode`)와 색 팔레트가 겹치므로, 두 뷰가 공유할 색 토큰을 shared 상수 파일로 추출하면 드리프트를 원천 차단할 수 있다(선택).
- **어댑터 `toFeatureTreeList` 의 조건부 스프레드 즉시실행함수(IIFE) 패턴** — `featureTreeAdapter.ts:171-182` 의 `...((): {...} => {...})()` IIFE 2곳은 조건부 키 부착을 위한 것이나 가독성이 낮다. `parentRef`/`linkedChanges` 를 미리 계산해 조건부 스프레드로 붙이면 6개월 뒤 신입이 읽기 쉬워진다(동작 동일, 순수 리팩토링).

## 적대적 검토 (4 페르소나)

- **파괴자 (Saboteur)**: 리스트 렌더 경로의 null/빈/대량 엣지를 훑음. ①빈 트리 → `FeatureListView.tsx:127-129` 가 `items.length===0` 일 때 "표시할 기능명세 항목이 없습니다" 안내(`feature-list-empty`) 렌더 — 방어 있음. ②`planningFeatures=null` → `App.tsx` effect 가 `setFeatureItems([])` 로 비움 — crash 없음. ③audit/screen 미로드(fetch 실패) → 어댑터가 `undefined` 로 넘겨 배지/칩만 생략(D-6/D-4) — 무영향. ④dangling 화면 id(레지스트리에 없는 링크) → `featureTreeAdapter.ts:129` 가 `screenLabelById.get(id) ?? id` 로 label=id 노출(숨기지 않음) — 의도적 안전처리. **발견: 없음(깨끗함 근거 — null/빈/대량/fetch실패 4경로 전부 방어 확인, verify edge게이트 "충분"과 정합).** 굳이 꼽자면 대량(수천 항목) 시 flat `<ul>` 가상화 없음 → 현 실사용 53항목이라 병목 아님(criteria 3).
- **신입 개발자 (New Hire)**: 6개월 뒤 이해도. 파일 상단 주석이 D1/D4 결정과 file:line 을 명시해 의도 추적이 쉬움 — 좋은 편. **발견 2건(수정하면 좋은 티어에 병합):** ①`SpecTreeNode.tsx:2,7` 주석이 삭제된 `IANode` 를 참조 → 존재하지 않는 파일을 찾게 됨. ②`FeatureListView.tsx` 색 상수 주석 "FeatureNode.KIND_STYLE과 정렬" 이 삭제된 파일을 가리킴(이제 single source 라 무해하나 주석은 오해 유발). 매직넘버는 `--feature-depth * 22px`(styles.css) 정도인데 리스트 들여쓰기 단위라 문맥상 명확.
- **보안 감사자 (Security Auditor)**: 공격 표면. ①이 change 는 라우트를 **제거**만 함(신규 입력 표면 0). ②리스트 라벨은 React 텍스트 노드로 렌더(`FeatureListView.tsx:70,84,90,95,104,110`) — 자동 이스케이프, XSS 표면 없음(verify naReason 과 정합). ③`title`/`data-testid` 속성도 문자열 바인딩(dangerouslySetInnerHTML 부재). ④제거된 IA 라우트가 인증 우회 경로였을 가능성 → 아니오(읽기전용 파생 뷰였음). **발견: 없음(깨끗함 근거 — 순수 제거 + 텍스트 노드 렌더, 신규 인젝션/인가 벡터 0).** rate limiting 등은 이 change 범위 밖(public-surface-hardening 별도 change 소관).
- **게으른 시니어 (Lazy Senior)**: 안 짜도 됐나(과잉구현). ①`FeatureListView` 신규 컴포넌트가 정말 필요? → 예. 다이어그램 대체가 spec THEN("리스트로 렌더")이고, 기존 FeatureNode(RF 노드)를 재활용할 수 없음(RF 캔버스 자체를 걷어내는 게 목적). ②어댑터를 새로 짰나 아니면 기존 걸 줄였나? → `toFeatureTreeFlow`(dagre 좌표계산 194L)를 `toFeatureTreeList`(평탄화 187L)로 **교체**하며 전체 diff 가 **-1198/+341** 로 순감(857L 감소) — 안 짠 코드가 늘어난 방향(가장 좋은 코드는 안 짠 코드). ③새 의존성 도입? → 없음(dagre/ReactFlow 를 기능명세 경로에서 **제거**, 패키지는 타 뷰가 써서 유지). **발견: 과잉구현 없음(깨끗함 근거 — net -857L, 신규 의존 0, 표준/기존 재사용).** 굳이 꼽으면 조건부 스프레드 IIFE(위 리팩토링 항목)가 살짝 부풀었으나 로직상 불필요 코드 아님.
- **2+ 페르소나 중복 발견(심각도 상승):** `SpecTreeNode.tsx`·`FeatureListView.tsx` 의 **삭제된 IANode/FeatureNode 참조 잔재 주석** 을 신입(①②)과 리팩토링 관점이 함께 지적 → "수정하면 좋은" 상단으로 우선순위 상승(단 코드 무영향이라 치명 승격은 아님).

## 최종 배포 가능 여부

**배포 가능**

근거: verify.json 이 6요구/14시나리오 전부 PASS·edge게이트 6/6 "충분"·archiveGate.open=true 로 **실증**했고, 정적 diff 리뷰에서 배포를 막을 file:line 결함이 없으며, 라이브(browse 실픽셀) 재확인으로 ①리스트 렌더(.react-flow 0, depth 0/1/2, screen chip) ②IA 라우트 404·탭 부재 ③레이블 구분 ④D4 딥링크 no-op(console error 0) ⑤화면 id 데이터원(planning-screens 200) 회귀 0 을 관측했다. 4페르소나 적대 패스에서 치명 발견 0, 남은 항목은 전부 "수정하면 좋은/리팩토링" 티어(주석 잔재·접근성 시맨틱·단위테스트 보강)로 배포 후 처리 가능. → **archive 진행 가능.**

## 개선 우선순위 (제안)

1. **[낮음·즉시] `SpecTreeNode.tsx:2,7`·`FeatureListView.tsx` 주석의 삭제된 IANode/FeatureNode 참조 갱신** — 6개월 뒤 신입 혼동 방지. 코드 무영향, 1~2줄. (2+ 페르소나 중복 지적)
2. **[중간·후속] `toFeatureTreeList` 순수함수 단위테스트 추가** — 연결화면 조인·audit 병합·linkedChanges 상속·평탄화 depth 회귀 안전망. 현재는 서버 골든+라이브 픽셀로만 커버.
3. **[낮음·선택] 리스트 접근성 시맨틱** — flat `<ul>` + CSS 들여쓰기 → 중첩 리스트 또는 `aria-level`/`role=treeitem` 으로 스크린리더 위계 노출(spec acceptance 는 이미 충족, 강화용).
4. **[낮음·선택] 공유 색 토큰 추출·조건부 스프레드 IIFE 정리** — SpecTreeNode↔FeatureListView 팔레트 드리프트 차단 + 어댑터 가독성. 순수 리팩토링(동작 불변).
