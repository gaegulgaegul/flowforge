## ADDED Requirements

### Requirement: 화면 표시명은 한글로 하되 연결 키는 영문을 유지한다

시스템은 화면에 보이는 표시명만 한글로 변환해야 하며(SHALL), capability·change·라우팅에 쓰이는 키는 영문 슬러그를 그대로 유지해야 한다(SHALL). 표시명을 바꾸는 것이 연결 키를 바꾸지 않는다.

#### Scenario: 표시명 한글화가 연결 키에 영향 없음

- **WHEN** capability 또는 change가 화면에 한글 표시명으로 렌더된다
- **THEN** 연결·라우팅에 사용되는 키는 영문 슬러그를 그대로 유지한다(불변ID·골든테스트 무영향)

### Requirement: capability 한글명은 출처 우선순위로 해석한다

capability 한글 표시명은 출처1(`docs/spec.md`의 `## capability: 키 — 한글` 병기)을 우선 사용하고, 병기가 없으면 출처2(flowforge 내 키→한글 맵)로 폴백해야 한다(SHALL).

#### Scenario: spec.md 한글 병기가 있으면 출처1 사용

- **WHEN** `docs/spec.md`에 `## capability: 키 — 한글` 형태로 한글이 병기돼 있다
- **THEN** 시스템은 그 병기된 한글을 capability 표시명으로 사용한다

#### Scenario: 한글 병기가 없으면 출처2 키맵으로 폴백

- **WHEN** capability에 한글 병기가 없다
- **THEN** 시스템은 flowforge 내 키→한글 맵에서 표시명을 찾아 사용하고, 맵에도 없으면 영문 키를 그대로 표시한다

### Requirement: change 한글명은 proposal 제목을 사용한다

change 한글 표시명은 출처3(`proposal.md`의 사람이 쓴 한글 제목)을 사용해야 한다(SHALL).

#### Scenario: proposal 제목을 change 표시명으로 사용

- **WHEN** change가 목록 또는 5종 뷰에 렌더된다
- **THEN** 시스템은 그 change의 `proposal.md` 한글 제목을 표시명으로 사용한다

#### Scenario: proposal 제목이 없으면 영문 change 키로 폴백

- **WHEN** change에 사람이 쓴 한글 제목이 없다
- **THEN** 시스템은 영문 change 키를 표시명으로 사용한다(빈 표시 금지)

## TDD Plan

- **Red**:
  - `koreanLabels.ts`가 capability 한글명을 출처1→출처2→영문키 폴백 순으로 해석하는지 테스트.
  - change 한글명을 출처3(proposal 제목)→영문키 폴백으로 해석하는지 테스트.
  - 표시명 한글화가 연결 키(영문)를 변경하지 않는지 테스트(키 보존 단언).
- **Green**:
  - `server/src/lib/koreanLabels.ts` — capability(출처1 spec.md 병기 파싱 → 출처2 키맵 폴백), change(출처3 proposal 제목) 해석 함수.
  - `@flowforge/shared` 타입에 `displayName`(한글) 필드 추가하되 `key`(영문)와 분리.
  - 프론트 카드/목록/뷰에서 표시는 `displayName`, 라우팅은 `key` 사용.
- **Refactor**:
  - 출처 우선순위를 명시 상수/enum으로. 해석 로직을 순수 함수로 격리(표시 레이어 외부에서 키 누출 없음).
- **Mock 대상**: 없음(spec.md/proposal.md 픽스처로 실제 파싱 검증). 외부 `*Client`/`*Gateway` 없음.
