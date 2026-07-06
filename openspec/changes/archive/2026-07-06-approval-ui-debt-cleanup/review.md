# 배포 전 최종 검토 — approval-ui-debt-cleanup
검토일: 2026-07-06 / 검토 범위: 이 change의 diff (커밋 `13c868e..83291b5`) 및 직접 영향 파일만 — `server/src/lib/{docs,featureDocs,userFlowDocs}.ts` + 각 `__tests__`, `web/src/{PrdApprovalPanel,App,api}.tsx/ts`, `shared/src/prd-suggestion-types.ts`. 전체 앱은 검토 대상 아님.

검토 방식: 정적 소스 리뷰 + 서브에이전트 3인(server/web/test) 병렬 적대 검토. **테스트 실증**: test 에이전트가 서버 스위트 95/95 GREEN 확인 후 신규 코드경로 2종(dedup·prune try/catch)을 무력화해 신규 6개 테스트 전건 RED 재현 — 회귀 가드가 진짜임을 실증(false-green 아님). **web는 실픽셀 미검증**(헤드리스 브라우저 미설치, verify.json도 동일 공백) — UI 레이아웃 주장은 전부 정적 검토임을 명시.

verify 입력: `verify.json` = **PASS 12/12** (fail 0·검증안함 0·skipped 0, archiveGate open). 단 verify web 레이어 basis가 "테스트 러너 부재 → 소스 구조 검증, UI 실픽셀 미실행"이라 명시 — 이 리뷰는 그 실증 공백을 그대로 계승한다(재실행 아님, 판단).

---

## 반드시 수정해야 할 항목

- 없음

세 경로 모두 spec의 THEN을 충족한다: prune 실패가 거짓 500 대신 200-shaped `queuePruneFailed`로 정직하게 표면화되고(`docs.ts:322-331`·`featureDocs.ts:277-284`·`userFlowDocs.ts:300-304`), 중복 id dedup은 검증(`isValid*`) **뒤** 읽기 경계에서 first-wins로 일관 적용된다(`docs.ts:206-207`·`featureDocs.ts:68-72`·`userFlowDocs.ts:79-84`). 치명 티어(file:line 증거 필수) 해당 없음.

## 수정하면 좋은 항목

- **[테스트 공백 — 최우선] 문서 write 자체의 EACCES 실패 경로가 미검증** (`docsFeatureApproval.test.ts:290-296`·`userFlowDocs.test.ts:322-328`·`docsPrdApproval.test.ts:299-306` 는 모두 *parse 실패/파일 부재*로만 `writeFailed`를 유발). `.md` 파일을 `chmod 0o444`로 막아 `writeFileSync(mdPath,…)`가 throw하는 케이스가 없다 → 그 catch 팔(`featureDocs.ts:260-262`·`userFlowDocs.ts:278-280`·prd `writeDocsPlanningPrd` false 반환)을 재-throw(500)로 되돌리는 회귀가 테스트를 전부 통과하며 배포된다. 이 change의 본질이 "EACCES 부분성공 = 200"인데, 그 대칭 음성 브랜치("문서 write 실패 = 422")는 실제 권한 실패로 박제되지 않았다. verify가 "예외 미검증"으로 잡을 성격의 공백. → 기준 5·9. **권장: 3-lib 각 1건씩 `.md` 0o444 주입 테스트 추가(uid 0 skip 가드는 기존 prune-fail 테스트에서 복사).**

- **[server] prune-fail catch가 에러를 무흔적 drop** — `docs.ts:325`·`featureDocs.ts:279`·`userFlowDocs.ts:302` 는 bare `catch {` (에러 바인딩 없음, grep 실측). 코드베이스 자체 규범(`safe-error.ts:11`이 stderr write)과 불일치하고, design의 no-log 허용은 **dedup drop 한정**(`design.md:47`)이라 prune-fail에는 적용 안 됨. prune 내부에서 진짜 TypeError/로직버그가 나면 사용자에겐 "큐 정리 실패"로만 보이고 실제 결함이 은폐된다. → 기준 5·10. **권장: catch에 `process.stderr.write` 1줄로 흔적 남기기(라우트 200 유지, 관측성만 회복).**

- **[정직성] 비원자적 write 부분손상을 주석이 과대보증** — 큐 write는 `writeFileSync(path, JSON.stringify(...))` 비원자적(`docs.ts:218`·`featureDocs.ts:84`·`userFlowDocs.ts:95`). mid-write throw(디스크 풀·프로세스 kill) 시 큐 파일이 truncate돼 catch의 재독(`readDocs*Suggestions`)이 JSON.parse 실패→empty 반환→`remaining:0`으로 **잃어버린 제안을 0으로 과소보고**한다. 그런데 catch 주석은 "큐는 pruned되지 않았으므로 remaining은… 정직하게 실측"이라 단정(`docs.ts:328`) — 이는 open-단계 실패(권한 등)에만 참이고 mid-write 실패엔 거짓. 원자적 write(temp+rename)는 **design이 명시적 Non-Goal**(`design.md:28`, 로컬 단일사용자)이라 코드 수정은 불필요 — **주석만** "remaining은 best-effort; mid-write 실패 시 큐 엔트리 유실 가능"으로 정직화 권장. → 기준 10.

- **[테스트] 라우트 레이어에서 `queuePruneFailed:true → HTTP 200` 미증명** — 라우트(`routes/docs.ts:275/315/367`)는 `writeFailed`만 422로 특수처리하고 나머지는 `res.json` 200 fall-through. lib의 `not.toThrow()`는 강한 프록시지만 HTTP 계약 자체는 아님 → 라우트가 `queuePruneFailed`를 5xx로 매핑하는 회귀는 통과한다. 이 change의 요지가 "500 아님"이므로 라우트 레벨 assertion 1건 권장. → 기준 9.

- **[테스트] prd dedup 테스트가 first-wins를 문서로 증명 못 함** — `docsPrdApproval.test.ts:413-430`는 중복 2건이 **동일 내용**이라 first-wins vs last-wins를 구분 못 하고 `applied===1` 카운트로만 RED된다. userflow(`userFlowDocs.test.ts:429-439`, 다른 에지+부재 단언)·features(`docsFeatureApproval.test.ts:332-345`, 다른 nodePath+둘째 불변 단언)는 문서 내용으로 증명 → prd만 얇다. 또 features prune-fail 테스트(`docsFeatureApproval.test.ts:305-329`)는 형제(prd·userflow)에 있는 `remaining` 단언을 누락. → 기준 2. **권장: prd 둘째 dup의 proposedBody/섹션을 다르게 해 문서 first-wins 박제.**

## 현재 상태로 유지해도 되는 항목

- **queuePruneFailed 3경로 배선·메시지 우선순위** — web 3경로(`App.tsx:556/597/645`) 모두 resolve `.then`에서 고지, `queuePruneFailed`가 `skipped`보다 먼저 체크(더 심각한 상태 우선). 재조회 `.then`은 `setStatus` 재호출 없이 state만 갱신(`App.tsx:563-567`) → 부분실패 고지가 성공 메시지에 덮이지 않음. 정상.
- **api.ts OR-합산** — `queuePruneFailed` false 초기화 후 truthy 청크에만 flip(`api.ts:203,217,219`), 필드 없는 청크(undefined)는 falsy라 누산 오염 없음. shared 타입 `readonly queuePruneFailed?: true`(never false 리터럴)와 정합. tsc EXIT0.
- **zero-new-CSS 게이트 충족** — PrdApprovalPanel의 17개 className 전부 styles.css에 기정의(borrowed `feature-approval-list`·`feature-approval-bulk` 포함, `styles.css:797-803` bare 셀렉터라 `.prd-approval` 하위 중첩에서도 동일 적용). verify의 CSS 번들 바이트 불변(34.47kB)과 정합.
- **N=0 처리** — 세 패널 모두 `suggestions.length===0` 시 `null` early-return(`PrdApprovalPanel.tsx:41`) → "(0건)" no-op 버튼 렌더 안 됨. `SKIPPED_PREVIEW_CAP` 경계(5·6건) off-by-one 없음(`App.tsx:542-545`).
- **EOL/CRLF** — 이 change는 EOL 처리 미접촉, 기존 detectEol/restoreEol 경로 무변경(문서 write 3종 그대로). 큐는 JSON이라 CRLF 무관. family-hardening 성과 회귀 없음.
- **동시성/파일 락 부재** — design 명시 Non-Goal(로컬 단일사용자). 오지적 안 함.

## 리팩토링 추천 항목

- **`docs.ts:207` 콤마 연산자 dedup 표현이 형제 2종과 스타일 비대칭** — prd만 `(seen.has(s.id) ? false : (seen.add(s.id), true))` 압축형, features/userflow는 가독형 `if/return` 블록. 동작 동일하나 design "동형" 취지에 어긋나고 신입 가독성 저하. prd를 형제와 같은 블록형으로 통일 권장(선택).
- **선재 CSS 중복 `feature-approval-bulk`** — `styles.css:536`(28f222f 유래)과 `:801`에 이중 정의. 이 change가 만든 게 아니라 out-of-scope지만, borrowed 클래스라 관측됨 → 별도 위생 change에서 병합 권장.
- **empty-string id 붕괴** — `isValid*`가 `id: ""`를 통과시켜(`docs.ts:180-189` 등) 생산자가 빈 id 2건을 쌓으면 dedup이 서로 다른 제안을 하나로 합치고 무흔적 drop. 생산자 규약(id 유일·비어있지 않음) 위반이 전제이나, 방어가 필요하면 `isValid*`에 non-empty id 요구 추가 권장(선택).

## 적대적 검토 (4 페르소나)

- **파괴자**: (1) prune write mid-throw 시 비원자 write가 큐 파일을 truncate → catch 재독이 `remaining:0`으로 유실을 은폐(수정하면 좋은 항목 3, `docs.ts:328` 주석 과대보증). (2) doc-write EACCES → 500 회귀가 테스트 사각(수정하면 좋은 항목 1). (3) prune-fail 후 재조회까지 실패하는 double-fault 시 `queuePruneFailed` 고지가 일반 실패 메시지로 덮임(`App.tsx:568`) — 단 덮는 문구도 "일부 반영됐을 수 있음"이라 오도는 아님(CLEAN caveat).
- **신입 개발자**: `docs.ts:207` 콤마 연산자 dedup은 6개월 뒤 "이게 왜 filter야?" 유발 — 형제 2종의 `if/return`과 달라 읽기 마찰(리팩토링 항목 1). bare `catch {`는 "여기서 뭘 삼키는가"가 주석에만 있고 에러 흔적이 없어 디버깅 시 막막(수정하면 좋은 항목 2).
- **보안 감사자**: 인증/인가·인젝션·민감정보 노출 신규 벡터 없음. 큐는 JSON.stringify로 직렬화(인젝션 표면 아님), 사용자 입력은 기존 `isValid*` 경계 검증 통과분만. **깨끗함 근거**: 이 diff는 로컬 파일 큐의 실패 표면화·중복 제거·UI 재배치만 다루며 새 네트워크/권한/입력 경계를 열지 않는다. (cors 와일드카드·인증은 design이 별도 change로 명시 분리 — 이 스코프 밖.)
- **게으른 시니어**: 과잉구현 없음. **근거**: (a) 신규 CSS 0(기존 클래스 재사용), (b) 신규 의존성 0, (c) prune try/catch·dedup은 각 1줄~수줄로 spec THEN에 정확히 대응(래퍼·추상화 없음 — design D-3가 "골격 추상화 금지" 명시적으로 방어), (d) shared 타입은 additive 1필드. "안 짜도 될 코드"는 발견되지 않음. 오히려 3-lib를 헬퍼로 묶지 *않은* 것이 design의 명시 결정(동형 유지)이라 정당.
- **2+ 페르소나 중복 발견(심각도 상승)**: 없음. 파괴자·신입이 각각 다른 항목을 지적, 겹치는 이슈 없음. (bare catch은 파괴자[관측성]·신입[가독]이 근접 언급하나 동일 결함 아님 — 승격 미적용.)

## 최종 배포 가능 여부

**배포 가능**

- verify PASS 12/12 + 테스트 회귀 가드 실증(6건 RED 재현) + 치명(반드시 수정) 0건. spec의 3개 THEN(부분실패 고지·dedup·단언 강화) 모두 코드·테스트로 충족.
- **단 2가지 실증 공백을 배포 전 인지 필수**: ① web 실픽셀 미검증(verify·리뷰 공통) → PRD 승인 탭 1회 수동 스모크로 상단 일괄 바·스크롤 캡·(N건) 육안 확인 권장. ② doc-write EACCES 음성 브랜치 테스트 부재 → 회귀 시 사각(수정하면 좋은 항목 1). 둘 다 배포를 막지 않으나 후속 위생 항목으로 남긴다.

## 개선 우선순위 (제안)

1. **doc-write EACCES 음성 브랜치 테스트 추가**(수정하면 좋은 1) — 배포는 통과하나 "500 아님" 계약의 대칭 절반이 미박제. 회귀 시 사용자에게 거짓 500. 영향 대비 비용 최저(기존 prune-fail 테스트 복사 변형).
2. **prune-fail catch에 stderr 흔적 1줄**(수정하면 좋은 2) — 진짜 버그가 "큐 정리 실패"로 위장하는 관측성 구멍을 1줄로 막음.
3. **`docs.ts:328` 주석 정직화**(수정하면 좋은 3) — 코드 무변경, mid-write 유실 가능성을 주석이 부정하지 않게. 정직성 게이트(§1).
4. **라우트 레벨 `queuePruneFailed→200` assertion**(수정하면 좋은 4) — HTTP 계약 박제.
5. **PRD 승인 탭 수동 실픽셀 스모크** — 러너 부재로 자동화 불가, 배포 후 1회 육안.
6. **prd dedup 테스트 다른-내용 dup으로 강화 + features `remaining` 단언 보강**(수정하면 좋은 5) — 형제 대칭 회복.
7. **`docs.ts:207` 콤마 연산자 통일·CSS 중복 병합·empty-id 방어**(리팩토링) — 위생, 후속 change 묶음.
