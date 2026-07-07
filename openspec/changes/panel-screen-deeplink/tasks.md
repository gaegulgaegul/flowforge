# panel-screen-deeplink — tasks

## Tasks

### Sequential: 데이터 경로 (선행)

- [ ] 1.1 RED: planningIaBuilder 단위 테스트 — 화면 노드에 원본 `screenId` 세팅(상세기능 노드엔 없음)
- [ ] 1.2 GREEN: shared `IANode.screenId?: string`(additive) + planningIaBuilder 화면 노드 세팅 + iaAdapter가 노드 data로 전달

### Sequential: UI 배선

- [ ] 2.1 FeatureDetailPanel: 화면 칩 `<span>`→`<button>` + `onSelectScreen?: (id: string) => void` prop (기존 자식 노드 버튼 패턴·클래스 재사용, hover 커서만 CSS 추가)
- [ ] 2.2 App.tsx: 핸들러 — planningIaNodes에서 `data.screenId` 문자열 동치 매칭 → 성공 시 setPlanTab("ia")+setSelectedIa(+기능명세 패널 닫기), 실패 시 상태바 안내만(탭 전환 없음)

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 3.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 333 회귀 0 + 빌더 신규) → UI 실픽셀(격리 픽스처: 칩 클릭→IA 탭+노드 선택, 불일치 id→안내만, 무링크 상세기능 회귀 없음) 전부 PASS
