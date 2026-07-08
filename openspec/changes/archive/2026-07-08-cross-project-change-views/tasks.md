# cross-project-change-views — tasks

## Tasks

### Sequential: server 해석 경로 (선행)

- [x] 1.1 RED: resolveChangeDir(id, rootDir?) 단위 테스트 — 지정 루트 해석·기본값 현행·`..`/부재 차단
- [x] 1.2 GREEN: changes.ts 시그니처 확장(기본값=changesRoot(), 호출부 무수정) + 프로젝트 화이트리스트 검증 공용화(projects.ts resolveProjectDir 재사용 위치 정리 — 로직 이동만, 동작 무변)

### Sequential: 라우트

- [x] 2.1 RED: 라우트 통합 테스트 — `?project=` 200(픽스처 2프로젝트)·미지정 기존 동작 불변·조작/미지 프로젝트 404
- [x] 2.2 GREEN: graph.ts 6 GET+1 PUT에 optional project 처리(검증 실패 404, 부재=글로벌 루트)

### Sequential: web 배선

- [x] 3.1 ChangeSummary.project?(additive, server capability detail 응답에 세팅) + api.ts 5 fetcher·saveLayout에 옵션 project 부착 + App.tsx openChangeViews가 dashProject 전달(뷰 로딩 effect·layout 저장 포함), RO 저장 실패 상태바 안내
- [x] 3.2 기존 진입 경로(프로젝트 컨텍스트 없음) 회귀 없음 확인 — project 미부착 시 현행 URL 그대로
  - 근거: api.ts withProject()가 project 부재 시 원본 URL 그대로 반환(코드), 라우트 통합 테스트가 "미지정=기존 동작 불변" 커버, 실브라우저에서 flowforge 카드 진입 정상(회귀 0).
- [x] 3.3 (본체 추가 — 스코프 내 필수 발견) 기획문서 없는 프로젝트의 skeleton 빈 화면 해소: `{false&&}` 뼈대 목록을 `planTabsAvail.length===0` 조건부 복구 + 라벨 "change 목록 (capability별)"로 정직화 — 이 목록이 없으면 wowa-app류 프로젝트는 change 뷰로 가는 진입로 자체가 없어 이 change의 시나리오가 UI 도달 불가(기존 결함, 라이브 대조로 회귀 아님 확인). 2026-07-03 비활성 결정의 취지(기획 그래프 중복·라벨 오류)는 조건·라벨로 존중.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] 4.1 VERIFY: 5단계 게이트 — 빌드 → 타입체크 → 린트 → 테스트(기존 336 회귀 0 + 신규) → UI 실픽셀(격리 픽스처: 타 프로젝트 change 클릭→5종 뷰 렌더·404 없음, 기존 flowforge change 회귀 없음) 전부 PASS
  - 빌드: shared/server(tsc)/web(vite) EXIT 0. 타입체크: strict tsc 포함. 린트: 러너 미구성(--if-present, 기존 동일). 테스트: 346/346(기존 336+신규 10, 회귀 0). UI 실픽셀(실브라우저, PROJECTS_ROOT=/home/gaegul): wowa-app 카드→capability 목록→implement-ios-app→PRD 렌더+5종 탭 순회, /api/changes/* 4xx 0건 · flowforge 카드 회귀 0 · 콘솔 에러=타 프로젝트 planning 문서 부재 404(무해 강등)뿐.
