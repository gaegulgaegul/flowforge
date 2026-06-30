## Context

OpenSpec 기획 단계 4단계. 1~3단계는 "flowforge가 docs/planning/을 읽어 렌더"하는 view 능력이라 flowforge 코드 변경이 컸지만, 4단계는 **agentic-harness 스킬/스크립트가 본체**다(features.md → docs/spec.md 변환은 plan *스킬*이 하는 일이지 flowforge 코드가 아니다). flowforge는 도그푸딩 검증 대상(자기 features.md를 spec.md로 변환)으로만 쓰인다.

사전조사(코드 입증, 별도 세션 + 이번 세션 file:line 재확인):
- **audit_match.py가 라인문법의 주인**. `parse_spec`, `split_capability_label`(RE_CAP_LABEL), `_classify_line`, `INVARIANT_KEYWORDS`(no-traversal/readonly/not-fabricated/safe-4xx), `RE_ASSERT_EP`(GET/POST/PUT/DELETE/PATCH 화이트리스트)가 전부 여기 있다. **무수정 유지**.
- **charter_status.py(581줄)가 게이트 본체**. 8 mode(detect/validate/discovery-coverage/flow-coverage/context-split/glossary-coverage/owner-coverage/prd-trace). `_load_audit`(charter_status.py:99-112)가 `--audit-skill` 경로를 `sys.path.insert`로 추가해 audit_match·audit_scan을 동적 import. **상대경로 의존성 0** — charter_scaffold.py/charter_wireframe.py를 import하지 않으므로 이동·폐기 안전.
- **charter 폐기 결합점**: charter_status.py를 실제 호출하는 곳은 charter SKILL.md뿐. openspec-archive/SKILL.md:94,96은 charter를 "docs/ 생성 주체"로 *서술*만 함(코드 의존 아님). audit_scan.py:96 주석은 "charter_status가 이 alias를 import한다"는 역방향 언급(공용화 후에도 유효).

## Goals / Non-Goals

**Goals**
- openspec-plan SKILL.md에 features.md → docs/spec.md 변환 단계 추가(audit 라인문법·게이트 호출·영문키 보존).
- charter_status.py를 공용 게이트로 이관(재구현 0, 모든 mode 동작 유지).
- charter 스킬 폐기(SKILL.md·scaffold·wireframe·schema·templates) + git tag 백업.
- charter 참조 서술 갱신(archive SKILL.md).
- 도그푸딩: flowforge features.md → docs/spec.md 변환 + audit 재검증(거짓연결 0).

**Non-Goals**
- audit_match.py 수정(라인문법 주인 — 무변경).
- flowforge 코드(server/web/parser) 변경. flowforge의 기존 10 capability·docs/spec.md 구조 변경.
- discovery/prd-trace 게이트를 plan 흐름에 *적극 편입*(사용자 결정 2번 기각 — 1번 = 스크립트 보존만). 스크립트엔 살아있되 plan은 detect/validate만 호출.
- 5단계(역방향 인덱스)·6단계(승인 UI)·와이어프레임 — 별도 change.
- generation capability 흡수는 1~3단계 패턴대로 보류 유지(아래 결정).

## Decisions

### D1. charter_status.py 이관 위치 = openspec-plan/ (스킬 디렉토리 동거)
charter_status.py를 `skills/openspec-plan/charter_status.py`로 옮긴다(이름 유지 — 호출부가 명시적 경로를 쓰므로). 이유: ①plan이 변환 끝단에서 이 게이트를 호출하는 주 소비자가 됐다 ②openspec-plan은 지금까지 순수 SKILL.md(스크립트 0)였으나, 변환 게이트 호출엔 스크립트가 필요하므로 plan 디렉토리에 두는 게 응집도가 높다 ③별도 공용 lib 디렉토리를 새로 만드는 것(과한 추상화)보다 단순하다(ponytail 최소구현). audit_match import 경로는 호출 시 `--audit-skill ${CLAUDE_PLUGIN_ROOT}/skills/openspec-audit`로 그대로 전달 — 이동과 무관하게 유지된다.
- **대안 기각**: ①공용 `skills/_lib/` 신설 = 새 디렉토리 규약 도입(과함, 다른 스킬이 아직 안 씀) ②openspec-audit/로 이동 = audit은 "코드 대조 감사"고 status는 "생성 게이트"라 역할 혼탁.

### D2. 변환 알고리즘 = LLM 절차(SKILL.md 명문화), 스크립트 변환기 안 만듦
features.md → spec.md 변환은 **LLM이 SKILL.md 절차대로 수행**한다(코드 변환기 신설 안 함). 이유: ①변환은 "요구사항 산문 → assert:endpoint/symbol(코드에 실재하는 것만) + 적절한 invariant kind + 실제 metric" 매핑인데, 이건 코드 지식·판단이 필요한 작업이라 결정론 스크립트로 못 짠다(어느 endpoint가 이 요구사항을 구현하는지는 LLM이 코드를 봐야 안다) ②charter도 spec.md 생성을 LLM 템플릿으로 했다(charter SKILL.md:79-85). ③검증은 사후 게이트(charter_status.py validate + audit_match 거짓연결 검사)가 결정론으로 잡는다 — 생성은 LLM, 검증은 결정론(역할 분리).
- SKILL.md에 박을 변환 규약: capability 헤더 형식(`## capability: <영문키> — <한글>`, 영문키는 features.md `<!-- capability: -->`에서 가져옴 불변), assert:endpoint METHOD 화이트리스트, invariant kind 화이트리스트, metric MANDATORY(placeholder 금지), not-fabricated(코드에 없는 endpoint/symbol 지어내지 말 것 — behavior로만), idempotency(기존 spec.md 보존).

### D3. generation capability 보류 유지 (1~3단계 교훈 재확인)
4단계에서 "스킬 단계가 코드 변환을 낳으니 generation도 endpoint/symbol 연결 가능한가" 재판단 숙제가 있었다. **결론: 여전히 보류가 정직하다.** planning-spec-conversion은 openspec-plan(agentic-harness) *스킬 동작*이라 flowforge 코드에 대응하는 endpoint/symbol이 없다. 흡수하면 audit 거짓연결 위험("틀린 문서가 죽은 문서보다 나쁘다"). 따라서 도그푸딩 archive 시 flowforge docs/spec.md에는 **view 계열만** 흡수하던 1~3단계 패턴을 유지하되, 이 4단계 change 자체는 flowforge에 새 view 코드가 없으므로 docs/spec.md 신규 흡수가 없을 수 있다(변환 능력은 스킬, 검증은 기존 capability에 대해 일어남). archive 단계에서 실제 흡수 대상을 재판정한다.

### D4. 폐기 순서(비가역 안전) = 이관 → 검증 → 백업 태그 → 폐기 → audit 재검증
1. charter_status.py를 openspec-plan/으로 복사(이동 전 원본 유지).
2. 이동본에 8 mode 실행해 동작 확인(import 경로 유지 입증).
3. SKILL.md 변환 단계 추가 + archive 서술 갱신.
4. 도그푸딩: flowforge features.md → docs/spec.md 변환 + audit 재검증(거짓연결 0).
5. **여기까지 검증 PASS 후** git tag `pre-charter-retire` 백업.
6. charter 폐기(SKILL.md·scaffold·wireframe·schema·templates 제거, 원본 charter_status.py도 제거 — 이동본이 대체).
7. 폐기 후 audit 재검증 1회 더(charter_status.py 이동본으로 flowforge validate/discovery-coverage 통과 재확인). 깨지면 태그 복구 롤백.

## Risks / Trade-offs

- **위험: 폐기 후 charter_status.py 호출 경로 깨짐** → 완화: 폐기 *전* 이동본 동작 검증(D4 step2), 호출부가 명시적 경로 전달이라 상대의존 0.
- **위험: 변환이 코드에 없는 endpoint/symbol을 지어냄(거짓연결)** → 완화: not-fabricated 규약 + 사후 audit_match 거짓연결 검사(0이어야 PASS).
- **트레이드오프: 변환을 LLM 절차로 둠** = 결정론 보장 약함. 그러나 생성은 본질적으로 코드판단이 필요(D2), 검증을 결정론 게이트로 보강해 상쇄.
- **위험: charter를 쓰던 사용자 워크플로우 단절** → 개인용 도그푸딩 환경이고 charter는 flowforge/쏙쏙에만 적용됐으며 그 docs/는 이미 생성됨(폐기해도 기존 docs/spec.md는 남음). plan이 revise를 이어받음.

## Migration Plan

charter를 쓰던 기존 프로젝트(flowforge·쏙쏙)의 docs/spec.md는 그대로 유효하다(폐기는 *스킬*이지 *산출물*이 아님). 이후 그 docs/를 갱신할 땐 charter 대신 openspec-plan의 변환 단계로 revise한다(charter_status.py detect가 revise 판정). 별도 데이터 마이그레이션 없음.

## 화면 구성 / UI

이 change는 flowforge UI 변경이 없다(스킬/스크립트 변경 + 도그푸딩 검증). 화면 작업 없음 → 프로토타입 생략.
