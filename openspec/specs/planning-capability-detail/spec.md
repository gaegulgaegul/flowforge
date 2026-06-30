# planning-capability-detail Specification

## Purpose
TBD - created by archiving change planning-capability-detail-view. Update Purpose after archive.
## Requirements
### Requirement: capability 단위 종합 상세 조회

시스템은 한 capability 키에 대해 그 capability의 features 서브트리, 연결된 유저플로우 목록, 그 capability를 건드리는 change 목록을 **한 응답**으로 묶어 제공하는 읽기전용 종합 엔드포인트 `GET /api/projects/:project/capabilities/:cap` 을 SHALL 제공한다. 연결은 capability 키의 **글자단위 정확 비교**로만 SHALL 판정한다(유사도 매칭 금지, 거짓연결 0).

#### Scenario: 종합 상세 200 반환
- **WHEN** 존재하는 project와 capability 키로 `GET /api/projects/:project/capabilities/:cap` 을 호출하면
- **THEN** 200과 함께 `{ key, koreanLabel, features, userFlows, changes }` 구조의 종합 뷰모델을 반환한다
- **AND** `changes`는 기존 역방향 인덱스 `byCapability.get(cap)`이 반환하는 change 키 집합과 동일하다(재구현 없이 재사용)

#### Scenario: features 서브트리는 capability 일치 가지만 포함
- **WHEN** `docs/planning/features.md`에 여러 requirement(각자 capability 키)가 있고 그중 하나의 capability로 종합 상세를 조회하면
- **THEN** `features`에는 그 capability 키와 **정확히 일치**하는 requirement 노드와 그 하위 feature/detail 가지만 포함되고, 다른 capability의 가지는 포함되지 않는다

#### Scenario: 유저플로우는 capability 마커로 연결
- **WHEN** `docs/planning/user-flow/<group>-vN.md` 중 `> capability: <키>` 마커로 해당 capability를 선언한 flow가 존재하면
- **THEN** `userFlows`에 그 flow의 stem(파일 식별자)이 포함된다
- **AND** capability 마커가 없거나 다른 키를 선언한 flow는 포함되지 않는다

#### Scenario: 연결 0개여도 빈 구조로 200
- **WHEN** charter spec.md에는 선언됐으나 features/유저플로우/change 어디에도 연결이 없는 capability를 조회하면
- **THEN** 404가 아니라 200과 함께 `features`/`userFlows`/`changes`가 각각 빈 값인 종합 뷰모델을 반환한다(빈 상태를 명시적으로 표면화)

#### Scenario: 경로 조작 차단
- **WHEN** project 파라미터에 `..` 또는 화이트리스트(`[A-Za-z0-9_-]`) 밖 문자가 포함되면
- **THEN** 디렉토리 경계를 벗어나지 않고 4xx로 안전하게 거부한다(no-traversal)

#### Scenario: 존재하지 않는 project는 safe-4xx
- **WHEN** openspec/changes 디렉토리가 없는(=프로젝트 아님) 이름으로 조회하면
- **THEN** 500이 아니라 4xx로 거부하고 내부 에러 상세를 노출하지 않는다(safe-4xx)

### Requirement: capability 통합 drill-down 화면

flowforge 웹은 capability를 클릭했을 때 그 capability의 change 목록 **옆에** features 서브트리, 연결된 유저플로우, PRD 맥락을 한 화면에 함께 SHALL 렌더한다(세 군데로 흩어지지 않게 co-locate). 기존 컴포넌트(features ReactFlow, 유저플로우 ReactFlow, `CapabilityChangeList`, `PrdPanel`)를 재사용한다.

#### Scenario: capability 클릭 시 통합 화면 전환
- **WHEN** skeleton 단계에서 capability 버튼을 클릭하면
- **THEN** 그 capability의 종합 상세(features 서브트리 + 유저플로우 + change 목록)를 한 화면에 함께 표시한다
- **AND** 기존처럼 change 목록만 단독으로 표시되지 않는다

#### Scenario: 빈 섹션 명시 표면화
- **WHEN** 조회한 capability에 features/유저플로우/change 중 비어있는 항목이 있으면
- **THEN** 그 섹션은 "연결된 항목 없음"을 명시적으로 표시한다(조용히 숨기지 않음)

#### Scenario: change 클릭 시 기존 5종 뷰 진입 보존
- **WHEN** 통합 화면의 change 목록에서 change 하나를 클릭하면
- **THEN** 기존과 동일하게 그 change의 5종 뷰(유저플로우·IA·와이어·PRD·기능명세) 탭 화면으로 진입한다(기존 drill-down 동작 회귀 없음)

