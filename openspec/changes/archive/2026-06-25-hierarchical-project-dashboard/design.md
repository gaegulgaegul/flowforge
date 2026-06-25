## Context

flowforge는 "spec → 유저플로우/와이어프레임 시각화" 단일 change 뷰어로 출발했고, 기존 change `ingest-charter-living-docs`가 charter 상주 `docs/`를 읽는 입력 엔진(D1·D3·D4·D5)을 추가해 20/21 완료 상태다. 본 change는 그 위에 **계층 네비게이션 셸**을 얹어 flowforge를 "홈서버 프로젝트를 한눈에 보는 계층형 기획 대시보드"로 만든다.

**단일 진실(이 design이 따르는 확정 결정 출처):**
- `docs/DIRECTION.md` — 계층 모델 + 확정 decision 6개 + 종착지 2-a 확정
- `docs/PRD.md` — decision 6개 append 이력 (identity / card-grid / show-all / specs-dir-link / korean-labels / tracer-bullet)
- `docs/discovery-log.md` — 거부된 가설 4 (유사도매칭·새태그·평면토글·charter-only) + resolved 1 (node-click=2-a)
- `docs/EXPLORE_charter_docs_ingest.md` — 스키마 갭 + D1~D6 결정후보

**제약 (반드시 준수):**
- 기존 change 단위 동작 무손상 (하위호환, additive only) — `specParser`/`flowBinder`/golden test 변경 0.
- charter 산출물 스키마는 agentic-harness 소유 → flowforge는 `## capability:` 줄을 **읽기전용**으로 파싱 소비만. charter 문법 변경 금지.
- 예광탄: 프로젝트 1개로 끝에서 끝까지 세로 관통(grounding) 먼저. 폭(멀티프로젝트 견고성)은 그 다음.

## Goals / Non-Goals

**Goals:**
- 홈 랜딩을 프로젝트 카드 그리드로 만들고, change 있는 모든 프로젝트를 노출(charter 유무 무관).
- charter 뼈대(capability)에서 세부(change)로 파고드는 계층 drill-down을 잇는다 — capability↔change를 `specs/<capability>/` 디렉토리명 불변ID로 연결(거짓연결 0).
- change 클릭 종착지를 기존 5종 뷰(2-a)로 재사용(신규 뷰 0).
- 화면 표시명만 한글로(연결 키는 영문 유지).
- 프로젝트 1개 세로 한 줄 관통을 실제 동작으로 grounding.

**Non-Goals:**
- charter spec.md의 `assert:endpoint`/`metric`/`invariant` **시각화** (후속 change — explore #2).
- `goto:(METHOD /path)` ↔ `assert:endpoint` **교차검증**(dangling endpoint audit) (후속 change — explore #3).
- audit 상태 **실시간 산출**(이번엔 정적/저장본 수준; 실시간 vs 캐시는 DIRECTION 미정).
- 멀티프로젝트 견고성·옛 데이터 폴백·편집/레이아웃 저장(읽기 중심 방향만, 확정 아님).
- charter docs 입력 엔진 자체(기존 change `ingest-charter-living-docs`가 소유 — 본 change는 그 결과를 소비).

## Decisions

### D-A. 프로젝트 스캔 = 신규 `projects.ts` + `/api/projects` 카드 그리드 (decision 2·3)
- 홈서버 프로젝트를 스캔해 [name·hasCharter(docs/ 존재)·changeCount·auditStatus·displayName] 집계. `changes.ts`의 스캔 패턴과 `docs.ts`의 DOCS_ROOT 해석을 차용하되 **읽기 전용 합성**.
- charter 없는 프로젝트도 포함(decision 3, 1-a): `hasCharter=false`면 카드 클릭 시 뼈대 그래프를 건너뛰고 change 목록으로 직행.
- **대안 기각**: `charter-only-cards`(charter 있는 프로젝트만) → wowa(change만 있음)가 누락돼 "한눈에"가 반쪽 → discovery-log에서 killed.

### D-B. capability↔change 연결 = `specs/` 디렉토리명 set 멤버십 (decision 4 / explore D-link)
- `specs/<capability>/` 디렉토리명(change 측)과 `docs/spec.md`의 `## capability: <키>`(charter 측)를 **글자단위 정확 비교**(대소문자·trim만 정규화, 유사도 X)로 역방향 인덱스 구성: `capabilityKey → change[]`.
- charter `## capability:` 파싱은 **읽기전용 정규식 포팅**(agentic-harness `audit_match.py`의 `RE_CAP` 동치). charter 문법 변경 0.
- **대안 기각 1**: `link-by-name-similarity`(영↔한 유사도 자동매칭) → 사전 필요·거짓연결 위험·charter "거짓✅ 금지" 충돌 → killed.
- **대안 기각 2**: `link-by-new-tag`(proposal.md에 `capability:<부모키>` 새 줄) → specs/ 디렉토리명과 이중 진실 → 이미 검증된 불변ID로 대체 → killed.

### D-C. change drill-down 종착 = 기존 5종 뷰 재사용 (decision 7 / node-click 2-a)
- capability의 change 클릭 시 기존 `/api/changes/:id/{graph,ia,wireframe,prd,spec-tree}` + `web` 탭 UI(`prd|spec|flow|ia|wire`)로 **그대로 진입**. 신규 뷰·신규 빌더 0.
- **대안 기각**: 2-b(유저플로우만)·2-c(capability 패널 멈춤) → 목업 3안 비교 후 사용자가 2-a 선택(정보량·깊이 최대, 재사용 0설계) → discovery-log resolved.

### D-D. 한글 표시명 = 3출처 우선순위 해석 레이어 (decision 5)
- 표시명만 한글, **연결/라우팅 키는 영문 슬러그 유지**(한글로 바꾸면 불변ID·골든테스트 깨짐).
- capability 한글명: 출처1 `docs/spec.md`의 `## capability: 키 — 한글` 병기(charter가 진실의 원천) → 폴백 출처2 flowforge 내 키→한글 맵(병기 없는 옛 capability용).
- change 한글명: 출처3 `proposal.md`의 사람이 쓴 한글 제목.
- 해석은 `koreanLabels.ts` 한 곳에 격리(표시 레이어), 데이터/연결 레이어는 영문만 다룬다.

### D-E. 계층 네비게이션 셸 = 프론트 라우팅 + 브레드크럼 (decision 1·6)
- `App.tsx`에 4단 라우팅 상태: `grid`(카드) → `skeleton`(뼈대 그래프, charter 있을 때) → `capability-changes`(capability별 change 목록) → 기존 5종 뷰. 브레드크럼·뒤로가기·⌂처음으로 셸.
- charter 없는 프로젝트는 `grid → capability-changes`(전체 change 목록)로 단축 — 뼈대 단계 스킵.
- 기존 단일-change 진입(직접 URL)도 살린다(하위호환).

### D-F. 백엔드 라우트 = `/api/projects` 신설, 기존 라우트 무손상 (explore D1 패턴 상속)
- `/api/projects`(카드 그리드), `/api/projects/:project/capabilities`(뼈대 capability + 한글명), `/api/projects/:project/capabilities/:cap/changes`(capability별 change 목록). 기존 `/api/changes/*`·`/api/docs/*`는 **변경 0**, 종착지로 재사용.

## Risks / Trade-offs

- **[charter 없는 프로젝트가 대다수 — 뼈대 그래프 진입이 드물어 가치 체감이 약할 수 있다]** → 예광탄 대상은 charter 있는 프로젝트(flowforge/ssoksok)로 잡아 뼈대→change 경로를 먼저 grounding. 카드 그리드 자체는 모든 프로젝트에 가치(한눈 조망).
- **[`specs/` 디렉토리명 ↔ `## capability:` 글자 불일치 시 연결 누락(silent)]** → 정확 비교라 거짓연결은 0이지만 **연결 안 됨**은 발생 가능. 미연결 capability/change를 "미연결" 상태로 **명시 표시**(숨기지 않음), silent drop 금지. (charter SKILL에 "흡수 시 디렉토리명 정확히 맞추라" 명문화는 agentic-harness 측 후속.)
- **[기존 5종 뷰 재사용 = change 측 데이터 모델에 종속]** → 종착지는 기존 `/api/changes/*` 계약을 그대로 호출만 함(신규 결합 0). 기존 계약이 안정적이라 위험 낮음.
- **[audit 상태를 정적으로만 표기 → 실제와 어긋날 수 있음]** → 이번엔 "저장본/정적" 수준임을 카드에 표기. 실시간 산출은 DIRECTION 미정 → 후속.
- **[한글 표시명 3출처 우선순위 충돌(출처1·3이 다른 한글)]** → 출처 우선순위를 코드로 고정(capability=1>2, change=3), 충돌 시 우선 출처 채택 + 디버그 로그. 표시 레이어라 데이터 정합엔 영향 없음.

## Migration Plan

- **배포**: 전부 additive. 기존 라우트·빌더·specParser·golden test 무변경이라 기존 단일-change 사용 흐름은 그대로. 신규 `/api/projects` + 프론트 라우팅 셸만 추가.
- **롤백**: 프론트 라우팅 진입점을 기존 단일-change 화면으로 되돌리고 `/api/projects` 라우트 비활성화하면 즉시 원복(데이터 마이그레이션 없음).
- **예광탄 검증**: 프로젝트 1개([flowforge] 또는 [ssoksok])로 [카드→뼈대 그래프(한글)→capability 클릭→change 목록→5종 뷰] 세로 한 줄을 실제 브라우저로 관통 확인(grounding). flowforge.gaegul.house 서빙으로 외부 관찰.

## 화면 구성 / UI

- 화면 구조·흐름·이동(드릴다운 클릭)의 명세는 `prototype.html`을 단일 출처로 한다(DESIGN.md가 없어 와이어프레임으로 렌더됨). **이 HTML은 명세이지 구현물이 아니다 — WebView로 그대로 쓰지 말고**, web 프론트(React + ReactFlow)로 같은 화면·흐름을 **번역해 구현**한다. 종착지 5종 뷰는 기존 flowforge 탭 UI를 재사용한다(신규 화면 0).

## Open Questions

> 이 design 범위에서 막지 않고, 후속/운영 단계에서 정한다 (DIRECTION 미정 항목과 정합).

- audit 상태 배지: 넣을지 / 실시간 vs 저장본 — 이번엔 정적 표기로 진행, 실시간화는 후속.
- 데이터 신선도: 매 요청 스캔 vs 캐시 — 예광탄은 매 요청 스캔(단순), 캐시는 성능 이슈 생기면.
- 편집 vs 읽기전용: 방향만 "읽기 중심", 확정 아님 — 이번 셸은 읽기 네비게이션만.
- 도그푸딩: flowforge 자신도 카드에 노출(charter 있으니 자연스러움) — 예광탄 대상 후보.
