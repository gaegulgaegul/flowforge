# 배포 전 최종 검토 — approval-wizard-extension
검토일: 2026-07-07 / 검토 범위: 이 change의 diff만 — `web/src/ApprovalWizard.tsx`(신규 공용 셸), `web/src/PrdApprovalWizard.tsx`·`web/src/FeatureApprovalWizard.tsx`·`web/src/UserFlowApprovalWizard.tsx`, `web/src/App.tsx`(위저드 배선·tick 격리), `shared/src/wizard-state.ts`(rename), `web/src/styles.css`(반응형). 서버는 무변경(spec Non-Goal)이나 apply 멱등성 확인차 `server/src/lib/{docs,featureDocs,userFlowDocs}.ts`를 참조 검증했다.

> **실증 입력(verify.json, 2026-07-07 05:41)**: finalJudgment **PASS**, 7/7 시나리오 PASS, fail 0 / 검증안함 0 / skipped 0. 엣지케이스 게이트 "충분"(null·빈값·경계·에러·대량 covered). 서버 333/333 회귀 0. web은 vite dev + playwright-core로 격리 픽스처 9시나리오 실픽셀 PASS(콘솔 실오류 0). android/ios는 적용 불가 SKIP. → 이 리뷰는 verify를 재실행하지 않고 그 위에서 **판단**한다.
> **검증 성격 구분**: 아래 발견은 코드 정적 분석 + verify의 실픽셀 결과 + 서버 apply 멱등성 실측(grep 확인)에 근거한다. web 패키지에 유닛 테스트 러너가 없어 위저드 effect/레이스는 **자동 회귀 테스트로는 미검증**이며 verify 실픽셀에만 의존한다(정적+실픽셀 검토, 자동 단위검증 아님).

## 반드시 수정해야 할 항목

- 없음.

**근거**: 4개 페르소나 적대 패스 + 10기준 어디서도 BLOCK급(데이터 손상·재적용·인젝션·인가 우회)을 찾지 못했다. 가장 위험했던 파괴자 발견 2·6(더블클릭 이중 전송 / 큐 프룬 실패 후 잔존 id 재전송)은 "서버 apply가 멱등이 아니면 BLOCK 격상" 조건부였는데 — 서버 3경로 모두 **큐에 없는 id는 `skipped`로 떨어뜨리고 재반영하지 않는다**(`featureDocs.ts:214-215` `if (!byId.has(id)) skipped.push(id)`, `docs.ts:292`, `userFlowDocs.ts:253` `not-in-queue`). 멱등성이 확보되어 이중 전송은 무해한 두 번째 POST(전부 skipped)로 흡수된다. 따라서 CONCERNS에 머문다.

## 수정하면 좋은 항목

- **[C-1·CONCERNS] 셸 `apply()`가 busy를 체크하지 않는 비대칭 — 더블클릭 이중 전송 창** (`web/src/ApprovalWizard.tsx:125-128`). 같은 셸의 `decide`(:113)·`escape`(:117)·`restart`(:121)는 전부 `if (busy) return`으로 막는데, 정작 서버를 때리는 `apply`만 이 가드가 없다. 버튼 `disabled={busy}`(:166)는 `busy`가 비동기 state라 `setPrdApplyBusy(true)` 커밋 전 짧은 창에 두 번째 실물 더블클릭이 통과 가능. App의 `dashReqToken` + 서버 `!byId.has` 멱등이 실피해(재적용)를 막지만, **불필요한 두 번째 네트워크 왕복**이 남는다. `apply()` 첫 줄에 `if (busy) return;`을 넣으면 다른 세 핸들러와 대칭을 이루고 창을 닫는다(1줄).

- **[C-2·CONCERNS] 결정이 남은 채 큐만 빈 경우 localStorage 체크포인트 영구 잔존** (`web/src/ApprovalWizard.tsx:96-111`). 저장 effect의 정리 분기는 `Object.keys(decisions).length === 0`일 때만 `removeItem`한다(:98). 큐가 외부 경로로 비워져 `suggestions=[]`가 되었는데 결정 맵이 아직 남아 있으면(예: 반영 전 이탈) `else` 분기로 `{ids:[], decisions:{...}}`를 다시 쓰고, 이후 `return null`(:111). 다음 진입 `reconcileCheckpoint([], …)`가 재로드는 막지만(라이브 id 0) **키 자체는 프로젝트마다 무한 축적**될 수 있다. 재적용 위험은 없고 위생/용량 문제. 정리 조건을 "빈 큐이면 항상 removeItem"으로 확장하거나 `ids.length === 0`도 삭제 트리거에 포함하면 해소.

- **[C-3·CONCERNS] apply 실패 경로에서 프룬 실패로 잔존한 id 재전송 가능(서버 멱등 의존)** (`web/src/ApprovalWizard.tsx:84-86` + `web/src/App.tsx:594·648·705`, `res.queuePruneFailed` 경로). 실패 경로는 tick을 안 올리고 큐를 재조회하므로 결정이 보존되는데(계약대로), 큐 프룬 실패로 이미 문서 반영된 id가 큐에 남아 있으면 사용자가 재검토 없이 다시 반영을 누를 때 그 id가 다시 전송된다. **서버 `!byId.has→skipped` 멱등이 재반영을 막으므로 실피해는 없다**(확인함). 다만 프론트가 "이미 반영됨"을 시각적으로 구분해 주지 못해 사용자가 혼동할 수 있다 — `queuePruneFailed` 안내 문구(App.tsx:575)는 이미 있으나, 요약 재진입 시 해당 id를 별도 표기하면 더 낫다(선택).

- **[C-4·CONCERNS(낮음)] localStorage 결정 *값* 미검증 — 손상된 체크포인트가 렌더 경로로 유입** (`web/src/ApprovalWizard.tsx:36-39,149,154`). `loadCheckpoint`는 `decisions` 컨테이너의 `typeof === object`만 확인하고 개별 값이 `'approve'|'reject'|'skip'` 열거형인지는 검증 안 한다. `applyPayload`가 approve/reject만 집계하므로 **서버로는 안 샌다(안전)**. 그러나 손상값이 `DECISION_LABEL[d]` 조회(:154)나 `?? "skip"`(:149) 폴백으로 흘러 요약 렌더에서 `undefined` 라벨/React child 오류(catch 후 복구 가능)를 낼 수 있다. `loadCheckpoint`에서 값도 열거형 화이트리스트로 거르면 완전 해소(보안 감사자·파괴자 공통 지적, 낮음).

- **[C-5·CONCERNS] 공용 셸의 `prd-` 접두어 오해 소지 + 잠재 testid 충돌** (`web/src/ApprovalWizard.tsx:137·138·199` 및 다수 `prd-wizard-*`/`prd-approval-*`). 셸은 이제 제네릭(`ApprovalWizard<TSuggestion>`)인데 구조 className·셸 소유 `data-testid`가 전부 `prd-*`로 하드코딩돼 있다. 세 위저드는 `activePlanTab`으로 상호 배타 마운트(App.tsx:858·875·925)라 **현재 런타임 충돌은 없다**(신입 개발자·직접 확인). 그러나 (a) `FeatureApprovalWizard`를 읽다 셸에 들어온 개발자가 PRD 전용 코드로 오해하고, (b) 누군가 web E2E에서 features 탭에 `getByTestId('prd-wizard')`를 쓰면 조용히 매치되는 함정이 잠복. 셸 상단에 "레거시 `prd-` 접두어 — 셸은 제네릭, CSS/픽셀 불변 위해 유지"를 1줄 주석으로 박아 두면 오해와 함정을 동시에 방어(리네임은 styles.css 다수 규칙 연동이라 이번 스코프 밖).

## 현재 상태로 유지해도 되는 항목

- **공용 셸 `ApprovalWizard<TSuggestion>` 추출은 정당하다(과잉추상화 아님)**. 셸이 체크포인트 load/reconcile/save 3 effect·appliedTick 리셋 순서·진행바·탈출구·요약 등 버그 취약 로직을 1벌로 소유하고, 패널은 카드 본문·요약 라벨·체크포인트 키만 주입한다. 대안(3벌 복제)은 가장 버그나기 쉬운 부분을 3배로 늘린다. 호출처 3곳 = rule of three 충족. (게으른 시니어 CLEAN)
- **세 얇은 래퍼 컴포넌트도 정당**. PRD(섹션 title/body 해석)·features(`findNodeByPath` 트리 하강 + 속성 diff)·userflow(target/edge 의미 파생)는 마크업이 아니라 **패널별 로직**을 담아 App.tsx 인라인보다 낫다.
- **XSS 안전**. 스코프 전체에 `dangerouslySetInnerHTML`/`innerHTML` 0건. `proposedBody`·`rationale`·`label`·`nodePath` 등 서버/AI 유래 필드가 전부 JSX 중괄호 보간(자동 이스케이프). `<pre>{proposedBody}</pre>`도 텍스트 노드. (보안 감사자 CLEAN)
- **프로토타입 오염 벡터 없음**(node REPL 실측 검증). `JSON.parse`는 `__proto__` 키를 own property로 만들 뿐 setter를 안 부르고, `reconcileCheckpoint`의 `live.has(id)` 게이트(서버 생성 id만 통과) + 결정값이 항상 원시 문자열(스펙상 `[[SetPrototypeOf]]` no-op)이라 오염 불가.
- **stale id 서버 누출 없음** — `reconcileCheckpoint`(로드) + `applyPayload`(반영) 이중 게이트가 둘 다 서버 제공 `ids`로 걸러 탬퍼된 localStorage id가 apply로 못 샌다. (파괴자·보안 공통 CLEAN)
- **localStorage 실패 전 경로 try/catch 가드**(`:33-42` 읽기·`:97-108` 쓰기), 무방비 `JSON.parse` 없음. quota/private mode/비활성 모두 빈 맵 폴백.
- **CSS 재사용 무손상** — 삭제된 두 패널의 `feature-approval-*`·`uflow-*` 규칙 33벌이 styles.css에 남아 새 카드 렌더러가 그대로 쓴다. 고아·깨진 스타일 없음.
- **반응형** — `@media (max-width:820px)`(styles.css:852-856)가 `.prd-approval-diff`·`.feature-approval-diff`를 세로 스택, 위저드 버튼을 flex-fill로. 세 위저드가 같은 클래스를 공유하므로 features/userflow도 모바일 스택 상속. verify 3패널 스크린샷으로 실증됨.

## 리팩토링 추천 항목

- **`pendingIds` 공개 API 정리**(`shared/src/wizard-state.ts:66-71`, barrel `shared/src/index.ts:98`). 프로덕션 소비자 0건 — 유일 호출은 `server/src/lib/__tests__/prdWizardState.test.ts:69` 단일 단언뿐이다(자기 자신만 테스트). 삭제하거나 최소한 barrel export에서 내리면 공개 표면이 준다. (게으른 시니어)
- **`WizardCheckpoint` 인터페이스 미사용**(`shared/src/wizard-state.ts:19-24`). 셸은 이 타입을 참조 않고 `{ids, decisions}`를 인라인 리터럴로 쓰고 읽을 땐 ad-hoc `{decisions?: unknown}` 캐스트를 쓴다. `loadCheckpoint`/저장 effect를 이 타입으로 타이핑하거나 삭제.
- **방어적 하드닝(선택)**: `wizard-state.ts`의 `next`/`result` 객체를 `Object.create(null)`로 만들면 "결정값이 늘 문자열이라 안전"이라는 암묵 가정을 제거(현재 익스플로잇 불가하나 belt-and-suspenders). C-4의 값 검증과 묶어 처리 가능.
- **`key` 리마운트가 정정성 계약임을 세 호출처에 주석 통일**(App.tsx:863·880·948). userflow만 주석이 있고(:948) PRD·features는 없다 — key 제거/변경이 체크포인트 복원을 깨뜨리는 숨은 의존임을 명시.

## 적대적 검토 (4 페르소나)

- **파괴자(Saboteur)**: 6개 가설 추적. **발견(≥1)**: ①셸 `apply()` busy 미체크 이중 전송 창(C-1) ②effect 순서 레이스 — "리셋이 이긴다"는 *최종 상태* 기준 참이나 선언 순서에만 의존·회귀 테스트 0(C-5 근본 리스크로 병합) ③실패 경로 잔존 id 재전송(C-3) ④빈 큐+결정 잔존 localStorage 누수(C-2). CLEAN: stale id 이중 게이트·localStorage try/catch·userflow 무효제안(id만 전송)·`findNodeByPath` null 가드. **BLOCK 없음** — 서버 apply 멱등성(`!byId.has→skipped`) 실측 확인으로 발견 2·6이 CONCERNS에 고정.
- **신입 개발자(New Hire)**: **발견**: 제네릭 셸의 `prd-` 접두어 오해 소지 + 잠재 testid 충돌(C-5), 셸 내 testid 네임스페이싱 반쪽 마이그레이션(C-5 병합), `key` 리마운트 계약 주석 비대칭(리팩토링 항목). 긍정 확인: 헬퍼마다 의도 주석이 잘 달려 있어 *빠진* 주석이 도드라진다.
- **보안 감사자(Security Auditor)**: **발견**: localStorage 결정값 열거형 미검증(C-4, 낮음), 클라이언트 공급 `project`/`stem`이 API URL 경로로 유입(현 단일사용자 로컬 컨텍스트에선 정보성 — 배포 모델 바뀌면 서버 경로 sanitize 필요). CLEAN: XSS·프로토타입 오염(실측)·localStorage 민감정보 부재·탬퍼 id 이중 게이트.
- **게으른 시니어(Lazy Senior)**: **과잉구현 발견**: `pendingIds` 프로덕션 데드(리팩토링), `WizardCheckpoint` 미사용 타입(리팩토링). "안 짜도 될 코드"로 지목된 제네릭 셸·세 래퍼·features 헬퍼는 전부 **정당(과잉 아님)**으로 반증 — 복제 회피·패널별 로직 캡슐화라는 실효가 있다.
- **2+ 페르소나 중복 발견(심각도 상승)**: (a) **localStorage 결정값 미검증** — 보안 감사자(2a)·파괴자(발견 5 미세흠) 동시 지적 → 단독이면 낮음이나 두 관점 겹쳐 C-4로 표면화. (b) **테스트 러너 부재로 위저드 effect/레이스 미검증** — 파괴자·게으른 시니어 모두 "web 자동 테스트 0" 지적 → verify 실픽셀이 보완하나 회귀 방어 공백은 기록해 둔다(C-1/C-5의 근본 리스크 배수).

## 최종 배포 가능 여부

**배포 가능** (치명 0건). verify PASS(7/7)와 서버 apply 멱등성 실측이 뒷받침한다. 남은 것은 전부 CONCERNS/기술부채 티어 — 특히 **C-1(셸 apply busy 가드 1줄)** 은 다른 세 핸들러와 대칭을 맞추는 값싼 수정이라 배포 전 반영을 권장하나, 서버 멱등성이 실피해를 이미 막으므로 블로킹은 아니다. web 유닛 테스트 부재로 위저드 레이스가 자동 회귀 방어 밖이라는 점은 이 change 고유가 아닌 프로젝트 상수(별도 결정 항목)로 계승한다.

## 개선 우선순위 (제안)

1. **C-1** 셸 `apply()`에 `if (busy) return;` 추가 — 1줄, 네 핸들러 대칭 회복 + 이중 전송 창 폐쇄. 가장 값싸고 즉효.
2. **C-4** `loadCheckpoint`에서 결정값 열거형 화이트리스트 검증 — 손상 체크포인트의 렌더 경로 유입 차단(2페르소나 중복).
3. **C-2** 빈 큐+결정 잔존 시 체크포인트 removeItem — localStorage 무한 축적 위생 해소.
4. **C-5** 셸 상단 "레거시 `prd-` 접두어, 제네릭 셸" 1줄 주석 — 오해 + 잠재 E2E testid 함정 동시 방어.
5. **C-3** `queuePruneFailed` 후 요약 재진입 시 잔존 id 시각 구분(선택) — 서버 멱등이 실피해는 막으므로 UX 개선 성격.
6. **리팩토링** `pendingIds`·`WizardCheckpoint` 정리, `key` 계약 주석 통일 — 공개 표면·가독성 부채 축소, 급하지 않음.
