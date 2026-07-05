# 배포 전 최종 검토 — approval-family-hardening

검토일: 2026-07-05 (2차 — 1차 치명 3건 픽스 후 재검토) / 검토 범위: 구현 커밋 789330f(D-2 큐 재독 차집합·D-3 배치 상한 200·D-5 패널 UI 캡) + 픽스 커밋 ee96b48(NUL 이스케이프)·81dbdb1(design 문구 정정)의 diff 및 직접 영향 파일 — `server/src/lib/docs.ts`·`featureDocs.ts`·`userFlowDocs.ts`·`routes/docs.ts`·`web/src/FeatureApprovalPanel.tsx`·`UserFlowApprovalPanel.tsx`·`styles.css` + 테스트 4종. 전체 앱 리뷰 아님.

> **verify 입력**: verify.json(2026-07-05 22:55) = **FAIL** — 시나리오 10/10 PASS·5.1 게이트(299 테스트·100건 픽스처 실픽셀 캡 540px)까지 통과했으나 **엣지 게이트 7건 "검증 불충분"으로 archiveGate closed**. 이 리뷰는 verify를 재실행하지 않고 판단 입력으로 사용한다.
>
> **criteria brief**: changeTypes=[backend, frontend] (신호: server .ts + web .tsx/.css diff, tasks 4.2 UI 태스크). 기준 10개 전부 in-scope. ruleSets: resolvedFrom `~/.claude/rules/`, selected 10-coding-style·20-testing·30-security·60-design·70-adversarial-review, absent 없음. designYardsticks: D-2(재독 차집합, 락 아님 — last-writer-wins 수용)·D-3(라우트 레벨 200)·D-5(CSS 한 곳+패널 2곳)·Non-Goals(골격 추상화 금지·파일 락/원자적 rename 제외). specsVerifyFocus: 엣지 게이트 7건(A: EOL 보존 3건 빈값·경계값 / B: 큐 prune 3건 잘못된타입·특수문자 / C: mermaid 블록 1건 빈값·경계값). adversarialScope: full change scope (NOT narrowed by this brief).
>
> **검증 상태 구분**: 서브에이전트 3팀 전부 **정적 추적**(diff·현재 파일·테스트 파일 읽기 + grep). 실행 검증은 verify 5.1(299 PASS·실픽셀)을 판단 입력으로 인용. 디자인 리뷰(3-2): 화면 작업 감지(D-5) — verify의 100건 픽스처 실픽셀 결과를 근거로 **정적 검토**로 수행(라이브 재실행 안 함), 결과는 기준 4·7에 병합.

## 1차 치명 3건 추적

1. **D-2·D-3·D-5 미구현** → **해결됨** (789330f — 재verify 시나리오 10/10 PASS, tasks 3.1–5.1 전부 [x]).
2. **design.md D-4 "무변경" 자기모순** → **해결됨** (81dbdb1 — D-4에 "구현 정정(2026-07-05 review 반영)" 문단·edge 3건 수용 명시, D-1도 "존재 감지(any-CRLF-wins)"로 정정 확인).
3. **userFlowDocs.ts 리터럴 NUL 바이너리** → **해결됨** (ee96b48 — 현재 파일 NUL 0바이트 실측 `grep -cP '\x00'` = 0).

1차 "수정하면 좋은 항목" 중: detectEol 문구 → 해결됨(위 2에 포함). lone-CR 가드·skip 사유 세분화·백틱 라벨 외부 렌더러·cors 후속 change → **미해결**(아래 재기재).

## 반드시 수정해야 할 항목

1. **[기준 5·9] 웹이 `batch_too_large`(400)를 처리하지 않아 201건 이상 큐에서 일괄 승인/반려가 영구 불능 — 이 change의 D-3와 D-5가 서로 충돌하는 미봉합 지점.** `web/src/api.ts:200`(prd)·`:274`(features)·`:344`(uflow)의 apply 3함수는 422만 특수 처리하고 400은 제네릭 throw → 사용자에겐 "기능명세 승인/반려 실패: Error: features-apply 400"(`App.tsx:590-592`)만 노출, 원인(상한 200)도 대처법도 알 수 없음. 결정적으로 "모두 승인/모두 반려"는 전량 id를 전송(`App.tsx:783/786/800/803/866`)하므로 **큐가 201건이면 일괄 버튼이 항상 400으로 실패**하고 UI에 청크 분할·부분 선택 수단이 없어 개별 클릭 201회가 유일한 복구 경로. D-5의 명분이 "대량 큐"인데 대량 큐에서 정확히 죽는다(verify는 100건 픽스처라 이 경로 미통과). 수정 = 응답 body `error === "batch_too_large"` 분기 + 안내 메시지, 또는 클라이언트 측 200건 청크 전송 중 택1. [파괴자(web) 발견 — 정적 추적, file:line 실증]
2. **[기준 9·verify 게이트] 엣지 게이트 7건 "검증 불충분" — archive가 기계적으로 닫혀 있어 테스트 보강 없이는 진행 불가.** 단, 3팀 정적 추적 결과 **7건 전부 BENIGN-GAP(구조상 안전)·REAL-RISK 0건**: (A) 빈 파일은 3 lib 모두 write 도달 전 흡수 — prd는 5섹션 부재로 `writeFailed`(`docs.ts:244→300-308`), features는 `applied===0` 가드(`featureDocs.ts:245`), userflow는 전건 skipped(`userFlowDocs.ts:187-189,266`); (B) prune 3형제는 `Set<string>.has` + 원시 문자열 filter(`docs.ts:331-336`·`featureDocs.ts:275-280`·`userFlowDocs.ts:298-303`)라 `__proto__`·빈 문자열·유니코드 id 전부 무해, non-string은 요청측 400(기존 테스트 `docsPrdApproval.test.ts:258` — verify 분류기가 매핑 못 한 사실상 ALREADY-COVERED)·큐측 읽기 필터 2중 방어; (C) `findFirstMermaidBlock`은 빈 배열→null, 0번 라인 펜스는 `openIdx < 0` 판정이라 truthiness 함정 없음(`planningUserFlowBuilder.ts:33,39`). 수정 = 코드가 아니라 **누락 엣지 테스트 추가**(빈 파일 3종 → unclosed fence → 혼합 EOL 결정론 → non-string id 픽스처 순) 후 verify 재실행으로 게이트 재개방.

## 수정하면 좋은 항목

- **[기준 4] 일괄 바 상단 이동으로 "미열람 일괄 승인"이 이전보다 쉬워짐 + 패널 첫 탭 포커스가 파괴적 버튼("모두 반려").** `FeatureApprovalPanel.tsx:108-127`·`UserFlowApprovalPanel.tsx:64-83` — 버튼에 건수 없음·확인 다이얼로그 없음, 60vh 캡으로 대부분 항목이 fold 아래인데 한 클릭에 미열람 200건 승인 가능(이전엔 바가 리스트 끝 = 스크롤 완주 후 도달). 항목이 "사용자가 검토해야 할 AI 제안"이라는 제품 맥락상 실수 비용 있음. 버튼 라벨에 N건 표기(+선택적 confirm) 권장.
- **[기준 5·pre-existing] 큐 쓰기(writeFileSync) 실패 시 doc 변형 후 500 + 승인분 큐 잔존(고아).** prune 내부 쓰기가 무보호(`docs.ts:213-217`·`featureDocs.ts:74-78`·`userFlowDocs.ts:84-88`) — doc 패치 후 큐 쓰기 throw(EACCES·디스크풀)면 500인데 doc은 이미 변형. userflow는 잔존 제안 재승인 시 duplicate-edge로 영구 skipped. 이전 코드도 동일 순서라 **이 커밋의 회귀 아님** — 후속 견고화 후보.
- **[기준 5·D-2 수용 범위] mid-apply 큐 파일 통째 손상(잘린 JSON·BOM) 시 재독=빈 큐 → 미처리 스냅샷 제안까지 소실.** `docs.ts:332-334`(3 lib 동형) — 이전 코드는 스냅샷 잔여분을 써서 살아남았으므로 이 지점만은 D-2가 보존성을 미묘하게 낮춤. 동기 함수라 창은 외부 프로세스 경합뿐이고 D-2가 last-writer-wins를 명시 수용 — 문서화 또는 재독 실패 시 스냅샷 폴백 한 줄 고려.
- **[기준 1] 두 패널 헤더 주석이 stale — "하단에 [모두 승인]/[모두 반려]를 둔다"** (`FeatureApprovalPanel.tsx:7`·`UserFlowApprovalPanel.tsx:7`). 이번 커밋이 상단으로 옮겼는데 주석은 코드와 모순. 2줄 수정.
- **[기준 8] PrdApprovalPanel만 구식 레이아웃(바 하단·리스트 무캡) — 3패널 UX 비대칭.** `PrdApprovalPanel.tsx:90`(`prd-approval-*` 클래스, `feature-approval-list` 미사용). design D-5 스코프가 "패널 2곳"이라 의도된 제외로 보이나, D-3 캡은 PRD 라우트에도 걸리고 PRD 큐도 같은 증상(13199px류) 재현 가능. 후속 change 또는 스코프 확장 판단 필요.
- **[기준 8] `rejectOversizedBatch`의 암묵적 "사전 검증 완료" 계약** (`routes/docs.ts:251`) — 미래 4번째 라우트가 검증 전에 호출하면 TypeError→500. 현재 3곳(273·313·365) 전부 검증 후라 실해 없음. 방어적 `Array.isArray` 한 줄 고려(현 스코프엔 과잉일 수 있음).
- **[1차 미해결 잔존]** docs.ts lone-CR 가드(`docs.ts:180-190` proposedBody 개행 무검증) / unclosed fence skip 사유 세분화(`userFlowDocs.ts:188` `no-mermaid-block` — 이번 라운드 엣지 판정팀도 재발견) / 백틱 라벨 외부 렌더러 1회 확인(미실측 PLAUSIBLE) / cors 와일드카드+무인증 후속 change(`index.ts:12`, 스코프 밖).

## 현재 상태로 유지해도 되는 항목

- **D-2 구현 정합**: 3 lib 전부 (a) 쓰기 직전 동일 read 함수로 재독 (b) processedIds만 차집합 (c) 신규분 보존 (d) doc 쓰기 실패 시 prune 미도달(큐 무접촉) — 순서 doc→큐 정적 추적 확인(`docs.ts:296→320`·`featureDocs.ts:252→269`·`userFlowDocs.ts:269→287`). 재독은 스냅샷과 완전히 같은 파싱/필터 경로라 semantics 드리프트 없음.
- **D-3 구현 정합**: 상한이 모든 쓰기 I/O·lib 호출 이전, 오프바이원 정확(200 통과·201 400 — 테스트 박제 `routes/__tests__/docsFeatureApproval.test.ts:161-183`), 비배열은 사전 shape 검증이 차단, 4번째 apply류 라우트 없음(grep 실증 — post 라우트는 docs.ts 3곳뿐).
- **D-5 구현 정합**: 신규 CSS 딱 2룰 한 곳(`styles.css:797-803`), 두 패널 bulk JSX는 testid 접두어만 다르고 문자 동일(발산 없음), DOM 순서 이동(CSS order 아님)이라 스크린리더/탭 순서와 시각 순서 일치. 반응형: 기존 @media(820px) 두 블록은 approval 계열 미접촉, 60vh는 세로 폰에서 ~400px로 사용 가능.
- **400 응답 정보 노출 없음**: `{error:"batch_too_large", cap:200}`만 — 내부 경로·스택 없음. 상한 우회 불가(중복 id도 발생 횟수대로 계상).
- **3 lib prune 일관성**: stem 파라미터 제외 문자 단위 동형, skipped 큐 잔류·순서 보존 동일. 공통 스켈레톤 미추출은 명시 Non-Goal.
- **bulk JSX 중복**: 이 커밋이 만든 게 아니라 기존 것의 이동 — 최소 diff 달성(마크업 이동 + CSS 2룰), 조기 추상화 회피는 프로젝트 방침.
- **엣지 게이트 7건의 코드 자체**: 위 "반드시 수정 2" 참조 — 전부 구조상 안전, 필요한 건 테스트 박제뿐.

## 리팩토링 추천 항목

- 60vh → `max-height:60vh; max-height:60dvh;` 폴백(iOS Safari 동적 툴바) — 차단 사유 아님.
- `UserFlowApprovalPanel.tsx:132` 이동 잔재 빈 줄 1개(두 패널 간 유일한 비대칭) + 두 패널의 `feature-approval-list` 래퍼 내부 `{suggestions.map...}` 재들여쓰기.
- (1차 계승) eol.ts 도큐블록 보강 — restoreEol 단일 호출자 명시.

## 적대적 검토 (4 페르소나)

- **파괴자**: 발견 3건 — ① 웹 batch_too_large 미처리 × 일괄 버튼 전량 전송 = 201건 이상 큐에서 일괄 기능 영구 불능(치명 1) ② 큐 쓰기 throw 시 doc 변형 후 500(pre-existing) ③ mid-apply 큐 통손상 재독 시 빈 큐 덮어쓰기(D-2 수용 범위). ENOENT 재독·빈 큐·전량 skipped·빈 파일 3종은 전부 안전 경로 실추적.
- **신입 개발자**: 발견 2건 — 두 패널 stale "하단에" 주석(코드와 모순), 래퍼 내부 미재들여쓰기. 서버 쪽은 clean(D-2 근거·"동기 함수라 경합 주입 불가" 사유가 doc comment로 명시, 매직넘버 없음 — APPLY_BATCH_CAP 명명+주석).
- **보안 감사자**: clean-with-evidence — 400/500 응답 정보 노출 없음, 상한 우회 불가(shape 검증→상한 순서 3곳 확인, 거대 body는 express json limit 선차단), prune은 Set 값 비교라 프로토타입 오염 벡터 없음. 잔여는 1차 보고분(cors 스코프 밖·백틱 라벨 미실측)뿐.
- **게으른 시니어**: 발견 1건(경미) — rejectOversizedBatch 암묵 계약. 그 외 과잉구현 없음: prune 헬퍼 export는 테스트 계약 박제 목적(설계 명시), 3중 복제는 명시 Non-Goal, 라우트 테스트는 행동 단언(상태코드·파일 바이트 불변), web은 순수 마크업 이동+CSS 2룰로 최소 diff.
- **2+ 페르소나 중복 발견(심각도 상승)**: 이번 라운드 없음 — 각 발견은 단일 페르소나 귀속(치명 1은 파괴자 단독이나 file:line 실증 + 기능 불능이라 자체로 치명 티어).

## 최종 배포 가능 여부

**조건부 가능 (치명 2건 수정 후)** — 1차의 치명 3건(미구현·design 모순·NUL)은 전부 해결 실측됐고, D-2·D-3·D-5 구현 자체는 설계 정합·코드 결함 0(재verify 시나리오 10/10·299 테스트·실픽셀 PASS). 남은 조건: ① 웹 batch_too_large 처리(대량 큐에서 일괄 기능이 죽는 실사용 결함 — 이 change의 명분과 정면 충돌) ② 엣지 테스트 보강으로 verify archiveGate 재개방(코드 위험은 정적 추적상 0이나 게이트가 기계적으로 닫혀 있음). 두 건 모두 소규모(웹 분기+메시지 1곳, 테스트 추가)이며 수정 후 verify 재실행 → 재리뷰 없이 archive 진행 가능 수준.

## 개선 우선순위 (제안)

1. **웹 batch_too_large 분기 + 안내(또는 200건 청크)** — 유일한 실사용 기능 결함, 이 change 자체가 만든 상호작용.
2. **엣지 테스트 보강 7건(빈 파일 3종 → unclosed fence → 혼합 EOL → non-string id) + verify 재실행** — archive 게이트 재개방의 기계적 조건, 전부 박제성 테스트.
3. **stale 주석 2곳 + 일괄 버튼 N건 표기** — 각 2줄, 기준 1·4 잔여.
4. **PRD 패널 캡/바 정렬 여부 결정** — 스코프 판단(후속 change 권장).
5. **큐 쓰기 무보호·재독 폴백·lone-CR·skip 사유·rejectOversizedBatch 가드** — 전부 pre-existing 또는 방어적 개선, 후속 견고화 묶음.
6. **cors/인증 후속 change** — 1차 계승, 스코프 밖이나 실제 공격 경로.

---

# 이전 검토 이력 (1차)

검토일: 2026-07-05 (1차) / 검토 범위: 구현 커밋 f94e3e3(D-4 mermaid 블록 판별 단일화)·1f3cd92(D-1 CRLF 개행 보존)의 diff 및 직접 영향 파일 — `server/src/lib/eol.ts`(신규)·`lib/docs.ts`·`lib/featureDocs.ts`·`lib/userFlowDocs.ts`·`parser/planningUserFlowBuilder.ts` + 테스트 4종. 전체 앱 리뷰 아님.

> **verify 입력**: verify.json = **FAIL** (4 PASS · 6 "검증 안 함", archiveGate closed). 계획 5건 중 D-1·D-4만 구현, D-2(큐 clobber)·D-3(배치 상한)·D-5(패널 UI 캡)는 미구현. 이 리뷰는 verify 결과를 재실행하지 않고 판단 입력으로 사용한다.
>
> **criteria brief**: changeTypes=[backend] (diff가 server .ts·jest뿐, UI 태스크 4.2 미구현). 기준 4(UX/UI)·7(반응형) = 해당 없음(frontend 변경 없음) → 디자인 리뷰(3-2)도 생략. ruleSets: resolvedFrom `~/.claude/rules/`, selected 10-coding-style·20-testing·30-security, absent 없음. designYardsticks: D-1(첫 감지 결정론·유틸 1개 허용)·D-4(파서 export "무변경")·Non-Goals(골격 추상화 금지·원자적 write 제외). adversarialScope: full change scope (NOT narrowed by this brief).
>
> 검증 상태 구분: 서브에이전트 2팀이 서버 테스트 **290/290 PASS·typecheck 3 workspace PASS 재실행**, 혼합 EOL·restoreEol 동작은 **tsx 재현 스크립트 실측**. 외부 렌더러 호환(아래 백틱 라벨 잔여)은 검증 안 함.

### 반드시 수정해야 할 항목

1. **[기준 9] 계획 5건 중 3건 미구현 — verify FAIL로 archive 차단 중.** D-2 큐 clobber(`lib/docs.ts:276→319-320`·`lib/featureDocs.ts:200→268-269`·`lib/userFlowDocs.ts:241→285-286` 전부 시작 스냅샷 filter 후 write, 재독 부재 — apply 중 추가 제안 통삭제 창 존치), D-3 배치 상한(`routes/docs.ts:245/283/328` 3곳 shape 검증만, 길이 무제한), D-5 패널 UI 캡 미구현. tasks 3.1–5.1 미완, verify.json "검증 안 함" 6건과 일치. 구현 완료 + 5.1 게이트 PASS 전에는 배포 불가.
2. **[기준 1·10] design.md D-4 "내부 파싱은 무변경, 노출만" 문구가 사실과 다름 — archive를 게이트하는 설계 문서의 자기모순.** 실제 커밋 f94e3e3은 `extractMermaid` 정규식을 삭제하고 라인 스캔(`parser/planningUserFlowBuilder.ts:20-39`)으로 재작성했고, 관찰 가능한 동작 변경 3건이 실측됨: (a) 라인 중간 mermaid 여는 펜스가 더는 블록을 열지 않음 (b) 4-backtick 펜스 미지원(블록 없음→null) (c) 백틱 포함 라벨이 skipped→applied로 반전(테스트 기대값 갱신). 재작성 자체는 정당(라인 인덱스 반환 필요 + CommonMark에 더 근접)하고 golden 픽스처 무영향 확인됐으나, design.md는 여전히 "무변경"을 주장한다. **적대 패스 2개 페르소나(게으른 시니어 ↔ 보안 감사자) 중복 → 심각도 상승.** 수정 = design.md D-4 문구를 실제 동작("펜스 판별을 라인 시작 기준으로 재정의, 일부 edge 동작 변경")으로 정정.
3. **[기준 10→상승] `lib/userFlowDocs.ts:107`·`:157`의 리터럴 NUL 2바이트 — git이 파일을 바이너리로 취급, diff·blame·3-way merge 전부 불가.** join 구분자로 raw NUL 문자가 소스에 박혀 있어(cdae89f부터 pre-existing) 이번 hardening 커밋 2건의 이 파일 변경분이 리뷰 사각지대로 출하됐고, 남은 태스크 3.x가 같은 파일을 또 통과한다. **2개 페르소나(신입 ↔ 파괴자: merge 충돌 오해결 벡터) 중복 → 심각도 상승.** 수정 = 리터럴 NUL을 U+0000 유니코드 이스케이프 표기로 교체 2곳(런타임 문자열 동일, 비용 사실상 0) — **남은 D-2 구현 착수 전에** 먼저 처리해야 이후 diff가 보인다.

### 수정하면 좋은 항목

- **[기준 1] detectEol의 "첫 감지" 명명이 구현과 다름 — 실제는 "존재 감지(any-CRLF-wins)".** `eol.ts:11`이 CRLF 포함 여부(includes) 검사라 LF 9줄+CRLF 1줄 혼합 문서에 승인 1건 → 전 파일이 CRLF로 재작성됨(실측). D-1이 수용한 결정론 범위이긴 하나 "첫 감지"라는 주석(`eol.ts:9`)·design 문구는 오독을 부른다. 2페르소나 중복(파괴자 ↔ 신입) — 동작 자체는 설계 수용 결정이라 문구 정정으로 충분. 위 항목 2의 design.md 정정 시 D-1 문구도 함께.
- **[기준 5] `docs.ts` proposedBody만 개행문자 무검증 — lone CR 잔존 가능.** userflow는 금지문자 정규식(`userFlowDocs.ts:31`)으로 CR/LF 차단, features는 enum 제한인데 prd `isValidPrdSuggestion`(`docs.ts:180-190`)은 string 타입만 본다. proposedBody에 단독 CR이 오면 restoreEol 두 치환 모두 비켜가 CRLF 문서에 혼재 개행 잔존. 발생 확률 낮음(AI 생성 JSON) — lone-CR 거부 또는 진입 시 정규화 권장.
- **[기준 5] 안 닫힌 mermaid 블록의 skip 사유가 부정확.** `findFirstMermaidBlock` null → `no-mermaid-block`(`userFlowDocs.ts:188`) — 블록이 *보이는데* "없음"으로 보고됨. 손상은 없음(write 자체를 안 함). 사유 세분화(`unclosed-mermaid-block`) 권장.
- **[기준 6·불확실 명시] 백틱 라벨 승인 반전의 외부 렌더러 영향 — 검증 안 함.** D-4로 백틱 포함 라벨이 applied되기 시작했는데 self-roundtrip은 자기 일관성만 증명한다. 같은 .md를 읽는 외부 소비자(CommonMark 프리뷰·mermaid.js)에서 깨져 보일 가능성(PLAUSIBLE, 미실측). 외부 렌더러 1회 확인 권장.
- **[기준 6·스코프 밖 pre-existing] `index.ts:12` cors 와일드카드 + 무인증 listen.** 브라우저에 열린 임의 사이트가 apply 라우트를 drive-by 호출해 대기 제안을 원격 승인 가능. design의 "로컬 단일 사용자 전제"가 bind/origin 어디로도 강제 안 됨. 이 change 밖이므로 후속 change 권고(D-3 상한만으로는 안 닫힘).

### 현재 상태로 유지해도 되는 항목

- **EOL 처리 비대칭**(docs.ts=write 직전 `restoreEol`, featureDocs/userFlowDocs=`join(eol)`): 코드 경로가 근본적으로 다름(문자열 조립 vs 라인 배열 splice) — 강제 통일이 오히려 Non-Goal(골격 추상화 금지) 위반. 설계 타당.
- **eol.ts 유틸 정확성**: 선정규화가 CR-CR-LF 이중오염을 정확히 방지함을 실측 확인. LF 타깃 변칙 케이스는 파이프라인상 도달 불가(원문에 CR-CR-LF 있으면 detectEol이 반드시 CRLF 반환).
- **#1 용의자였던 "EOL 복원 × 펜스 정확 매치" 상호작용 — 무혐의**: 라인 split 정규식이 스캔 전에 CR을 전부 제거(`userFlowDocs.ts:257-259`), append 라인은 write 시 `join(eol)`로 일괄 EOL 부여. 실측 확인.
- **findFirstMermaidBlock null 소비**: 파서(빈 그래프)·lib(전건 skip, 원본 불변) 양쪽 안전 처리 + 테스트 존재.
- **신규 테스트 품질**: 3개 lib 전부 바이트 수준 단언(userFlowDocs는 전체 파일 완전 일치 비교) — 행위 수준, 과잉 없음.
- **파싱 동작 변화의 실질 영향**: golden.json에 해당 edge 패턴 없음, `RE_EDGE`/`stripNodeShapes` 무영향 — 산출 그래프 회귀 없음(위 항목 2는 *문서* 정정 요구).
- **수정 금지 준수**: specParser·flowBinder·graphBuilder·`__golden__/`·PrdApplyRequest/Result·기존 라우트 경로 — 두 커밋 diff에서 전부 미변경 교차 확인.

### 리팩토링 추천 항목

- `eol.ts` 도큐블록 보강: (a) "왜 docs.ts만 restoreEol인가" 한 문장(비대칭 이유 명시 — 나중에 누가 '통일'하려다 헤매지 않게), (b) "3형제 공유 유틸" 표현 정정 — 3-way 공유는 detectEol뿐, restoreEol은 단일 호출자(docs.ts:266).

### 적대적 검토 (4 페르소나)

- **파괴자**: 혼합 EOL 문서에서 CRLF 1개가 LF 다수를 이겨 승인 1건이 전 파일 개행 재작성(실측, `eol.ts:11`) / 안 닫힌 블록 skip 사유 부정확. #1 용의자(EOL×펜스 매치)와 lone-CR·CR-CR-LF 경로는 실측 추적 후 무혐의.
- **신입 개발자**: `userFlowDocs.ts:107`·`:157` 리터럴 NUL → git 바이너리(diff·blame·merge 불가) / "첫 감지" 명명 오독 / 3형제 비대칭 이유 미문서화.
- **보안 감사자**: D-3 미구현 상태의 DoS 표면 — 원격 단독 DoS는 약하나(비싼 경로가 디스크 큐 크기에 종속) "AI 생산자 폭주 + 일괄 승인" 시 동기 apply가 이벤트 루프 수 초~분 점유 / cors 와일드카드+무인증(pre-existing, drive-by 승인 가능) / 펜스 주입은 3겹 방어(금지문자·id 화이트리스트·trial roundtrip) 확인으로 깨끗, 잔여는 백틱 라벨 외부 렌더러(PLAUSIBLE·미실측).
- **게으른 시니어**: D-4는 "노출만"이 아니라 파서 재작성 — design.md 미정정(스코프 초과의 기록 누락) / restoreEol 단일 호출자·도큐블록 과장. eol.ts 신설 자체와 신규 테스트는 정당함 확인(과잉구현 아님).
- **2+ 페르소나 중복 발견(심각도 상승)**: ① 파괴자↔신입(any-CRLF-wins + 오칭) ② 신입+파괴자(NUL 바이너리) ③ 게으른 시니어↔보안 감사자(D-4 "무변경" 위반과 백틱 라벨 반전이 같은 결정) — 각각 위 티어에 반영.

### 최종 배포 가능 여부

**배포 불가** — 계획 5건 중 3건(D-2·D-3·D-5) 미구현으로 verify.json이 FAIL(6건 "검증 안 함")이고 archive 게이트가 닫혀 있다. 구현된 D-1·D-4 자체의 코드 품질은 배포 가능 수준(치명 코드 결함 0, 테스트 290/290·typecheck PASS)이나, change 단위로는 미완성이다. 잔여 태스크 3.1–5.1 완료 + verify 재실행 PASS 후 재리뷰 필요.

### 개선 우선순위 (제안)

1. **잔여 3건 구현(D-2 큐 재독·D-3 배치 상한·D-5 UI 캡) + 5.1 게이트** — 배포 차단의 직접 원인, 이것 없이는 아무것도 진행 안 됨.
2. **NUL 리터럴 → U+0000 이스케이프 표기 2곳** — D-2 구현이 같은 파일을 또 바이너리 사각지대로 통과하기 전에 먼저. 비용 2글자, 효과는 이후 모든 diff의 가시성.
3. **design.md D-4 문구 정정(+D-1 "존재 감지" 문구)** — archive가 이 문서를 게이트하므로 사실과 일치시켜야 함. 코드 수정 없음.
4. **docs.ts lone-CR 가드** — 3 lib 중 유일한 비일관 지점, EOL 불변식의 마지막 구멍.
5. **skip 사유 세분화 + 백틱 라벨 외부 렌더러 1회 확인** — UX 정확성·미실측 잔여 해소.
6. **cors/인증 후속 change** — 스코프 밖이나 지금 hardening 중인 바로 그 라우트의 실제 공격 경로.
7. **eol.ts 도큐블록 보강** — 유지보수 비용 절감, 급하지 않음.
