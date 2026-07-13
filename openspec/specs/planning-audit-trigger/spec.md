# planning-audit-trigger

## Purpose

flowforge에서 audit 상태가 미확인(unknown)/경고(warn)인 프로젝트에 "감사 진행" 버튼을 노출해, 사용자가 감사를 직접 실행하고 판정을 UI에 반영하는 닫힌 루프를 제공한다. flowforge 컨테이너는 홈 읽기전용 마운트라 audit을 직접 실행하지 못하므로, 얇은 인증 프록시로서 감사 잡을 openspec-reports 호스트 워커 큐에 위임한다. 실행은 인증 게이트(requireWriteAuth)와 프로젝트 화이트리스트를 통과해야 하며, 판정(PASS/FAIL/UNVERIFIABLE)은 워커 내부의 결정적 파이썬 3-step이 산출하고 결과는 audit.json에 저장된다.

## Requirements

### Requirement: 미감사 프로젝트에 감사 실행 버튼을 노출한다
audit 상태가 미확인(unknown) 또는 경고(warn)인 프로젝트에서, 사용자가 감사를 직접 실행할 수 있는 버튼을 SHALL 노출한다. 감사가 정합(clean)인 프로젝트에는 버튼을 강제 노출하지 않는다(재실행은 허용 가능).

#### Scenario: 미확인 상태에 버튼 표시
- **WHEN** auditStatus가 unknown인 프로젝트 상세를 본다
- **THEN** "감사 진행" 버튼이 보인다

#### Scenario: 버튼 클릭 시 감사 잡이 큐잉된다
- **WHEN** 인증된 사용자가 "감사 진행"을 클릭한다
- **THEN** 서버가 202를 반환하고 openspec-reports 큐에 audit 잡이 enqueue된다

### Requirement: 감사 실행은 인증 게이트와 프로젝트 화이트리스트를 통과해야 한다
audit-run 엔드포인트는 requireWriteAuth(CF Access JWT 또는 Bearer 토큰)를 SHALL 통과해야 하며, project 키는 화이트리스트 정규식(`^[A-Za-z0-9_-]+$`)과 resolveProjectDir 검증을 통과한 값만 SHALL 허용한다. 미등록·경로조작 project는 실행하지 않는다.

#### Scenario: 무인증 요청 거부
- **WHEN** 인증 없이(프로덕션 env 활성) audit-run을 호출한다
- **THEN** 401을 반환하고 잡을 큐잉하지 않는다

#### Scenario: 경로조작 project 거부
- **WHEN** project에 `..`나 절대경로가 포함된다
- **THEN** 4xx를 반환하고 실행하지 않는다

### Requirement: 감사는 호스트 워커가 판정을 결정적으로 산출하고 결과를 저장한다
flowforge 컨테이너는 audit을 직접 실행하지 않고 큐잉만 SHALL 한다. 실제 실행은 openspec-reports 호스트 워커가 담당한다. 워커는 openspec-audit 스킬을 고정 프롬프트(`/openspec-audit`)로 실행하며, **판정(PASS/FAIL/UNVERIFIABLE)은 스킬 내부의 결정적 파이썬 3-step(audit_scan → audit_match → generate_report, shell=False)이 route/symbol 문자열 매칭으로 SHALL 산출**한다. LLM은 스크립트 실행을 오케스트레이션하고 behavior 라인에 주석만 달 수 있으며, **LLM 판단은 UNVERIFIABLE 상한에 묶여 PASS를 만들 수 없다**. 결과는 `<project>/docs/audit.json`에 저장한다.

#### Scenario: 감사 실행 후 audit.json 갱신
- **WHEN** 워커가 audit 잡을 처리한다
- **THEN** `<project>/docs/audit.json`이 새 finalJudgment로 갱신된다

#### Scenario: UI가 결과를 재조회해 반영한다
- **WHEN** 감사 완료 후 UI가 재조회한다
- **THEN** 갱신된 audit 판정이 화면에 표시된다
