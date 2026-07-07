# cross-project-change-views — tasks

## Tasks

### Sequential: server 해석 경로 (선행)

- [x] 1.1 RED: resolveChangeDir(id, rootDir?) 단위 테스트 — 지정 루트 해석·기본값 현행·`..`/부재 차단
- [x] 1.2 GREEN: changes.ts 시그니처 확장(기본값=changesRoot(), 호출부 무수정) + 프로젝트 화이트리스트 검증 공용화(projects.ts resolveProjectDir 재사용 위치 정리 — 로직 이동만, 동작 무변)

### Sequential: 라우트

- [x] 2.1 RED: 라우트 통합 테스트 — `?project=` 200(픽스처 2프로젝트)·미지정 기존 동작 불변·조작/미지 프로젝트 404
- [x] 2.2 GREEN: graph.ts 6 GET+1 PUT에 optional project 처리(검증 실패 404, 부재=글로벌 루트)

### Sequential: web 배선

- [ ] 3.1 ChangeSummary.project?(additive, server capability detail 응답에 세팅) + api.ts 5 fetcher·saveLayout에 옵션 project 부착 + App.tsx openChangeViews가 dashProject 전달(뷰 로딩 effect·layout 저장 포함), RO 저장 실패 상태바 안내
- [ ] 3.2 기존 진입 경로(프로젝트 컨텍스트 없음) 회귀 없음 확인 — project 미부착 시 현행 URL 그대로

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 4.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 336 회귀 0 + 신규) → UI 실픽셀(격리 픽스처: 타 프로젝트 change 클릭→5종 뷰 렌더·404 없음, 기존 flowforge change 회귀 없음) 전부 PASS
