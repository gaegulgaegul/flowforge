## Why

OpenSpec 기획 단계(openspec-plan) 본구현 **4단계 — 가장 큰 작업이자 유일한 비가역 단계**. 1~3단계(planning-only 인식·기능명세서·유저플로우)가 archive 완주됐고, manyfast 기획 파이프라인의 마지막 연결고리 = **기획 산출물(features.md)을 audit 기준 명세(docs/spec.md)로 변환하는 단계**를 openspec-plan에 추가한다.

핵심 동기는 **charter 폐기**다. charter 스킬과 plan 스킬은 둘 다 "프로젝트 수준 상주 문서를 docs/에 1회 생성·다회 revise"하는 역할이 겹친다(spec.md·PRD·user-flow 이름까지 중복). charter를 그대로 두고 plan을 마저 만들면 두 스킬이 같은 docs/를 두고 충돌한다. 사전조사로 입증된 사실: **audit은 charter에 묶이지 않는다** — 라인문법의 주인은 audit(audit_match.py)이고 charter는 그 문법을 *따르는* 쪽(charter_status.py가 audit_match.parse_spec을 import해 검증)이다. 따라서 charter를 폐기하고 plan이 같은 audit 문법으로 docs/spec.md를 생성하면 audit은 그대로 동작한다.

## What Changes

- **openspec-plan 스킬에 "spec.md 변환" 단계 추가** (agentic-harness): 유저플로우 다음(끝단)에 `docs/planning/features.md`의 요구사항(capability 키)을 `docs/spec.md`의 `## capability: <영문키> — <한글>` + 기능별 `assert:endpoint`/`assert:symbol`/`invariant:<kind>`/`metric:` 라인(audit 문법)으로 변환하는 절차를 명문화한다. charter의 핵심 정신(metric MANDATORY·not-fabricated·영문키 불변)을 이식한다.
- **charter_status.py를 plan이 쓸 공용 위치로 이동/공용화** (agentic-harness): 게이트 본체(detect/validate/discovery-coverage/flow-coverage/context-split/glossary-coverage/owner-coverage/prd-trace 8 mode)를 **재구현하지 않고 그대로 재사용**한다. audit_match import 경로(`--audit-skill`)를 유지한다. plan은 변환 끝단에서 detect/validate 게이트를 호출해 거짓연결·metric 누락을 막는다.
- **charter 폐기 (비가역)** (agentic-harness): openspec-charter SKILL.md + charter_scaffold.py + charter_wireframe.py + charter-schema.md + templates/를 제거한다. **단 charter_status.py는 폐기하지 않고 공용 게이트로 살린다**(사용자 결정 1번 — 기능 손실 0). discovery-coverage·prd-trace 등 charter 고유 게이트도 스크립트에 보존된다. 폐기 직전 git tag `pre-charter-retire` 백업.
- **charter를 참조하는 다른 스킬의 서술 갱신**: openspec-archive/SKILL.md의 "charter가 만든 docs/ 레이어" 서술을 "plan이 만든"으로 갱신(코드 의존 아닌 서술 의존 — absorb 동작 자체는 무변경). audit_scan.py 주석의 charter_status 참조는 유지(공용화 후에도 호출됨).
- 새 의존성 없음. charter_status.py는 표준 라이브러리 + audit_match 동적 import만 사용(상대경로 의존성 0 — 이동 안전).

## Capabilities

### New Capabilities
- `planning-spec-conversion`: openspec-plan 스킬이 유저플로우 다음 끝단에서 `docs/planning/features.md` 요구사항을 `docs/spec.md`의 audit 라인문법(capability 헤더 + assert/invariant/metric)으로 변환하는 능력. charter B등급 게이트(audit_match 파서 재사용·METHOD/invariant 화이트리스트·metric placeholder 필터·validate·discovery-coverage·idempotency)를 이식한다. (스킬 절차 — flowforge 코드 밖. 1~3단계 generation 보류 패턴과 동일.)
- `charter-retirement`: charter 스킬(SKILL.md·scaffold·wireframe·schema·templates)을 폐기하되 charter_status.py를 공용 게이트로 보존하고, charter를 참조하던 서술을 plan으로 갱신하는 구조 변경. charter_status.py의 8 mode가 이동 후에도 audit_match import 경로를 유지하며 전부 동작 SHALL 한다(기능 손실 0).

### Modified Capabilities
<!-- flowforge 코드는 무변경(이 단계는 agentic-harness 스킬/스크립트 변경이 본체). 도그푸딩 검증만 flowforge docs/spec.md에 일어남. flowforge의 기존 10 capability 무수정. modified 없음. -->

## Impact

- **agentic-harness (주 변경)**: `skills/openspec-plan/SKILL.md`에 spec.md 변환 단계 추가(유저플로우 옆) + frontmatter 갱신. `charter_status.py`를 공용 위치로 이동(예: openspec-plan/ 또는 공용 lib). `openspec-charter/` 디렉토리 폐기(SKILL.md·charter_scaffold.py·charter_wireframe.py·charter-schema.md·templates/). `openspec-archive/SKILL.md` 서술 갱신.
- **도그푸딩 (flowforge)**: flowforge 자체 `docs/planning/features.md`(4 요구사항)를 `docs/spec.md`로 변환하고, audit_match.parse_spec + charter_status.py validate를 돌려 거짓연결 0·게이트 통과를 확인한다.
- **무영향**: flowforge 코드(server/web/parser)·기존 10 capability·audit 라인문법(audit_match.py는 무수정 — 주인 유지)·1~3단계 산출물.
- **비가역 안전 가드**: charter 폐기 전 git tag `pre-charter-retire` 백업. 폐기 후 audit 재검증(parse_spec + validate + discovery-coverage 돌려 거짓연결 0 확인). 깨지면 롤백(태그 복구).
- **결합 주의**: charter_status.py는 audit_scan.scan()을 flow-coverage에서 실제 호출(charter_status.py:305) → audit_match import 경로(`--audit-skill`)가 이동 후에도 유지돼야 한다. charter_scaffold.py/charter_wireframe.py는 charter_status.py가 import하지 않으므로 함께 폐기해도 status는 안 깨진다.
