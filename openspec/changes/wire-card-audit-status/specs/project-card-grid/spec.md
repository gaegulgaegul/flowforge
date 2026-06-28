## ADDED Requirements

### Requirement: 카드의 audit 상태는 audit.json의 finalJudgment에서 채워진다

The system SHALL populate each project card's audit status from the project's `<projDir>/docs/audit.json` `finalJudgment` field, not from a hardcoded constant. When `audit.json` is absent, unparseable, or its `finalJudgment` is unrecognized, the system SHALL fall back to `unknown`.

#### Scenario: finalJudgment "조건부" → warn 배지

- **WHEN** a project's `docs/audit.json` exists with `"finalJudgment": "조건부"`
- **THEN** the system SHALL set that card's `auditStatus` to `warn`

#### Scenario: finalJudgment "FAIL" → fail 배지

- **WHEN** a project's `docs/audit.json` exists with `"finalJudgment": "FAIL"`
- **THEN** the system SHALL set that card's `auditStatus` to `fail`

#### Scenario: finalJudgment "PASS" → clean 배지

- **WHEN** a project's `docs/audit.json` exists with `"finalJudgment": "PASS"`
- **THEN** the system SHALL set that card's `auditStatus` to `clean`

#### Scenario: audit.json 없는 프로젝트는 unknown 폴백

- **WHEN** a project has no `docs/audit.json` file
- **THEN** the system SHALL set that card's `auditStatus` to `unknown` and SHALL NOT raise an error

#### Scenario: 깨진 JSON 또는 미인식 finalJudgment는 unknown 폴백

- **WHEN** a project's `docs/audit.json` is unparseable JSON, or its `finalJudgment` is `"UNVERIFIABLE"` / missing / an unrecognized value
- **THEN** the system SHALL set that card's `auditStatus` to `unknown` and SHALL NOT raise an error

#### Scenario: audit.json의 호스트 절대경로는 신뢰하지 않는다

- **WHEN** a project's `docs/audit.json` contains a `scanRoot` host absolute path
- **THEN** the system SHALL ignore that path, construct the read path from the already-resolved `projDir`, and consume only the `finalJudgment` field
