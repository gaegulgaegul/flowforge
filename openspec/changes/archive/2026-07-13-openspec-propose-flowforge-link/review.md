# 배포 전 최종 검토 — openspec-propose-flowforge-link
검토일: 2026-07-13 / 검토 범위: `agentic-harness/plugins/agentic-harness/skills/openspec-propose/SKILL.md`(§5-1-c:159·§5-2:184-201·Output:220) + 캐시 1.1.8 동기본. flowforge 레포 코드 변경 없음(문서 change).

## review criteria brief
- **changeTypes**: `doc` (실행 소스 0줄 — agentic-harness 스킬 문서 SKILL.md 안내 문구만 수정. 트리거 신호: diff가 `.md`만, `publish_docs.py`·flowforge 서버 무변경 명시)
- **criteria (10)**:
  1. 유지보수성 — **in** (문구 규칙의 명확성)
  2. 중복/과잉구현 — **in** (문서 지시가 부풀었는가)
  3. 병목 — 해당 없음 (실행 코드 없음)
  4. UX/UI — 해당 없음 (frontend 변경 없음 — 단, 이 문구가 만들어낼 *사용자 대면 링크*의 명료성은 1로 흡수)
  5. 예외/오류/로딩 — **in** (발행 스킵·project 부재 폴백 지시)
  6. 보안 — **in** (지어낸 URL·플레이스홀더 잔존이 사용자를 죽은 링크로 유도하는가)
  7. 반응형 — 해당 없음 (frontend 변경 없음)
  8. 확장성 — **in** (tab enum 확장 시 이 지시가 버티는가)
  9. 배포 치명 — **in**
  10. 기술부채 — **in** (소스↔캐시 이중 유지, 버전 bump 시 캐시 재적용)
- **ruleSets**: resolvedFrom=`~/.claude/rules/`, selected=`10-coding-style`(문서라 코드샘플 없음→실질 미적용)+`70-adversarial-review`, absent=없음. doc 타입이라 stack rule(20-testing/30-security) 실질 미적용, 폴백으로 내장 10기준.
- **designYardsticks**: decisions=[G4 최소 변경(발행 인프라 불변, SKILL.md 문구만), tab=prd 고정, ?project= 미설정 시 통째 생략]. nonGoals=[publish_docs.py/리포트서버 불변, flowforge 프론트 라우팅 미포함(선행 change 몫), flowforge 서버 API 무변경]
- **specsVerifyFocus**: verify.json = **PASS 4/4·검증안함0·SKIPPED0·archiveGate open**. 4시나리오(발행성공병기·스킵폴백·project폴백·선행의존) 전부 문서grep+라이브딥링크 실측 통과.
- **adversarialScope**: full change scope (NOT narrowed by this brief)

## 반드시 수정해야 할 항목
- 없음

## 수정하면 좋은 항목
- **[기술부채·경미] 소스↔캐시 이중 유지 관리 부담** (`SKILL.md` 소스 + 캐시 `1.1.8/.../SKILL.md`): 이 change는 소스와 캐시 두 파일에 동일 문구를 반영해야 하고, 현재는 실측으로 일치(diff 완전일치, flowforge 9회 언급 동일). 다만 plugin 버전 bump(예: 1.1.9) 시 새 캐시 디렉토리로 이 문구가 자동 전파되지 않으므로 **재적용이 필요**하다. proposal Impact·design에 이미 이 교훈이 명시돼 있어 신규 결함은 아니나, 캐시 재적용을 잊으면 런타임(캐시 로드) 문구가 옛것으로 돌아간다. → 하네스 레포 릴리스 절차에 "캐시 동기 확인" 체크가 있으면 이상적(범위 밖, 후속).

## 현재 상태로 유지해도 되는 항목
- **폴백 지시 3종(발행성공 병기 / 스킵 로컬경로 / project 부재 ?project= 생략)이 SKILL.md에 명시적·자족적으로 존재**: :189 폴백, :194-200 published/skipped 분기, :220 Output 요약. 모델이 문맥 없이도 이 규칙만 읽고 올바른 URL을 조립할 수 있다.
- **"지어내지 않는다" 안전 규칙 유지**: :159·:200 — 발행 스킵 시 살아있지 않은 openspec.gaegul.house URL을 지어내지 말라는 기존 정책이 flowforge URL 확장에도 일관되게 승계됨. 죽은 링크 노출 방지.
- **`tab=prd` 고정 + "다른 탭 값 임의로 넣지 않는다"**: 완료 랜딩 탭을 결정론적으로 고정 — 선행 change의 tab enum(prd|spec|flow|ia|wire)과 정합.

## 리팩토링 추천 항목
- 없음 (문서 문구 수정 — 리팩토링 대상 코드 없음)

## 적대적 검토 (4 페르소나) — full change scope
- **파괴자 (Saboteur)**: "선행 의존(flowforge-deeplink-url)이 미배포면 링크가 랜딩으로 폴백해 사용자가 change를 못 본다"가 최대 파손 시나리오. → **design.md:53-55에 리스크로 명시**돼 있고, 실측으로 선행 change가 **이미 배포됨**(라이브 딥링크 HTTP 200 + 브레드크럼이 change 뷰로 복원 + PRD 탭 활성, verify 스크린샷 `evidence/deeplink-live.png`). 또 다른 파손: design.md 리스크 "propose 직후 아직 archive 안 된 change를 flowforge가 서빙하는지 미확인" → 이 change 자체가 **활성(archive 전) 상태로 라이브에서 PRD 렌더 성공** = 리스크 실측 해소. 남은 파손 벡터 없음.
- **신입 개발자 (New Hire)**: URL 템플릿 `?project=<project>&change=<name>&tab=prd`와 각 재료 출처(`<name>`=kebab change name, `<project>`=VERIFY_PROJECT env)가 :186-190에 명시돼 6개월 뒤에도 조립 규칙이 자명하다. 암묵 가정 없음. 한 가지: "flowforge는 project 없으면 전역 root 하위호환으로 해석"이라는 근거가 SKILL.md엔 코드 참조 없이 서술만 있으나, design.md:51이 `graph.ts:32-34`·`api.ts:76-78`로 그 근거를 남겨 추적 가능.
- **보안 감사자 (Security Auditor)**: 문서 change라 인젝션/인가 벡터 없음. 유일한 사용자 영향=완료 요약에 노출되는 링크. **"빈 project= 값이나 리터럴 <project> 플레이스홀더를 URL에 남기지 않는다"(:189)**가 깨진(placeholder 노출) URL로 사용자를 유도하는 것을 방지. 죽은 openspec URL 지어내기 금지(:200)로 피싱성 오링크도 차단. 민감정보 노출 없음(env 값은 URL의 project 파라미터로만, 토큰류 아님).
- **게으른 시니어 (Lazy Senior)**: 이 change는 **코드를 안 짠 change** — 스킬 문구만 수정(G4 최소 변경). 새 스크립트·래퍼·flowforge 프론트 라우팅을 만들지 않고, `?project=` 크로스프로젝트 해석은 이미 있는 서버 기능(`graph.ts:32-34`)을 재사용. 딥링크 라우팅도 별도 선행 change에 위임. "안 짜도 될 코드"가 없다 — 오히려 최소 표면으로 목표(완료 링크 확장) 달성. 과잉구현 없음.
- **2+ 페르소나 중복 발견(심각도 상승)**: 없음. 파괴자·보안 감사자가 모두 "링크 유효성"을 봤으나 서로 다른 각도(폴백 동작 vs placeholder/죽은링크 방지)이고 둘 다 방어가 존재 → 심각도 상승 대상 아님.

## 디자인 리뷰
- 화면 변경 없음 → 디자인 리뷰 생략 (criteria 4·7 = 해당 없음, frontend 변경 없음). 이 change가 *가리키는* flowforge change 뷰 자체는 선행 change의 산출물로, 본 change scope 밖.

## 최종 배포 가능 여부
**배포 가능** (치명 0건). verify PASS 4/4·archiveGate open. 문서 문구가 자족적이고, 선행 의존은 라이브 실측으로 배포 확인됨. 유일한 "수정하면 좋은" 항목(소스↔캐시 이중유지)은 이미 일치 상태이며 버전 bump 시 후속 절차 사안.

## 개선 우선순위 (제안)
1. (후속·선택) 하네스 릴리스 절차에 "SKILL.md 소스↔캐시 동기 확인" 체크 추가 — 버전 bump 시 문구 회귀 방지. 범위 밖이나 반복 교훈이라 절차화 가치 있음.
