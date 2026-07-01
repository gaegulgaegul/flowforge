# 배포 전 최종 검토 — planning-approval-edit-ui-features (6b 기능명세 속성 승인/반려 편집 UI)

> **2026-07-01 재검토(최종 판정 변경): 이전 BLOCK 사유 3건이 모두 해소됐다.**
> - **HIGH(D5 self-roundtrip 방어 부재) → 해결** — 커밋 `93cb7ab`. `structureInvariantHolds`/`treeFingerprint` 구현 + `applyFeatureSuggestions`가 write 직전 재파싱해 노드 개수·capability 키 집합 불변을 검증, 위반 시 writeFailed(422·원본/큐 보존). `buildFeatureTreeFromLines` 분리로 디스크 왕복 없이 재파싱.
> - **MEDIUM(동일 label 형제 첫 매치 silent) → 해결** — 커밋 `e46f31f`. `countNodesByPath`로 매치 노드 ≥2면 skipped 표면화(엉뚱한 노드 오변경 방지).
> - **LOW(무의미 제안 통과) → 해결** — 커밋 `e46f31f`. `isValidFeatureSuggestion`가 priority·status 둘 다 undefined면 false.
> - 검증(본체 직접 재현): 타입체크 EXIT=0, lint EXIT=0, server 테스트 **210/210 PASS**(원래 200 → self-roundtrip 6 + MEDIUM/LOW 4, 회귀 0). 방어 무력화 프로브에서 negative-path 테스트가 정확히 red 전환(가짜 통과 아님, 커밋 메시지 grounding).
> - 잔여 LOW(RE_ATTRS 두 벌 중복·배열 길이 상한)는 archive 차단 아님(후속). **최종 판정: CONCERNS(archive 허용) — 아래 "최종 배포 가능 여부" 참조.**

검토일: 2026-07-01(초판) / 재검토: 2026-07-01(커밋 93cb7ab·e46f31f 반영) / 검토 범위: 이 change diff (shared 1 · server 4 · web 4)
- shared/src/feature-suggestion-types.ts, shared/src/index.ts
- server/src/lib/featureDocs.ts, server/src/lib/docs.ts(hasDocs features 인정), server/src/routes/docs.ts(features 라우트 2), server/src/lib/__tests__·routes/__tests__/docsFeatureApproval.test.ts
- web/src/FeatureApprovalPanel.tsx, web/src/App.tsx(features 배선), web/src/api.ts, web/src/styles.css

검토 방식(초판): 커밋 48eb5ab(server)·28f222f(web) diff 정독 + design.md D1~D8 대조 + spec.md SHALL/scenario 매핑 + 적대적 3페르소나(파괴자·신입·보안) + 본체 직접 실측(격리 픽스처로 duplicate-label·partial-attr·self-roundtrip 부재를 재현 probe). 5게이트(빌드/타입/린트/테스트) 본체 재실행으로 grounding.
검토 방식(재검토 2026-07-01): 커밋 `93cb7ab`·`e46f31f` 코드를 직접 정독(featureDocs.ts structureInvariantHolds·countNodesByPath·isValidFeatureSuggestion / featureTreeBuilder.ts buildFeatureTreeFromLines / docsFeatureApproval.test.ts 신규 10케이스) + `cd server && npm test`로 210/210 재현. 초판 주장을 그대로 믿지 않고 코드 위치를 대조해 3건 해소 확인.

## review criteria brief
- changeTypes: [backend, frontend] (server lib/routes + web 컴포넌트/App.tsx, prototype.html 존재)
- ruleSets: backend→20-testing/30-security, frontend→60-design/70-adversarial-review, 소스변경→10-coding-style
- designYardsticks(지킴 확인): 사이드카 제안 큐+개별/일괄 승인반려, 승인분만 features.md 속성 줄 교체·반려 원본불변, SSOT="승인 통해서만 변경", 산문·capability·위계 보존, writeFailed(422)와 미실재 id/nodePath(skipped) 구분. Non-Goals(오지적 안 함): 노드 add/remove·label·구조 편집=후속, 유저플로우/와이어=6b-userflow/wireframe, LLM 호출 없음, 동시성/대량=개인용 범위 밖.

## 반드시 수정해야 할 항목

- **없음.** 초판의 archive 차단 항목(HIGH·MEDIUM)은 재검토 시점(2026-07-01) 모두 해소됐다. 해소 내역은 아래 "해결된 항목"에 이관.

## 해결된 항목 (2026-07-01 재검토 — 커밋 93cb7ab·e46f31f)

- **[HIGH → RESOLVED] D5 self-roundtrip 불변식 검증 구현 완료 — spec ADDED scenario 충족.** (커밋 `93cb7ab`)
  - 초판 지적: `applyFeatureSuggestions`가 라인 교체 후 검증 없이 곧바로 `writeFileSync`, `writeDocsPlanningFeaturesAttrs`(self-roundtrip) 함수 부재.
  - 해소 코드(본체 직접 확인):
    - `server/src/parser/featureTreeBuilder.ts:59` `buildFeatureTreeFromLines(lines)` 분리 export — 파일 IO 없이 라인 배열만 파싱(안 쓴 새 라인을 디스크 왕복 없이 재파싱하려고). `buildDocsPlanningFeatures`(46~52)는 이걸 호출하는 얇은 래퍼로 전환(동작 불변).
    - `server/src/lib/featureDocs.ts:140` `treeFingerprint(root)` — 노드 개수 + capability 키 집합 추출(가상 루트 제외).
    - `server/src/lib/featureDocs.ts:174` `structureInvariantHolds(before, afterLines)` — afterLines를 재파싱해 노드 개수·capability 키 집합이 before와 동일한지 검증(하나라도 다르면 false).
    - `server/src/lib/featureDocs.ts:223` apply가 패치 전 `beforeTree = buildFeatureTreeFromLines(lines).root`로 원본 지문을 잡고, `241~246`에서 `applied>0`일 때 `structureInvariantHolds` 실패 시 **write 안 하고** `writeFailed:true`(라우트 422)로 원본·큐 통째 보존.
  - 충족 spec: `specs/planning-features-approval-apply/spec.md` "self-roundtrip 불변식 위반 시 원본 보호" scenario — write 전 재파싱·노드 개수/capability 키 집합 불변 검증 경로가 실재. (spec 매핑 테이블 갱신: ❌ → ✅)
  - 회귀 테스트(본체 확인, `docsFeatureApproval.test.ts`): `structureInvariantHolds` 단위 5(속성만→true / 노드 감소·증가·capability 삭제·capability 변경→false) + 정상 승인 통합 1(self-roundtrip 통과해 실제 write, happy-path no-op 아님 못박음). 커밋 메시지 grounding: 방어에 `return true` 프로브 삽입 시 negative-path 4건 정확히 red 전환 → 가짜 테스트 아님.
  - **판정: 계약 이행. archive 차단 사유 소멸.** 초판이 우려한 "6a↔6b 비대칭"도 해소(6a와 동형 self-roundtrip 방어가 6b에 존재).

- **[MEDIUM → RESOLVED] 동일 label 형제 노드 모호성 — 첫 매치 silent 대신 skipped 표면화.** (커밋 `e46f31f`)
  - 초판 지적: `findNodeHeaderLine`이 같은 부모/레벨 동일 label 헤더 다수 시 첫 매치를 조용히 반환, design.md Risks가 약속한 skipped 경고 없음.
  - 해소 코드: `featureDocs.ts:156` `countNodesByPath(root, nodePath)` — nodePath와 일치하는 노드 수를 센다. apply(`228~231`)가 `countNodesByPath(beforeTree, s.nodePath) > 1`이면 첫 매치를 바꾸지 않고 `skipped.push(s.id)` + `continue` → 엉뚱한 노드 오변경 방지, features.md 원본 불변.
  - 회귀 테스트: 동일 label 2개 → skipped·applied:0·파일 통째 불변 / 유니크 label 1개는 과잉 차단 없이 정상 반영(applied:1). (과잉/과소 양쪽 봉인)
  - **판정: design Risks 이행. HIGH self-roundtrip과 이중 방어(모호성은 사전 차단, 라인 손상은 사후 재파싱 검증).**

## 현재 상태로 유지해도 되는 항목

- **XSS 없음**: `FeatureApprovalPanel`이 priority/status/rationale/nodePath를 전부 JSX 텍스트 노드로 렌더(`{attrs.priority}`, `{sug.rationale}`, `pathLabelOf(...)`) — 자동 이스케이프, dangerouslySetInnerHTML 미사용. (본체 확인)
- **경로안전**: 라우트가 `resolveDocsDir`(화이트리스트 `^[A-Za-z0-9_-]+$`) 재사용, features.md/suggestions.json 쓰기는 안전한 docsDir 위 `join`만. 경로조작 GET/POST 둘 다 404 테스트 통과. docs 루트 밖 유출 없음. (route test 71·122줄)
- **읽기 무-throw**: `readDocsFeatureSuggestions`가 existsSync 가드 + JSON.parse try/catch + `isValidFeatureSuggestion` 필터로 파일없음/깨진JSON/부정항목을 안전 폴백(53~66). spec "MUST NOT throw" 충족.
- **스키마 검증 견고**: op="set-attrs"·nodePath 문자열배열·priority/status 화이트리스트·**priority·status 둘 다 없는 무의미 제안 필터**(`isValidFeatureSuggestion` featureDocs.ts:49 `if (s.priority===undefined && s.status===undefined) return false`, 커밋 e46f31f) — spec "둘 다 없는 제안은 무의미하므로 걸러낸다" 정합. (초판 LOW 지적 해소)
- **state-sync 견고**: `applyFeature`(App 386~416)가 낙관업데이트 없이 POST 후 features·큐 재조회 + `dashReqToken` race 가드(390·403·408줄)로 다른 카드 이동 시 폐기. `featureApplyBusy` 중복클릭 가드(389). fetch 경로도 dashReqToken 가드 적용(306·310). 6a applyPrd와 대칭.
- **body 검증 재사용**: `isPrdApplyRequest`(docs.ts:329) 재사용 정확(approve/reject 문자열배열 2필드). 400 테스트 통과.
- **hasDocs features 인정**: `planning/features.md`도 docs 프로젝트 인식 OR 조건에 추가(docs.ts:41) — features-only 기획 프로젝트 표시 가능. 하위호환 무손상.
- **partial-attr 왕복 무결**: status 없이 priority만 승인 → `(중요도: 높음, 상태: )` 생성, 파서 RE_ATTRS가 빈 그룹 허용이라 되읽기 정상(probe 확인). render/parse 어휘 정합(featureDocs RE_ATTRS ↔ featureTreeBuilder RE_ATTRS 동일 문법).
- **결정론**: 같은 노드 다중 승인은 큐 순서 뒤가 최종(테스트 162줄). in-place swap이라 삽입 폭주 없음.

## 리팩토링 추천 항목

- **[LOW · RESOLVED] `isValidFeatureSuggestion`가 priority·status 둘 다 없는 제안을 통과시킨다** — 커밋 `e46f31f`에서 `if (s.priority===undefined && s.status===undefined) return false`(featureDocs.ts:49) 추가로 해소. 큐/UI에 "아무것도 안 바꾸는 카드" 안 뜬다. spec 문구 정합.
- **[LOW · 잔존 — archive 차단 아님] featureDocs `RE_ATTRS`(줄29) vs `parseAttrLine` 내부 정규식(줄186)이 두 벌** — 하나는 non-capturing, 하나는 capturing. 두 리터럴이 어긋나면 조용히 오작동. 공통 상수 추출 후보(6a review의 PRD_SECTION_ORDER 중복 지적과 동류). 현재 두 리터럴 어휘 일치 확인됨 → 즉각 위험 아님, 후속 정리 권고.
- **[LOW · 잔존 — archive 차단 아님] approve/reject·nodePath 배열 길이 상한 없음** — 개인용 로컬이라 무해(6a review와 동일 LOW). 다중사용자 전환 시 DoS 방지용 상한 필요.
- **[LOW · 잔존 — 감점 아님] `applyFeatureSuggestions`가 6a `PrdApplyRequest`/`PrdApplyResult`를 그대로 쓰는데 함수/타입명이 Prd** — features 문맥에서 이름이 오해 소지(신입 관점). 주석으로 재사용 사유는 밝혀져 있어 감점 아님.

## spec 준수 매핑 (capability SHALL → 코드 위치)

### planning-features-approval-queue
| SHALL / Scenario | 충족 코드 | 상태 |
|---|---|---|
| 읽기전용 endpoint가 features.suggestions.json 반환 | routes/docs.ts:207~219 GET + featureDocs.ts:53 readDocsFeatureSuggestions | ✅ (route test 54) |
| 큐 부재=빈 큐 200(404 아님) | featureDocs.ts:56 existsSync→empty, route 216 | ✅ (test 63) |
| 읽기 MUST NOT throw(깨진 JSON 폴백) | featureDocs.ts:57~65 try/catch | ✅ (test 79) |
| 경로 조작 차단 | routes/docs.ts:211~215 resolveDocsDir null→404 | ✅ (test 71) |
| 미인식 op/빈속성/부정 nodePath/화이트리스트밖 필터 | featureDocs.ts:40~51 isValidFeatureSuggestion(둘 다 없음=49줄 return false) | ✅ (test 110·126, 커밋 e46f31f) |

### planning-features-approval-apply
| SHALL / Scenario | 충족 코드 | 상태 |
|---|---|---|
| 승인=nodePath 헤더 직후 속성줄만 교체(없으면 삽입) | featureDocs.ts:113~133 setNodeAttrs | ✅ (test 113·141) |
| 산문·capability·위계·다른 노드 보존 | in-place 라인 swap(라벨/본문 미접촉) | ✅ (test 122~130) |
| MUST NOT write except through approval | applyFeatureSuggestions만 writeFileSync | ✅ |
| 반려=반영 없이 큐에서만 제거, 원본 불변 | featureDocs.ts:194~198 | ✅ (test 153·91) |
| 응답 {applied,rejected,remaining,skipped,writeFailed?} | featureDocs.ts:205 | ✅ |
| silent drop 금지(미실재 id/nodePath→skipped) | featureDocs.ts:157~159·176~178·195~197 | ✅ (test 172·182) |
| **self-roundtrip 불변식 위반→422, features.md 전혀 안 씀** | featureDocs.ts:174 structureInvariantHolds + apply 244~246 위반 시 writeFailed(422) | ✅ **충족(커밋 93cb7ab)** (test 282·308~345) |
| 파싱 실패→422 원본 보호 | read 실패(219) + 구조 불변식 위반(244) 둘 다 writeFailed | ✅ (test 272·319) |
| 삽입 시 self-roundtrip이 위계 불변 확인 | 삽입(135) 후 structureInvariantHolds가 노드수·capability 검증(244) | ✅ (커밋 93cb7ab) |
| capability 키 보존 불변식 | treeFingerprint caps 집합 비교(174~181) | ✅ (test 331·337) |
| 잘못된 body→400 | routes/docs.ts isPrdApplyRequest | ✅ (test 113) |
| 경로 조작→404 | routes/docs.ts | ✅ (test 122) |
| features.md 부재/IO 실패→422 writeFailed | featureDocs.ts:213·219·245·249 | ✅ (test 130·272) |

## Non-Goal 침범 여부
- 노드 add/remove·label·구조 편집: **미침범** — `setNodeAttrs`는 속성 줄만, 헤더/자식/label 미접촉. ✅
- 유저플로우/와이어 승인, LLM 호출: 코드에 없음. ✅
- SKILL.md(openspec-plan) features 제안 절차: tasks에 [x]이나 이 change diff(48eb5ab/28f222f)엔 없음(agentic-harness 소스 별 repo). archive 시 spec 흡수 대상 아님(proposal 25줄 명시, 1~6a 교훈 준수). ✅

## 5게이트 검증 상태 요약 (본체 재실행 grounding — 2026-07-01 재검토 기준)
- 빌드: `npm run build --workspaces` EXIT=0 (server tsc + web tsc+vite). ✅
- 타입체크: server tsc --noEmit EXIT=0 / web tsc --noEmit EXIT=0. ✅ (재검토 재현)
- 린트: `npm run lint --workspaces` EXIT=0. ✅ (재검토 재현)
- 테스트: server `npm test` 24스위트 **210/210 PASS**(초판 200 → self-roundtrip 6 + MEDIUM/LOW 4, 회귀 0). ✅ (재검토 `cd server && npm test`로 직접 재현)
- UI 실픽셀(Playwright): 커밋 28f222f 보고=PASS(격리 DOCS_ROOT, 제안 렌더→개별 승인→속성줄 교체→반려 원본불변→큐 소진 읽기뷰, 스크린샷 4). **본체 재관찰 불가(환경에 브라우저 없음)**. 수정 후(93cb7ab·e46f31f) 정상 승인 동작 실픽셀은 **별도 에이전트가 재관찰 진행 중** → 그 결과로 최종 확정. ⚠️ 미재관찰(진행 중)

## 적대적 검토 (3+1 페르소나 — 재검토 후 상태)
- **파괴자**: 초판 HIGH(self-roundtrip 방어 부재) + MEDIUM(동일 label 첫매치 silent) 모두 **해소 확인**. self-roundtrip은 write 전 재파싱 노드수/capability 검증(structureInvariantHolds)으로, 동일 label 모호성은 countNodesByPath 사전 차단으로 방어. 이중 방어(사전 차단 + 사후 재파싱)라 라인 패치가 위계를 흔드는 경로가 막혔다. 잔여=배열 길이 무제한(LOW, 개인용 무해).
- **신입 개발자**: 동일 label 모호성이 이제 skipped로 표면화(주석에 "design Risks 이행" 명시) → 6개월 후 "왜 딴 노드가 바뀌지?" 유발 안 함. RE_ATTRS 두 벌 중복은 잔존(LOW, 어휘 일치 확인). 함수명 Prd 재사용은 주석 있어 통과.
- **보안 감사자**: XSS·경로조작·에러노출 전부 깨끗(실측). features.md 쓰기가 resolveDocsDir 경계 안으로만(docs 루트 밖 불가). 큐 읽기 프로토타입 오염 벡터는 Map 미사용·plain filter라 무해. 이슈=길이 무제한(LOW, 개인용 무해).
- **게으른 시니어(4번째)**: 초판이 잡은 "게으름 사다리"(spec 요구 방어를 'set-attrs면 안전하니까'로 건너뜀)는 **실제 구현으로 해소** — spec THEN(self-roundtrip)이 코드+테스트로 traceable. 방어 무력화 프로브로 negative-path가 red 전환함을 커밋에서 grounding(가짜 테스트 아님). FeatureApprovalPanel·featureDocs는 적정, 새 의존성 0, 6a 패턴 대칭 회복.
- 재검토 결론: 2+ 페르소나 중복으로 상승했던 MEDIUM(동일 label)·차단 HIGH(self-roundtrip)가 모두 해소 → 남은 페르소나 지적은 전부 LOW(잔존, archive 차단 아님).

## 최종 배포 가능 여부
**CONCERNS(archive 허용) — 초판 BLOCK 사유 3건 전부 해소.** (2026-07-01 재검토)

- 5게이트: 빌드/타입/린트 EXIT=0, 테스트 **210/210 PASS**(재검토 재현). 승인/반려·보존·경로안전·state-sync·XSS 견고.
- 초판이 archive를 막았던 유일한 사유 **spec ADDED scenario "self-roundtrip 불변식 위반 시 원본 보호" 미구현**이 커밋 `93cb7ab`로 실제 구현됨(write 전 재파싱·노드수/capability 키집합 불변 검증→위반 시 422, 회귀 테스트 6). "happy-path만 통과하는 초록불" 함정은 방어 무력화 프로브로 negative-path red 전환을 확인해 배제.
- MEDIUM(동일 label 첫매치 silent)·LOW(무의미 제안 통과)도 커밋 `e46f31f`로 해소.
- 남은 이슈는 LOW 잔존 2건(RE_ATTRS 두 벌 중복·배열 길이 상한)뿐이며 **개인용 로컬 범위에서 무해·즉각 위험 없음 → archive 차단 아님**. 그래서 CLEAN에 가까운 CONCERNS(잔여 LOW만)이며 archive 진행 가능.
- **단서 하나**: verify 원칙상 UI 실픽셀 관찰이 archive의 표준 게이트인데, 수정 후 정상 승인 동작 실픽셀은 **별도 에이전트가 재관찰 중**(환경에 브라우저 없어 본체 재현 불가). 그 재관찰이 PASS로 확인되면 archive에 남은 조건도 소멸. (코드·테스트 레이어는 이 리뷰로 통과.)

## 개선 우선순위 (제안) — 재검토 후
1. **[완료] self-roundtrip 불변식 구현** — 커밋 93cb7ab. ✅
2. **[완료] 동일 label 형제 모호성 skipped** — 커밋 e46f31f. ✅
3. **[완료] isValidFeatureSuggestion 무의미 제안 필터** — 커밋 e46f31f. ✅
4. **[LOW · 후속] RE_ATTRS 두 벌 공통 상수화 / 배열 길이 상한** — 다중사용자 전환 시. archive 차단 아님.
