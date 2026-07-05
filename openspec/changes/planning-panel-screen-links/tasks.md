## Tasks

### Sequential: 라우트 (RED → GREEN)

- [ ] 1.1 RED: `server/src/routes/__tests__/docs.planning.test.ts`에 `GET /api/docs/:project/planning-screens` 통합 테스트 — (a) `## 화면목록` 2화면+`<!-- screens: -->` 링크 픽스처에서 `{ screens, links }` 반환 단언 (b) 화면목록 없는 프로젝트 빈 registry 200 (c) 존재하지 않는 프로젝트·경로조작(`..`) 404. 픽스처는 기존 makeFeatures 헬퍼에 화면목록 본문 추가.
- [ ] 1.2 GREEN: `server/src/routes/docs.ts` 라우트 추가 — 기존 planning-* 라우트의 프로젝트 해석·404 패턴 재사용, `buildScreenRegistry(docsDir)` 소비(null이면 빈 `{ screens: [], links: [] }`). 파서 무수정.

### Parallel Group 1 (라우트 완료 후 — 서로 다른 파일, 동시 실행 가능)

- [ ] 2.1 web fetch+파생: `web/src/api.ts`에 `fetchPlanningScreens(project)` 추가, `featureTreeAdapter.ts`에 상세기능 노드 라벨 ↔ `links[].detailLabel` 동치로 `screens: {id,label}[]` 파생(D-2·D-3: label은 registry.screens에서 해석, dangling id는 `label=id` 강등, 링크 없으면 undefined). `FeatureNodeData`에 `screens?` 정식 필드 승격. App.tsx 기능명세 로드부 병렬 fetch 추가, 실패는 필드 없음 강등(D-4). [parallel]
- [ ] 2.2 패널 캐스트 제거: `web/src/FeatureDetailPanel.tsx`의 `(node as { screens?... })` 임시 캐스트를 `node.screens` 정식 필드 참조로 교체 — 렌더 JSX 무변경(이미 완성된 섹션). [parallel]

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 3.1 VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(신규 통합 포함, 기존 회귀 0) → UI: 라이브(또는 실데이터 로컬)에서 기능명세 뷰 실픽셀 — `<!-- screens: -->` 링크 있는 상세기능 클릭→"연결된 화면 (N:M)" 섹션에 화면 label 나열, 링크 없는 상세기능은 섹션 생략, 그래프·기존 패널 필드(audit 포함) 회귀 없음, 콘솔 에러 0 전부 PASS
