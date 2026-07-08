# planning-wireframe-device-frame — tasks

## Tasks

### Sequential: 폐기 코드 정리 (선행 — 구조)

- [x] 1.1 폐기된 element 접근 제거: screenRegistry `<!-- element: -->` 파싱·`RE_ELEMENT`·`ScreenElement`·`ScreenNode.elements?`·`planningWireframeBuilder.ts`·관련 테스트 삭제. features.md의 `<!-- element: -->` 주석 제거(도그푸딩분). 화면목록 `<!-- screen: id -->`·N:M 링크는 유지(다른 뷰가 씀). golden·featureTreeBuilder 무저촉 확인

### Sequential: 데이터 모델 + 픽스처 (선행)

- [ ] 2.1 shared `WireScreen2{id,title,device,regions}` + `WireRegion`(topbar/sidebar/bottombar/body) + `WireBody{layout,elements}` + `WireElement{kind,label,goto?,span?}` 타입. 기존 Wireframe/WireBox는 change 경로용 유지(비파괴)
- [ ] 2.2 픽스처 레이아웃 데이터: 목업 화면 3개(프로젝트 그리드=desktop 상단+사이드+그리드 / 기획뷰=desktop 상단+탭바+본문 / 기능명세=desktop 상단+트리+상세, 모바일 변형 1개)를 WireScreen2 JSON으로. `docs/planning/wireframe/*.json` 또는 서버 내장 샘플. RED: 빌더가 이 픽스처를 WireScreen2로 반환하는 단위 테스트

### Sequential: 라우트 + 렌더러

- [ ] 3.1 GREEN: planning-wireframe 라우트가 WireScreen2[] 반환(픽스처 로드, resolveDocsDir 재사용)
- [ ] 3.2 web `WireframeDeviceFrame.tsx` 신설 — 데스크탑(브라우저 크롬+상단 메뉴+사이드+본문 grid/stack/tree/form)·모바일(폰 프레임+상단+본문+하단바) 렌더, 회색조 로우피델리티(목업 CSS 참조), 요소 goto 클릭 이동, 디바이스 토글. 기획 와이어 탭이 이걸 사용(기존 WireframePanel은 change 경로 유지)

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 4.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(회귀 0 + 신규, **golden 회귀 0 명시**, element 제거로 깨진 테스트 정리) → **UI 실픽셀(라이브: 기획 와이어 탭 → 데스크탑 프레임에 상단/사이드/본문 배치·모바일 프레임에 하단바·요소 클릭 이동·목업과 시각 대조)** 전부 PASS. **목업(wireframe-mockup-deploy)과 나란히 비교해 "세로 목록 아님·화면 배치 맞음" 확인 필수**(방향 재발 방지)
