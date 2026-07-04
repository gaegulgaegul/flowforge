# 배포 전 최종 검토 — wire-card-audit-status
검토일: 2026-07-03 / 검토 범위: 커밋 b54a261 diff — `server/src/lib/projects.ts`(mapFinalJudgment·readAuditStatus·배선), `server/src/lib/__tests__/projects.test.ts`(단위 6케이스), `openspec/changes/wire-card-audit-status/tasks.md`. 전체 앱 리뷰 아님.

## review criteria brief (Criteria-Gen)
- changeTypes: **[backend]** — 신호: diff가 `server/src/lib/*.ts`뿐, 프론트 파일(.tsx/.html) 변경 0(`ProjectGrid.tsx` 무손상은 verify가 grep으로 확인), prototype.html 없음, tasks에 [frontend-agent] 태그 없음
- criteria: 1 in / 2 in / 3 in / **4 out(해당 없음 — frontend 변경 없음)** / 5 in / 6 in / **7 out(해당 없음 — frontend 변경 없음)** / 8 in / 9 in / 10 in
- ruleSets: { resolvedFrom: [`~/.claude/rules/`], selected: [10-coding-style, 20-testing, 30-security, 70-adversarial-review], absent: [] }
- designYardsticks:
  - decisions: D-1 `projDir` 기준 경로 구성(scanRoot 절대경로 신뢰 금지) / D-2 어휘 매핑 순수 함수 격리(`조건부` 한글 리터럴 비교, `clean`≠`pass`) / D-3 모든 실패 경로 `unknown` 폴백(throw 0)
  - nonGoals: 실시간 재산출, items/counts 상세 시각화, 신선도 검사·캐시, AuditStatus 새 멤버 — **이것들의 부재를 지적하지 않음**
- specsVerifyFocus: verify.json = **PASS 6/6**(FAIL·검증안함·SKIP 이슈 0, android/ios SKIP은 레이어 부재로 정당), 엣지게이트 "충분"(8클래스 중 6 covered, 경계값·동시성 na 사유 타당). 유일 잔여 = **tasks.md 3.1 미구현·4.1 미체크**
- adversarialScope: **full change scope (NOT narrowed by this brief)**

## verify 입력 (역할 분리: verify=실증, review=판단)
openspec-verify 실행됨(2026-07-03T17:03 KST). dist 실기동 E2E(픽스처 12종 HTTP 실측) + jest 221/221 + tsc/build/lint exit 0 + 실데이터 grounding(flowforge=경고, wowa-app=실패, 4개=audit 미확인 스크린샷). 6개 acceptance 시나리오 전부 실행 기반 PASS — 본 리뷰는 이를 재실행하지 않고 판단 근거로 사용한다.

## 반드시 수정해야 할 항목
- **[변경 미완 — task 3.1 라우트 통합 테스트 미구현]** `tasks.md:16`이 미체크(`- [ ]`)이고, `server/src/routes/__tests__/projects.test.ts`에 `audit` 관련 단언이 0건(grep 실측). verify의 E2E는 일회성 실기동 실측이라 런타임 동작은 입증됐지만, **레포에 라우트 레벨 회귀 테스트가 없다** — 이후 라우트/합성 변경 시 auditStatus 배선이 조용히 깨져도 CI가 못 잡는다. 조치: 3.1 구현(픽스처에 `makeAudit` 심고 `GET /api/projects` 응답 `auditStatus==="warn"`/`"unknown"` 단언) 후 체크, 또는 "단위 6케이스+verify E2E로 충분" 판단이면 tasks.md에 명시적 스코프아웃 사유를 적고 체크. 어느 쪽이든 **미체크 방치 상태로 archive 불가**. (4.1도 같은 건 — verify가 5단계 게이트를 실증했으므로 체크박스 갱신만 필요.)

## 수정하면 좋은 항목
- **[docs/audit.json 자체의 심링크는 따라간다]** `projects.ts:102`는 프로젝트 디렉토리 레벨 심링크만 `lstatSync`로 차단하고, `readAuditStatus`(`projects.ts:71`)의 `readFileSync`는 `docs/audit.json`이 심링크면 그대로 추적한다. 임의 파일을 가리켜도 내용은 `finalJudgment` enum 매핑으로만 소비되고 절대 노출되지 않아(응답은 4개 리터럴 중 하나) 실질 유출은 없지만, 파일 헤더 docblock의 "심링크 방어" 서술과 실제 방어 범위가 어긋난다. 파괴자+보안 감사자 2페르소나 중복 발견으로 심각도 LOW→MEDIUM 승격했으나, 악용 시나리오가 정보 노출로 이어지지 않아 이 티어 유지. 조치(택1): `lstatSync` 가드 한 줄 추가, 또는 docblock에 "심링크 방어는 프로젝트 dir 레벨" 명시.
- **[어휘 소유권 주석 부재]** `projects.ts:55` `mapFinalJudgment`의 어휘(`PASS|FAIL|조건부|UNVERIFIABLE`)는 agentic-harness `openspec-audit`가 소유하는데 코드 주석엔 그 출처가 없다. 6개월 뒤 새 어휘가 추가되면 어디가 진실인지(스키마 소유자가 누군지) 코드만 봐선 모른다. 한 줄 주석(`// 어휘는 agentic-harness openspec-audit 산출 스키마 소유 — 새 값은 unknown 폴백`)이면 충분. (불확실성: 어휘 변경 빈도가 낮으면 실익 작음.)

## 현재 상태로 유지해도 되는 항목
- **매 요청 동기 파일 I/O(캐시 없음)** — design Risks에 명시된 의도적 trade-off(예광탄, 프로젝트당 작은 JSON 1개). 5MB 파일도 verify에서 실측 통과.
- **`조건부` 한글 리터럴 비교** — audit.json이 실제로 쓰는 데이터 어휘 그대로(design D-2 결정 준수). 대소문자 변형('pass')이 unknown 폴백되는 것도 verify가 실측(정확 일치만 인정 — 거짓 green 방지에 오히려 유리).
- **audit.json 신선도 미검사** — design Non-Goal("배지=마지막 audit 결과"가 계약). 오지적하지 않음.
- **단위 테스트의 `cardOf` non-null assertion(`!`)** — 실패 시 에러 메시지가 다소 불친절하나 테스트 전용 헬퍼로 허용 범위.

## 리팩토링 추천 항목
- 없음 — 신규 코드 34줄이 `countChanges`/`hasCharter` 형제 헬퍼 패턴을 그대로 따르고(파일 127줄, 함수 전부 50줄 미만, 10-coding-style 충족), 분리할 중복이 없다.

## 적대적 검토 (4 페르소나)
- **파괴자**: ①`docs/audit.json` 심링크 추적(상기 MEDIUM). ②`existsSync`→`readFileSync` 사이 TOCTOU는 catch→unknown으로 흡수됨(안전 확인). ③GB급 audit.json이면 `readFileSync`가 이벤트루프 블로킹 — 단 audit.json은 자체 도구 산출물이라 현실성 낮고 5MB 실측 통과, 발견으로만 기록.
- **신입 개발자**: `mapFinalJudgment` 어휘의 소유권(agentic-harness 스키마)이 주석에 없음 — 새 어휘 추가 시 진실의 원천을 코드에서 못 찾는다(상기 항목). 그 외 함수명·주석·폴백 의도는 명확.
- **보안 감사자**: ①audit.json 심링크로 임의 파일 읽기 유도 가능 — 단 출력이 enum 4종으로 고정돼 내용 유출 벡터 없음(파괴자와 중복 → 승격). ②경로는 `readdirSync` 산출 name+`join` 고정 구성으로 traversal 없음, `scanRoot` 미신뢰는 verify가 정적 grep+E2E로 실증. ③`GET /api/projects` rate limiting 부재는 이 change 이전부터의 기존 표면(홈서버 내부 대시보드)이라 스코프 밖 기록만.
- **게으른 시니어**: 안 짜도 될 코드 없음 근거 — diff 87줄(주석·테스트 포함), 신규 의존성 0, 새 타입 0, 프론트 변경 0, 하드코딩 상수 1개를 리더 호출 1줄로 교체. `mapFinalJudgment` 분리는 design Goals("매핑을 한 함수에 격리")가 명시 요구한 것이라 과잉 아님. 유일 후보였던 `makeAudit`의 `raw` 파라미터 이중용도도 픽스처 헬퍼 1개로 6케이스를 커버하기 위한 최소 형태라 정당.
- 2+ 페르소나 중복 발견(심각도 상승): **audit.json 심링크 추적** — 파괴자+보안 감사자 → LOW→MEDIUM 승격(수정하면 좋은 항목에 반영).

## 최종 배포 가능 여부
**조건부 가능 (치명 1건 수정 후)** — 코드·동작 자체는 verify가 실행 기반으로 전부 입증(6/6 PASS, 엣지게이트 충분)했고 design 결정(D-1~D-3) 준수도 확인됐다. 유일한 블로커는 변경 자체의 계약 미완: **task 3.1(라우트 통합 테스트) 미구현 + 3.1/4.1 미체크**. 3.1을 구현(또는 명시적 스코프아웃 기록)하고 체크박스를 실상과 일치시키면 archive 가능.

## 개선 우선순위 (제안)
1. **task 3.1 라우트 통합 테스트 구현 + tasks.md 3.1/4.1 체크 갱신** — archive 게이트이자 유일한 회귀 방지 공백. 픽스처 헬퍼 하나+단언 2개로 끝나는 작은 작업.
2. **audit.json 심링크 lstat 가드(또는 docblock 정정)** — 2페르소나 중복 발견, 한 줄 수정으로 방어 서술과 실제를 일치.
3. **mapFinalJudgment 어휘 소유권 주석** — 기술부채 예방 한 줄, 다음에 이 파일 만질 때 함께 처리해도 무방.

---
*디자인 리뷰: 화면 변경 없음(backend-only) → 디자인 리뷰 생략. criteria 4·7 = 해당 없음(frontend 변경 없음).*
*발행: VERIFY_UPLOAD_URL/TOKEN 미설정 → review.md 웹 발행 스킵(레포 파일만).*
