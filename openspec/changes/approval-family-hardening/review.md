# 배포 전 최종 검토 — approval-family-hardening

검토일: 2026-07-05 / 검토 범위: 구현 커밋 f94e3e3(D-4 mermaid 블록 판별 단일화)·1f3cd92(D-1 CRLF 개행 보존)의 diff 및 직접 영향 파일 — `server/src/lib/eol.ts`(신규)·`lib/docs.ts`·`lib/featureDocs.ts`·`lib/userFlowDocs.ts`·`parser/planningUserFlowBuilder.ts` + 테스트 4종. 전체 앱 리뷰 아님.

> **verify 입력**: verify.json = **FAIL** (4 PASS · 6 "검증 안 함", archiveGate closed). 계획 5건 중 D-1·D-4만 구현, D-2(큐 clobber)·D-3(배치 상한)·D-5(패널 UI 캡)는 미구현. 이 리뷰는 verify 결과를 재실행하지 않고 판단 입력으로 사용한다.
>
> **criteria brief**: changeTypes=[backend] (diff가 server .ts·jest뿐, UI 태스크 4.2 미구현). 기준 4(UX/UI)·7(반응형) = 해당 없음(frontend 변경 없음) → 디자인 리뷰(3-2)도 생략. ruleSets: resolvedFrom `~/.claude/rules/`, selected 10-coding-style·20-testing·30-security, absent 없음. designYardsticks: D-1(첫 감지 결정론·유틸 1개 허용)·D-4(파서 export "무변경")·Non-Goals(골격 추상화 금지·원자적 write 제외). adversarialScope: full change scope (NOT narrowed by this brief).
>
> 검증 상태 구분: 서브에이전트 2팀이 서버 테스트 **290/290 PASS·typecheck 3 workspace PASS 재실행**, 혼합 EOL·restoreEol 동작은 **tsx 재현 스크립트 실측**. 외부 렌더러 호환(아래 백틱 라벨 잔여)은 검증 안 함.

## 반드시 수정해야 할 항목

1. **[기준 9] 계획 5건 중 3건 미구현 — verify FAIL로 archive 차단 중.** D-2 큐 clobber(`lib/docs.ts:276→319-320`·`lib/featureDocs.ts:200→268-269`·`lib/userFlowDocs.ts:241→285-286` 전부 시작 스냅샷 filter 후 write, 재독 부재 — apply 중 추가 제안 통삭제 창 존치), D-3 배치 상한(`routes/docs.ts:245/283/328` 3곳 shape 검증만, 길이 무제한), D-5 패널 UI 캡 미구현. tasks 3.1–5.1 미완, verify.json "검증 안 함" 6건과 일치. 구현 완료 + 5.1 게이트 PASS 전에는 배포 불가.
2. **[기준 1·10] design.md D-4 "내부 파싱은 무변경, 노출만" 문구가 사실과 다름 — archive를 게이트하는 설계 문서의 자기모순.** 실제 커밋 f94e3e3은 `extractMermaid` 정규식을 삭제하고 라인 스캔(`parser/planningUserFlowBuilder.ts:20-39`)으로 재작성했고, 관찰 가능한 동작 변경 3건이 실측됨: (a) 라인 중간 mermaid 여는 펜스가 더는 블록을 열지 않음 (b) 4-backtick 펜스 미지원(블록 없음→null) (c) 백틱 포함 라벨이 skipped→applied로 반전(테스트 기대값 갱신). 재작성 자체는 정당(라인 인덱스 반환 필요 + CommonMark에 더 근접)하고 golden 픽스처 무영향 확인됐으나, design.md는 여전히 "무변경"을 주장한다. **적대 패스 2개 페르소나(게으른 시니어 ↔ 보안 감사자) 중복 → 심각도 상승.** 수정 = design.md D-4 문구를 실제 동작("펜스 판별을 라인 시작 기준으로 재정의, 일부 edge 동작 변경")으로 정정.
3. **[기준 10→상승] `lib/userFlowDocs.ts:107`·`:157`의 리터럴 NUL 2바이트 — git이 파일을 바이너리로 취급, diff·blame·3-way merge 전부 불가.** join 구분자로 raw NUL 문자가 소스에 박혀 있어(cdae89f부터 pre-existing) 이번 hardening 커밋 2건의 이 파일 변경분이 리뷰 사각지대로 출하됐고, 남은 태스크 3.x가 같은 파일을 또 통과한다. **2개 페르소나(신입 ↔ 파괴자: merge 충돌 오해결 벡터) 중복 → 심각도 상승.** 수정 = 리터럴 NUL을 U+0000 유니코드 이스케이프 표기로 교체 2곳(런타임 문자열 동일, 비용 사실상 0) — **남은 D-2 구현 착수 전에** 먼저 처리해야 이후 diff가 보인다.

## 수정하면 좋은 항목

- **[기준 1] detectEol의 "첫 감지" 명명이 구현과 다름 — 실제는 "존재 감지(any-CRLF-wins)".** `eol.ts:11`이 CRLF 포함 여부(includes) 검사라 LF 9줄+CRLF 1줄 혼합 문서에 승인 1건 → 전 파일이 CRLF로 재작성됨(실측). D-1이 수용한 결정론 범위이긴 하나 "첫 감지"라는 주석(`eol.ts:9`)·design 문구는 오독을 부른다. 2페르소나 중복(파괴자 ↔ 신입) — 동작 자체는 설계 수용 결정이라 문구 정정으로 충분. 위 항목 2의 design.md 정정 시 D-1 문구도 함께.
- **[기준 5] `docs.ts` proposedBody만 개행문자 무검증 — lone CR 잔존 가능.** userflow는 금지문자 정규식(`userFlowDocs.ts:31`)으로 CR/LF 차단, features는 enum 제한인데 prd `isValidPrdSuggestion`(`docs.ts:180-190`)은 string 타입만 본다. proposedBody에 단독 CR이 오면 restoreEol 두 치환 모두 비켜가 CRLF 문서에 혼재 개행 잔존. 발생 확률 낮음(AI 생성 JSON) — lone-CR 거부 또는 진입 시 정규화 권장.
- **[기준 5] 안 닫힌 mermaid 블록의 skip 사유가 부정확.** `findFirstMermaidBlock` null → `no-mermaid-block`(`userFlowDocs.ts:188`) — 블록이 *보이는데* "없음"으로 보고됨. 손상은 없음(write 자체를 안 함). 사유 세분화(`unclosed-mermaid-block`) 권장.
- **[기준 6·불확실 명시] 백틱 라벨 승인 반전의 외부 렌더러 영향 — 검증 안 함.** D-4로 백틱 포함 라벨이 applied되기 시작했는데 self-roundtrip은 자기 일관성만 증명한다. 같은 .md를 읽는 외부 소비자(CommonMark 프리뷰·mermaid.js)에서 깨져 보일 가능성(PLAUSIBLE, 미실측). 외부 렌더러 1회 확인 권장.
- **[기준 6·스코프 밖 pre-existing] `index.ts:12` cors 와일드카드 + 무인증 listen.** 브라우저에 열린 임의 사이트가 apply 라우트를 drive-by 호출해 대기 제안을 원격 승인 가능. design의 "로컬 단일 사용자 전제"가 bind/origin 어디로도 강제 안 됨. 이 change 밖이므로 후속 change 권고(D-3 상한만으로는 안 닫힘).

## 현재 상태로 유지해도 되는 항목

- **EOL 처리 비대칭**(docs.ts=write 직전 `restoreEol`, featureDocs/userFlowDocs=`join(eol)`): 코드 경로가 근본적으로 다름(문자열 조립 vs 라인 배열 splice) — 강제 통일이 오히려 Non-Goal(골격 추상화 금지) 위반. 설계 타당.
- **eol.ts 유틸 정확성**: 선정규화가 CR-CR-LF 이중오염을 정확히 방지함을 실측 확인. LF 타깃 변칙 케이스는 파이프라인상 도달 불가(원문에 CR-CR-LF 있으면 detectEol이 반드시 CRLF 반환).
- **#1 용의자였던 "EOL 복원 × 펜스 정확 매치" 상호작용 — 무혐의**: 라인 split 정규식이 스캔 전에 CR을 전부 제거(`userFlowDocs.ts:257-259`), append 라인은 write 시 `join(eol)`로 일괄 EOL 부여. 실측 확인.
- **findFirstMermaidBlock null 소비**: 파서(빈 그래프)·lib(전건 skip, 원본 불변) 양쪽 안전 처리 + 테스트 존재.
- **신규 테스트 품질**: 3개 lib 전부 바이트 수준 단언(userFlowDocs는 전체 파일 완전 일치 비교) — 행위 수준, 과잉 없음.
- **파싱 동작 변화의 실질 영향**: golden.json에 해당 edge 패턴 없음, `RE_EDGE`/`stripNodeShapes` 무영향 — 산출 그래프 회귀 없음(위 항목 2는 *문서* 정정 요구).
- **수정 금지 준수**: specParser·flowBinder·graphBuilder·`__golden__/`·PrdApplyRequest/Result·기존 라우트 경로 — 두 커밋 diff에서 전부 미변경 교차 확인.

## 리팩토링 추천 항목

- `eol.ts` 도큐블록 보강: (a) "왜 docs.ts만 restoreEol인가" 한 문장(비대칭 이유 명시 — 나중에 누가 '통일'하려다 헤매지 않게), (b) "3형제 공유 유틸" 표현 정정 — 3-way 공유는 detectEol뿐, restoreEol은 단일 호출자(docs.ts:266).

## 적대적 검토 (4 페르소나)

- **파괴자**: 혼합 EOL 문서에서 CRLF 1개가 LF 다수를 이겨 승인 1건이 전 파일 개행 재작성(실측, `eol.ts:11`) / 안 닫힌 블록 skip 사유 부정확. #1 용의자(EOL×펜스 매치)와 lone-CR·CR-CR-LF 경로는 실측 추적 후 무혐의.
- **신입 개발자**: `userFlowDocs.ts:107`·`:157` 리터럴 NUL → git 바이너리(diff·blame·merge 불가) / "첫 감지" 명명 오독 / 3형제 비대칭 이유 미문서화.
- **보안 감사자**: D-3 미구현 상태의 DoS 표면 — 원격 단독 DoS는 약하나(비싼 경로가 디스크 큐 크기에 종속) "AI 생산자 폭주 + 일괄 승인" 시 동기 apply가 이벤트 루프 수 초~분 점유 / cors 와일드카드+무인증(pre-existing, drive-by 승인 가능) / 펜스 주입은 3겹 방어(금지문자·id 화이트리스트·trial roundtrip) 확인으로 깨끗, 잔여는 백틱 라벨 외부 렌더러(PLAUSIBLE·미실측).
- **게으른 시니어**: D-4는 "노출만"이 아니라 파서 재작성 — design.md 미정정(스코프 초과의 기록 누락) / restoreEol 단일 호출자·도큐블록 과장. eol.ts 신설 자체와 신규 테스트는 정당함 확인(과잉구현 아님).
- **2+ 페르소나 중복 발견(심각도 상승)**: ① 파괴자↔신입(any-CRLF-wins + 오칭) ② 신입+파괴자(NUL 바이너리) ③ 게으른 시니어↔보안 감사자(D-4 "무변경" 위반과 백틱 라벨 반전이 같은 결정) — 각각 위 티어에 반영.

## 최종 배포 가능 여부

**배포 불가** — 계획 5건 중 3건(D-2·D-3·D-5) 미구현으로 verify.json이 FAIL(6건 "검증 안 함")이고 archive 게이트가 닫혀 있다. 구현된 D-1·D-4 자체의 코드 품질은 배포 가능 수준(치명 코드 결함 0, 테스트 290/290·typecheck PASS)이나, change 단위로는 미완성이다. 잔여 태스크 3.1–5.1 완료 + verify 재실행 PASS 후 재리뷰 필요.

## 개선 우선순위 (제안)

1. **잔여 3건 구현(D-2 큐 재독·D-3 배치 상한·D-5 UI 캡) + 5.1 게이트** — 배포 차단의 직접 원인, 이것 없이는 아무것도 진행 안 됨.
2. **NUL 리터럴 → U+0000 이스케이프 표기 2곳** — D-2 구현이 같은 파일을 또 바이너리 사각지대로 통과하기 전에 먼저. 비용 2글자, 효과는 이후 모든 diff의 가시성.
3. **design.md D-4 문구 정정(+D-1 "존재 감지" 문구)** — archive가 이 문서를 게이트하므로 사실과 일치시켜야 함. 코드 수정 없음.
4. **docs.ts lone-CR 가드** — 3 lib 중 유일한 비일관 지점, EOL 불변식의 마지막 구멍.
5. **skip 사유 세분화 + 백틱 라벨 외부 렌더러 1회 확인** — UX 정확성·미실측 잔여 해소.
6. **cors/인증 후속 change** — 스코프 밖이나 지금 hardening 중인 바로 그 라우트의 실제 공격 경로.
7. **eol.ts 도큐블록 보강** — 유지보수 비용 절감, 급하지 않음.
