# cross-project-layout-persistence

타 프로젝트(`PROJECTS_ROOT` 하위, 읽기 전용 마운트) change 의 유저플로우 그래프 레이아웃을 전용 RW 볼륨에 저장·재조회하고, 쓰기 불가 대상은 정직한 상태 코드로 거부하는 능력. 홈 마운트의 읽기 전용 보안 경계는 보존한다.

## ADDED Requirements

### Requirement: 타 프로젝트 change 의 레이아웃 저장

`?project=<project>` 로 지정된 타 프로젝트 change 에 대해 레이아웃 저장을 요청하면, 시스템은 전용 RW 볼륨(`OVERLAY_ROOT`)에 그 레이아웃을 SHALL 저장하고 성공을 응답한다. 저장 경로 규약은 `<OVERLAY_ROOT>/<project>/<changeId>.json` 이다.

읽기 전용 마운트인 `PROJECTS_ROOT` 하위(`<changeDir>/viz/`)에 SHALL NOT 쓴다 — 홈 전체 마운트의 읽기 전용 보안 경계를 보존하기 위함이다.

#### Scenario: 타 프로젝트 change 레이아웃 저장 성공

- **WHEN** `PUT /api/changes/<changeId>/layout?project=<타프로젝트>` 에 유효한 레이아웃 본문으로 요청한다
- **THEN** HTTP 200 과 저장 결과를 응답한다(500 이 아니다)
- **AND** `<OVERLAY_ROOT>/<project>/<changeId>.json` 에 그 레이아웃이 실제로 기록된다

#### Scenario: 읽기 전용 마운트에 쓰지 않는다

- **WHEN** 타 프로젝트 change 레이아웃을 저장한다
- **THEN** `PROJECTS_ROOT` 하위 change 디렉토리에는 `viz/` 디렉토리나 오버레이 파일이 생성되지 않는다

#### Scenario: 잘못된 레이아웃 본문은 거부

- **WHEN** 레이아웃 형식(`{nodeId: {x:number, y:number}}`)에 맞지 않는 본문으로 저장을 요청한다
- **THEN** HTTP 400 으로 거부하고 아무것도 저장하지 않는다

### Requirement: 저장한 레이아웃의 재조회 일관성

저장된 레이아웃은 같은 change 를 다시 조회할 때 SHALL 복원된다. 읽기는 `OVERLAY_ROOT` 를 우선 조회하되, 기존 `<changeDir>/viz/graph-overlay.json` 경로도 폴백으로 SHALL 읽어 이미 저장된 오버레이가 유실되지 않게 한다.

#### Scenario: 저장 → 재조회 시 좌표 복원

- **WHEN** 타 프로젝트 change 에 레이아웃을 저장한 뒤 그 change 의 그래프를 다시 조회한다
- **THEN** 저장한 노드 좌표가 그래프 응답에 반영되어 돌아온다

#### Scenario: 기존 글로벌 루트 오버레이 무손실

- **WHEN** 기존 방식으로 `<changeDir>/viz/graph-overlay.json` 에 이미 저장된 오버레이가 있는 change 를 조회한다
- **THEN** 그 오버레이가 계속 읽혀 좌표가 복원된다(새 규약 도입으로 유실되지 않는다)

### Requirement: 쓰기 불가 대상의 정직한 거부

레이아웃 저장 대상이 쓰기 불가일 때, 시스템은 generic 500(내부 오류)이 아니라 기계 판독 가능한 상태 코드(409)와 에러 코드로 SHALL 응답한다. 설계상 쓸 수 없는 대상은 서버 내부 오류가 아니기 때문이다.

에러 응답에 내부 파일시스템 경로를 SHALL NOT 노출한다(내부 에러 상세 클라이언트 비노출).

#### Scenario: 쓰기 불가 대상은 409

- **WHEN** 저장 대상 루트가 쓰기 불가인 상태에서 레이아웃 저장을 요청한다
- **THEN** HTTP 409 와 `read_only_target` 에러 코드로 응답한다(500 이 아니다)
- **AND** 응답 본문에 내부 파일시스템 경로가 포함되지 않는다

#### Scenario: 미지 프로젝트는 404 유지

- **WHEN** 화이트리스트를 통과하지 못하는 프로젝트명으로 저장을 요청한다
- **THEN** 기존대로 HTTP 404 로 응답한다(경로 존재 여부를 드러내지 않는다)

### Requirement: 글로벌 루트 저장 경로 회귀 없음

`?project=` 없이 요청하는 기존 글로벌 루트(`OPENSPEC_ROOT`, 쓰기 가능 마운트) 저장 경로는 시스템이 변경하지 SHALL NOT 한다. 프론트 API 계약(`saveLayout(id, layout, project?)`)도 변경하지 SHALL NOT 한다.

#### Scenario: 글로벌 루트 저장은 기존대로

- **WHEN** `?project=` 없이 `PUT /api/changes/<changeId>/layout` 으로 저장을 요청한다
- **THEN** 기존과 동일하게 저장에 성공하고 재조회 시 복원된다
