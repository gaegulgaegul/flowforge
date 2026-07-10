## Tasks

> 세 관심사(기능명세 리스트 전환·IA 제거·레이블 구분)는 대체로 서로 다른 파일이라 병렬 가능성이 높다. 단 `App.tsx`는 세 관심사가 모두 손대므로 병렬 편집 시 머지 충돌 주의(같은 파일 다른 영역 — 논리적으로 독립이나 물리적으로 한 파일). IA 제거의 화면 id 골든은 제거 *전/후* 둘 다 green이어야 하므로 골든 확보를 선행한다.

### Sequential: 화면 id 골든 선확보 (IA 제거 전 안전망)
- [ ] IA 제거 전에 `server/src/routes/__tests__/docs.planning.test.ts`의 `planning-screens` 케이스(18-25행 `<!-- screen: home/settings -->` 픽스처, 108-137행)가 green임을 실행 확인 — 화면 id 회귀 기준선(baseline) 확보 [spec: flowforge-ia-removal / "화면 id 파싱이 IA 제거 후에도 동작한다"]

### Parallel Group 1 (독립 관심사 — 서로 다른 파일/영역, 동시 진행 가능)

**A. 기능명세 리스트 렌더 전환** [spec: flowforge-feature-list-view]
- [ ] `web/src/FeatureNode.tsx` 다이어그램 노드를 계층 리스트 항목 렌더로 대체(or 신규 리스트 컴포넌트). 타입 태그·priority/status 뱃지·요구사항 capability 칩·audit 뱃지·상세기능 연결화면 칩·메모/when/then 전부 보존 [parallel] [spec THEN: "뱃지·칩·태그가 리스트 항목에 그대로 표시된다"]
- [ ] `web/src/featureTreeAdapter.ts` — dagre 좌표계산(`rankdir:"LR"`)·RF nodes/edges 생성을 트리 평탄화/재귀 순회 리스트 데이터로 교체하되, 연결화면 조인(`:116-128` `screenRegistry` 병합)은 유지 [parallel] [spec THEN: "상세기능의 연결화면 칩이 화면 레지스트리와 같은 id로 붙는다"]
- [ ] `web/src/App.tsx` — planning 기능명세(`:1031-1043`)·capability drill 기능명세(`:1172-1183`) 두 진입점의 `<ReactFlow>` 기능명세 렌더를 리스트 컴포넌트로 교체(같은 컴포넌트 재사용) [parallel] [spec THEN: "두 진입점 모두 리스트로 전환된다"]

**B. IA 뷰 제거** [spec: flowforge-ia-removal]
- [ ] `web/src/App.tsx` IA 제거 — `Tab`/planTab 유니언 `"ia"`(`:89,105`)·`nodeTypes` `ia: IANode`(`:82`)·상태(`iaNodes/iaEdges/planningIaNodes/planningIaEdges/iaVerbose/selectedIa`)·effect(`:246-252,280-296`)·`onIaNodeClick`(`:368-375`)·`selectIaById`·IA 탭 버튼(change "IA 트리" `:943`, planning "화면 구조" `:994`)·`iaVerbose` 토글(`:975-979`)·IA 렌더 블록(planning `:1047-1067`, change `:1225-1230`)·IADetailPanel 마운트(`:1248-1253`)·`planTabsAvail` ia push(`:915`)·`dash-body--wide` 배열의 `"ia"`(`:989`)·IA import 제거 [parallel] [spec THEN: "change 뷰에 IA 탭이 없다" / "planning 뷰에 화면 구조(IA) 탭이 없다" / "IA 컴포넌트·어댑터·상태·토글이 코드에서 제거된다"]
- [ ] IA web 파일 제거 — `web/src/IANode.tsx`·`web/src/iaAdapter.ts`·`web/src/IADetailPanel.tsx` 삭제, `web/src/api.ts`의 `IAResponse`(`:31-33`)·`fetchIA`(`:127-130`)·`fetchDocsPlanningIa`(`:289-295`) 제거. `web/src/styles.css:68-106`(`.ia-node*`) 제거 — 🔴 `.feature-detail-*`는 존치(FeatureDetailPanel/FlowDetailPanel 공유) [parallel] [spec THEN: "IA 컴포넌트·어댑터·상태·토글이 코드에서 제거된다"]
- [ ] IA 서버 제거 — `server/src/parser/iaBuilder.ts`·`server/src/parser/planningIaBuilder.ts` 삭제, `graph.ts:19` import + `:91-102` `/api/changes/:id/ia` 라우트 제거, `docs.ts:33` import + `:178-196` `/api/docs/:project/planning-ia` 라우트 제거. `shared/src/ia-types.ts` 삭제 + `index.ts:11-14` re-export 제거 [parallel] [spec THEN: "IA 라우트가 더 이상 응답하지 않는다" / "IA 서버 빌더 파일이 제거된다"]
- [ ] IA 테스트 정리 — `server/src/parser/__tests__/planningIaBuilder.test.ts` 삭제, `server/src/routes/__tests__/graphCrossProject.test.ts:67`의 뷰 루프 배열에서 `"ia"` 제거(나머지 케이스 green 유지) [parallel]
- [ ] 🔴 feature→screen 딥링크 안전 처리 — `App.tsx:390-403` `selectScreenInIa`의 IA 딥링크 타깃(`planningIaNodes`)이 사라지므로 핸들러 제거/no-op/상태바 안내로 처리. `onSelectScreen={selectScreenInIa}`(`:1240`) 배선·FeatureDetailPanel 화면 칩(`:53-54,72,186-196`)은 유지(칩 라벨은 화면 레지스트리에서 옴 — 정보 손실 0) [parallel] [spec THEN: "feature→screen 딥링크가 IA 부재로 깨지지 않는다"]

**C. 레이블 계보 구분** [spec: flowforge-view-labels]
- [ ] `web/src/App.tsx` — change 기능명세 탭(`:941`)·planning 기능명세 탭(`:993`)의 "기능명세서" 레이블을 서로 구분되게 변경(예: planning="기획 기능명세", change="명세(change)") 또는 계보 안내(툴팁/부제) 부착 [parallel] [spec THEN: "change 탭과 planning 탭 레이블이 서로 다르다" / "계보 출처가 드러난다"]

### Sequential: 🔴 화면 id 존치 불변식 검증 (IA 제거 직후 필수 게이트)
- [ ] IA 제거 후 `planning-screens` 골든 재실행 — `docs.planning.test.ts`의 `planning-screens` 케이스가 IA 제거 후에도 동일하게 green(화면 id 회귀 0). `screenRegistry.ts`·`/api/docs/:project/planning-screens`·`fetchPlanningScreens`·`shared/src/screen-types.ts` 무변경 확인 [spec THEN: "화면 id 파싱이 IA 제거 후에도 동작한다"]
- [ ] 연결화면 조인 확인 — 기능명세 리스트에서 상세기능 연결화면 칩이 화면 레지스트리와 동일 id로 붙는지 확인(리스트 전환이 조인을 깨지 않음) [spec THEN: "유저플로우·와이어의 화면 id 조인이 유지된다"]

### Sequential: 검증 게이트 (마지막 필수)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 시) 전부 PASS. `docker compose up -d --build`로 라이브 반영 후 Playwright 실픽셀로 (1) 기능명세 리스트 렌더·다이어그램 부재 (2) change·planning 양쪽 IA 탭 부재 (3) 유저플로우·와이어 화면 id 링크 정상 (4) 두 기능명세 레이블 구분을 관찰. 🔴 화면 id 골든 회귀 0 필수(제거 전/후 `planning-screens` green 동일).
