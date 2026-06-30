# 배포 전 최종 검토 — planning-spec-conversion-charter-retire
검토일: 2026-06-30 / 검토 범위: agentic-harness 커밋 b9be71e·d66bd91의 diff —
`skills/openspec-plan/charter_status.py`(588줄 이관본), `skills/openspec-plan/SKILL.md`(변환 단계),
`skills/openspec-archive/SKILL.md`+`absorb_merge.py`(charter→plan 서술), `skills/openspec-audit/audit_scan.py`(주석).
flowforge 코드는 무변경(도그푸딩 검증 대상만). **전체 앱이 아닌 이 change의 diff·직접 영향 파일만 검토.**

변경타입: backend(게이트 스크립트) + doc(SKILL.md). frontend 0 → criteria 4·7 해당 없음, 디자인 리뷰 생략(design.md "화면 작업 없음").
verify 입력: verify.json final=**PASS**, gate_open=True (15 scenario PASS / FAIL 0 / edge 게이트 6 requirement 모두 충분). review는 verify를 재실행하지 않고 판단 입력으로 사용.

## 반드시 수정해야 할 항목
- 없음. (CRITICAL/HIGH 0 — 보안 취약점·데이터 손실·인증 우회 해당 없음. 코드 검증: server 142/142·tsc exit 0·lint exit 0·audit FAIL 0)

## 수정하면 좋은 항목
- **[MEDIUM] 폐기 용어(charter)가 사용자향 문자열 3곳에 잔존** — `charter_status.py:220`·`:267`("docs/spec.md 없음 — charter 먼저")·`:349`("docs/PRD.md 없음 — charter PRD 먼저"). spec.md/PRD.md 없을 때 이 메시지를 받은 사용자는 폐기된 charter를 찾게 돼 해결 경로를 잃는다(올바른 흐름=openspec-plan 변환 단계). 기능 동작(exit code·ok:false)은 정확 — 배포 차단 아님. 정기 정리 시 "openspec-plan 변환 단계 먼저"로 교체 권장.
- **[MEDIUM] `charterAction` JSON 키 이름이 폐기 용어** — `charter_status.py:210` `out["charterAction"]="revise"|"create"`. SKILL.md는 *값*(revise/create)만 참조하고 키 이름은 미참조 → `specAction`/`planAction` rename 가능. 6개월 뒤 가독성↑. rename 시 SKILL.md 동시 점검 필요.
- **[MEDIUM] `context_split` reason이 폐기 주체 언급** — `charter_status.py:433` "사람 승인 후 charter가 분할." 분할 주체를 plan/수동으로 정정 권장.
- **[LOW→배포후] 적대 패스(파괴자): fallbackParser 키 early-return 누락** — `discovery_coverage`(`:265-268`)·`prd_trace`(`:349-351`)의 spec/PRD 부재 early-return에 `fallbackParser` 키가 빠진다. `main()`의 보완 주입(`:577`)이 early-return 경로를 못 탄다 → 그 두 모드 결과에 키 누락. 기능 무영향이나 모니터링 코드가 키를 무조건 읽으면 KeyError 위험. (validate는 `:218`에서 키 포함 — 일관성만 어긋남.)

## 현재 상태로 유지해도 되는 항목
- **[OK] 이동 안전 (D1 코드 입증)** — `charter_status.py` 최상위 import는 stdlib(sys/os/re/json/argparse/glob)뿐. audit_match·audit_scan은 `_load_audit()`에서 `--audit-skill` 경로 동적 import. 폐기된 charter_scaffold/charter_wireframe 미참조 → 이동·폐기 안전(AST 확인).
- **[OK] `audit_scan.py:96` 역방향 주석 유효** — charter_status.py:115가 audit_scan import, :315에서 norm_route 사용. 공용화 후에도 정확.
- **[OK] archive 서술/absorb_merge docstring 변경** — 사실 기술, 실행 흐름·흡수 동작 무영향(흡수는 spec.md 파일만 읽음, 생성 주체 무관).
- **[OK] 폴백 파서 2함수(`_fallback_parse_spec`/`_fallback_classify`)** — audit 미설치 시 게이트가 죽지 않게 하는 필수 안전망(게으른 시니어도 "안 짜도 될 코드 아님" 판정). 588줄 이관본에 신규 작성 코드 0(재구현 0, docstring만 갱신) — over-engineering 없음.

## 리팩토링 추천 항목
- **[LOW] 파일명 `charter_status.py` → `plan_gates.py`/`living_doc_gates.py`** — 폐기 스킬명이 파일명에 남아 발견성↓. SKILL.md:211이 경로 직접 참조 → rename 시 동시 갱신 필요. 동작 무관이라 즉시 필수 아님.

## 적대적 검토 (4 페르소나)
- **파괴자**: fallbackParser 키 early-return 누락(위 LOW) — 파서 미로드 시 discovery-coverage/prd-trace 결과에 키 빠짐. 프로덕션 크래시 수준 아님(소비측이 키 무조건 읽을 때만 KeyError).
- **신입 개발자**: `charterAction` 키·charter 잔존 문자열이 "charter가 뭔데?" 혼란 유발(위 MEDIUM). 주석 한 줄 또는 rename으로 해소.
- **보안 감사자**: `_load_audit()` `sys.path.insert(0, audit_skill)` 경로 검증이 `os.path.isdir`뿐(`:111-112`, absorb_merge.py:73 동일). 프롬프트 인젝션으로 `--audit-skill /tmp/evil` 주입 시 임의코드 실행 이론상 가능. 완화: 웹 미노출(openspec-reports 워커 grep 0건)·단일사용자 홈서버·경로가 SKILL.md에서 `${CLAUDE_PLUGIN_ROOT}` 고정. 현 위협모델 허용. 방어깊이용으로 `realpath().startswith(PLUGIN_ROOT)` containment 추가하면 좋음.
- **게으른 시니어**: "안 짜도 될 코드 없음" — 신규 작성 0, 전부 charter 시절 함수 그대로 이관. 폴백 2함수도 필수. diff 줄일 여지 없음(오히려 폐기로 1318줄 삭제).
- **2+ 페르소나 중복(심각도 상승)**: charter 용어 잔존 = 신입개발자+(수정하면좋은 MEDIUM 3건)에서 공통 → MEDIUM 유지(기능 무영향이라 상승해도 배포 차단선 미만).

## archive 사전 점검 (도로로 추가 발견 — D3 함정)
- **absorb dry-run(`--mode plan`) 결과: 이 change의 두 capability(`planning-spec-conversion`·`charter-retirement`)가 flowforge docs/spec.md에 `classification: NEW`로 판정됨.** 그러나 둘 다 *스킬 능력*이라 flowforge 코드에 대응 endpoint/symbol이 없다 → NEW로 흡수하면 standing spec에 거짓연결이 박혀 다음 audit에서 FAIL. **design.md D3가 예고한 "archive에서 흡수 대상 재판정" 지점.**
- **조치(사용자 승인 2026-06-30): archive 시 두 capability의 docs/spec.md 흡수를 스킵**(section body 미작성 → 흡수 거부). archive 흡수 게이트는 사람이 section body를 써야만 반영되고 거부 시 docs/spec.md 무변경이라 안전. specs delta sync(openspec/specs/)는 정상 진행.

## 최종 배포 가능 여부
**배포 가능** — CRITICAL/HIGH 0, verify final=PASS(gate_open=True), 코드검증 전부 PASS, audit FAIL 0. MEDIUM 3건(charter 용어 잔존)은 기능 무영향·정기 정리 대상. archive는 흡수 스킵으로 진행(D3 함정 회피).

## 개선 우선순위 (제안)
1. charter 잔존 문자열 3곳 정정(`:220/:267/:349`) — 사용자가 실제로 막히는 유일한 실사용 영향. (다음 정리)
2. fallbackParser early-return 키 일관성(`:265-268`/`:349-351`) — 모니터링 견고성. (다음 정리)
3. `charterAction` 키 + 파일명 rename — 가독성/발견성. SKILL.md 동시 갱신 필요. (저우선)
4. `_load_audit` 경로 containment — 방어깊이. 현 위협모델 허용이라 선택. (저우선)
