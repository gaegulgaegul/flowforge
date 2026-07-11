# flowforge-change-node-mapping

## ADDED Requirements

### Requirement: 요구사항 노드에 연관 change만 in-place로 매핑한다
기획 기능명세 트리의 요구사항 노드는 그 노드의 capability 키로 연관된 change가 있을 때만, 그 change를 노드 자리에 in-place로 SHALL 표시한다. 연관 change가 없는 노드에는 아무것도 표시하지 않는다(전역 목록 나열 금지).

#### Scenario: capability에 연관 change가 있는 요구사항 노드
- **WHEN** 기능명세 트리에서 capability 키를 가진 요구사항 노드를 보고, 그 capability가 `byCapability`에 연관 change를 가진다
- **THEN** 그 노드 자리에 연관된 change만(개수 배지 또는 펼침) in-place로 표시된다

#### Scenario: 연관 change가 없는 요구사항 노드
- **WHEN** 요구사항 노드의 capability에 연관 change가 0개다
- **THEN** 그 노드에는 change 표시가 붙지 않는다(빈 배지·빈 블록도 없음)

#### Scenario: 전역 change 목록은 더 이상 나열되지 않는다
- **WHEN** skeleton 뷰를 연다
- **THEN** 기존의 "change 목록(capability별)" 전역 통짜 나열 블록은 렌더되지 않는다(연관 매핑으로 대체)

### Requirement: 하위 노드는 상위 요구사항 capability를 상속해 연관 change를 표시한다
자체 capability 필드가 없는 기능·상세기능 노드는 상위 요구사항의 capability를 상속해 연관 change를 SHALL 조회·표시한다. 상세기능은 자신이 연결한 화면의 연관 change도 합집합으로 표시한다.

#### Scenario: 기능 노드(3단)가 상위 capability를 상속한다
- **WHEN** capability 필드가 없는 기능 노드를 보고, 그 상위 요구사항이 연관 change를 가진 capability를 가진다
- **THEN** 기능 노드에도 상위 capability의 연관 change가 in-place로 표시된다

#### Scenario: 상세기능 노드가 요구사항 capability와 연결 화면 change를 합집합으로 표시한다
- **WHEN** 상세기능 노드가 상위 요구사항 capability의 change와, `screens` 링크로 연결된 화면의 연관 change를 가진다
- **THEN** 두 출처의 change가 중복 제거된 합집합으로 그 상세기능 노드에 표시된다

### Requirement: 화면 노드는 상세기능↔화면 링크를 역경유해 연관 change를 매핑한다
화면 노드(IA·와이어·유저플로우 화면)는 그 화면 id를 연결한 상세기능들의 상위 요구사항 capability를 모아, 그 capability들의 change를 화면 자리에 in-place로 SHALL 매핑한다. 화면↔change 직접 조인 데이터는 없으므로 파생으로 처리한다.

#### Scenario: 화면에 연결된 상세기능의 capability change가 화면에 매핑된다
- **WHEN** 어떤 화면 id를 `screens` 링크로 가진 상세기능들이 있고, 그 상위 요구사항 capability들에 연관 change가 있다
- **THEN** 그 change 합집합이 해당 화면 노드 자리에 in-place로 표시된다

#### Scenario: 연결 상세기능이 없거나 연관 change가 없는 화면
- **WHEN** 화면 id에 연결된 상세기능이 없거나, 연결됐어도 그 capability들에 연관 change가 0개다
- **THEN** 그 화면 노드에는 change 표시가 붙지 않는다(안전한 빈 처리)

### Requirement: 노드에 매핑된 change에서 5종 뷰로 진입한다
노드/화면에 in-place로 표시된 change 항목을 선택하면 그 change의 5종 뷰(PRD/기능명세/유저플로우/IA/와이어)로 SHALL 진입한다. 진입은 기존 openChangeViews 흐름을 재사용한다(읽기 전용).

#### Scenario: 노드의 change 항목 클릭 시 5종 뷰 진입
- **WHEN** 노드에 표시된 연관 change 항목을 클릭한다
- **THEN** 그 change의 views 단계로 진입하고 PRD 탭이 활성화된다(openChangeViews 재사용)

#### Scenario: change를 노드에서 편집하지 않는다
- **WHEN** 노드에 매핑된 change를 본다
- **THEN** 표시·진입만 가능하고 노드에서 change를 편집·추가·삭제하는 UI는 없다(읽기 전용)

## TDD Plan

- **RED**: (web에 컴포넌트 테스트 러너 없음 — 선례 deeplink-url·change-entry-unified대로 순수 파생 로직은 서버 유닛테스트(server Jest)로, 노드 렌더 배선은 VERIFY 라이브(Playwright 실픽셀)로 검증) 서버 파생 함수 테스트 먼저 작성: capability→change 매핑을 노드 트리에 실어주는 파생이 (a)요구사항 노드에 연관 changeKeys 부여, (b)하위 상속, (c)화면 역경유 합집합, (d)연관 0개면 빈 배열을 내는지 → 현재 미구현이라 실패.
- **GREEN**: 서버에 노드↔change 파생 로직 신설(byCapability 재사용) + `FeatureTreeNode.linkedChanges?` 필드 부여. web adapter가 하위 상속·화면 역경유 파생. 노드 렌더에 change 배지/펼침 + openChangeViews 배선. skeleton 하단 `dash-changes-section` 제거.
- **회귀 테스트**: 전역 목록 제거 후에도 연관 change가 있는 노드에서 반드시 5종 뷰 진입 가능(접근성 대체 확인). planning 5종 뷰·유저플로우 좌표·승인 위저드·핀 피드백 불변(diff 스코프).
- **엣지**: capability 없는 프로젝트, change 0개 프로젝트, 화면 연결 없는 상세기능, 순환/중복 화면 링크 → 크래시 없이 빈 처리.
- **UI 검증**: `docker compose up -d --build` 라이브 반영 후 Playwright(`~/.cache/ms-playwright`)로 flowforge를 열어 (1) 연관 change 있는 노드에만 in-place 표시, (2) 연관 없는 노드 미표시, (3) 상세기능/화면 역경유 매핑, (4) change 클릭 시 5종 뷰 진입, (5) 전역 목록 사라짐을 실픽셀 관찰. skeleton·views 탭 UI 불일치도 점검.
