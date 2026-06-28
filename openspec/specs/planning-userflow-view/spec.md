# planning-userflow-view

flowforge가 `docs/planning/user-flow/<group>-vN.md`의 Mermaid flowchart를 파싱해 SpecGraph로 렌더하고, 드래그한 좌표를 `<group>-vN.overlay.json`에 저장하는 능력. SpecGraph 타입(공용)·web graphAdapter/SpecNode를 재사용한다. docs 디렉토리에 처음으로 쓰기(좌표 저장)가 추가된다.

## Requirements

### Requirement: flowforge가 Mermaid 유저플로우를 SpecGraph로 파싱해 제공한다
flowforge 서버는 `docs/planning/user-flow/<group>-vN.md`의 ```mermaid 코드블록을 파싱해 SpecGraph(노드+엣지)로 변환해 API로 SHALL 제공한다. mermaid 라이브러리를 쓰지 않고 flowchart 노드(모양→kind)·엣지(`-->`, `-->|라벨|`)만 정규식으로 파싱한다. 라우트는 `GET /api/docs/:project/planning-user-flow`이며 그래프와 저장된 좌표(layout)를 함께 반환한다. 유저플로우가 여러 버전이면 버전 목록도 제공한다. 파일이 없으면 404로 안전하게 응답한다.

#### Scenario: 유저플로우 그래프 조회 성공
- **WHEN** `<project>/docs/planning/user-flow/<group>-vN.md`에 Mermaid flowchart가 있고 `GET /api/docs/<project>/planning-user-flow`(group/version 지정)를 호출한다
- **THEN** HTTP 200과 함께 노드·엣지를 담은 SpecGraph와 저장된 layout(없으면 빈 객체)을 반환한다

#### Scenario: Mermaid 노드 모양이 노드 kind로 매핑된다
- **WHEN** Mermaid에 `A(["시작"])`, `B["페이지"]`, `C{"행동"}` 노드가 있는 상태로 조회한다
- **THEN** 각 노드가 대응 kind(start/screen/action 등)로 파싱돼 반환된다

#### Scenario: Mermaid 엣지가 그래프 엣지로 변환된다
- **WHEN** Mermaid에 `A --> B`, `B -->|확인| C` 엣지가 있는 상태로 조회한다
- **THEN** source/target이 이어진 엣지로 변환되고, `|라벨|`은 엣지 label로 보존된다

#### Scenario: 유저플로우 파일 없으면 안전한 4xx
- **WHEN** `<project>/docs/planning/user-flow/`가 없거나 지정 group/version 파일이 없다
- **THEN** 500이 아니라 404로 안전하게 응답한다

### Requirement: 드래그 좌표를 overlay JSON에 저장한다
flowforge는 사용자가 그래프 노드를 드래그한 좌표를 `docs/planning/user-flow/<group>-vN.overlay.json`에 SHALL 저장한다(docs 첫 쓰기). 라우트는 `PUT /api/docs/:project/planning-user-flow/layout`이며, 저장된 좌표는 다음 조회 시 dagre 자동배치보다 우선 적용된다(저장본 우선·빈 곳만 dagre 폴백). 저장은 좌표(LayoutOverlay)만 쓰며 명세(.md)는 건드리지 않는다.

#### Scenario: 좌표 저장 후 재조회 시 반영
- **WHEN** 노드를 드래그하고 `PUT /api/docs/<project>/planning-user-flow/layout`로 좌표를 저장한 뒤 다시 조회한다
- **THEN** `<group>-vN.overlay.json`에 좌표가 기록되고, 재조회 layout에 그 좌표가 포함된다

#### Scenario: overlay 저장은 명세 .md를 변경하지 않는다
- **WHEN** 좌표를 저장한다
- **THEN** `<group>-vN.md`(Mermaid 명세)는 수정·삭제되지 않고, overlay JSON만 쓰인다

### Requirement: 쓰기 라우트의 경로안전·입력검증 불변
docs 첫 쓰기 라우트는 경로 조작과 잘못된 입력을 SHALL 차단한다. project는 기존 `resolveDocsDir` 화이트리스트(`..` 금지)를 거치고, group/version은 파일명 화이트리스트로 검증하며, 저장 body는 `LayoutOverlay` 런타임 검증(`isLayoutOverlay`)을 통과해야 한다. 검증 실패 시 디렉토리 밖이나 비정상 파일을 쓰지 않는다.

#### Scenario: 경로 조작 차단 (읽기·쓰기 모두)
- **WHEN** project/group/version에 `..` 등 경로 조작 문자가 포함된 채로 조회 또는 좌표 저장을 호출한다
- **THEN** 4xx로 차단하고 docs 디렉토리 밖 파일을 읽거나 쓰지 않는다

#### Scenario: 잘못된 layout body 거부
- **WHEN** `PUT .../layout`에 `LayoutOverlay` 형식이 아닌 body(좌표 아닌 값)를 보낸다
- **THEN** `isLayoutOverlay` 검증 실패로 4xx를 반환하고 파일을 쓰지 않는다
