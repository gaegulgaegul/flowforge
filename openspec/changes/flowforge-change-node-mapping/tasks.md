# Tasks — flowforge-change-node-mapping

> 화면 명세 단일 출처: `prototype.html`(와이어프레임 골격, DESIGN.md 없음). React로 번역 구현.
> web 컴포넌트 테스트 러너 없음(선례 change-entry-unified) → 순수 파생은 server Jest, 노드 배선은 VERIFY 라이브(Playwright)로.

## Tasks

### Sequential Group A: 서버 파생 — 노드↔change 매핑 (선행 필수, 다른 그룹의 입력)

- [x] A.1 (RED→GREEN) server Jest 테스트 — `attachLinkedChanges` 파생 테스트 4건(capabilityIndex.test.ts): (a)연관 change 있으면 linkedChanges 부여, (b)연관 0개면 필드 미부착(비파괴 옵셔널 — 빈 배열이 아니라 undefined), (c)기능/빈 capability 노드·가상 루트엔 미부착, null 트리 안전. 전부 PASS
- [x] A.2 (GREEN) 서버 파생 로직 신설 — `capabilityIndex.ts`에 `attachLinkedChanges(tree, index)` 순수 함수(byCapability 재사용, 요구사항 노드+capability 있고 연관 change>0일 때만 부여). `shared/src/feature-tree-types.ts`에 `linkedChanges?: readonly string[]` 옵셔널 필드 추가(비파괴). `docs.ts` planning-features 라우트에 배선(charter=<dir>/spec.md, changesRoot=<projectRoot>/openspec/changes)
- [x] A.3 (GREEN) 검증 — shared 빌드 0 + server 타입체크 0 + server 테스트 459 passed(파생 4건 포함)

### Parallel Group B: web 파생 — 상속·역경유 (A 완료 후, 서로 다른 파일)

- [x] B.1 [frontend] web adapter 상속 파생 — `featureTreeAdapter.ts`에 `linkedChangesById` 맵으로 각 요구사항의 linkedChanges를 그 서브트리 전체(자신+기능+상세기능)에 상속(:143~151). 조건부 스프레드 부착, undefined면 미부착(:188~190). `FeatureNodeData.linkedChanges?` 필드 추가. 검증: web 타입체크 0 + build 성공
- [x] B.2 [frontend] web IA 화면 역경유 파생 — `iaAdapter.ts`에 순수 함수 3개(`buildDetailLabelsByScreen`·`buildLinkedChangesByDetailLabel`·`buildLinkedChangesByScreenId`)로 화면 id→상세기능→상위 요구사항 linkedChanges 합집합(중복 제거) 파생. `toIAFlow`에 옵션 `changeMapping` 추가, 화면 노드(`n.screenId`)에만 부착. App.tsx 기획 IA effect(:311~331)에서 planningFeatures+planningScreens 전달. `IANodeData.linkedChanges?` 필드 추가. 검증: web 타입체크 0 + build 성공. ※유저플로우 그래프 노드는 화면 id 없어 제외(후속 change)

### Sequential Group C: 노드 렌더 in-place 표시 + 진입 (B 완료 후 — 같은 렌더 파일 순차)

- [x] C.1 (GREEN) 노드에 연관 change 배지 in-place 렌더 — `FeatureNode.tsx` head에 `linkedChanges` 있으면 "change N" 배지(audit 배지 동형, `.feature-tree-change` CSS). 요구사항+상속받은 하위 노드 모두, 연관 0개면 미표시. spec R1·R2·R3 THEN "in-place 표시"
- [x] C.2 (GREEN) change 항목 클릭 → 5종 뷰 진입 배선 — `FeatureDetailPanel`에 "연관 change" 섹션(screens 섹션 동형) 추가, 항목 클릭 시 `onOpenChange(changeKey)`. App.tsx가 `openChangeViews({key,displayName,project:dashProject.name})`로 배선(nodeTypes 외부상수 제약 우회 — 노드는 배지 신호, 진입은 상세 패널). spec R4 THEN "5종 뷰 진입" 액션 구현됨. `.feature-detail-change` CSS
- [x] C.3 (GREEN) 전역 목록 제거 + 죽은 코드 정리 — `dash-changes-section` 블록 제거(spec R1 "전역 통짜 나열 안 됨"). 도달 불가능해진 죽은 코드 정리: `openCapability`·`capabilities` state·`capChanges` 단계 전체·`CapabilityChangeList.tsx`(삭제)·`fetchCapabilities`·관련 CSS(dash-cap/ccl). featureAudit·openChangeViews는 보존. 검증: web 타입체크 0 + build 성공 + server 테스트 459 passed(회귀 없음)

### Parallel Group D: 회귀·엣지 검증 (C 완료 후, 서로 독립)

- [x] D.1 [parallel] 회귀 — 전역 목록 제거 후에도 연관 change 있는 노드에서 5종 뷰 진입 가능(접근성 대체) 확인. planning 5종 뷰·유저플로우 좌표·승인 위저드·핀 피드백 diff 스코프 불변 검증. 정적근거 4/4 PASS: 진입로 CapabilityChangeList→FeatureDetailPanel onOpenChange 대체(App.tsx:1170-1174, FeatureDetailPanel.tsx:209-231), openChangeViews 본문 불변(App.tsx:863-878); views 5종 렌더 블록 미변경(App.tsx:1141-1160); graphAdapter.ts 미변경(유저플로우 좌표 불변, iaAdapter는 IA 화면 노드 data만 추가); 승인위저드·핀피드백 소스 diff 0건. 3-레이어 타입체크 exit 0. 런타임 실동작은 E그룹으로 이월
- [x] D.2 [parallel] 엣지 — capability 없는 프로젝트·change 0개 프로젝트·화면 연결 없는 상세기능·중복 화면 링크에서 크래시 없이 빈 처리 확인. 5/5 PASS, 크래시 지점 없음: capability falsy 가드(capabilityIndex.ts:174), byCapability nullish ??[](:175)·length>0(:176), changesRoot 부재 early return(:73)·catch(:78-79), iaAdapter union.size>0(:102)·3중 중복제거(:53,:67-73,:97-101 Set), null 트리 early return(:170). server jest 14 PASS(항목3·4는 web iaAdapter 단위테스트 부재→코드정독 근거)
- [x] D.3 [parallel] 읽기 전용 확인 — 노드에서 change 편집·추가·삭제 UI가 없는지(spec R4 THEN 읽기 전용) diff/코드 확인. 4/4 PASS: FeatureNode 배지=span·onClick 없음(FeatureNode.tsx:77-84), FeatureDetailPanel 연관 change=button onClick→onOpenChange 진입만·screens 섹션 동형(FeatureDetailPanel.tsx:211-230), web diff에 POST/PUT/DELETE/PATCH/mutation/input/삭제핸들러 추가 0건(api.ts는 순삭제), openChangeViews=setState+history.pushState만(App.tsx:863-878), IA 화면 노드 linkedChanges는 data만·IANode 미렌더·IADetailPanel 편집핸들러 없음

### Sequential Group E: 라이브 반영 + UI 검증

- [x] E.1 `docker compose up -d --build`로 flowforge 라이브 반영(커밋≠라이브). 실측: openspec/changes는 호스트 RO 볼륨 실시간 읽기(`/home/gaegul:/data/docs-root:ro`)라 코드 미변경 시 재빌드 불필요 — 컨테이너가 최신 이미지(5e7681e) 서빙·web/dist에 feature-tree-change 마커 존재·health OK 확인. verify fixture(specs/planning-features-view)도 재빌드 없이 즉시 반영(API linkedChanges 1개 실측)
- [x] E.2 [frontend-agent] gstack(내부 ~/.cache/ms-playwright chromium)로 실픽셀 캡처. (1)planning-features-view 요구사항 노드에만 change 1 배지(e2-badge-on)·미연관 2노드 미표시(e2-badge-off) (2)서브트리 상속 4노드 배지·클리핑 0(e2-inherit·e4-tree-tab, DOM .feature-tree-change=4) (3)IA 역경유는 fixture 화면 미연결→안전한 빈 처리 미표시(e2-ia-screen, spec "연결 상세기능 없으면 미표시" 부합). 본체 직접 관찰(e2-inherit)로 grounding
- [x] E.3 [frontend-agent] gstack로 change 클릭→5종 뷰 진입 실동작. 상세패널 🔗연관 CHANGE(1)→항목 클릭→PRD 탭 활성+URL `?project=flowforge&change=flowforge-change-node-mapping&tab=prd` 정확 일치(e3-detail-panel·e3-open-views·e3-open-views-tabs). 전역 목록 .dash-changes-section DOM 0 매치(e3-no-global-list). 본체 직접 관찰(e3-open-views)로 grounding
- [x] E.4 [frontend-agent] gstack로 탭 조합 회귀. 기획 기능명세 그래프 탭 배지 클리핑/오버레이 0(e4-graph-tab), change 5탭 전부 콘솔 에러 0(e4-change-features-tab), 유저플로우·와이어프레임 회귀 없음(e4-regression-userflow·e4-regression-wireframe). 승인 위저드는 suggestion 큐 비어 미노출(무관). skeleton·views 탭 바 정렬 통일은 D5대로 별도 판단(이 change 미착수)

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] VERIFY: 5단계 게이트 전부 PASS — ①BUILD(shared·server·web tsc+vite build) ②TYPECHECK(3 워크스페이스 exit 0) ③LINT(lint:linkage 위반 0, 기획 cap 11 vs openspec 45 대조) ④TEST(server Jest 39스위트 459 passed, capabilityIndex 파생 포함·회귀 0) ⑤UI(gstack 13장 실픽셀 — 배지 표시/미표시/서브트리 상속 4노드/상세패널 진입/딥링크 URL 정확 일치/읽기전용/전역목록 제거/탭 회귀, 본체 직접 관찰 2장 grounding). ⚠️ UI 배지는 verify fixture(specs/planning-features-view)로 실증 — 실데이터 배지는 후속 change [[flowforge-mapping-basis-shift]]에서 실증(charter→features.md 조인·archive 제외 완화)
