# Tasks — flowforge-screen-crosslink

> 화면 id를 조인키로 유저플로우 노드 ↔ 와이어 ↔ 기능명세를 상호참조. 피드백9(와이어)+피드백12(기능) 동시 해소. 읽기 상호참조만(편집 제외).

## Sequential Group A: 조인키(바레 화면 id) 확보 — 선행 필수 (D1 안A)

- [ ] A.1 (RED) `server/src/parser/__tests__/planningUserFlowBuilder.test.ts`에 케이스 추가 — mermaid `["텍스트"]` 화면(page) 노드에 바레 `screenId`(mermaidId 소문자)가 실리고, 화면 아닌 노드(시작 `([..])`·섹션 `((..))`·행동 `{..}`)엔 `screenId`가 없음(undefined) 검사 → 현재 실패 확인
- [ ] A.2 `shared/src/graph-types.ts` `GraphNode`에 옵셔널 `screenId?: string` 추가(비파괴 — change/골든 경로는 undefined) + `shared/src/index.ts` export 무변경 확인
- [ ] A.3 (GREEN) `server/src/parser/planningUserFlowBuilder.ts`에서 화면(page) 종류 노드에 `screenId`(mermaidId 소문자 = 바레 화면 id) 파생 부여 → A.1 통과. 화면 아닌 노드는 미부여
- [ ] A.4 `web/src/graphAdapter.ts` `SpecNodeData`에 `screenId?: string` 추가 + 서버 노드의 `screenId`를 통과(exactOptionalPropertyTypes: undefined면 키 생략, 기존 seed 패턴 `graphAdapter.ts:123` 준수)

## Parallel Group B: 조인 헬퍼 (A 완료 후, 서로 다른 파일 — 동시 실행)

- [ ] B.1 [parallel] (RED→GREEN) 화면→상세기능 역인덱스 순수 헬퍼 신규(`web/src`) + 테스트 — `screenRegistry.links`(`ScreenLink{detailLabel,screenIds}`) → `Map<screenId, detailLabel[]>` 역인덱싱. 케이스: 정상 N:M·화면 id 매칭 0개→빈배열·같은 화면 여러 상세기능·빈 링크. (D2)
- [ ] B.2 [parallel] (RED→GREEN) 화면→와이어 lookup 순수 헬퍼 신규(`web/src`) + 테스트 — `WireScreen2[]` → `Map<id, WireScreen2>`, screenId로 조회(있음/없음/dangling→undefined). (D3)

## Sequential Group C: 상세 패널 상호참조 UI (B 완료 후 — 같은 FlowDetailPanel.tsx)

- [ ] C.1 (RED) `web/src/__tests__` FlowDetailPanel 렌더 테스트 — 화면 노드(screenId 있음)+와이어 있음 → 연관 와이어 섹션(`WireframeDeviceFrame` 프리뷰) 렌더 / 연관 상세기능 목록 렌더. 화면 아님 노드 → 두 섹션 미노출. 연결 0개 → 빈 상태. dangling → 빈 상태 크래시 없음
- [ ] C.2 (GREEN) `web/src/FlowDetailPanel.tsx` 확장 — `kind==="screen"`일 때만 흐름 섹션 뒤에 "🖥️ 연관 와이어프레임"(`WireframeDeviceFrame` 프리뷰 재사용 + wire 탭 열기 콜백)·"📋 연관 기능명세"(상세기능 라벨 칩, spec 딥링크 선택) 섹션 추가. 데이터는 props 주입만(패널은 조인 안 함 — `FlowDetailPanel.tsx:8` 원칙 유지). 빈 상태는 `feature-detail-empty` 재사용
- [ ] C.3 (GREEN) `web/src/App.tsx` 배선 — 선택된 유저플로우 노드의 `screenId`로 `planningWireScreens`(`:164`) lookup(B.2) + `planningScreens`(screenRegistry `:139`) 역인덱스(B.1)를 조인해 `wireForScreen`·`featuresForScreen`를 계산, `FlowDetailPanel`에 전달. IA `selectScreenInIa`(`:390-403`) 매칭 규칙과 정합

## Parallel Group D: 딥링크/전환 연동 (C 완료 후, 서로 독립)

- [ ] D.1 [parallel] "wire 탭에서 열기" 콜백 배선 — 딥링크 유틸(`flowforge-deeplink-url`) 있으면 `?...&tab=wire` 딥링크 재사용, 없으면 `setTab("wire")` 인앱 전환 폴백(D5). 강결합 금지
- [ ] D.2 [parallel] 연관 상세기능 칩 클릭 → spec 탭 딥링크(선택) 또는 라벨 식별만 — 라벨 표시는 필수, 딥링크는 있으면 연결

## Parallel Group E: 회귀·엣지 검증 (C 완료 후, 서로 독립)

- [ ] E.1 [parallel] 회귀 — 화면 아닌 노드(시작·섹션·행동) 선택 시 기존 흐름 섹션만 렌더(상호참조 섹션 미노출), 기존 `FlowDetailPanel` 동작 diff 스코프 불변 확인
- [ ] E.2 [parallel] 엣지 — 화면 id 매칭 0개(와이어도 상세기능도 없음)에서 빈 상태 안내 + 크래시 없음
- [ ] E.3 [parallel] 엣지 — dangling 화면 id(레지스트리·와이어 어디에도 없음)에서 id 숨기지 않고 빈 상태 렌더, 크래시 없음

## Sequential Group F: 라이브 반영 + 검증 게이트 (마지막 필수)

- [ ] F.1 `docker compose up -d --build`로 flowforge 라이브 반영(커밋≠라이브, `reference_flowforge_deploy`)
- [ ] F.2 static-first 게이트(`reference_verify_static_first_gate`) — 화면 id 조인 헬퍼·`screenId` 파생·패널 섹션이 실제 코드에 있는지 grep으로 확인("미구현≠SKIP")
- [ ] F.3 Playwright(`~/.cache/ms-playwright`) 실픽셀 — 화면(page) 노드 클릭 → 연관 와이어 프리뷰 렌더 + 연관 상세기능 목록 렌더 실관찰(spec THEN 대응). 화면 아님/연결 0개/dangling 3케이스 빈 상태·무크래시 실관찰. 검증 서버는 PID 지정 kill
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(shared·server 파서·web 헬퍼/패널 신규 포함) → UI(프론트 변경 — Playwright 실픽셀: 화면 노드→연관 와이어+연관 기능 표시, 흐름 섹션 병존, 화면 아님/0개/dangling 빈 상태를 실제 클릭+관찰) 전부 PASS
