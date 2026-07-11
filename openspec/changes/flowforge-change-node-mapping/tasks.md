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

- [ ] C.1 (GREEN) 노드에 연관 change 배지/펼침 in-place 렌더 — `linkedChanges`가 있는 노드에만 change 개수 배지 + 클릭/호버 펼침. 연관 0개 노드엔 미표시(빈 배지·빈 블록 없음). 기존 `dash-cap`/배지 스타일 재사용. spec R1·R2·R3 THEN "in-place 표시"
- [ ] C.2 (GREEN) change 항목 클릭 → 5종 뷰 진입 배선 — 노드에 표시된 change 항목 클릭 시 기존 `openChangeViews(change)` 호출 → views 단계 + PRD 탭 활성. spec R4 THEN "5종 뷰 진입"(액션 — 표시만으론 미완, 이동 배선 필수)
- [ ] C.3 (GREEN) 전역 목록 제거 — skeleton 하단 `dash-changes-section`(change-entry-unified가 추가) 블록 제거. spec R1 "전역 통짜 나열 안 됨". CapabilityChangeList는 노드 펼침으로 재사용 또는 대체

### Parallel Group D: 회귀·엣지 검증 (C 완료 후, 서로 독립)

- [ ] D.1 [parallel] 회귀 — 전역 목록 제거 후에도 연관 change 있는 노드에서 5종 뷰 진입 가능(접근성 대체) 확인. planning 5종 뷰·유저플로우 좌표·승인 위저드·핀 피드백 diff 스코프 불변 검증
- [ ] D.2 [parallel] 엣지 — capability 없는 프로젝트·change 0개 프로젝트·화면 연결 없는 상세기능·중복 화면 링크에서 크래시 없이 빈 처리 확인
- [ ] D.3 [parallel] 읽기 전용 확인 — 노드에서 change 편집·추가·삭제 UI가 없는지(spec R4 THEN 읽기 전용) diff/코드 확인

### Sequential Group E: 라이브 반영 + UI 검증

- [ ] E.1 `docker compose up -d --build`로 flowforge 라이브 반영(커밋≠라이브)
- [ ] E.2 [frontend-agent] Playwright(`~/.cache/ms-playwright`)로 (1)연관 change 있는 노드에만 in-place 표시, (2)연관 없는 노드 미표시, (3)상세기능/화면 역경유 매핑 실픽셀 캡처
- [ ] E.3 [frontend-agent] Playwright로 change 클릭→5종 뷰 진입 + 전역 목록 사라짐 실동작 캡처
- [ ] E.4 [frontend-agent] Playwright로 skeleton·views 단계 탭 UI 불일치 점검(D5 — 통일 여부는 별도 판단). before/after 회귀 없음 확인

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(server Jest 파생 + web 라이브) → UI(프론트 변경 있음 — Playwright 실픽셀) 전부 PASS
