## Tasks

### Sequential: 서버 집계 lib (RED → GREEN, 같은 파일 축)

- [ ] 1.1 RED: `server/src/lib/__tests__/auditSummary.test.ts` 신설 — 임시 픽스처 `<root>/<project>/docs/audit.json`(items[] 포함)로: (a) FAIL≥1 capability→`fail`+fail 건수 (b) PASS+UNVERIFIABLE만→`clean`+unverifiable 건수 (c) 전부 UNVERIFIABLE→`unknown` (d) 파일없음·깨진 JSON·items 비배열→빈 맵(throw 없음) (e) capability·verdict 외 필드 없는 item도 안전. 픽스처 헬퍼는 projects.test의 makeAudit 패턴 차용(raw 본문 지원).
- [ ] 1.2 GREEN: `shared/src/`에 `CapabilityAuditSummary` 타입(`{ status: 'clean'|'fail'|'unknown'; pass: number; fail: number; unverifiable: number; failClaims: { claim: string; reason: string }[] }`) 추가하고, `server/src/lib/auditSummary.ts` 신설 — `aggregateAuditItems(items: unknown): Record<string, CapabilityAuditSummary>`(순수 집계, D-1 규칙) + `readAuditCapabilities(projectDir: string)`(파일 리더, D-3 신뢰 경계·빈 맵 폴백). failClaims는 FAIL 항목의 claim·reason만 수집.

### Sequential: 라우트 (lib GREEN 의존)

- [ ] 2.1 RED: `server/src/routes/__tests__/docs.planning.test.ts`(기존 planning 라우트 테스트 파일)에 `GET /api/docs/:project/audit-capabilities` 통합 테스트 추가 — audit.json 픽스처 프로젝트에서 집계 맵 반환 단언(fail·clean·unknown 3키), audit.json 없는 프로젝트는 빈 맵 200, 존재하지 않는 프로젝트/경로조작(`..`)은 404.
- [ ] 2.2 GREEN: `server/src/routes/docs.ts`에 라우트 추가 — 기존 planning-* 라우트의 프로젝트 해석·404 패턴 재사용(기존 resolveDocsDir/프로젝트 검증 재사용, 새 검증 로직 만들지 않음). 응답 `{ capabilities: Record<string, CapabilityAuditSummary> }`.

### Parallel Group 1 (서버 완료 후 — 서로 다른 파일, 동시 실행 가능)

- [ ] 3.1 web fetch+병합: `web/src/api.ts`에 `fetchAuditCapabilities(project)` 추가, `featureTreeAdapter.ts`에 audit 맵을 요구사항 노드 data에 capability 키 동치로 병합하는 파생 추가(맵 없음/빈 맵이면 배지 데이터 undefined — 기존 path·childRefs 파생과 나란히). App.tsx 기능명세 뷰 로드부에서 planning-features와 병렬 fetch, fetch 실패는 배지 없음 강등(그래프 렌더 유지). [parallel]
- [ ] 3.2 노드 배지 렌더: `web/src/FeatureNode.tsx`에 요구사항 노드 한정 audit 배지(clean→`정합` 초록 / fail→`불합 N` 빨강 / unknown→`미감사` 회색 저채도) + `styles.css` 배지 스타일. 기능·상세기능 노드는 배지 렌더 안 함(D-6). [parallel]

### Sequential: 상세 패널 (배지 데이터 병합 완료 후)

- [ ] 4.1 `web/src/FeatureDetailPanel.tsx`에 audit 섹션 — 판정·PASS/FAIL/검증불가 건수, fail일 때만 failClaims(claim+reason) 텍스트 나열(D-4, dangerouslySetInnerHTML 금지). 감사 데이터 없는 요구사항은 "미감사" 한 줄. 비요구사항 노드는 섹션 자체 생략.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 5.1 VERIFY 전제: openspec-audit을 flowforge에 재실행해 `docs/audit.json`을 최신 저장본으로 갱신(현 저장본은 구버전 2 capability뿐 — 코드 작업 아님, grounding 전제).
- [ ] 5.2 VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(신규 단위·통합 포함, 기존 골든 회귀 0) → UI: 라이브(또는 실데이터 로컬)에서 기획 기능명세 뷰 실픽셀 — 요구사항 노드 배지 3종(정합/불합 또는 미감사) 렌더, 요구사항 노드 클릭→상세 패널 audit 섹션, 기능·상세기능 노드 배지 없음, 콘솔 에러 0 전부 PASS
