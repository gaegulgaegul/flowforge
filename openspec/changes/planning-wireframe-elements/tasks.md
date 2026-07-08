# planning-wireframe-elements — tasks

## Tasks

### Sequential: 요소 파싱 (선행 — screenRegistry additive)

- [ ] 1.1 RED: screenRegistry element 파싱 테스트 — `<!-- element: <kind> "<label>" [-> detail:] [-> screen:] -->` 여러 개·순서 보존·kind 5종·옵션 유무·요소 없음 / 기존 id·label·N:M 링크 무영향
- [ ] 1.2 GREEN: shared `ScreenElement{kind,label,detail?,screen?}` + `ScreenNode.elements?`(additive) + screenRegistry RE_ELEMENT(화면 헤더 컨텍스트 아래, 라인 스캔). 금지: featureTreeBuilder·flowBinder·wireframeBuilder(change)·__golden__

### Sequential: 와이어 빌더 + 라우트

- [ ] 2.1 RED: buildDocsPlanningWireframe 테스트 — 화면→WireScreen·element→WireBox(kind/label)·goto(screen: 해석·없으면 null)·빈 화면=박스 0 / golden 회귀 0
- [ ] 2.2 GREEN: `server/src/parser/planningWireframeBuilder.ts`(planningIaBuilder 병렬 패턴) + `GET /api/docs/:project/planning-wireframe`(resolveDocsDir 재사용)

### Sequential: web + 도그푸딩

- [ ] 3.1 web: api fetchDocsPlanningWireframe + App.tsx 기획 와이어 탭 → 기존 WireframePanel 재사용(신규 컴포넌트·CSS 0), planTabsAvail에 와이어 추가
- [ ] 3.2 docs/planning/features.md 화면 1~2개에 element 도그푸딩(원천 실증 — 예: login/grid 화면에 field·button 요소 + screen/detail 매핑)

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 4.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 390 회귀 0 + 신규, **golden 회귀 0 명시 확인**) → UI 실픽셀(격리 픽스처: element 저작 화면 → 와이어 탭에 박스 렌더·goto·빈 화면·detail 매핑, change 와이어 회귀 0) 전부 PASS
