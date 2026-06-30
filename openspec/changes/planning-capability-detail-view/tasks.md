## Tasks

### Sequential: 종합 뷰모델 타입 (선행 필수)
- [x] shared/src/dashboard-types.ts에 `CapabilityDetail` 타입 추가 — `{ key, koreanLabel, features: FeatureTree | null, userFlows: string[], changes: ChangeSummary[] }`. 미사용 `CapabilityNode`는 정리/주석. shared 배럴 export(index.ts) 반영. (기존 FeatureTree/ChangeSummary 재사용)

### Parallel Group 1 (RED — 독립, 동시 실행 가능: 서로 다른 테스트 파일)
- [x] RED: `server/src/lib/__tests__/capabilityIndex.test.ts`에 `buildCapabilityDetail` 테스트 추가 [parallel] — (a)features 서브트리가 일치 capability 가지만 (b)유저플로우가 `> capability:` 마커로만 연결 (c)changes가 byCapability와 동일 (d)연결0이면 빈 구조. 임시 디렉토리 픽스처(makeChange + features.md + user-flow/*.md 작성).
- [x] RED: `server/src/routes/__tests__/projects.test.ts`에 `GET /api/projects/:project/capabilities/:cap` 테스트 추가 [parallel] — 200 구조(key/features/userFlows/changes)·경로조작 4xx·비프로젝트 4xx. supertest + PROJECTS_ROOT 임시 픽스처.

### Sequential: 통합 GREEN (라우트가 함수에 의존 — 순차)
- [ ] GREEN: `server/src/lib/capabilityIndex.ts`에 `buildCapabilityDetail(cap, charterCaps, changesRoot, featureTree, userFlowMarkers)` 순수 함수 구현 — byCapability 재사용, featureTree에서 capability 일치 가지 필터, 주입된 userFlow 마커 맵에서 일치 stem 추출. 글자단위 정확 비교(거짓연결0).
- [ ] GREEN: `server/src/routes/projects.ts`에 `GET /api/projects/:project/capabilities/:cap` 라우트 — resolveProjectDir/indexFor/safe() 재사용. docsDir에서 buildDocsPlanningFeatures + listDocsUserFlows·readDocsUserFlowSpec로 `> capability:` 마커 스캔해 buildCapabilityDetail에 주입. (유저플로우 마커 스캔 경량 헬퍼는 라우트/lib에 최소 구현)

### Sequential: web 통합 (백엔드 완료 후 — api→App 의존, 순차)
- [ ] web/src/api.ts에 `fetchCapabilityDetail(project, cap)` 클라이언트 함수 추가 + CapabilityDetail 타입 import.
- [ ] web/src/App.tsx `openCapability`에서 fetchCapabilityDetail 호출, `capChanges` 단계 렌더를 확장 — features ReactFlow(featureTreeAdapter 재사용) + 유저플로우 목록/링크 + CapabilityChangeList를 한 화면에 co-locate. 빈 섹션은 "연결된 항목 없음" 명시. change 클릭→기존 5종 뷰 진입 보존. dashReqToken race가드 유지. nodeTypes 상수 컴포넌트 밖.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(회귀 포함) → UI(Playwright 실픽셀: capability 클릭→통합 화면에 features+유저플로우+change 목록 co-locate 관찰, change 클릭→5종 뷰 진입, 콘솔에러0) 전부 PASS
