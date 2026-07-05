# 배포 전 최종 검토 — planning-approval-edit-ui-userflow
검토일: 2026-07-05 / 검토 범위: 이 change의 diff 한정 (앱 전체 아님) — `shared/src/user-flow-suggestion-types.ts`(신규)·`shared/src/index.ts`(배럴), `server/src/lib/userFlowDocs.ts`(신규)+단위 테스트, `server/src/routes/docs.ts`(라우트 2개 추가)+통합 테스트, `server/src/parser/planningUserFlowBuilder.ts`(리팩토링), `server/src/lib/docs.ts`(1줄)

## review criteria brief
- changeTypes: **backend** (server lib·routes·shared 타입 — 구현된 diff 기준). frontend 신호(prototype.html 존재, tasks 3.1·3.2·4.1 `[parallel]` web 태스크)는 있으나 **web 코드 미구현** — diff에 화면 파일 0건.
- criteria: 1·2·3·5·6·8·9·10 in-scope / **4·7 out-of-scope** (사유: frontend 변경분이 diff에 없음 — web 태스크 자체가 미착수)
- ruleSets: resolvedFrom `~/.claude/rules/` (repo `.claude/rules/` 없음) / selected: 10-coding-style·20-testing·30-security / absent: 없음
- designYardsticks: design.md Decisions D-1(append-only)~D-7(계약 재사용) / Non-Goals: 삭제·수정 op, 라벨 편집, 제안 생산기, 와이어프레임, 비화면 newNode — **오지적 금지 대상**
- specsVerifyFocus: verify.json(2026-07-05 18:08) = **조건부**, server 10/10 PASS(무력화 프로브 실측 포함)·edge 4/4 충분, **web 2건 "검증 안 함"(기능 미구현 — 환경 SKIP 아님)**, archiveGate closed
- adversarialScope: **full change scope (NOT narrowed by this brief)**

## 반드시 수정해야 할 항목

- **[치명] D-4 게이트 밖 문자(`[` `]` `` ` ``) 라벨이 배치 전체를 "사유 없는 422"로 독살 — spec 계약 위반.** `server/src/lib/userFlowDocs.ts:30`(게이트가 `"`·`|`·개행만 금지) + `:267`(roundtrip 실패 시 배치 통째 롤백). **실측 재현**: `label: "see [foo]"` 제안 + 유효 제안 1건을 같은 approve 배치로 → `{applied:0, skipped:[], writeFailed:true}` — 유효한 형제 제안까지 롤백되고 skipped가 빈 배열이라 원인 표시가 전혀 없다. 근원: 라벨 속 `[foo]`를 파서 `stripNodeShapes`(planningUserFlowBuilder.ts:36)가 벗겨 재파싱 라벨이 달라짐 → D-5 멀티셋 불일치. 백틱 3개는 `extractMermaid`(:23) 비탐욕 매칭이 블록을 라벨 중간에서 절단. spec.md:50 "같은 apply의 다른 유효 제안은 정상 반영" + design D-7 "skipped 사유 표면화"를 이 문자 클래스에서 위반. 사용자 영향: AI가 "선택지 [예/아니오]" 같은 자연스러운 라벨을 제안하면 그 제안을 반려하기 전까지 **일괄 승인이 영구 불가**. 수정 방향: 검증 단계에서 렌더→재파싱 pre-check로 개별 skipped 처리(또는 D-4 금지문자 확장), 최소한 roundtrip 실패 시 원인 제안 식별을 시도해 사유를 표면화. (파괴자+보안 감사자 중복 발견 → 상향. 문서 손상은 없음 — 가드가 막는 것 자체는 실측 확인)
- **[스코프 미완성] web 미구현 — spec 4번째 Requirement("유저플로우 탭에 승인 패널을 표시한다") 전체 미충족.** tasks 3.1(`web/src/api.ts` fetch/apply)·3.2(`UserFlowApprovalPanel.tsx`)·4.1(App 배선)·5.1(VERIFY 게이트) 미체크, `web/src` grep 0건(verify.json 실측). 코드 결함이 아니라 **change가 아직 끝나지 않은 상태** — 이대로는 승인 루프의 소비자 UI가 없어 기능이 사용자에게 도달하지 않는다. archive 불가.

## 수정하면 좋은 항목

- **[중간] "첫 mermaid 블록" 정의가 두 벌로 어긋남 → 영구 422.** `userFlowDocs.ts:90-101`(trim+`startsWith("\`\`\`mermaid")`) vs `planningUserFlowBuilder.ts:23`(정규식, 라인 앵커 없음). 실측: `\`\`\`mermaid-example` 블록이 진짜 블록보다 앞에 있으면 append 위치와 파싱 대상이 갈려 모든 유효 제안이 사유 없는 422. 블록 판별 함수를 한 곳으로 통일 권장. (파괴자+신입 중복 발견 → 상향)
- **[중간] CRLF 문서가 apply 한 번에 전체 LF로 조용히 변환.** `userFlowDocs.ts:259`(`split(/\r?\n/)`)→`:269`(`join("\n")`). 실측 확인 — "한 줄만 append" 계약이 바이트 수준에서 깨져 git diff 전 라인 변경. featureDocs.ts:248 동일 패턴(선례 답습)이라 공통 수정 권장.
- **[중간] 프로세스 간 큐 clobber 레이스.** `userFlowDocs.ts:244`(read)→`:286`(스냅샷 통째 재작성). 큐 생산자(AI 스킬)는 별도 프로세스가 정상 워크플로 — apply 사이에 추가된 신규 제안이 흔적 없이 삭제될 수 있다(silent drop). 정적 검토(미실행 추론).
- **[낮음] 큐 중복 id 미검증** — 같은 id 2건 + approve 1개 → 에지 2줄 append(실측). `userFlowDocs.ts:76`에서 id 유일성 필터 권장.
- **[낮음] 라벨·rationale 길이 상한 부재** — 사이드카 큐 경유라 express body limit 우회, 수 MB 라벨이 문서에 append 가능(`userFlowDocs.ts:124-137`). 로컬 단일 사용자 전제로 실위험 낮음.
- **[낮음] apply POST 배열 크기 상한 부재** — `routes/docs.ts:328-357`. 기존 prd/features apply와 동일 패턴이라 별도 change에서 일괄 처리 권장.

## 현재 상태로 유지해도 되는 항목

- **D-1~D-7 전부 구현 준수** (10기준 패스 검증): D-1 append-only(`splice` 삽입만, 기존 줄 무수정), D-2 첫 블록 닫는 펜스 직전+블록 부재 시 skipped, D-3 to측 신규만+id 화이트리스트+대소문자 무시 충돌, D-4 금지문자 개별 skip, D-5 완전 비교 roundtrip+**무력화 프로브 실존**(userFlowDocs.test.ts:334-336 — 6b-features 교훈 반영), D-6 per-stem 큐+isSafeFlowToken 이중 게이트(라우트+lib), D-7 PrdApplyRequest/Result 재사용.
- **경로 이탈 방어 견고**: `^[A-Za-z0-9_-]+$` 화이트리스트(점 자체 불허), 인코딩 우회(`..%2f`)까지 통합 테스트 실측 커버(docsUserFlowApproval.test.ts:116,207).
- **프로토타입 오염·에러 누설 클린**: bracket 접근만·merge 없음, 에러 응답은 고정 토큰(내부 상세 stderr만).
- **파서 리팩토링 회귀 0**: buildUserFlowFromLines 추출은 순수 기계적, 281 테스트 PASS.
- 비원자적 write(temp+rename 없음)는 코드베이스 전반 패턴 + 로컬 단일 사용자 도구 전제 — 이 change에서 안 고쳐도 됨.
- GET 라우트의 flow 미지정 폴백(routes/docs.ts:318)은 spec 밖 추가지만 기존 GET과 대칭+테스트 있음 — 수용.

## 리팩토링 추천 항목

- **"안전 큐 읽기/쓰기" 스켈레톤 3벌째 복제 — rule of three 도달.** `docs.ts:195-209`(PRD)≡`featureDocs.ts:57-70`≡`userFlowDocs.ts:66-80`. design이 apply 로직 공통화 금지를 결정한 건 타당하나 read/write는 문서 구조와 무관한 순수 IO — 4번째 큐가 나오기 전에 `readSuggestionQueue(path, validator)` 제네릭으로 접기 권장.
- 주석-코드 불일치 정리: `userFlowDocs.ts:116` 주석은 `\0` 구분자, `:120` 구현은 `join(" ")` — 안전한 이유(id 문자집합에 공백 불가)를 주석으로 명시.
- `version: 1` 필드는 읽을 때 무시·쓸 때 항상 1 — 소비자 없는 의식(ceremony) 필드. 유지한다면 "미래 마이그레이션용, 현재 미검사" 주석 한 줄.

## 적대적 검토 (4 페르소나)

- **파괴자**: 치명 1(S-1 배치 독살 — 실측)·중간 2(CRLF 변환 실측, 큐 clobber 레이스)·낮음 2(중복 id 실측, 비원자 write). 단 **문서 손상 벡터는 못 뚫음** — 브래킷·백틱·펜스 불일치 프로브 3종 전부에서 원본 바이트 불변 실측, D-5 가드는 진짜다.
- **신입 개발자**: "첫 mermaid 블록" 정의 이중화(N-1, 상향), edgeKey 주석-코드 불일치, writeFailed 시 remaining 의미 경로별 상이(`userFlowDocs.ts:242` vs `:230`), skipped 문자열 프로토콜이 관례로만 존재.
- **보안 감사자**: 경로 이탈·프로토타입 오염·에러 누설 **클린(증거 있음)**. 발견 = D-4 밖 문자로 apply-DoS(A-2=S-1), 사이드카 경유 거대 문자열의 body limit 우회(낮음), 서드파티 mermaid 렌더러(GitHub/VS Code)에서 HTML 라벨 생존 가능(낮음/추정 — flowforge web 자체는 텍스트 렌더로 XSS 안전 실증 이력).
- **게으른 시니어**: 과잉구현 발견 = 큐 IO 3벌 복제(L-1)·ceremony version 필드(L-2)·spec 밖 GET 폴백(L-3, 수용 가능). 죽은 코드 0 — `userFlowInvariantHolds` export는 spec 의무 프로브의 테스트 표면, 신규 타입 2개뿐·계약 재사용(D-7) — 과잉 발명 없음.
- 2+ 페르소나 중복 발견(심각도 상승): **① D-4 밖 문자 배치 422 독살**(파괴자+보안, 중간→치명) **② 첫 mermaid 블록 정의 이중화**(파괴자+신입, 낮음→중간)

## 디자인 리뷰 (조건부 게이트)

frontend 신호는 존재(prototype.html·web 태스크 3.1/3.2/4.1)하나 **화면 코드가 아직 없어 디자인 리뷰 수행 불가** — 구현 후 재리뷰 시 gstack로 실픽셀 점검 필요. criteria 4·7 = 해당 없음(구현된 frontend 변경 없음).

## 최종 배포 가능 여부

**배포 불가** — 사유 2축:
1. **스코프 미완성**: spec Requirement 4/4 중 1개(web 승인 패널) 전체 미구현, tasks 3.1·3.2·4.1·5.1 미완, verify 판정 "조건부"·archiveGate closed. 서버만으로는 기능이 사용자에게 도달하지 않는다.
2. **치명 1건**: D-4 밖 문자 라벨의 사유 없는 배치 422(spec.md:50 계약 위반, 실측 재현).

단, **구현된 서버 부분의 품질 자체는 높다** — D-1~D-7 전 결정 준수, 무력화 프로브 실존, 문서 손상 벡터 실측 0, 경로 이탈 방어 견고. verify의 정직한 "검증 안 함" 보고와 일치.

## 개선 우선순위 (제안)

1. **web 3.1→3.2→4.1→5.1 구현 완료** — change의 존재 이유(승인 UI)가 없으면 나머지가 무의미.
2. **치명: D-4 밖 문자 개별 skipped 처리**(렌더→재파싱 pre-check 또는 금지문자 확장 + roundtrip 실패 사유 표면화) — spec 계약 회복, 일괄 승인 영구 불가 해소.
3. **첫 mermaid 블록 판별 단일화** — 같은 "무언 422" 클래스의 두 번째 진입로 봉쇄.
4. CRLF 보존(EOL 감지 후 join) — featureDocs와 공통 수정.
5. 큐 중복 id 필터 + 프로세스 간 큐 clobber 완화(문서화만이라도).
6. (별도 change) 큐 IO 제네릭 추출·apply 배열 상한 — 3벌 복제 해소.
