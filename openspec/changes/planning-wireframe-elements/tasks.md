# planning-wireframe-elements — tasks

## Tasks

### Sequential: 요소 파싱 (선행 — screenRegistry additive)

- [x] 1.1 RED: screenRegistry element 파싱 테스트 — `<!-- element: <kind> "<label>" [-> detail:] [-> screen:] -->` 여러 개·순서 보존·kind 5종·옵션 유무·요소 없음 / 기존 id·label·N:M 링크 무영향
- [x] 1.2 GREEN: shared `ScreenElement{kind,label,detail?,screen?}` + `ScreenNode.elements?`(additive) + screenRegistry RE_ELEMENT(화면 헤더 컨텍스트 아래, 라인 스캔). 금지: featureTreeBuilder·flowBinder·wireframeBuilder(change)·__golden__

### Sequential: 와이어 빌더 + 라우트

- [x] 2.1 RED: buildDocsPlanningWireframe 테스트 — 화면→WireScreen·element→WireBox(kind/label)·goto(screen: 해석·없으면 null)·빈 화면=박스 0 / golden 회귀 0
- [x] 2.2 GREEN: `server/src/parser/planningWireframeBuilder.ts`(planningIaBuilder 병렬 패턴) + `GET /api/docs/:project/planning-wireframe`(resolveDocsDir 재사용)

### Sequential: web + 도그푸딩

- [x] 3.1 web: api fetchDocsPlanningWireframe + App.tsx 기획 와이어 탭 → 기존 WireframePanel 재사용(신규 컴포넌트·CSS 0), planTabsAvail에 와이어 추가
- [x] 3.2 docs/planning/features.md 화면 3개(grid/skeleton/features)에 element 도그푸딩 — header/list/button/field/empty 5종 실사용 + screen: 이동(grid→skeleton, skeleton→features) + detail: 매핑(features→"planning-features 라우트 조회"). flowforge 실제 화면 기준(지어내지 않음).

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] 4.1 VERIFY: 5단계 게이트 — 빌드(shared/server/web EXIT 0) → 타입체크(strict tsc) → 린트(러너 미구성 --if-present) → 테스트(400/400, 기존 390+요소파싱/빌더 신규 10, 회귀 0, **golden.test.ts PASS 명시 확인**) → **UI 실픽셀(라이브 flowforge.gaegul.house)**: 기획 와이어 탭 뜸·3화면 프레임(grid 3박스·skeleton 2박스·features 3박스)·박스 5종 렌더(제목/목록/버튼/입력·표시/빈 상태)·goto 있는 박스에 ▶ 화살표·콘솔 에러 0. planning-wireframe API에 요소 실재+goto(screen-skeleton/screen-features) 해석 확인. change 경로 와이어·골든 무저촉.
