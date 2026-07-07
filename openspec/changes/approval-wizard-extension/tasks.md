# approval-wizard-extension — tasks

## Tasks

### Sequential: 구조 (동작 무변경 — 분리 커밋)

- [ ] 1.1 shared `prd-wizard-state.ts` → `wizard-state.ts` rename + import 2곳 갱신 — 기존 단위 테스트 16건 GREEN 유지(내용 무변)
- [ ] 1.2 공용 셸 `ApprovalWizard` 추출 — PrdApprovalWizard의 골격(배너·진행바+결정 점·3버튼·탈출구·요약·localStorage 체크포인트 IO·appliedTick 리셋)을 render prop(카드 렌더러) 방식으로 일반화, PRD를 셸로 마이그레이션. **PRD 동작·픽셀 무변이 게이트**(체크포인트 키 `prd-wizard:<project>` 유지)

### Parallel Group 1 (패널별 위저드 — 서로 다른 파일, 동시 실행 가능)

- [ ] 2.1 features 위저드: 카드 렌더러(nodePath 경로 + 속성 before/after 화살표 — 기존 FeatureApprovalPanel 카드 마크업 이식), App.tsx 배선(featAppliedTick·openProject 리셋·반영 0건 안내), 기존 FeatureApprovalPanel.tsx 삭제 [parallel]
- [ ] 2.2 userflow 위저드: 카드 렌더러(에지 실선/점선·신규 화면 뱃지 이식), App.tsx 배선(uflowAppliedTick·stem별 key 리마운트·stem 전환 리셋·반영 0건 안내), 체크포인트 키 `uflow-wizard:<project>:<stem>`, 기존 UserFlowApprovalPanel.tsx 삭제 [parallel]

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 3.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 333 회귀 0) → UI 실픽셀(격리 픽스처: ①PRD 위저드 동작 무변(진입·skip 재등장·재진입 복원) ②features 위저드 전 경로 ③userflow 위저드 전 경로+stem 격리) 전부 PASS
