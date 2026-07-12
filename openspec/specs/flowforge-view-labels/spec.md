# flowforge-view-labels

두 계보에 중복된 "기능명세서" 레이블을 UI에서 구분 가능하게 만드는 능력. planning 계보(`docs/planning/features.md`, openspec-plan 산출)와 change 계보(change의 `specs/<cap>/spec.md`, openspec-propose 산출)가 레이블 또는 안내로 구별된다. 노드 타입은 코드상 이미 분리돼 있으나(`App.tsx:82`의 `specTree` vs `featureTree`) 레이블이 같아 UI에서 혼동됐다.

## ADDED Requirements

### Requirement: 두 계보의 "기능명세서" 레이블이 UI에서 구분된다
change 뷰의 기능명세 탭(`App.tsx:941`)과 planning 뷰의 기능명세 탭(`App.tsx:993`)에 붙은 동일한 "기능명세서" 레이블을, 두 계보가 UI만으로 구별되도록 서로 다른 레이블 또는 계보 안내로 바꿔야 SHALL 한다. planning 계보는 openspec-plan(features.md) 산출, change 계보는 openspec-propose(spec.md) 산출임이 드러나야 한다.

#### Scenario: change 탭과 planning 탭 레이블이 서로 다르다
- **WHEN** change 뷰의 기능명세 탭과 planning 뷰의 기능명세 탭을 나란히 본다
- **THEN** 두 탭의 레이블(또는 부제/툴팁 안내)이 서로 구분돼, 어느 계보의 기능명세인지 UI만으로 식별된다(둘 다 그냥 "기능명세서"로 표기되지 않는다)

#### Scenario: 계보 출처가 드러난다
- **WHEN** 각 기능명세 탭의 레이블/안내를 확인한다
- **THEN** planning 계보(features.md·openspec-plan)와 change 계보(spec.md·openspec-propose)가 레이블 또는 부연 안내로 구분된다

## TDD Plan

- **Red/Green/Refactor**: 레이블 문자열 변경은 web 렌더(단위테스트 없는 영역)이므로 검증 = (1) `App.tsx:941`·`:993` 두 탭 레이블이 서로 다른 문자열임을 grep으로 확인 (2) `docker compose up -d --build` 후 Playwright 실픽셀로 change 뷰·planning 뷰에서 두 기능명세 레이블이 구분돼 보이는지 관찰(grounding). 노드타입 분리(`specTree` vs `featureTree`)는 이미 코드상 되어 있으므로 무변경 확인.
- **Mock 대상**: 없음(레이블 변경 + 산출물 관찰).
