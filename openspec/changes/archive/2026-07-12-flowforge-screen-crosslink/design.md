# Design — flowforge-screen-crosslink

> Phase 4 — 화면(page) id를 허브로 산출물을 상호연결한다. 유저플로우 노드를 선택하면 흐름(전이)만이 아니라, 그 화면에 대응하는 **와이어프레임**과 그 화면에 연관된 **기능명세 상세기능**을 같은 상세 패널에서 상호참조로 보게 한다. 피드백9(와이어 안 보임)+피드백12(기능 연관 안 보임)를 한 뿌리(화면 id 조인 부재)에서 해결한다.

## 배경 / 위치

flowforge는 산출물을 각각 별도 탭으로만 보여준다(`web/src/App.tsx` `tab ∈ prd|spec|flow|ia|wire`). 유저플로우 노드를 클릭하면 `FlowDetailPanel`(`web/src/FlowDetailPanel.tsx`)이 뜨는데, 표시하는 건 **나가는/들어오는 흐름(전이)뿐**이다(`SpecNodeData.incoming`/`outgoing`, `graphAdapter.ts:22-31`). 화면(page) 노드여도 그 화면의 와이어나 연관 기능으로 이어지는 통로가 없다.

데이터 정합은 이미 있다:
- **화면 id 공유(조인키 존재)**: 유저플로우·IA·와이어가 같은 화면 id를 쓴다(`shared/src/wire-screen2-types.ts:61` "안정 식별자(화면목록 `<!-- screen: id -->`와 공유 — 유저플로우·IA와 정합)", `planningWireframeFixture.ts:5-6`: grid·skeleton·features가 유저플로우·IA와 같은 id). 원천 = `features.md` 화면목록(`screenRegistry.ts`).
- **상세기능↔화면 링크(정방향 파생됨)**: `featureTreeAdapter.ts:124-128`이 `screenRegistry.links`(`ScreenLink{detailLabel, screenIds}`)로 상세기능 노드에 `screens`(연결화면)를 이미 파생한다. 역방향(화면 id → 상세기능들)만 없다.
- **IA의 화면 딥링크 선례**: 기능명세 상세 패널은 연결화면 칩 클릭 → IA의 그 화면 노드로 딥링크한다(`FeatureDetailPanel` `onSelectScreen` → `App.tsx:390-403` `selectScreenInIa`, `iaAdapter.ts:28` `screenId` 문자열 동치 매칭). 이 패턴을 유저플로우에도 대칭 적용한다.

부재 확정(조사): `App.tsx`에 wireframe↔flow 조인 0건, `FlowDetailPanel`에 screen/wire 참조 0건.

## 핵심 난점: 유저플로우 노드 id ≠ 바레 화면 id

유저플로우 `GraphNode.id`는 `uflow-<slug>-<mermaidId>` 형태다(`planningUserFlowBuilder.ts:191-194` `nodeId`). 예: 화면 id `grid`인 노드의 GraphNode.id는 `uflow-프로젝트목록-grid`. 반면 와이어(`WireScreen2.id`)와 화면목록(`ScreenNode.id`)은 **바레 화면 id**(`grid`). 그래서 GraphNode.id를 그대로 조인키로 쓸 수 없다 — **바레 화면 id를 별도로 확보**해야 한다.

## D1. 조인키(바레 화면 id)를 어떻게 확보하나 — 서버 부여(권장) vs web 파생

두 안:

**(A) 서버가 화면 노드에 바레 `screenId`를 실어준다 [권장]** — IA가 이미 하는 방식(`iaAdapter.ts:28`: server IANode.screenId 통과). `planningUserFlowBuilder.ts`에서 mermaid `["텍스트"]` 화면 노드의 mermaidId(소문자)를 바레 화면 id로 `GraphNode.screenId`에 채운다. `shared/src/graph-types.ts` `GraphNode`에 옵셔널 `screenId` 추가(비파괴 — change/골든 경로는 undefined). `graphAdapter.ts`가 `SpecNodeData.screenId`로 통과. **장점**: 조인키 규칙이 서버 파서 한 곳에 있고 IA와 대칭, 테스트가 파서 단위로 확정. **단점**: shared·server·web 3층 소폭 변경.

**(B) web adapter에서 GraphNode.id 접미를 파생** — `uflow-<slug>-<mermaidId>`에서 마지막 `-` 뒤 토큰(mermaidId)을 소문자화해 바레 화면 id로 쓴다. **장점**: 서버·shared 무변경. **단점**: id 문자열 포맷에 강결합(`nodeId` 규칙이 바뀌면 조인이 조용히 깨짐 — dangling), slug에 `-`가 들어가면 접미 추출이 취약.

**택: (A) 서버 부여.** 이유: (1) IA가 이미 `screenId`를 서버에서 실어주는 확립된 선례가 있어 대칭이 자연스럽다. (2) 조인키를 id 문자열 파싱에 의존시키면 `nodeId` 포맷 변경에 취약(조용한 dangling). (3) 파서 단위 테스트로 "mermaidId 소문자 = 바레 화면 id" 정합을 못박을 수 있다. 단 (A)가 서버 변경을 부담스럽게 만들면 (B)를 폴백으로 둔다(설계상 열어둠, 구현 시 재확인).

## D2. 화면 → 상세기능 역인덱스

정방향(`featureTreeAdapter`)은 상세기능 라벨 → 화면 목록이다. 역방향이 필요하다: **화면 id → 그 화면을 연결화면으로 가진 상세기능 라벨들**.

```
screenRegistry.links: ScreenLink[] = [{ detailLabel, screenIds }, ...]
→ 역인덱스: Map<screenId, detailLabel[]>
  각 link의 screenIds를 순회하며 screenId → detailLabel 를 push
```

순수 헬퍼(`web/src`, 신규)로 한 번 만들어 패널에 넘긴다. 상세기능 라벨 → featureTree 노드로의 딥링크는 라벨 문자열 동치로 찾는다(featureTree 노드 id는 `feat-...`라 라벨 매칭 필요 — 딥링크는 선택, 라벨 표시는 필수). `App.tsx`는 `planningScreens`(screenRegistry, 이미 로드 `:139`)를 이 헬퍼에 넣어 역인덱스를 만든다.

## D3. 화면 → 와이어 lookup

`planningWireScreens: WireScreen2[]`은 이미 App에 로드돼 있다(`App.tsx:164`). 화면 id로 lookup:

```
Map<WireScreen2.id, WireScreen2>  (id → 와이어 1개)
→ screenId로 조회 → 있으면 WireframeDeviceFrame 프리뷰(또는 wire 탭 딥링크)
```

`WireframeDeviceFrame`(`web/src/WireframeDeviceFrame.tsx`)이 단일 `WireScreen2`를 디바이스 프레임으로 렌더하므로(props에 `screenId`·`screen: WireScreen2`) 프리뷰 위젯으로 그대로 재사용한다. 데스크탑 변형만 있고 모바일 변형(`grid-m` 등)이 별도면, 바레 id 정확 매칭 우선 + 없으면 빈 상태.

## D4. 상호참조 패널 UI — FlowDetailPanel 확장

`FlowDetailPanel`에 화면(page) 노드일 때만 두 섹션을 흐름 섹션 뒤에 추가:
- **🖥️ 연관 와이어프레임**: `WireframeDeviceFrame` 축소 프리뷰 + "wire 탭에서 열기" 버튼(딥링크/탭 전환). 없으면 "연결된 와이어 없음"(빈 상태, 기존 `feature-detail-empty` 재사용).
- **📋 연관 기능명세**: 상세기능 라벨 목록(칩). 클릭 시 spec 탭 딥링크(선택). 없으면 "연관 기능 없음".

노드 종류 판별은 `SpecNodeData.kind === "screen"`(`graph-types.ts:11` NodeKind). 화면이 아니면 두 섹션 자체를 안 그린다(흐름 섹션만 — 기존 동작 완전 보존). 데이터는 패널 props로 주입(조인은 App에서, 패널은 조인 결과만 렌더 — `FlowDetailPanel`이 "조인/서버 왕복 없음"을 유지하는 기존 원칙 `:8` 준수). 즉 App이 `wireForScreen: WireScreen2 | null`·`featuresForScreen: {label, featId?}[]`를 계산해 패널에 넘긴다.

## D5. 딥링크 change와의 관계 (약한 선행)

`flowforge-deeplink-url`(URL 라우팅, `?project=&change=&tab=wire`)이 있으면 "wire 탭에서 열기"를 진짜 딥링크 URL로 만들 수 있다. 없어도 인앱 탭 전환(`setTab("wire")` + 해당 화면으로 스크롤/포커스)으로 폴백 가능하므로 **강결합 아님**. 구현 시 딥링크 유틸이 있으면 재사용, 없으면 탭 전환 콜백으로 시작한다.

## 의도적 제외 (범위 밖)

- **양방향 편집**: 유저플로우에서 와이어/기능을 편집하거나, 화면↔상세기능 링크를 추가/삭제하는 UI는 이 change 범위 밖. **읽기 상호참조(보기·딥링크)만** 신설한다. 링크 저작은 여전히 `features.md`의 `<!-- screens: -->` 주석(승인 위저드 경로)이 진실의 원천.
- **change 경로(비-planning) 유저플로우**: 화면 id 공유 정합은 planning 산출물(`docs/planning/*`) 기준이다. change 경로 유저플로우(`flowNodes`)는 화면 레지스트리가 없을 수 있으므로, 조인 데이터가 없으면 빈 상태(섹션 미노출)로 자연히 처리된다.
- **새 화면 id 스킴**: 조인키는 기존 화면 id를 그대로 쓴다. 새 식별자 체계를 만들지 않는다.

## 검증 전략

- flowforge는 커밋≠라이브(`reference_flowforge_deploy`) — VERIFY에서 `docker compose up -d --build` 재빌드 후 라이브 URL.
- Playwright(`~/.cache/ms-playwright`) 실픽셀: 화면(page) 노드 클릭 → 연관 와이어 프리뷰 렌더 + 연관 상세기능 목록 렌더를 실제 클릭으로 관찰. 화면 아님 노드/연결 0개/dangling 3케이스에서 크래시 없음 + 빈 상태를 관찰.
- static-first 게이트(`reference_verify_static_first_gate`): "미구현≠SKIP" — 화면 id 조인 헬퍼·`screenId` 파생·패널 섹션이 실제 코드에 있는지 grep 게이트로 확인 후 라이브 관찰.
