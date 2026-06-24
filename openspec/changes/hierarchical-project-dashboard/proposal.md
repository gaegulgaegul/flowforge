## Why

flowforge는 지금 첫 화면이 곧장 한 프로젝트의 change 안으로 들어가버려, "홈서버 프로젝트들을 한눈에" 보는 최상위 레이어가 없다. 기존 change `ingest-charter-living-docs`가 charter 상주 `docs/`를 읽어 flow/wire/prd 탭에 렌더하는 **입력 엔진**까지는 만들었지만(20/21 완료), 그 위에서 **프로젝트→뼈대(capability)→세부(change)→5종 뷰**로 파고드는 계층 네비게이션은 아직 없다. flowforge의 진짜 목표는 단일 change 뷰어가 아니라 **계층형 기획 대시보드**다(DIRECTION.md / PRD decision `identity-hierarchical-dashboard`).

## What Changes

본 change는 DIRECTION.md의 확정 결정 6개를 **예광탄(MVP)** 으로 구현한다 — 프로젝트 1개로 [홈 카드 그리드 → 프로젝트 클릭 → charter 뼈대 그래프(한글) → capability 노드 클릭 → 그 capability의 change들 → change 클릭 → 기존 5종 뷰(2-a)] **세로 한 줄 관통**. 멀티프로젝트 폴백·옛 데이터·편집·audit 배지 실시간화는 범위 밖(후속).

- **(decision 2) 홈 랜딩 = 프로젝트 카드 그리드**: 최상위 화면을 홈서버 프로젝트 카드 그리드로 한다. 카드마다 [charter 유무 / change 개수 / (정적) audit 상태] 표시. `/api/projects` 스캔을 카드 그리드 진입점으로 재구성.
- **(decision 3) charter 없는 프로젝트도 노출**: change 있는 모든 프로젝트를 카드로 보여준다. charter 있으면 🦴뼈대 카드(클릭→뼈대 그래프), 없으면 "뼈대 없음·change N개"로 표시하고 클릭하면 change 목록으로 직행 (1-a).
- **(decision 4) capability↔change 연결 = specs/ 디렉토리명 불변ID**: change의 `specs/<capability>/` 디렉토리명 == docs/spec.md의 `## capability: <키>` 를 **글자단위 비교(set 멤버십)** 로 연결. 새 태그·유사도 자동추측 금지 (A-2). 거짓연결 0건이 성공 기준.
- **(decision 5) 한글 표시명 (연결 키는 영문 유지)**: 화면 표시명만 한글. capability 한글명 = 출처1(docs/spec.md `## capability: 키 — 한글` 병기) → 폴백 출처2(키→한글 맵). change 한글명 = 출처3(proposal.md 사람이 쓴 한글 제목). 연결·라우팅 키는 영문 슬러그 유지.
- **(decision 7 = 노드클릭 종착지 2-a) change drill-down 종착 = 기존 5종 뷰**: capability에 속한 change를 클릭하면 flowforge 기존 5종 뷰(유저플로우·IA·와이어프레임·PRD·기능명세) 탭으로 진입한다. 신규 뷰 설계 없이 기존 `/api/changes/:id/*` + 탭 UI를 그대로 재사용 (사용자 확정 2026-06-24, 목업 3안 비교).
- **(decision 1, 6) 계층 네비게이션 셸 + 예광탄**: 위 흐름을 잇는 라우팅/브레드크럼/뒤로가기 셸을 신설한다. 프로젝트 1개([flowforge] 또는 [ssoksok])로 끝에서 끝까지 grounding 확인.

## Capabilities

### New Capabilities
- `project-card-grid`: 홈서버 프로젝트를 스캔해 카드 그리드로 보여주는 최상위 랜딩 — change 있는 모든 프로젝트 노출(charter 유무 무관), 카드별 [charter 유무·change 개수·audit 상태] 표시, 카드 클릭 시 charter 있으면 뼈대 그래프로/없으면 change 목록으로 분기.
- `capability-change-navigation`: charter 뼈대(capability)에서 세부(change)로 파고드는 계층 네비게이션 — capability↔change를 `specs/<capability>/` 디렉토리명 불변ID로 연결(거짓연결 0), capability 노드 클릭 시 그 capability에 속한 change 목록 표시, change 클릭 시 기존 5종 뷰로 진입, 브레드크럼·뒤로가기 셸.
- `korean-display-labels`: 영문 슬러그(연결 키)는 유지하되 화면 표시명만 한글로 변환하는 라벨 해석 레이어 — capability는 출처1(spec.md 병기)→출처2(키맵 폴백), change는 출처3(proposal 제목) 우선순위로 한글명 해석.

### Modified Capabilities
<!-- 없음. 기존 change 경로(라우트·빌더·specParser·golden test)는 무손상 — additive only. 기존 change `ingest-charter-living-docs`의 docs-ingest/docs-visualization capability도 그대로 둔다(이 change는 그 위에 얹는 네비게이션 층). -->

## Impact

- **신규 백엔드**: `server/src/lib/projects.ts`(홈서버 프로젝트 스캔 — change 유무·charter docs/ 유무·change 개수·audit 상태 집계, `changes.ts`/`docs.ts` 패턴 차용), `server/src/lib/capabilityIndex.ts`(`specs/<capability>/` 디렉토리명 ↔ docs/spec.md `## capability:` set 멤버십 역방향 인덱스), `server/src/lib/koreanLabels.ts`(한글 표시명 3출처 해석), `server/src/routes/projects.ts`(`/api/projects` 카드 그리드 + capability별 change 목록).
- **신규/수정 공유타입**: `@flowforge/shared`에 `ProjectCard`(name·hasCharter·changeCount·auditStatus·displayName), `CapabilityNode`(key·koreanLabel·changeKeys[]), `CapabilityChangeLink` 타입 추가.
- **수정 프론트엔드**: `web/src/api.ts`(projects/capability-change fetch 함수), `web/src/App.tsx`(라우팅 셸 — 카드 그리드 ↔ 뼈대 그래프 ↔ change 목록 ↔ 5종 뷰, 브레드크럼·뒤로가기), 신규 `web/src/ProjectGrid.tsx`(카드 그리드), 신규 `web/src/CapabilityChangeList.tsx`(capability별 change 목록), 한글 라벨 표시 적용.
- **무손상(하위호환)**: `server/src/routes/graph.ts`, `server/src/routes/docs.ts`, `server/src/lib/changes.ts`, 모든 기존 빌더, `specParser.ts`, `flowBinder.ts`, golden test — **변경 0**. 기존 5종 뷰(`/api/changes/:id/*`)는 종착지로 그대로 재사용. 기존 docs 모드(소스 토글)도 무손상.
- **소유 경계**: charter 스키마는 agentic-harness 소유 → flowforge는 `## capability:` 줄을 **읽기전용**으로 파싱 소비만(연결·한글명 추출). charter 문법/산출물 **변경 0**.
- **의존성**: 신규 npm 패키지 없음(기존 express/정규식/ReactFlow만).
