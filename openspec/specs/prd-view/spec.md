# prd-view Specification

## Purpose

change의 `proposal.md` + `design.md`를 manyfast 고정 5섹션(개요/핵심가치/타겟·시나리오/성공지표/속성설정)으로 파생해 읽기전용으로 표시하는 PRD 뷰. 섹션 소스가 없으면 빈 섹션으로 표면화하며, 소스에 없는 내용은 지어내지 않는다.

## Requirements

### Requirement: PRD 5섹션 파생
시스템은 change 디렉토리의 `proposal.md`와 `design.md`를 읽어 manyfast 고정 5섹션(개요·핵심가치·타겟/시나리오·성공지표·속성설정) 구조의 PRD를 파생해 SHALL 반환한다. 각 섹션은 정해진 소스 마크다운 섹션에서만 내용을 끌어오며, 시스템은 소스에 없는 내용을 생성하지 않는다.

#### Scenario: proposal·design이 모두 있는 change의 PRD 파생
- **WHEN** 클라이언트가 `GET /api/changes/:id/prd`를 호출하고 해당 change에 `proposal.md`와 `design.md`가 존재한다
- **THEN** 서버는 5개 섹션(`overview`/`value`/`target`/`metrics`/`attributes`)을 가진 PRD 객체를 반환하며, 각 섹션의 본문은 매핑된 소스 섹션(개요=proposal `## Why`+`## What Changes`, 핵심가치=proposal `## Why`+design `## Goals / Non-Goals`, 타겟·시나리오=design `## Context`+`## 화면 구성 / UI`, 성공지표=design `## Risks / Trade-offs`+`## Open Questions`, 속성설정=proposal `## Impact`)에서 추출된 마크다운 텍스트다

#### Scenario: 매핑 소스 섹션이 없을 때 빈 섹션 표면화
- **WHEN** PRD 파생 중 어떤 섹션의 매핑 소스 헤더가 문서에 하나도 존재하지 않는다
- **THEN** 해당 섹션은 본문 없이 비어 있음(`empty: true` 또는 빈 문자열)으로 반환되고, 시스템은 임의의 대체 텍스트를 지어내지 않는다

#### Scenario: design.md가 없는 change
- **WHEN** change에 `proposal.md`는 있으나 `design.md`가 없다
- **THEN** 서버는 4xx 오류 대신 PRD를 반환하되 design 기반 섹션(핵심가치 일부·타겟/시나리오·성공지표)은 가능한 만큼만 채우고 나머지는 빈 섹션으로 표면화한다

#### Scenario: 존재하지 않는 change id
- **WHEN** 클라이언트가 존재하지 않거나 경로 조작(`..`)이 포함된 change id로 PRD를 요청한다
- **THEN** 서버는 안전 오류(4xx)를 반환하고 change 디렉토리 밖의 파일을 읽지 않는다

### Requirement: PRD 뷰 표시
웹 클라이언트는 PRD 탭에서 파생된 5섹션을 순서대로 읽기전용 문서 형태로 SHALL 렌더한다. 사용자는 섹션을 편집하거나 저장할 수 없다.

#### Scenario: PRD 탭 선택 시 5섹션 렌더
- **WHEN** 사용자가 change를 선택하고 PRD 탭을 누른다
- **THEN** 화면에 5개 섹션이 고정 순서(개요→핵심가치→타겟/시나리오→성공지표→속성설정)로 제목과 함께 표시되고, 각 섹션 본문은 마크다운으로 렌더된다

#### Scenario: 빈 섹션 시각적 구분
- **WHEN** PRD에 빈 섹션(매핑 소스 없음)이 포함되어 있다
- **THEN** 해당 섹션은 "해당 문서에 없음" 같은 플레이스홀더로 비어 있음을 명시적으로 표시하고, 다른 섹션과 시각적으로 구분된다
