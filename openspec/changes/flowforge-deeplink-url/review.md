# 배포 전 최종 검토 — flowforge-deeplink-url
검토일: 2026-07-10 / 검토 범위: `web/src/deeplink.ts`(신규 51줄), `web/src/App.tsx`(수정 +67/-15). tasks.md는 문서 산출물이라 코드 리뷰 대상 아님.

> 변경 유형: **frontend**(.ts/.tsx, web SPA, URL 라우팅). 적용 룰셋: 60-design.md(설계 게이트) + 70-adversarial-review.md(적대 리뷰) + 10-coding-style.md(소스 변경 상시). 판단 근거로 design.md의 D1(pushState 채택)·D5(순수헬퍼 단일화)·"의도적 제외"(react-router 미도입, 탭 내부 상태 URL 미반영, 서버 무변경)를 사용해 **의도적으로 제외된 항목을 누락으로 오분류하지 않는다.**

## 10기준 in/out 스코프 판정 (한 줄 사유)
1. **정확성/버그** — 스코프. pushState 3지점·복원 2 useEffect의 로직 검토.
2. **과설계/오버엔지니어링** — 스코프. 네이티브 history 채택(react-router 미도입, D5)은 의도적 최소화. 작성된 코드가 최소인지 판단.
3. **네이밍/가독성** — 스코프. 순수헬퍼·주석·상수(TABS/DEFAULT_TAB) 검토.
4. **UI/디자인 정합** — 스코프(frontend). 단 라우팅만이라 신규 UI 0 → 시각 회귀 위험 낮음(§설계 게이트).
5. **예외/로딩 처리** — 스코프. 복원이 기존 `.catch(setStatus)` 경로를 깨는지.
6. **보안** — 스코프. URL 파라미터는 공격자 제어 입력 → 화이트리스트·인코딩·XSS·오픈리다이렉트 검토.
7. **접근성/반응형** — 스코프(frontend). 단 기존 버튼 마크업(`aria-pressed`·`data-testid`)을 그대로 두고 onClick만 확장 → 회귀 없음.
8. **테스트 커버리지** — 부분 스코프. web에 테스트 러너 없음(순수헬퍼=typecheck, 배선=VERIFY 라이브). 이 전제는 tasks/design에 명시됨.
9. **성능** — out. URL 3파라미터 고정·pushState 클릭당 1회, 성능 영향 없음.
10. **문서/주석 정합** — 스코프. 코드 주석이 실제 동작과 일치하는지.

## 반드시 수정해야 할 항목
- 없음

## 수정하면 좋은 항목
- 없음. (아래 "적대적 검토"의 popstate-then-grid 시 `selected` 미클리어 관찰은 렌더 분기가 `dashStage`만 보므로 무해 — "유지해도 되는 항목"으로 분류.)

## 현재 상태로 유지해도 되는 항목

- **verify의 `조건부`(S1.1 검증 안 함)는 코드 결함이 아니라 검증환경 한계다 — 배포 게이트가 아님.**
  근거(코드로 재확인):
  - S1.1의 pushState 코드는 `App.tsx:932-936`에 **존재**한다(`if (change.project)` 가드 `:931` → `serializeDeepLink({project, change, tab:"prd"})` → `history.pushState`). typecheck EXIT 0.
  - `openChangeViews`(`:923`)는 오직 `CapabilityChangeList`의 `onOpenChange` 프롭(`App.tsx:1267`)에서만 호출된다. `CapabilityChangeList`는 `capChanges` 단계에서만 렌더되고, 그 단계는 `.dash-cap` 버튼(`:1214`, `openCapability` `:896→911`)으로만 진입한다. `.dash-cap`은 `planTabsAvail.length === 0`(`:1205`, 기획문서 없는 프로젝트)에서만 렌더된다.
  - 라이브 데이터에선 capability를 가진 프로젝트(flowforge 24·wowa-app 11)가 전부 "기획 있음"이라 `.dash-cap`이 숨겨지고, "기획 없음" 프로젝트들은 capability가 0개다. 그래서 **현재 라이브에 `openChangeViews`로 가는 UI 클릭 경로가 없다** → S1.1의 WHEN(인앱 진입 클릭)을 실행할 수 없었다.
  - 그러나 pushState를 실행하는 **동일 기계**(`serializeDeepLink` + `history.pushState`)는 S1.2(탭전환, `:957-961`)·S1.3(5탭 연속)에서 **라이브 스크린샷으로 PASS 입증**됐다(history.length +1/클릭, distinct `tab=` URL). serialize/pushState의 정확성은 이미 실증된 것이고, S1.1이 못 실행된 것은 *진입 UI 도달성*이라는 별개 축이다.
  - `.dash-cap` 진입 UI의 도달성은 **이 change의 범위 밖**이다. 이 change는 "URL 라우팅을 추가"할 뿐 capChanges 진입 UI를 추가·변경하지 않는다(design.md "의도적 제외": skeleton/capChanges 단계의 딥링크·진입 UI는 범위 밖). 즉 S1.1은 **선존(pre-existing) UI-도달성 특성 + 현재 라이브 데이터**의 아티팩트이지, 딥링크 코드의 결함이 아니다.
  - **결론: `조건부`는 검증환경 한계이며 코드 레벨 배포 차단 사유가 아니다.** archiveGate.open=false(검증 안 함 1건)는 verify 도구의 기계적 판정이지, 코드 결함의 신호가 아니다.

- **URL 조립/파싱 단일화(D5 준수) — 확인됨.** `grep '?project=' web/src/App.tsx`의 3건은 전부 주석(`:102,:346,:929`)이고 실제 조립은 없다. 모든 pushState가 `serializeDeepLink` 경유(`:935,:960`), views 이탈은 `window.location.pathname`(`:947`), 파싱은 `parseDeepLink` 2곳(`:251,:263`). 인라인 `?project=...` 문자열 조립 0건 → URL 표현 드리프트 방지 달성.

- **`Tab` 타입 단일 정의 — 확인됨.** `App.tsx`의 `type Tab` 정의를 제거하고 `deeplink.ts:14`의 `Tab`(`TABS` 튜플 파생)을 import(`:79`)한다. 화이트리스트와 타입이 한 곳(`deeplink.ts:11 TABS`)에서 파생 → 스킴-타입 드리프트 방지.

- **복원이 기존 `.catch(setStatus)` 경로를 보존 — 확인됨.** 마운트 복원(`:251-257`)·popstate(`:263-271`)는 `setSelected`/`setSelectedProject`만 세팅하고 fetch를 추가하지 않는다. 데이터 로딩은 기존 `[selected, selectedProject]` effect(`:218-245`)가 트리거되며, 그 effect의 5개 `.catch((e)=>setStatus(...))`(`:231,234,237,240,243`)가 그대로 실패를 상태바에 표시한다(S4.2 라이브 PASS: "PRD 로드 실패: Error: prd 404"). 신규 예외 경로 없음.

- **popstate→grid 시 `selected` 미클리어 — 무해.** popstate `else` 분기(`:270`)는 `setDashStage("grid")`만 하고 `selected`를 비우지 않는다. 그러나 메인 렌더 분기(`:1045`)는 `dashStage`만 보고 grid를 그리며, `selected`를 쓰는 crumb(`:1026`)는 `dashStage === "views"`로 가드된다 → grid 상태에서 stale `selected`가 화면에 새지 않는다. S3.2 라이브 PASS(back→grid 카드 표시)로 실증됨. 클리어 추가는 불필요한 코드라 현행 유지가 맞다(게으른 시니어 관점 일치).

- **`change.project === undefined` 시 pushState 스킵 — 올바른 결정.** 전역 진입 change는 `?project=`가 없어 왕복 복원이 불가하므로, URL을 남기지 않는 편이 마운트 복원(project·change 둘 다 필수, `deeplink.ts:35`)과 일관된다. 잘못된 딥링크를 만들지 않는 보수적 선택 — 유효 케이스를 조용히 버리는 게 아니다(왕복 불가 케이스만 스킵).

- **탭 전환 `if (selectedProject && selected)` 가드 — 올바름.** 둘 다 있을 때만 pushState. views 단계에서는 항상 둘 다 세팅돼 있으므로 정상 케이스를 누락하지 않고, 방어적으로만 작동한다.

## 리팩토링 추천 항목
- 없음(리팩토링은 이미 REFACTOR 태스크에서 완료 — 단일화·타입 이관 확인됨). 굳이 꼽자면 마운트 복원과 popstate의 4-setState 블록이 동형이라 헬퍼로 뽑을 수 있으나, 2회 반복·6줄 규모라 추출이 오히려 간접화를 늘림 → **추천 안 함**.

## 적대적 검토 (4 페르소나)
- **파괴자**: (1) in-flight fetch 중 popstate — 마운트 fetch가 도착하기 전 뒤로가기해도, 데이터 로딩 effect가 `selected` 변화에 재트리거되고 이전 change 상태를 먼저 null로 비운다(`:221-224`) → stale 플래시 없음. race로 앱이 깨지는 경로 없음. (2) 빠른 탭 연타 — 클릭당 pushState 1회로 히스토리가 쌓이지만(S1.3에서 +1/클릭 실측) 각 항목이 유효 URL이고, 뒤로가기는 그걸 순서대로 되짚을 뿐 — 스택 오염이 아니라 정상 히스토리. (3) malformed search string — `URLSearchParams`가 파싱을 흡수하고, project/change 누락 시 `null`(`:35`)로 grid 폴백(S4.3 PASS). throw 경로 없음. **결함 없음(clean-basis: 3개 파괴 벡터 모두 방어 확인).**
- **신입 개발자**: 6개월 후 가독성 양호 — `deeplink.ts`가 스킴/순수성/단일화 규약을 주석으로 명시하고, `TABS`/`DEFAULT_TAB` 명명 상수로 매직값 없음. App.tsx의 각 pushState에 "왜 이 가드인지"(전역 진입 왕복 불가) 주석이 있음. 유일한 암묵 가정 = "SPA index.html 폴백이 딥링크 새로고침을 처리"인데 design.md D1에 근거가 문서화돼 있음. **개선 지적: 없음(코드에 자족적). clean-basis 성립.**
- **보안 감사자**: URL 파라미터는 공격자 제어 입력이다. 방어 3중 확인 — (1) `tab`은 화이트리스트 5종으로 정규화(`isTab`→`DEFAULT_TAB`, `:38`), 임의 값이 뷰로 새지 않음(S4.1 PASS). (2) `project`/`change`는 `encodeURIComponent`로 인코딩(`:48-49`)해 fetch 쿼리에 실림 — 쿼리 인젝션 차단, 서버 경로 방어는 기존 API 계약(무변경). (3) pushState는 `serializeDeepLink`의 **상대 URL(`?...`)** 또는 `window.location.pathname`만 쓴다 → 절대 URL·외부 origin을 조립하지 않으므로 오픈리다이렉트 벡터 없음. (4) 파라미터는 fetch 쿼리·React 텍스트로만 흐르고 `innerHTML` 주입 없음 → XSS 없음. **잔여 리스크: `change` 파라미터의 경로탐색(`../`)은 서버 방어에 의존(이 change 무변경 전제) — 프론트 인코딩+서버 경로방어 이중이라 수용 가능하나, 서버 방어가 이 스코프 밖임을 명시.**
- **게으른 시니어**: 안 써도 될 코드 없음 — react-router 미도입(D5), 탭 내부 상태 URL 미반영(design 의도적 제외)로 최소 표면. 헬퍼 추출도 2함수/51줄로 과하지 않음. popstate와 마운트의 중복 4-setState는 위에서 판단했듯 추출이 오히려 손해. **불필요 코드: 없음(스펙 누락 아님 확인).**
- **2+ 페르소나 중복 발견(심각도 상승)**: 없음. 각 페르소나가 서로 다른 축을 봤고 겹치는 결함 없음(보안 감사자만 "서버 경로방어 의존"을 단독 관찰 — 서버 무변경 전제라 이 change 스코프 밖, 심각도 상승 대상 아님).

## 최종 배포 가능 여부

**배포 가능**

- 치명(반드시 수정) 0건. typecheck EXIT 0. 라이브 스크린샷 10장이 5종 탭 정상 렌더·복원·뒤로가기·엣지 방어를 실증(verify.json: 10 PASS / 0 FAIL).
- verify의 `조건부`(S1.1 검증 안 함)는 **코드 결함이 아니라 검증환경 한계**다: S1.1의 pushState 코드는 존재(`App.tsx:932-936`)하고 동일 serialize+pushState 기계가 S1.2/S1.3에서 라이브 PASS로 입증됐다. S1.1이 실행 못 된 유일한 이유는 현재 라이브 데이터에서 `openChangeViews`로 가는 진입 UI(`.dash-cap`, `planTabsAvail.length===0` 조건)가 렌더되지 않아서이며, 그 진입 UI 도달성은 **이 change의 범위 밖**(design.md 의도적 제외: capChanges 진입 UI 미변경)인 선존 특성이다. 딥링크 코드 자체는 완전하고 정확하다.
- 설계 게이트: 이 change는 라우팅만 추가하고 신규 UI(컴포넌트·CSS)가 0이라 복원된 뷰는 기존 정상 내비게이션과 동일 화면을 보여준다 → 시각 회귀 위험 낮음. verify 스크린샷 10장이 5종 탭 정상 렌더를 이미 실증. DESIGN.md 부재(프로젝트에 없음) → 위반할 소스 오브 트루스 없음. 별도 gstack 재촬영 불요.

## 개선 우선순위 (제안)

1. **(선택, 이 change 밖) `.dash-cap` 진입 UI 도달성** — S1.1을 UI로 실행하려면 "기획 있음 + capability 있는" 프로젝트에서도 change 뷰로 가는 인앱 경로가 필요. 후속 change(예: propose 완료 링크 배선, 또는 planning 그래프의 change 진입점) 대상. **이 change의 배포를 막지 않음.** 딥링크 URL 직접 접속(S2.x)이 이미 완전 동작하므로, propose 완료 링크가 딥링크 URL을 가리키면 S1.1 경로 없이도 목적(특정 change 뷰 열기)이 달성된다.
2. **(선택) 서버 경로탐색 방어의 명시적 회귀 테스트** — `change=../../etc` 류를 서버 레이어에서 차단하는지 서버 change에서 별도 검증(이 프론트 change 무변경 전제라 스코프 밖).
3. **(선택) web 테스트 러너 도입** — 현재 순수헬퍼도 typecheck에만 의존. vitest 등으로 `parseDeepLink`/`serializeDeepLink` 단위테스트를 두면 회귀 안전망 강화(프로젝트 전반 개선, 이 change 필수 아님).
