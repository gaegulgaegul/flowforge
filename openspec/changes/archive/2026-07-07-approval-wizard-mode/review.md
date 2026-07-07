# 배포 전 최종 검토 — approval-wizard-mode

---

## 검토일: 2026-07-06 (3차 — C-2·M-1 수정 후 재검토)

검토 범위: `web/src/App.tsx`(119 tick state·405-541 openProject·553-599 applyPrd·834-846 위저드 배선), `web/src/PrdApprovalWizard.tsx`(87-115 effect 순서·reset effect), `shared/src/prd-wizard-state.ts`(순수 함수 전체), `web/src/api.ts`(applyInChunks 195-222) — 이 change의 diff 범위 + C-2·M-1 수정 커밋 `8e9e636`가 건드린 배선. 서버 apply/큐 계약은 직전 change 검증분(무변경).

> 재검토 트리거: 2차 검토(아래)가 지적한 **C-2**(cross-project 결정 소실)와 **M-1**(반영 대상 0 유령 성공)을 커밋 `8e9e636`가 수정. verify.json(2026-07-06 13:12)이 그 위에서 신규 xproject 픽스처 포함 PASS 7/7 재실행됨. 이 3차 검토는 **① C-2·M-1 수정이 실제로 반영됐는지 ② 수정이 새 회귀를 도입했는지**를 판단한다. 적대 패스는 self-review 함정 방지를 위해 2개 독립 서브에이전트(회귀검증 / 보안·과잉구현)에게 위임해 병렬 실행.
>
> **판정 요약: C-2·M-1 모두 해결됨. 새 치명 회귀 없음. 남은 미해결은 저위험 이월 2건(M-2 하드닝·M-3 기존 관행) + 신규 저위험 관찰 2건(왕복 실측 미검·App 배선 자동테스트 부재). 배포 가능.**

### C-2 (2차 치명) — 해결됨 ✅

- **수정 확인**: 커밋 `8e9e636`가 두 겹으로 수정. ① `App.tsx:412`(`openProject`에 `setPrdAppliedTick(0)` — 프로젝트 전환 시 tick 격리) ② `App.tsx:839`(`<PrdApprovalWizard key={dashProject?.name ?? ""}>` — 프로젝트 전환 시 강제 재마운트).
- **이중 수정이 중복 아님(게으른 시니어·파괴자 서브에이전트 코드 확정)**: 두 메커니즘은 서로 다른 실패 모드를 막는 **상호보완**이라 하나만으론 C-2가 재발한다.
  - `key`만 있고 tick 리셋 없으면 → X apply(tick 0→1) 후 Y 전환 시 위저드는 재마운트되나 부모 `prdAppliedTick`은 여전히 `1`(전역 카운터, `App.tsx:119`). 새 Y 인스턴스의 reset effect(`PrdApprovalWizard.tsx:97-99`)가 **마운트 시 1회 실행**되며 `appliedTick=1>0`을 보고 `setDecisions({})` 발화 → Y가 막 복원한 체크포인트를 그 자리에서 파괴(= 정확히 C-2 재현).
  - tick 리셋만 있고 `key` 없으면 → 위저드 미재마운트로 `decisions` state가 메모리에 잔존, `[project, ids]` effect가 다음 커밋에서 복원하나 그 사이 한 프레임 이전 프로젝트 결정 맵이 새 suggestions와 오매칭 렌더될 여지(effect는 render 후 실행).
- **stale prop 윈도우 없음**: `openProject`(`App.tsx:405-412`)에서 `setDashProject`·`setPrdAppliedTick(0)`가 같은 동기 콜백에 있고 React 18 `createRoot` 자동 배칭으로 한 커밋에 묶여, 재마운트되는 위저드는 **첫 렌더부터 tick=0**을 받는다.
- **실증**: 신규 `web/verify-fixture/wizard-fixture-xproject.tsx`(App C-2 배선 충실 재현)를 Playwright 실픽셀 재현 → X 반영 후 Y 재진입 시 체크포인트 복원(2/3) 실측 PASS(`evidence/s9-xproject.png`, verify.json layers.web). 2차 검토가 놓친 cross-project 경로를 verify가 이번에 커버.

### M-1 (2차 권장) — 해결됨 ✅

- **수정 확인**: `App.tsx:559-562` — `applyPrd`에 `if (approve.length === 0 && reject.length === 0)` short-circuit(`setStatus("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.")` 후 return, tick 미증가). 전부-skip에서 서버 무접촉·유령 성공·위저드 리셋 3중 문제가 안내 메시지로 대체됨.
- **정당한 apply를 막지 않음(파괴자 서브에이전트 확정)**: `apply()`는 `allDecided` 전제(요약 화면 진입 조건, `PrdApprovalWizard.tsx:137,140`)에서만 호출되고, payload가 `{approve:[],reject:[]}`가 되는 유일 케이스는 전부-skip뿐. 빈 큐는 `PrdApprovalWizard.tsx:117`에서 렌더 자체가 안 됨(`apply()` 호출 불가).

### 3차 나머지 (2차에서 이월)

- **M-2(체크포인트 결정 값 미검증)** — 미해결(저위험 하드닝). `reconcileCheckpoint`(`shared/src/prd-wizard-state.ts:142-152`)는 여전히 id-in-queue만 필터, 결정 값 화이트리스트 없음. **오늘 익스플로잇 불가(보안 서브에이전트 확정)**: 하류 `applyPayload`(`:124-136`)가 `d==='approve'`/`d==='reject'` **엄격 리터럴 매칭**이라 조작 값은 어느 배열에도 안 들어가 서버로 안 샘. UI도 `DECISION_LABEL[d]`(`Record<WizardDecision,string>`) 룩업이라 미지 값은 빈 라벨. 조작 대상이 자기 브라우저 localStorage뿐(self-XSS급 무의미, 프로젝트별 키 분리로 전파 채널 없음). 방어 심도용 한 줄 권고지 배포 차단 아님.
- **M-3(raw 에러 노출)** — 미해결(이 change 신규 아님). `App.tsx:585` `${String(e)}`. 동일 패턴이 리포 전역 13곳(188·206·209·212·215·218·357·384·532·585·631·680·724) — 직전 change부터의 관행 계승. `api.ts` Error 메시지는 엔드포인트 라벨+HTTP status뿐(URL 경로·스택 미포함, 보안 서브에이전트 확인). 저리스크.
- **L-1(신규 관찰) 왕복 실측 미검** — verify의 xproject는 편도(X→Y)만 실픽셀 캡처(`verify.json` layers.web, `s9-xproject.png`). 왕복(X→Y→X 복귀 후 A 결정 보존)은 이번 적대 분석이 **코드 추론**(React 배칭·effect 순서·`checkpointKey(project)` 인스턴스 격리)으로 CLEAN 판정했으나 실픽셀 증거는 없음 — 정직 구분. 저위험(왕복 안전성이 코드상 확정적이라 배포 차단 아님, 다음 사이클 실측 권장).
- **L-2(신규 관찰) App.tsx 배선 자동테스트 부재** — `prdAppliedTick`·`key` 배선의 회귀 방지가 수동 Playwright 픽스처에만 의존. 순수 모듈(`shared/src/prd-wizard-state.ts`)은 jest 16건으로 탄탄하나 App 배선(tick 리셋 타이밍·key 재마운트 상호작용) 자동 테스트 없음 → 향후 리팩토링 시 이 조합 재파손을 CI가 못 잡음. `20-testing.md` TDD 의무와 다소 어긋나나 예광탄 성격상 치명 아님(다음 사이클 권장).

### 3차 적대적 검토 (4 페르소나 — 2개 독립 서브에이전트로 위임, 전체 스코프)

- **파괴자**: [CLEAN] C-2·M-1 수정에서 신규 CRITICAL/HIGH 회귀 없음. `key`+tick 조합은 상호보완(하나만으론 원 회귀 재발 코드 확정), C-1 happy path(동일 프로젝트 apply→tick++→reset) 유지, apply in-flight 중 프로젝트 전환 race도 `dashReqToken`(`App.tsx:563·575`)이 tick 증가 포함 `.then` 전체를 폐기해 안전. [LOW] 왕복 실측 미검(L-1).
- **신입 개발자**: [CONCERN 저] `prdAppliedTick` 카운터 신호가 App(119·412·579·845)↔위저드(97-99)에 흩어져 "왜 숫자를 세나"가 주석 의존 — 단 `openProject:410-411`·`applyPrd:557-558`·reset effect:94-96에 각 의도 주석이 추가돼 2차 대비 개선됨(C-2 근인이던 "리셋 신호 부재"가 주석으로 표면화). [CONCERN 저] 결정 점 3중 삼항(`PrdApprovalWizard.tsx:225-234`)은 여전히 헬퍼 미추출(선택 리팩토링).
- **보안 감사자**: [CLEAN] XSS 벡터 없음(`dangerouslySetInnerHTML` 이 change 범위 전무 — grep 확인, 전부 텍스트 노드). auth는 서버 계약 무변경이라 스코프 밖(프로덕션화 전 별도 트랙 필요성만 기록). [LOW] M-2 값 미검증(오늘 무해, 하류 엄격 매칭 의존). [저] M-3 raw 에러(기존 관행). BLOCK 없음.
- **게으른 시니어**: [CLEAN] 과잉구현 없음. C-2 이중 수정은 중복 아닌 필요충분(상호보완 코드 확정). `shared/` 순수 모듈 분리는 서버 jest 실소비(`server/src/lib/__tests__/prdWizardState.test.ts`)로 정당화, 미사용 함수 0(`pendingIds`까지 소비). 새 의존성·불필요 추상화·중복 유틸 0(`applyInChunks`는 기존 헬퍼 재사용, CSS 토큰 기존 `prd-approval-*` 재사용). YAGNI 위반 없음.
- **2+ 페르소나 중복 발견(심각도 상승)**: 없음(신규 치명 0). C-2 이중 수정의 상호보완성은 파괴자·게으른 시니어가 **독립적으로 같은 결론**(둘 다 필수, 중복 아님)에 도달 → 수정 정당성 교차 확증(위험 상승이 아니라 신뢰 상승).

### 3차 최종 배포 가능 여부

**배포 가능**

- C-1(1차)·C-2(2차)·M-1(2차) 치명·권장 항목 전부 해결 확인(코드 + verify 실픽셀 + 독립 서브에이전트 2종 교차검증). 테스트 333/333 PASS(회귀 0, 재실행 확인), 타입체크 clean, XSS clean.
- 남은 항목은 전부 저위험: M-2(오늘 익스플로잇 불가·하류 엄격 매칭), M-3(기존 리포 관행·이 change 신규 아님), L-1(왕복 코드상 확정·실측만 없음), L-2(예광탄 배선 자동테스트 부재). **배포를 막을 사유 없음.**
- 예광탄(PRD 패널만) 성격에 부합. features/userflow 위저드화는 명시적 후속 change 범위.

### 3차 개선 우선순위 (제안)

1. **L-1** (다음 사이클) — xproject 픽스처에 왕복(Y→X 복귀 후 A 결정 보존) 실픽셀 시나리오 추가. 코드상 확정이나 실측으로 회귀 그물 완성.
2. **L-2** (다음 사이클) — App.tsx tick·key 배선 회귀 테스트(Testing Library 등)로 수동 픽스처 의존 해소(`20-testing.md` 정합).
3. **M-2** (하드닝) — `reconcileCheckpoint`/`loadCheckpoint`에 `WizardDecision` 값 화이트리스트 한 줄. 미래 하류 소비자 회귀 방어.
4. **M-3** (저) — 상태바 raw 에러 사용자 친화 메시지(리포 전역 패턴이라 별도 정리 트랙).
5. 결정 점 삼항 → `decisionToDot` 헬퍼 추출(가독성, 선택).

---

## 검토일: 2026-07-06 (2차 — C-1 수정 후 재검토)

검토 범위: `web/src/PrdApprovalWizard.tsx`(appliedTick reset effect 신규), `web/src/App.tsx`(119·405-464 openProject·550-590 applyPrd·829-836 위저드 배선), `shared/src/prd-wizard-state.ts`, `web/src/api.ts`(applyInChunks 195-222) — 이 change의 diff 범위 + C-1 수정 커밋 `78f92e0`가 건드린 배선. 서버 apply/큐 계약은 직전 change 검증분(무변경).

> 재검토 트리거: 1차 검토(아래)가 지적한 **C-1**(apply 후 skip 잔존 큐 요약 갇힘)을 커밋 `78f92e0`가 `appliedTick` prop + 반영 성공 시 `setDecisions({})` reset effect로 수정. verify.json(2026-07-06 12:45)이 그 위에서 PASS 7/7 재실행됨. 이 2차 검토는 **① C-1 수정이 실제로 반영됐는지 ② 수정이 새 회귀를 도입했는지**를 판단한다.
>
> **판정 요약: C-1은 해결됨. 그러나 수정이 새 치명 회귀 1건(C-2, cross-project 결정 소실)을 도입했다.** 적대적(파괴자) 페르소나 재검증으로 재현 경로를 코드로 확정.

### C-1 (1차 치명) — 해결됨 ✅

- **수정 확인**: `PrdApprovalWizard.tsx:81-83`(`appliedTick` prop) + `:97-99`(`useEffect(() => { if (appliedTick > 0) setDecisions({}) }, [appliedTick])`) + `App.tsx:570`(성공 `.then`에서만 `setPrdAppliedTick((t) => t + 1)`). 반영 성공 시 결정 맵이 `{}`로 리셋 → skip 잔존 큐가 요약에 갇히지 않고 카드로 재등장(spec "다시 나타난다" 충족). 실패 `.catch`(App.tsx:572-584)는 tick 미증가 → 결정 보존(재시도 계약 유지). **1차 재현 경로(큐 [A,B] → A승인·B건너뛰기 → 반영 → B 요약 박제)는 더 이상 성립하지 않음.**
- 근본 수정(간접 "큐 축소→reconcile 빈 맵" 경로 대신 명시적 "반영 성공→세션 리셋" 신호)이라 1차 리뷰의 리팩토링 권고와도 일치. 표면 수정 아님.

### C-2 (2차 치명 — 신규 회귀) — cross-project 전환 시 다른 프로젝트의 미반영 결정 소실 (배선 누락)

- **위치**: `web/src/App.tsx:119`(`prdAppliedTick`는 App 전역 state, project별 키 없음) × `App.tsx:405-464`(`openProject`가 `setPlanningPrd`·`setPrdSuggestions` 등 dashboard 상태를 전부 리셋하는데 **`prdAppliedTick`만 리셋 안 함** — grep: `setPrdAppliedTick`은 119(초기)·570(성공)에만 존재) × `App.tsx:829-836`(위저드에 **`key` prop 없음** → project 전환 시 재마운트되지만 부모 tick은 그대로) × `PrdApprovalWizard.tsx:97-99`(reset effect는 마운트 시에도 1회 실행 → 그때 `appliedTick > 0`이면 발화).
- **재현**: (1) 프로젝트 **X** PRD 뷰에서 결정 후 `[결정 반영하기]` 성공 → `prdAppliedTick`이 0→1(App.tsx:570). (2) 프로젝트 **Y**(localStorage `prd-wizard:Y`에 미반영 체크포인트 `{C:approve, D:reject}` 잔존 — 이전에 Y를 검토하다 이탈한 흔한 상태)로 카드 전환. (3) `openProject`가 `setPlanningPrd(null)`(411) → 위저드 언마운트, async `setPlanningPrd(r.prd)`(415) → **재마운트**. (4) 재마운트 시 `useState` 초기화가 Y 체크포인트를 복원(`decisions={C:approve,D:reject}`, :87-89) → 하지만 reset effect가 **마운트 시 `appliedTick===1 > 0`을 보고 발화** → `setDecisions({})`(:98). (5) 다음 커밋에서 save effect(:102-115)가 `decisions==={}`이므로 `removeItem("prd-wizard:Y")`(:105) → **Y의 미반영 결정이 메모리+localStorage 양쪽에서 소실**. 사용자는 Y에 아무 조작도 안 했다.
- **왜 치명**: (1) spec "이탈 후 재진입 시 결정 복원"(`spec.md:35-38`) 위반 — Y로 재진입했는데 X에서 apply했다는 이유만으로 Y의 복원이 즉시 파괴된다. (2) **C-1 수정이 도입한 신규 회귀** — 78f92e0 이전엔 `appliedTick` 자체가 없어 이 경로가 존재하지 않았다. (3) verify.json은 전 시나리오가 단일 `fixture-project`라 cross-project 전환을 관찰하지 못함 → PASS 7/7이 이 경로를 놓쳤다. (4) 멀티프로젝트 환경 확정(`ProjectGrid`에서 여러 카드 전환, App.tsx:812).
- **심각도 조정(정직)**: 데이터 **무결성**은 안전 — 서버 큐 원본은 불변이라 Y는 다시 검토 가능(design D-3: "체크포인트는 편의지 데이터가 아님"). 따라서 이건 데이터 손상이 아니라 **기능/UX 결함(미반영 작업 손실 + spec 복원 위반)**. 그러나 예광탄이라도 "이탈 내성"은 이 change의 1급 목표(proposal What Changes 2-3)이고, 그 목표가 cross-project에서 깨지므로 배포 전 수정 대상.
- **수정 방향(택1)**: ① `openProject`에 `setPrdAppliedTick(0)` 추가 — 프로젝트 전환 시 tick 초기화(다른 상태 리셋과 대칭, 가장 작은 diff). ② 위저드에 `key={dashProject?.name}` 부여 + tick도 project 키잉 — 단 key만으로는 부모 tick이 여전히 truthy라 ①이 반드시 병행돼야 함. ③ reset effect를 마운트에서 skip(첫 실행 무시 ref 가드) — mount vs increment 구분. **①이 최소·명확**(openProject가 이미 PRD 관련 상태 전부를 리셋하는 곳이라 tick도 거기 넣는 게 배선 일관).

### 2차 검토 나머지 (1차에서 이월)

- **M-1(전부-skip phantom success)** — C-1 수정 후 **오히려 악화**. 전부 skip → `applyPayload`가 `{approve:[],reject:[]}`(prd-wizard-state.ts:147 테스트 확인) → `applyInChunks`(api.ts:205-211)가 청크 0개로 **서버 무접촉인데 성공 resolve** → 성공 `.then`이 `setPrdAppliedTick++`(App.tsx:570) → reset effect가 위저드를 첫 카드로 **리셋**. 사용자에겐 "반영 버튼을 눌렀더니 서버 호출·상태메시지 없이 위저드가 처음으로 되돌아감"으로 보임(먹통+유령 성공). 수정: `applyPrd`에서 `approve.length + reject.length === 0`이면 short-circuit + "반영할 결정이 없습니다(건너뛴 항목은 다시 표시됩니다)" `setStatus`, tick 미증가. 권장(치명 아님).
- **M-2(체크포인트 결정 값 미검증)** — 1차와 동일, 미해결. `reconcileCheckpoint`(prd-wizard-state.ts:142-152)는 id-in-queue만 필터, 값 유효성 미검. 오늘 무해(하류 `applyPayload`가 리터럴 매칭). 방어적 하드닝(값도 3리터럴 필터 한 줄) 권장.
- **M-3(raw 에러 노출)** — 1차와 동일, 미해결. App.tsx:576 `${String(e)}`. 직전 change 유래·로컬 도구라 저리스크.

### 2차 적대적 검토 (4 페르소나 — C-1 수정 스코프 전체 재훑음)

- **파괴자**: [BLOCK] **C-2** cross-project 전환 시 Y 체크포인트 파괴(재현 경로 코드 확정 — openProject의 tick 리셋 누락 × key 부재 × mount-time reset effect). [CONCERN] M-1 전부-skip 유령 성공→위저드 리셋. effect 순서 경쟁(restore@90 → reset@97 같은 commit)은 **정상**(선언 순서상 reset이 이겨 apply-성공 경로는 clean) — 여기선 안 터진다.
- **신입 개발자**: [CONCERN] `prdAppliedTick`이라는 카운터 신호가 App↔위저드에 흩어져 있어(119·570·835·97-99) "왜 숫자를 세나"가 주석 없이는 불명확 — reset effect 주석(:94-96)은 있으나 App쪽 `openProject`에 "여기서 tick 리셋 필요"라는 신호가 없어 C-2 누락을 유발. reset effect가 마운트에서도 발화한다는 점(useEffect 기본 의미)이 암묵적 가정.
- **보안 감사자**: [CONCERN 저] M-2 값 미검증(하류 규율 의존). XSS·인젝션·auth 우회 없음(텍스트 노드·서버 생성 id). BLOCK 없음.
- **게으른 시니어**: C-1 수정 자체는 과잉 아님 — `appliedTick` 단일 숫자 신호는 콜백 prop보다 가벼운 최소 배선. 다만 **C-2의 근인이 "가벼움"에서 옴** — project 키잉 없는 전역 tick이 diff를 줄이려다 cross-project 격리를 빠뜨렸다. "안 짜도 될 코드"는 없으나 "한 줄 더 짰어야 할 곳"(openProject tick 리셋)이 누락. (누락은 파괴자 소관 — C-2로 계상.)
- **2+ 페르소나 중복 발견(심각도 상승)**: **C-2**를 파괴자(재현)와 신입 개발자(openProject에 리셋 신호 부재)·게으른 시니어(전역 tick 격리 누락)가 같은 근인으로 지적 → 심각도 상승 확정, 치명 티어.

### 2차 최종 배포 가능 여부

**조건부 가능 (치명 1건 수정 후 — C-2)**

- C-1(1차 치명)은 해결 확인. 해피 패스(단일 프로젝트, 전부 승인/반려)는 verify 실픽셀로 검증됨.
- 그러나 C-1 수정이 **cross-project 결정 소실(C-2)**을 신규 도입했고, 이는 이 change의 1급 목표인 "이탈 내성"을 멀티프로젝트에서 깨뜨린다. 데이터 무결성은 안전(큐 불변)하나 미반영 작업 손실 + spec 복원 위반이므로 배포 전 C-2 수정 필요. 수정은 `openProject`에 `setPrdAppliedTick(0)` 한 줄(+가능하면 위저드 `key` project 키잉)로 최소.

### 2차 개선 우선순위 (제안)

1. **C-2** (치명·신규 회귀) — `openProject`(App.tsx:405)에 `setPrdAppliedTick(0)` 추가로 cross-project tick 격리. 배포 전제. 병행 권장: 위저드 `key={dashProject?.name}`(App.tsx:829).
2. **M-1** (권장) — `applyPrd`에서 반영 대상 0이면 short-circuit + 안내 setStatus(tick 미증가). C-1 수정 후 유령 성공→리셋으로 악화됐으므로 함께 처리.
3. **M-2** (하드닝) — `reconcileCheckpoint`에 결정 값 화이트리스트.
4. **M-3** (저) — 상태바 raw 에러 사용자 친화 메시지(직전 change 유래).

---

## 검토일: 2026-07-06 (1차 — apply 전) / 검토 범위: `shared/src/prd-wizard-state.ts`, `shared/src/index.ts`(exports), `server/src/lib/__tests__/prdWizardState.test.ts`, `web/src/PrdApprovalWizard.tsx`, `web/src/App.tsx`(applyPrd 배선, 548-585), `web/src/styles.css`(prd-wizard-*), `web/src/PrdApprovalPanel.tsx`(삭제) — 이 change의 diff 범위만. 서버 apply/큐 계약·`applyInChunks`는 직전 change 검증분(무변경)이라 배선 접점만 확인.

> 실증 검증 입력: `verify.json`(2026-07-06) = **PASS 7/7**(fail 0·검증안함 0·skipped 0). server jest 333/333, web 실픽셀 7시나리오. 이 리뷰는 verify를 재실행하지 않고 그 위에서 판단한다. **단, verify가 커버하지 못한 경로 1건(apply 후 큐 축소 → skip 잔존)에서 아래 치명 1건을 발견했다** — verify의 s2는 큐 불변 reload만 봤고, apply로 큐가 줄어든 뒤의 재진입은 관찰되지 않았다.

> **[2차 갱신 표시]** 아래 C-1은 커밋 `78f92e0`로 **해결됨**(위 2차 검토 참조). M-1~M-3은 미해결(이월).

## 반드시 수정해야 할 항목

### C-1. apply 후 skip 잔존 큐 = 요약 화면에 갇힘 + skip 재검토 불가 (spec 위반)
- **위치**: `web/src/PrdApprovalWizard.tsx:87-89`(`useEffect([project, ids])`) × `web/src/App.tsx:566`(apply 후 재조회로 `setPrdSuggestions` 큐 축소). 사후 리셋 부재는 `PrdApprovalWizard.tsx` 전체에 `onApplied`/`setDecisions({})` 사후 호출이 **없음**으로 확인(grep). App도 localStorage/decisions를 건드리지 않음.
- **재현**: 큐 `[A,B]` → A 승인·B 건너뛰기 → `[결정 반영하기]`. `applyPrd`가 A를 서버 반영 후 재조회 → `setPrdSuggestions`가 축소된 큐 `[B]`(새 배열 참조) 반환 → `ids` useMemo 재계산 → 라인 87-89 effect 발화 → `loadCheckpoint("proj", ["B"])`. localStorage엔 `{A:approve, B:skip}` 잔존 → `reconcileCheckpoint`가 `{B:skip}`만 남김 → `allDecided(["B"], {B:skip})`가 **true**(skip도 "결정된 것") → 위저드가 카드가 아니라 **요약 화면**으로 착지. 사용자는 "승인 0·반려 0·건너뜀 1"만 보고, B를 다시 검토할 경로가 [처음부터 다시](라벨상 "재검토"로 안 읽힘)밖에 없다.
- **왜 치명**: (1) **spec THEN 위반** — "건너뛰기한 제안은... 다음 위저드 진입 때 다시 나타난다"(`specs/.../spec.md:16-19`). 여기선 apply 후 재진입 시 B가 **카드로 재등장하지 않고** 요약에 skip으로 박제된다. (2) skip을 1건 이상 남긴 채 반영하는 것은 코너케이스가 아니라 흔한 실사용 경로(일부만 결정하고 나머지 보류). (3) verify s2는 큐 불변 reload만 관찰해 이 경로를 놓쳤다. 데이터 손상은 없음(큐 원본 불변)이라 SEV은 UX/기능이지 데이터 아님.
- **근본 원인**: 반영 성공을 위저드에 알려 결정 맵을 재기준화하는 신호가 없다. 위저드는 "큐 축소 → reconcile → 빈 맵이면 삭제"라는 **간접 경로**에만 의존하는데, skip은 reconcile에서 살아남아 이 경로가 성립하지 않는다.
- **수정 방향(택1)**: ① apply 성공 후 App→위저드로 `onApplied` 콜백을 흘려 `setDecisions({})`(또는 checkpoint 삭제) — 반영된 큐는 새 검토 세션으로. ② 또는 재진입 시 "미결정 0인데 skip만 남음"을 요약-done으로 보지 않고 카드 뷰로 되돌린다(=skip 잔존 큐는 검토 재개). ①이 spec의 "다시 나타난다"에 더 정확.

## 수정하면 좋은 항목

### M-1. 전부 skip(또는 미결정 없음)에서 `[결정 반영하기]` = 서버 무접촉 무피드백
- **위치**: `web/src/PrdApprovalWizard.tsx:121-124`(`applyPayload` 빈 페이로드) → `web/src/api.ts:205-211`(청크 0개 → for 루프 미실행 → 서버 POST 없음) → `web/src/App.tsx:555-560`(`queuePruneFailed` false·`skipped.length===0`이라 `setStatus` **미발화**).
- **증상**: 전부 skip이면 `applyPayload`가 `{approve:[], reject:[]}` → `applyInChunks`가 청크 0개 → 서버 호출 자체가 안 일어나고 아무 상태 메시지도 안 뜬다. 버튼이 "먹통"처럼 보이고 화면 변화 없음. C-1 갇힘 상태에서 재차 누를 때도 동일.
- **수정 방향**: `applied+rejected===0`(반영 대상 0)일 때 "반영할 승인/반려 결정이 없습니다(건너뜀은 큐에 남습니다)" 같은 성공/안내 `setStatus`. 또는 요약에서 반영 대상 0이면 `[결정 반영하기]`를 disable. 저비용.

### M-2. 체크포인트 결정 *값* 미검증 — stale 방어는 id만 본다 (방어적 하드닝)
- **위치**: `web/src/PrdApprovalWizard.tsx:56`(`as WizardDecisionMap` 캐스트) / `shared/src/prd-wizard-state.ts:142-152`(`reconcileCheckpoint`는 id-in-queue만 필터, 값 유효성 안 봄).
- **현재는 무해**(security 서브에이전트 확인): 조작된 localStorage `{"sug-1":"foo"}`가 React state까지 들어와도 `applyPayload`(`prd-wizard-state.ts:124-135`)가 `approve`/`reject` 문자열 정확 매칭만 하므로 서버로 새지 않고, 서버도 `byId` 미존재 id를 skipped 처리. UI도 `?? "skip"` 폴백이라 크래시 없음. **오늘은 익스플로잇 불가**.
- **위험**: 안전이 전적으로 "하류 소비자가 값-화이트리스트"라는 규율에 의존. 미래에 어떤 소비자가 `decisions[id]` passthrough를 하면 임의 결정 주입이 살아난다. `reconcileCheckpoint` 안에서 값도 3개 리터럴로 필터하면 한 줄 defense-in-depth.

### M-3. 상태바에 raw 에러 문자열 노출
- **위치**: `web/src/App.tsx:571` — `setStatus(...실패...: ${String(e)})`. 로컬 단독 사용 도구라 리스크 낮지만, fetch 계층이 URL/백엔드 경로/응답 본문을 담은 에러를 던지면 화면에 노출된다. (직전 change부터 있던 패턴 — 이 change 신규 아님.)

## 현재 상태로 유지해도 되는 항목

- **순수 상태 모듈 분리**(`shared/src/prd-wizard-state.ts`) — 프레임워크 무의존·무상태·불변 반환. 테스트 가능성을 위해 web 로직을 shared로 뽑은 판단이 정확하고, server jest 16건이 결정 이동·skip 제외·탈출구·요약 카운트·stale 폐기·페이로드 분리를 모두 커버(회귀 0). 유지보수성 상.
- **XSS 안전** — `proposedBody`/`rationale`을 `<pre>{...}</pre>`·`<p>{...}</p>` 텍스트 노드로 렌더, `dangerouslySetInnerHTML` 전무(web/src 전체 grep 확인). 제안 id는 서버/스킬 생성 안정 식별자.
- **race 가드** — 요약 `[결정 반영하기]`는 `disabled={busy}`(라인 161) + `applyPrd`의 `if(!project||prdApplyBusy)return`(App.tsx:551) + `dashReqToken` stale 재조회 폐기(App.tsx:552,564)의 3중 방어. 이중 클릭 반영 경로 없음.
- **localStorage 폴백** — read/write 모두 try/catch로 감싸 quota 초과·프라이빗 모드에서 비영속 세션으로 정상 degrade(design D-3 준수). catch 스코프가 localStorage/JSON 연산만 감싸 실제 로직 에러를 삼키지 않음.
- **일괄 능력 계승** — 탈출구·요약이 기존 `applyInChunks`(200건 상한·청크·queuePruneFailed 고지)를 그대로 소비. 서버 계약 무변경(design 게이트 준수).
- **죽은 코드 제거** — `PrdApprovalPanel.tsx` 삭제(D-5·10-coding-style 준수).

## 리팩토링 추천 항목

- **C-1 수정 시 `onApplied` 콜백 도입**을 권장 — 위저드가 "큐 축소 → reconcile 빈 맵"이라는 간접·부서지기 쉬운 경로에 의존하는 구조를 명시적 "반영 완료 → 세션 리셋" 신호로 바꾸면 skip 잔존 버그가 구조적으로 재발 불가해진다(표면 수정보다 근본).
- **결정 점 mod 계산**(`PrdApprovalWizard.tsx:215-231`)의 3중 삼항 중첩 — `decisionToDot(d, isCurrent)` 순수 헬퍼로 뽑으면 가독성↑(신입 개발자 관점). 선택.

## 적대적 검토 (4 페르소나)
- **파괴자**: [BLOCK] C-1 — apply 후 skip 잔존 큐가 요약에 갇힘(재현 경로 확정). [CONCERN] M-1 전부-skip 무피드백 무접촉. [저] 같은 렌더 프레임 내 두 번 클릭 시 `busy`가 결정 클릭을 디바운스하지 않아(정상 검토 중 `prdApplyBusy`=false) 둘째 클릭이 같은 `current.id`를 덮을 수 있음 — 자기교정되고 결정론적이라 저severity지만 "busy가 클릭 방어"라는 오해 주의(`PrdApprovalWizard.tsx:109-112,185-188`).
- **신입 개발자**: [CONCERN] C-1의 회복 경로 라벨 `[처음부터 다시]`가 "skip 재검토"로 안 읽힌다. 결정 점 3중 삼항 중첩(라인 215-231)은 주석/헬퍼 없이 6개월 뒤 해독 비용. `nextPendingId`가 cursor를 저장 안 하고 "첫 미결정"으로 유도하는 설계는 주석(라인 50-54)으로 잘 설명됨 — 양호.
- **보안 감사자**: [CONCERN 저] M-2 체크포인트 결정 값 미검증(오늘 무해, 하류 규율 의존). [CONCERN 저] M-3 raw 에러 노출. XSS·인젝션·auth 우회 벡터 없음(텍스트 노드 렌더·서버 생성 id·서버측 byId 재검증). BLOCK 없음.
- **게으른 시니어**: 안 짜도 될 코드 없음 — diff가 spec acceptance에 정확히 대응(과잉 래퍼·불필요 추상화·새 의존성 0). 상태 로직을 shared 순수 함수로 뺀 건 테스트를 위한 *필요한* 분리지 과잉 아님. 카드 마크업/CSS 토큰을 기존 `prd-approval-*`에서 재사용(신규 최소). "가장 좋은 코드는 안 짠 코드" 기준으로 군더더기 없음. (단 C-1은 *누락*이지 과잉 아님 → 파괴자/traceability 소관.)
- **2+ 페르소나 중복 발견(심각도 상승)**: **C-1**을 파괴자(갇힘 재현)와 신입 개발자(회복 라벨 불명확)가 같은 이슈로 지적 → 심각도 상승 확정, 치명 티어. **M-1**은 파괴자·(간접) C-1 재차 트리거로 연결.

## 최종 배포 가능 여부

**조건부 가능 (치명 1건 수정 후)**

- 해피 패스(전부 승인/반려, skip 없음)는 verify로 실픽셀 검증 완료 — 데이터 손상 위험 0(큐 원본 불변).
- 그러나 **skip을 1건 이상 남긴 채 반영**하는 흔한 경로에서 C-1(요약 갇힘 + spec "다시 나타난다" 위반)이 재현된다. 예광탄이라도 skip은 이 change가 명시적으로 추가한 1급 기능이므로, skip 경로가 spec대로 동작하지 않는 상태로 내보내는 것은 부적절. C-1 수정 후 배포.

## 개선 우선순위 (제안)

1. **C-1** (치명) — apply 후 `onApplied`로 결정 맵 리셋 또는 skip-잔존 큐를 카드 뷰로 복귀. spec 위반 + UX 갇힘 해소. 배포 전제.
2. **M-1** (권장) — 반영 대상 0일 때 안내 setStatus 또는 버튼 disable. C-1과 함께 고치면 "먹통" 인상 동시 해소. 저비용.
3. **M-2** (하드닝) — `reconcileCheckpoint`에 결정 값 화이트리스트 한 줄. 미래 회귀 방어.
4. **M-3** (저) — 상태바 raw 에러를 사용자 친화 메시지로(직전 change 유래, 이 change 범위 밖이나 함께 정리 가능).
5. 결정 점 삼항 → 헬퍼 추출 (가독성, 선택).
