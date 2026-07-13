# flowforge-change-entry

## Purpose

프로젝트에 기획문서(docs/planning/)가 있든 없든, openspec change의 5종 뷰(PRD/기능명세/유저플로우/IA/와이어)로 가는 진입로(capability별 change 목록)를 항상 노출한다. 기존에는 기획문서가 있는 프로젝트일수록 `planTabsAvail.length === 0` 게이트에 걸려 change 목록이 숨겨지는 역설이 있었는데, 이 capability는 그 게이트를 완화해 기획 탭과 change 목록이 병존하도록 한다. change 진입 경로(capability→change→5종 뷰)는 기존 openChangeViews 흐름을 재사용한다.

## Requirements

### Requirement: 기획문서 유무와 무관하게 change 목록을 항상 노출한다
skeleton 단계에서 프로젝트의 change 목록(capability별)은 그 프로젝트에 기획문서(docs/planning/)가 있든 없든 SHALL 노출된다. 기획문서 존재 여부(`planTabsAvail`)가 change 목록 노출을 막지 않는다.

#### Scenario: 기획문서 있는 프로젝트에서 기획 탭과 change 목록이 병존한다
- **WHEN** 기획문서가 있는 프로젝트(flowforge 등)의 skeleton 뷰를 연다
- **THEN** 기획 탭이 위쪽에 렌더되고, 그 아래에 change 목록(capability별)도 함께 노출된다

#### Scenario: 기획문서 없는 프로젝트는 기존처럼 change 목록만 노출된다
- **WHEN** 기획문서가 하나도 없는 프로젝트(wowa-app 등)의 skeleton 뷰를 연다
- **THEN** 기획 탭은 렌더되지 않고 change 목록만 노출된다(기존 동작과 동일, 회귀 없음)

### Requirement: change 목록에서 5종 뷰로 진입할 수 있다
노출된 change 목록에서 capability와 change를 선택하면 그 change의 5종 뷰(PRD/기능명세/유저플로우/IA/와이어)로 SHALL 진입한다. 진입 경로는 기존 openCapability→openChangeViews 흐름을 재사용한다.

#### Scenario: capability를 선택하면 그 capability의 change 목록으로 들어간다
- **WHEN** change 목록에서 capability를 클릭한다
- **THEN** 그 capability의 change 상세 단계(capChanges)로 이동한다

#### Scenario: change를 선택하면 그 change의 5종 탭으로 진입한다
- **WHEN** capability 상세에서 특정 change를 클릭한다
- **THEN** 그 change의 5종 뷰(views 단계)로 진입하고 PRD 탭이 활성화된다

### Requirement: change나 capability가 없는 프로젝트를 안전하게 표면화한다
change나 capability가 없는 프로젝트에서도 빈 화면 대신 상태를 명시적으로 SHALL 표면화한다. 게이트 완화가 이 엣지 케이스를 새로 깨뜨리지 않는다.

#### Scenario: capability가 0개인 프로젝트
- **WHEN** capability가 하나도 없는 프로젝트의 skeleton 뷰를 연다
- **THEN** "표시할 capability가 없습니다" 안내가 change 목록 자리에 노출된다

#### Scenario: change가 0개인 capability
- **WHEN** change가 없는 capability가 목록에 있다
- **THEN** 그 capability는 change 개수 0으로 표기되며, 클릭 시 빈 상세로 진입하되 오류 없이 처리된다

## TDD Plan

- **RED**: 기획문서 있는 프로젝트(flowforge)의 skeleton 렌더에서 change 목록(`dash-cap-list` 또는 capability 버튼)이 존재하는지 검사하는 테스트를 먼저 작성 → 현재 게이트 때문에 실패(FAIL).
- **GREEN**: `planTabsAvail.length === 0` 게이트를 완화해 change 목록을 무조건 렌더하도록 최소 수정 → 테스트 통과.
- **회귀 테스트**: 기획문서 없는 프로젝트(wowa-app 류) skeleton에서 기획 탭 미노출 + change 목록 노출이 기존과 동일한지(변화 없음) 검증. before/after 렌더 스냅샷 비교.
- **엣지**: capability 0개 → "표시할 capability가 없습니다" 노출, change 0개 capability → 개수 0 표기·오류 없음.
- **UI 검증**: `docker compose up -d --build`로 라이브 반영 후 Playwright(`~/.cache/ms-playwright`)로 flowforge를 열어 (1) 기획 탭+change 목록 병존, (2) capability→change→5종 뷰 진입, (3) 기획문서 없는 프로젝트 무회귀를 실픽셀 관찰.
