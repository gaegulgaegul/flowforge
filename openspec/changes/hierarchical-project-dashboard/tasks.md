## Tasks

### Sequential: 공유타입 기초 (선행 필수 — 백엔드·프론트 모두 의존)

- [x] 1.1 RED: `@flowforge/shared` 타입 테스트 — `ProjectCard`(name·displayName·hasCharter·changeCount·auditStatus), `CapabilityNode`(key·koreanLabel·changeKeys[]), `CapabilityChangeLink`(capabilityKey·changeKey·linked) 형태 단언
- [x] 1.2 GREEN: `@flowforge/shared`에 위 타입 추가 (영문 `key`와 한글 `displayName` 분리 — korean-display-labels "연결 키 영문 유지" 충족). 기존 타입 비파괴(옵셔널 추가만)

### Parallel Group 1 (독립 - 서로 다른 파일, 동시 실행 가능)

- [ ] 2.1 RED: `server/src/lib/projects.ts` 테스트 작성 [parallel] — 픽스처 디렉토리로 (a)change 있는 프로젝트 전부 반환 (b)charter 없는 프로젝트도 포함 (c)각 항목에 hasCharter·changeCount·auditStatus·displayName 채움 검증
- [ ] 2.2 RED: `server/src/lib/capabilityIndex.ts` 테스트 작성 [parallel] — (a)`specs/<X>/` 디렉토리명 == `## capability: <X>` 글자단위 일치 시 연결 (b)유사하지만 다른 이름은 **비연결**(거짓연결 0) (c)미연결 change는 "미연결"로 분류(누락 아님). charter `## capability:` 읽기전용 정규식(RE_CAP 동치)
- [x] 2.3 RED: `server/src/lib/koreanLabels.ts` 테스트 작성 [parallel] — (a)capability 한글명 출처1(spec.md `키 — 한글` 병기)→출처2(키맵)→영문키 폴백 (b)change 한글명 출처3(proposal 제목)→영문키 폴백 (c)표시명 한글화가 영문 연결 키 불변

### Parallel Group 2 (Group 1 RED 후 - 서로 다른 파일, 동시 실행 가능)

- [ ] 3.1 GREEN: `server/src/lib/projects.ts` 구현 [parallel] — 홈서버 디렉토리 스캔(change 유무·docs/ 유무·change 개수·정적 audit 집계), `changes.ts`/`docs.ts` 패턴 차용. 실패 시 추측 수정 금지·근본원인부터
- [ ] 3.2 GREEN: `server/src/lib/capabilityIndex.ts` 구현 [parallel] — `## capability:` 읽기전용 정규식 포팅 + `specs/` 디렉토리명 set 멤버십 역방향 인덱스(`capabilityKey→change[]`) + 미연결 분류. 실패 시 근본원인부터
- [x] 3.3 GREEN: `server/src/lib/koreanLabels.ts` 구현 [parallel] — capability(출처1 spec.md 병기 파싱→출처2 키맵 폴백→영문키), change(출처3 proposal 제목→영문키) 해석 순수 함수. 실패 시 근본원인부터

### Sequential: 라우트 통합 (Group 2 산출물 의존 — 한 파일에 합류)

- [ ] 4.1 RED: `server/src/routes/projects.ts` 테스트 작성 — `/api/projects`(카드 그리드, 단일 change로 곧장 안 들어감), `/api/projects/:project/capabilities`(뼈대 capability + 한글명), `/api/projects/:project/capabilities/:cap/changes`(그 capability의 change만, change 0개면 빈 상태) 응답 검증
- [ ] 4.2 GREEN: `server/src/routes/projects.ts` 구현 — 위 3 라우트를 projects/capabilityIndex/koreanLabels 합성으로 제공. 기존 `/api/changes/*`·`/api/docs/*`·`graph.ts`는 **무손상**(import만, 수정 0)
- [ ] 4.3 GREEN: 라우트 등록 — 서버 진입점에 `/api/projects` 라우터 마운트(기존 라우터 등록부 비파괴 추가)

### Parallel Group 3 (백엔드 API 완료 후 - 서로 다른 컴포넌트 파일, 동시 실행 가능)

- [ ] 5.1 GREEN: `web/src/ProjectGrid.tsx` 작성 [parallel] [frontend] — 카드 그리드 렌더(charter 유무·change 개수·audit 배지·한글 표시명), **charter 있는 카드 클릭→뼈대 그래프 이동 / charter 없는 카드 클릭→change 목록 이동**(spec project-card-grid THEN 액션 직접 구현)
- [ ] 5.2 GREEN: `web/src/CapabilityChangeList.tsx` 작성 [parallel] [frontend] — capability별 change 목록 렌더(한글 제목), **change 클릭→기존 5종 뷰(`prd|spec|flow|ia|wire` 탭) 이동**, change 0개 capability는 빈 상태 표시(spec capability-change-navigation THEN 액션 직접 구현)
- [ ] 5.3 GREEN: `web/src/api.ts`에 fetch 함수 추가 [parallel] [frontend] — `/api/projects`, `/api/projects/:p/capabilities`, `/api/projects/:p/capabilities/:c/changes` 호출 함수

### Sequential: 네비게이션 셸 통합 (위 컴포넌트들 합류 — App.tsx 단일 파일)

- [ ] 6.1 GREEN: `web/src/App.tsx` 라우팅 셸 — 4단(grid→skeleton 뼈대그래프→capability-changes→기존 5종뷰) 상태머신. **capability 노드 클릭→그 capability의 change 목록 이동**(뼈대 그래프 측 핸들러 배선), charter 없는 프로젝트는 grid→capability-changes 단축(뼈대 스킵)
- [ ] 6.2 GREEN: 브레드크럼 + 뒤로가기 — **브레드크럼 상위 항목 클릭→해당 상위 단계 이동**, **뒤로가기→히스토리 직전 단계 복귀**(spec capability-change-navigation THEN 액션 직접 구현). 기존 단일-change 직접 진입(URL) 하위호환 유지
- [ ] 6.3 GREEN: 표시/라우팅 분리 적용 — 모든 카드·목록·뷰에서 표시는 `displayName`(한글), 라우팅·연결은 `key`(영문) 사용(korean-display-labels THEN "연결 키 영문 유지" 충족)

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 7.1 VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 있음: 프로젝트 1개[flowforge 또는 ssoksok]로 DOCS_ROOT 서버 띄워 [카드 그리드→프로젝트 클릭→뼈대 그래프(한글)→capability 클릭→change 목록→change 클릭→5종 뷰] 세로 한 줄을 브라우저로 직접 관통 관찰 + 거짓연결 0·미연결 명시표시·브레드크럼/뒤로가기·기존 5종뷰 무손상 확인) 전부 PASS
