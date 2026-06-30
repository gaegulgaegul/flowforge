# charter-retirement

charter 스킬(SKILL.md·charter_scaffold.py·charter_wireframe.py·charter-schema.md·templates/)을 폐기하되, charter_status.py를 공용 게이트 스크립트로 보존하는 구조 변경. charter의 spec.md 생성 역할은 openspec-plan이 흡수했으므로(planning-spec-conversion) charter는 더 이상 필요 없다. 단 charter_status.py의 8개 게이트 mode(detect/validate/discovery-coverage/flow-coverage/context-split/glossary-coverage/owner-coverage/prd-trace)는 기능 손실 없이 살린다(사용자 결정 1번).

## ADDED Requirements

### Requirement: charter_status.py가 공용 게이트로 보존되며 모든 mode가 동작한다
charter_status.py는 charter 스킬 디렉토리 폐기와 무관하게 공용 게이트 스크립트로 보존 SHALL 된다. 이동 후에도 8개 mode 전부(detect/validate/discovery-coverage/flow-coverage/context-split/glossary-coverage/owner-coverage/prd-trace)가 동작하며, audit_match를 동적 import하는 경로(`--audit-skill <openspec-audit>`)가 유지돼 키 drift가 발생하지 않는다. 게이트 로직을 재구현하지 않는다(이동/공용화만).

#### Scenario: 이동 후 validate/detect 게이트가 정상 동작한다
- **WHEN** 공용 위치로 옮긴 charter_status.py에 `--mode validate --root <project> --audit-skill <openspec-audit>`를 실행한다
- **THEN** audit_match.parse_spec을 import해 capability별 feature/metric 게이트를 검증하고 JSON 결과를 출력한다(import 실패·경로 깨짐 없음)

#### Scenario: charter 고유 게이트도 보존된다
- **WHEN** discovery-coverage·prd-trace mode를 실행한다
- **THEN** 이동 후에도 두 mode가 동작한다(charter 폐기로 기능을 잃지 않는다 — 사용자 결정 1번)

### Requirement: charter 스킬을 폐기하되 비가역 백업 가드를 둔다
charter 스킬의 폐기 대상(openspec-charter/SKILL.md·charter_scaffold.py·charter_wireframe.py·charter-schema.md·templates/)을 제거 SHALL 한다. 단 폐기는 비가역이므로 제거 직전에 git tag `pre-charter-retire`로 백업을 남긴다. charter_status.py는 폐기 대상에서 제외한다(공용 게이트로 이관).

#### Scenario: 폐기 전 백업 태그가 존재한다
- **WHEN** charter 스킬 파일을 제거하기 직전 상태를 본다
- **THEN** git tag `pre-charter-retire`가 charter 폐기 직전 커밋을 가리켜, 필요 시 복구할 수 있다

#### Scenario: charter_status.py는 제거되지 않는다
- **WHEN** charter 폐기 후 파일 트리를 본다
- **THEN** charter SKILL.md·scaffold·wireframe·schema·templates는 사라졌지만 charter_status.py(공용 게이트)는 남아 있다

### Requirement: charter를 참조하던 서술을 plan으로 갱신한다
charter를 언급하던 다른 스킬 문서의 서술을 plan 기준으로 갱신 SHALL 한다. openspec-archive/SKILL.md의 "docs/ 레이어를 charter가 만들었다"는 서술을 "plan이 만든다"로 고친다. 이는 코드 의존이 아닌 서술 의존이므로 absorb_merge.py의 흡수 동작 자체는 무변경이다(docs/spec.md를 흡수하는 로직은 누가 spec.md를 생성했는지와 무관).

#### Scenario: archive 서술이 더 이상 charter를 docs 생성 주체로 가리키지 않는다
- **WHEN** charter 폐기 후 openspec-archive/SKILL.md를 본다
- **THEN** "charter가 docs/를 만들었다"는 서술이 plan 기준으로 갱신돼, 폐기된 스킬을 docs 생성 주체로 안내하지 않는다

#### Scenario: archive 흡수 동작은 무변경이다
- **WHEN** charter 폐기 후 docs/spec.md가 있는 프로젝트에 archive 흡수를 돌린다
- **THEN** absorb_merge.py가 docs/spec.md를 이전과 동일하게 흡수한다(spec.md 생성 주체와 무관하게 동작)

## TDD Plan

- **Red/Green/Refactor**: 스크립트 이동·스킬 폐기·문서 갱신은 코드 단위테스트 대상이 아니다. 검증 = (1) 이동한 charter_status.py에 8개 mode를 실제 실행해 동작 확인(import 경로 유지) (2) git tag `pre-charter-retire` 존재 확인 (3) charter 폐기 대상 파일 부재 + charter_status.py 잔존 확인 (4) archive SKILL.md grep으로 charter 서술 갱신 확인 (5) 폐기 후 audit 재검증(flowforge docs/spec.md에 parse_spec + validate + discovery-coverage 돌려 거짓연결 0). 실행 검증(grounding)으로 입증한다.
- **Mock 대상**: 없음(스크립트 실행 + 파일 트리 검증).
