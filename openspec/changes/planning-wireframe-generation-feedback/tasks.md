# Tasks — planning-wireframe-generation-feedback

> A안 파일 릴레이 / B형 화면별 재생성. AI 생성 로직 자체는 flowforge 밖(스킬) — 이 change는 flowforge 측 계약·큐·피드백 write·UI·렌더 배선만 구현한다.

## Tasks

### Sequential: 타입·스키마 기초 (선행 필수)
- [ ] RED: 와이어 제안 아이템 타입 + 피드백 아이템 타입 스키마 가드 테스트 작성 (`WireScreen2` 유효성: device∈{desktop,mobile}, body layout∈{grid,stack,tree,form}, 요소 kind 8종)
- [ ] GREEN: shared에 와이어 제안 아이템 타입(`wire-suggestion-types.ts`: id·screenId·layout:WireScreen2·rationale?) + 피드백 아이템 타입(screenId·text·ts) 정의 (기존 `feature-suggestion-types.ts` 패턴 재사용)

### Parallel Group 1 (독립 - 서로 다른 lib 파일, 동시 실행 가능)
- [ ] RED: 큐 read 안전폴백 테스트 — 파일부재 빈큐 200·깨진JSON 필터·id dedup·스키마위반 필터 [parallel]
- [ ] RED: apply 테스트 — 승인분만 반영·반려 큐제거·self-roundtrip 422·skipped 표면화·queuePruneFailed·배치상한200 [parallel]
- [ ] RED: feedback write 테스트 — 화면 append(screenId·text·ts)·빈텍스트 거부·미존재 화면 방어 [parallel]

### Parallel Group 2 (서버 lib 구현 - 서로 다른 함수/파일, 동시 실행 가능)
- [ ] GREEN: `readDocsWireframeSuggestions(docsDir)` — 큐 read, throw금지, dedup (`readDocsFeatureSuggestions` 원형 복제) [parallel]
- [ ] GREEN: `applyWireframeSuggestions(docsDir, req)` + `wireframeInvariantHolds` — 승인분 반영·self-roundtrip 방어 (`applyFeatureSuggestions` 원형 복제) [parallel]
- [ ] GREEN: `appendWireframeFeedback(docsDir, {screenId,text})` — feedback 사이드카 append (사람→파일 방향, 컨테이너 write 볼륨 확인) [parallel]

### Sequential: 원천 교체 (apply 산출물에 의존)
- [ ] GREEN: `buildDocsPlanningWireframe2`를 고정 픽스처 반환에서 **승인분 반환**으로 교체 (1단계 렌더러·라우트·web 무변경, `WireScreen2[]` 계약 유지)
- [ ] GREEN: 라우트 배선 — `GET/POST .../planning-wireframe-suggestions`(+/apply), `POST .../planning-wireframe-feedback` (`docs.ts`에 features/userflow 라우트 패턴 복제, apply body는 `isPrdApplyRequest` 재사용)

### Parallel Group 3 (웹 - 서버 API 완료 후, 서로 다른 컴포넌트, 동시 실행 가능)
- [ ] GREEN: 화면별 피드백 입력 컴포넌트 — 각 화면에 자유텍스트 textarea + 제출→feedback write. 제출 후 "접수됨" 표시 [parallel] [frontend]
- [ ] GREEN: 와이어 승인 위저드 — `ApprovalWizard` 셸 재사용, renderCard에 `WireframeDeviceFrame`으로 제안 화면 미리보기, 승인/반려→apply [parallel] [frontend]
- [ ] GREEN: 와이어 탭 배선 — App.tsx에서 제안큐 fetch·승인 위저드·피드백 입력·재조회(그 화면만 갱신 반영) 연결 [parallel] [frontend]

### Sequential: 정합 검증
- [ ] GREEN: "그 화면만 재생성 반영" 격리 확인 — 재조회 시 피드백 남긴 화면만 갱신, 타 화면 승인분 불변 (재생성분은 큐 갱신 픽스처로 시뮬레이션)
- [ ] REFACTOR: 큐 read/apply·self-roundtrip·위저드 셸 재사용 정리 (features/userflow와 중복 최소화), 구조 변경 커밋 분리

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 있음: 피드백 입력·승인 위저드·와이어 탭 라이브 실픽셀) 전부 PASS. 골든 회귀 0 확인.
