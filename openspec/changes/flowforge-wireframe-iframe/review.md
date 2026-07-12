# 배포 전 최종 검토 — flowforge-wireframe-iframe

---

## 재검토 — 2026-07-12 07:07 (커밋 1bf712f 이후, template 우회 수정분 재verify)

> 트리거: 아래 최초 검토(2026-07-12)가 BLOCK한 **#1 `injectWireDocCsp` `<template>` 데코이 CSP 우회**를 커밋 1bf712f가 수정(scan에 `<template>…</template>` 마스킹 추가 + 회귀 2건). 이 수정을 **재verify**(재배포 후 라이브 + 서버 테스트 530 + jsdom·실브라우저 실증)하고 BLOCK 해소 여부를 적대적으로 재확인했다.
> 재verify 리포트: `verify.html` finalJudgment=**FAIL**(PASS 23 / FAIL 2), archiveGate **닫힘**. 발행: https://openspec.gaegul.house/flowforge-wireframe-iframe/verify.html

### 최초 BLOCK(#1 template 데코이) — ✅ 해결됨 (부분)
- 커밋 1bf712f가 `wire-security.ts:81-82`에 주석 마스킹 뒤 `.replace(/<template[^>]*>[\s\S]*?<\/template>/gi, …)` 체이닝을 추가했다.
- **실증**: 최초 BLOCK의 정확한 페이로드 `<html><template><head></head></template><head><title>real</title></head>…`를 (a) jest 회귀 2건(문자열 위치 + jsdom 실파싱: live head has CSP=true, template.content trapped=false) — 서버 530/530 PASS, (b) 실브라우저 Chrome DOMParser 재검증 — `review-BLOCK-template=DEFENDED`(ourInHead=true, trappedTpl=false)로 확인. **이 벡터는 닫혔다.**

### 그러나 — 🔴 신규 BLOCK 2건 (동일 심각도 클래스, archive 차단 유지)
최초 검토가 예고한 대로(review #2 "정규식으로 HTML 구조 판정 = 마스킹 사다리가 계속 샌다", 그리고 #1 각주의 `<head foo="-->">` 미확정 후보)가 **실체화**됐다. `injectWireDocCsp`의 마스킹은 **주석 + `<template>` 두 종류만** 가리므로(`:81-82`), 아래 3형태에서 문서 CSP 메타가 실제 `<head>`가 아닌 inert 위치에 삽입되고 **live head에는 우리 CSP가 0**이 된다(jsdom + 실브라우저 Chrome DOMParser 양쪽 실증, `ourInHead=false`):

1. **[BLOCK] `<script>` 주석 안 가짜 `<head>`** — `<script>/* <head></head> */</script><head><title>r</title></head>…`. scan이 `<script>` 내용을 마스킹하지 않아 정규식 `/<head[^>]*>/`이 script 텍스트 안 가짜 head에 먼저 매치 → CSP가 inert script 텍스트에 갇힘. 실브라우저: `inScript=true, ourInHead=false`.
2. **[BLOCK] 속성값 안 `</template>`** — `<head foo="</template>"><title>r</title></head>…`. template 마스킹 정규식이 속성값 안 `</template>`를 실 태그로 오인해 마스킹 경계가 깨짐 → CSP 메타가 `foo` 속성값 문자열 안(`foo="</template><meta…">`)에 들어가 실제 요소가 안 됨. (= 최초 #1 각주의 미확정 후보 벡터 — 이제 확정.)
3. **[BLOCK] 미종료 `<template>`** — `<template><head></head><head><title>r</title></head>…`(닫는 `</template>` 없음). 마스킹 정규식이 `</template>`를 요구하므로 매치 실패 → 미마스킹 → CSP가 template.content(inert)에 갇힘. 실브라우저: `trappedTpl=true, ourInHead=false`.

- **왜 여전히 BLOCK인가(최초 검토 #1과 동일 근거)**: sandbox(`allow-scripts`, `allow-same-origin` 미부여 — 라이브 경계 TypeError로 부모 격리는 유효)는 **부모 오리진** 접근만 막는다. iframe 문서 **자신의 outbound 네트워크**(fetch/XHR/`<img src>`/WebSocket to 제3자) 차단은 오직 `WIRE_DOC_CSP`의 `connect-src 'none'`/`default-src 'none'` 몫이다. 이 3벡터 중 하나로 생성된 악성 AI 문서는 문서 CSP가 붙지 않아 이 change가 명시적으로 선언한 "외부 네트워크 유출 차단"(`wire-security.ts:30`) 속성을 그대로 잃는다. `doc.html`은 `wireDocs.ts`가 신뢰되지 않은 AI 생성물로 명시하므로 D1 위협 모델의 방어 대상 바로 그것.
- **근본 원인(최초 #2와 동일)**: 정규식+마스킹 사다리로 HTML 구조를 판정하는 접근 자체. 마스킹을 하나 더 추가해도(script/속성값/미종료 template) 다음 quirk가 또 샌다. 재발 방지 = 삽입 위치를 실 HTML 파서로 결정하거나, CSP를 문서 생성 시점에 스켈레톤에 고정하는 계약으로 이전(최초 리팩토링 추천 항목과 동일).
- 증거: `verify-evidence/vif2-realbrowser-probe.png`(실브라우저 6-shape), scratchpad `vif2-realbrowser.html`·`vif2-triage.mjs`·`vif2-bypass-analysis.mjs`(jsdom·실브라우저 재현).

### 재검토 최종 배포 가능 여부 — **배포 불가 (신규 치명 2건 · archive 차단)**
최초 #1(template)은 닫혔으나, 같은 함수의 같은 결함 클래스(마스킹 사다리)가 script 주석·속성값 `</template>`·미종료 template 3형태로 남아 문서 CSP를 무력화한다(jsdom+실브라우저 실증). 재verify finalJudgment=FAIL, archiveGate 닫힘. **표면적으로 template 벡터만 막지 말고 삽입 위치 판정을 실 파서/스켈레톤 계약으로 이전한 뒤 3벡터 회귀 테스트를 추가하고 재verify PASS를 받아 archive로 진행할 것.** (아래는 최초 2026-07-12 검토 원문 — 최초 #1은 위에서 ✅해결 처리, 근본원인 #2는 신규 3벡터로 재확인됨.)

---

# (최초) 배포 전 최종 검토 — flowforge-wireframe-iframe
검토일: 2026-07-12 / 검토 범위: 이 change의 diff (commit fb002e9, 20 파일) — shared(`wire-security.ts`·`wire-doc-types.ts`·`wire-suggestion-types.ts`·`index.ts`), server(`lib/cspHeaders.ts`·`lib/wireDocs.ts`·`index.ts`·`routes/docs.ts`·`parser/planningWireframeFixture.ts` + 테스트 4종), web(`WireframeDeviceFrame.tsx`·`WireframePinFeedback.tsx`·`App.tsx`·`WireframeApprovalWizard.tsx`·`api.ts`·`styles.css`). 앱 전체가 아니라 이 change 경로만.

> 성격: 좌표 없는 요소배열(WireScreen2)을 화면별 자족 HTML 문서(WireDoc[])의 **sandbox iframe 렌더**로 BREAKING 전환. 이 change의 절반은 보안(임의 AI 생성 HTML/JS 렌더). server(WireDoc 빌더·CSP 주입·앱 CSP 헤더) + web(iframe srcdoc 렌더·핀 오버레이) + shared(보안 상수 단일 원천).

## 검증 입력 (verify=실증 / review=판단)
- `verify.json`: **finalJudgment=PASS**, counts pass 25/fail 0/검증안함 0/skipped 0, `archiveGate.open=true`. 이 review에서 **재실측한** 것: typecheck EXIT 0, server jest **41 suites / 528 tests PASS**(verify basis와 일치), 라이브(localhost:8812) iframe `sandbox="allow-scripts"`·srcdoc CSP `default-src 'none'` 주입·부모 `contentDocument` 접근 불가(격리)·앱 응답/정적/404 전부 `frame-ancestors 'self'`+`X-Frame-Options`.
- verify가 이미 잡은 CONCERNS(정규식 견고성 — 주석 우회)는 이전 apply에서 수정+회귀 7건으로 닫혔고, verify 적대검증 6개 페이로드에서 실효 우회 미발생 확인됨. **그 판정은 존중한다.**
- 그러나 이 review의 4페르소나 적대 패스(전체 diff)가 **verify·기존 테스트가 다루지 않은 NEW 우회**를 발견하고 spec-conforming 파서(jsdom)로 실증했다 → 아래 "반드시 수정 #1". 이건 verify가 CONCERNS로 닫은 그 우회가 아니라 별개 벡터다.

## 반드시 수정해야 할 항목

### #1 [BLOCK · 보안 criteria 6·9] `injectWireDocCsp`의 `<template>` 데코이 CSP 우회 — 문서 CSP 전면 무력화
- 위치: `shared/src/wire-security.ts:73-89` (특히 주석 마스킹만 하는 `:76`, head 탐색 `:78`).
- 결함: `injectWireDocCsp`는 HTML **주석**만 공백 마스킹(`:76`)한 스캔 사본에서 `<head>`/`<html>`를 찾아 그 오프셋에 CSP `<meta>`를 삽입한다. 그러나 HTML5 파싱 스펙상 `<template>` 요소의 내용은 **inert `DocumentFragment`(`template.content`)** 에 들어가 라이브 문서 트리에 절대 반영되지 않는다. 공격 문서가 앞에 데코이 `<template><head>…</head></template>`를 두면, 마스킹 안 된 스캔 사본은 그 가짜 `<head>`에 먼저 매치 → CSP 메타가 **inert template 안**에 박히고, 진짜 `<html><head>`는 CSP 없이 렌더된다.
- **실증(정적 검토 아님 — 실행 검증)**: 배포된 함수(`shared/dist`)에 페이로드 `<template><head>decoy</head></template><html><head></head><body>…</body></html>` 투입 → 메타 index 34(=`<template>` 영역 0~243 **내부**). jsdom(HTML5 준수 파서)로 파싱: `live head has CSP: false`, `meta trapped in template.content (inert): true`, 정상 문서 baseline은 `live head CSP: true`. → **라이브 head에 CSP 0**. (repro: `/tmp/.../scratchpad/repro.mjs`·`dom.cjs`, node_modules/jsdom 경로에서 실행 확인.)
- 왜 sandbox로 상쇄 안 되나(치명 판정 근거): `WIRE_IFRAME_SANDBOX='allow-scripts'`(allow-same-origin 없음)는 **부모 오리진** 접근(쿠키·DOM·토큰)만 막는다 — iframe 문서 **자신의 outbound 네트워크**(fetch/XHR/`<img src>`/WebSocket to 제3자)는 막지 않는다. 그 차단은 오직 `WIRE_DOC_CSP`의 `connect-src 'none'`/`default-src 'none'` 몫(design D3). CSP가 이 우회로 죽으면 문서가 "외부 fetch 전부 차단되어 외부로 데이터 안 나감"(`wire-security.ts:30`)이라는 change의 명시 보안 속성을 그대로 잃는다. sandbox와 CSP는 **서로 다른 것**을 지키고, 이 우회는 sandbox가 안 덮는 쪽을 뚫는다.
- 신뢰 모델: `doc.html`은 `wireDocs.ts:72`가 "신뢰되지 않은 AI 생성물"로 명시 — 악성/프롬프트 인젝션된 문서는 D1 위협 모델이 방어 대상으로 삼은 바로 그것. AI 생성물이라 "사람이 안 넣으니 괜찮다"는 완화 논리는 이 change 전제상 성립 안 함.
- 수정 방향(수정은 이 스킬 밖 — 별도 단계): `injectWireDocCsp`가 `<head>`/`<html>` 탐색 **전에** `<template>…</template>` 영역도 주석과 함께 마스킹(또는 진짜 문서 파서로 삽입 위치 결정)하고, 이 정확한 페이로드 형태의 회귀 테스트 추가(`wireDocs.test.ts` injectWireDocCsp describe). 관련 CONCERNS 후보: 서브에이전트가 제기한 `<head foo="-->">`(속성값 안 `-->`) 벡터 — 미확정(파서 복원 quirk와 분리 필요), 같은 마스킹 개선으로 함께 닫힐 가능성.

## 수정하면 좋은 항목

### #2 [CONCERNS · 견고성] injectWireDocCsp 정규식 접근의 잔여 견고성 (verify가 이미 지목한 축)
- 위치: `shared/src/wire-security.ts:76-88`.
- verify 적대검증(security-reviewer)이 "문자열-레벨 정규식이 malformed HTML을 과소비할 수 있다"고 제기한 그 축이 #1로 실체화됐다. 근본 원인은 **정규식으로 HTML 구조를 판정**하는 것(주석만 알고 template/CDATA/파서 복원 규칙은 모름). #1의 template 마스킹은 표면 수정이고, 장기적으로는 삽입 위치 결정을 실 HTML 파서(또는 문서 생성 시점에 CSP를 문서 스켈레톤에 미리 심는 계약)로 옮기는 게 재발 방지에 강하다. 단 이건 sandbox 이중방어가 있어 #1 수정 후엔 배포 차단 아님.

### #3 [CONCERNS · 보안 criteria 6] 앱 CSP `script-src 'unsafe-inline'`는 부모 앱 XSS 방어를 강화하지 않음
- 위치: `shared/src/wire-security.ts:53-54` (`WIRE_APP_CSP` script-src/style-src `'unsafe-inline'`).
- flowforge SPA가 Vite/React 인라인 번들이라 `'unsafe-inline'`은 현실적 트레이드오프이고 "CSP 전무"보다 순개선이다. 다만 주석(`:43-49`)이 CSP를 실제 기능(=`frame-ancestors`/`frame-src`의 clickjacking·프레이밍 방어)보다 넓은 통제로 읽히게 한다 — 부모 SPA에 XSS가 생기면 이 CSP는 인라인 스크립트 실행을 못 막는다. 이 diff 단독으로 악용 불가. 인식용 표기(nonce/hash 기반으로 강화하면 실 XSS 방어가 되나, 이 change 범위 밖).

## 현재 상태로 유지해도 되는 항목
- sandbox 상수 `WIRE_IFRAME_SANDBOX='allow-scripts'`(`wire-security.ts:23`) — allow-same-origin·top-navigation·popups·modals·downloads 전부 미부여. 부모 오리진 격리 라이브 실측 확인(contentDocument 접근 차단). change 최상위 보안 불변식이 정확히 지켜짐.
- 앱 CSP 미들웨어 배치(`server/src/index.ts:15`) — CORS·json·라우터·static **앞** 최상단 `app.use`. 정적 자산·404·SPA 폴백 전부 `frame-ancestors`+`X-Frame-Options` 부여됨(라이브 curl 확인). 바이패스 경로 없음.
- 상위 DOM 직접 삽입 부재 — `doc.html`의 유일 소비처가 `WireframeDeviceFrame.tsx:39` `srcDoc`. web 전역 `innerHTML`/`dangerouslySetInnerHTML` 부재(grep, 주석뿐). `doc.title`·핀 `text`/`region`은 JSX 텍스트 보간(React 자동 이스케이프) — XSS 싱크 없음.
- 핀 피드백 경로 안전 — 좌표는 오버레이 `getBoundingClientRect` 기준(iframe 내부 DOM 미접근, 격리 존중). `isValidPct`(0~100·유한)·빈텍스트 거부(`wireDocs.ts:306-308·334-336·375`). `project`는 라우트 상류 `resolveDocsDir`가 `^[A-Za-z0-9_-]+$`로 경로순회 차단(`docs.ts` write 라우트는 `requireWriteAuth`). `screenId`는 알려진 화면 집합 대조만, FS 경로 세그먼트 미사용 → 순회 벡터 없음.
- 안전 폴백 — 승인분 JSON 없음/깨짐/스키마위반은 `readApprovedWireframe`→null→픽스처 폴백, `isValidWireDoc` 필터. 읽기 throw 금지(`wireDocs.ts:129-153`). 렌더 안 죽음.
- 픽스처 자족성 — 5종 문서(desktop 3·mobile 2) 외부 http(s) 참조 0(grep 실측), 인라인 style/script만. verify basis와 일치.

## 리팩토링 추천 항목
- `injectWireDocCsp`의 "정규식으로 HTML 삽입 위치 판정"을 실 파서 기반 또는 "문서 생성 시점에 CSP를 스켈레톤에 고정"으로 이전(#2와 동일 뿌리). 정규식+마스킹 사다리를 계속 늘리는 대신 구조적으로 파서에 위임하면 template/CDATA/향후 파싱 quirk 재발을 원천 차단.
- `WIRE_APP_CSP`의 `'unsafe-inline'`을 빌드 타임 nonce/hash로 교체(부모 SPA 실 XSS 방어 확보). 별도 change 규모.

## 적대적 검토 (4 페르소나)
- **파괴자**: `injectWireDocCsp`가 malformed/적대 HTML(template 데코이)에서 CSP를 inert 위치에 삽입 → 문서 CSP 전면 무력화. jsdom 실증(반드시수정 #1). 그 외 깨진 JSON·범위밖 좌표·빈 배열은 안전 폴백/거부로 방어됨 확인(위 유지 항목).
- **신입 개발자**: `injectWireDocCsp`의 "주석만 마스킹" 가정이 코드에 명시 안 됨 — 주석은 마스킹하면서 template/CDATA는 왜 안 하는지 6개월 뒤 이해 어려움(그 공백이 #1의 원인). 상수·불변식 자체는 주석이 충실(`wire-security.ts:8-11·20-21`)해 신입 친화적. → #1 수정 시 "왜 template도 마스킹하는가" 주석 필수.
- **보안 감사자**: (2+ 페르소나 중복 → 심각도 상승) `<template>` 데코이 CSP 우회 = 배포 차단 BLOCK. 부모 격리(sandbox)는 정상이나 CSP가 지키는 outbound 유출 차단이 뚫림 — sandbox로 상쇄 불가. 별개 미확정 벡터(`<head foo="-->">`)는 CONCERNS. 경로순회·write auth·XSS 싱크는 CLEAN.
- **게으른 시니어**: 과잉구현 없음. 프레임 크롬·토글·탭·핀 오버레이 인프라를 **재사용**하고 본문만 iframe로 교체(게으름 위계 준수, `WireframeDeviceFrame.tsx:9-13` 주석대로). 보안 상수 단일 원천(`wire-security.ts`)은 drift 방지 목적의 필요한 추상화이지 부풀림 아님. 새 의존성 0(helmet 미도입, 무의존 미들웨어 — §90 준수). 안 짜도 될 코드 없음.
- **2+ 페르소나 중복 발견(심각도 상승)**: 파괴자·신입·보안감사자 3인이 `injectWireDocCsp` template 우회를 공통 지목 → 심각도 BLOCK 확정(단일 페르소나였어도 실증 PoC라 BLOCK).

## 최종 배포 가능 여부
**조건부 가능 (치명 1건 수정 후)** — verify는 PASS(archiveGate open)이고 sandbox 격리·앱 CSP·핀 경로·폴백은 견고하나, review 적대 패스가 verify·기존 테스트가 놓친 **NEW template 데코이 CSP 우회(BLOCK, jsdom 실증)**를 찾았다. 이 우회는 change가 명시적으로 제공한다고 선언한 "외부 네트워크 유출 차단" 보안 속성을 sandbox와 무관하게 무력화한다. `injectWireDocCsp`가 `<template>` 영역도 마스킹(또는 파서 기반 삽입)하고 해당 회귀 테스트를 추가한 뒤 배포/archive 진행.

## 개선 우선순위 (제안)
1. **[BLOCK] #1 injectWireDocCsp `<template>` 우회 수정 + 회귀 테스트** — 문서 CSP 전면 무력화. change의 핵심 보안 속성 상실, jsdom 실증. 배포 전 필수.
2. **[CONCERNS] #2 정규식→파서 기반 삽입 위치 판정으로 이전** — #1의 근본(정규식으로 HTML 구조 판정). 표면 마스킹 사다리 재발 방지. #1 후속.
3. **[CONCERNS] #3 앱 CSP `'unsafe-inline'` 인식 표기(장기 nonce/hash)** — 부모 SPA XSS 방어는 CSP가 아닌 frame-ancestors만 함을 문서화. 별도 change.
