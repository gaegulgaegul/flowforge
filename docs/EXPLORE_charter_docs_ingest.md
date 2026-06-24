# Explore: flowforge가 charter 상주 docs/를 읽어 시각화 (문제공간 탐색)

> 모드: **explore (구현 아님)**. 결정 후보를 정리해 openspec-propose로 넘길 수 있게 캡처.
> 작성: 도로로(개발봇), 2026-06-24. 멘션: lim_myeongseop.
> 제약 상속: change 단위 동작 깨지 말 것(하위호환) · docs/ 읽기는 additive · charter 스키마는 agentic-harness 소유(flowforge는 읽기 전용 소비) · charter 문법 멋대로 바꾸지 말 것.

---

## 0. 한 줄 요약

flowforge는 본래 "spec → 유저플로우/와이어프레임 시각화" 도구다. 그런데 **휴리스틱으로 추론하던 화면·goto를 charter가 이미 명시 데이터로 만들어 docs/에 놔둔다.** flowforge가 docs/를 두 번째 입력 모드로 읽으면, 추론을 명시 데이터로 대체해 더 정확한 시각화가 된다. 문제는 **두 스키마가 다르다는 것**(charter 라인문법 ≠ OpenSpec WHEN/THEN)이라 어댑터가 핵심 쟁점이다.

---

## 1. 현재 한계 (코드로 확인됨)

| 영역 | 현재 (change 단위) | 근거 |
|---|---|---|
| 입력 루트 | `OPENSPEC_ROOT`(기본 cwd/openspec) 아래 `changes/<id>/` | `server/src/lib/changes.ts` `changesRoot()` L13-16 |
| change 판정 | `<changeDir>/specs/*/spec.md` 존재 | `changes.ts` `hasSpecs()` L19-30 |
| 파서 입력 | spec.md (OpenSpec 포맷) | `parser/specParser.ts` |
| spec 문법 | `### Requirement:` / `#### Scenario:` / `**WHEN**` / `**THEN**` | `specParser.ts` L24-28 |
| 화면 판정 | **휴리스틱** isScreenSpec (SCREEN_TOKENS≥3 && >API_TOKENS) | `parser/flowBinder.ts` L80-86 |
| goto 추론 | **휴리스틱** flowTarget (THEN에서 NAV_RE 동사+별칭매칭, dangling 가능) | `flowBinder.ts` L120-151 |
| 빌더 입력 | 전부 `changeDir`(절대경로) 단일 진입점 | `graphBuilder/iaBuilder/specTreeBuilder/wireframeBuilder/prdBuilder.ts` |
| 라우트 | `/api/changes/:id(*)/{graph,ia,wireframe,prd,spec-tree,layout}` | `server/src/routes/graph.ts` |
| 프론트 | React+ReactFlow, 탭 `prd\|spec\|flow\|ia\|wire` | `web/src/App.tsx` L34 |

**결론: flowforge는 charter 상주 docs/(spec.md 라인문법, user-flow.md)를 입력으로 못 받는다.** 빌더가 전부 `changeDir → specs/*/spec.md(OpenSpec)` 경로에 묶여 있다.

---

## 2. 스키마 갭 (charter docs ↔ flowforge 입력) — 핵심 쟁점

charter 산출물 생성기 위치(소유 경계 확정):
`agentic-harness/plugins/agentic-harness/skills/openspec-charter/{charter_scaffold.py, charter_wireframe.py, charter_status.py, charter-schema.md, templates/}`
→ **이 스키마는 agentic-harness 소유. flowforge는 읽기 전용 소비만.**

### 2-1. spec.md 문법 갭

| 개념 | charter docs/spec.md | flowforge specParser | 매핑 |
|---|---|---|---|
| 기능 그룹 | `## capability:` | (없음) | charter→flowforge 단방향 (capability를 트리 루트/그룹으로) |
| 기능 | `### 기능: cap (METHOD /path)` | `### Requirement:` | ⚠️ 헤딩 prefix 다름 |
| API 사실 | `- assert:endpoint METHOD /path` | THEN 텍스트 내 내포(추론) | charter가 **명시** → 추론 불필요 |
| 심볼 | `- assert:symbol NAME` | (없음) | charter 전용 |
| 불변식 | `- invariant:<kind> ...` | (없음) | charter 전용 |
| 성공지표 | `- metric: ...` | (없음) | charter 전용 (시각화에 배지로 표현 가능) |
| 선행/결과 | (없음) | `- **WHEN** / - **THEN**` | flowforge 전용 |

→ **두 문법은 서로 다른 관점.** charter spec.md = "API 사실+불변식+지표"(코드 역생성), flowforge spec.md = "화면 행위 시나리오(WHEN/THEN)". 단순 1:1 매핑 불가. **어댑터 필요.**

### 2-2. user-flow.md — 여기가 가장 큰 기회

charter user-flow.md 문법 (`charter_wireframe.py` L24-27):
```
## flow: <capability키>
### 화면: <화면명> (<컴포넌트>, <경로>)
- step: <사용자 액션>
- goto: <화면명>  |  - goto: (METHOD /path)
```

flowforge는 **같은 정보를 휴리스틱으로 추론**한다(isScreenSpec로 화면 판정, flowTarget으로 THEN에서 goto 추론, dangling 발생). charter user-flow.md는 그 화면·goto를 **명시적으로** 적어둔다.

→ **charter user-flow.md = flowforge가 추론하던 것의 정답지(ground truth).** 이걸 읽으면 휴리스틱 없이 정확한 그래프/와이어프레임을 그린다. **어댑터의 1순위 가치.**

### 2-3. wireframe.html — 이미 완성품

charter `charter_wireframe.py`가 user-flow.md에서 self-contained HTML 생성(CSS 인라인, JS 0, 흑백 골격, box-field/button/header/list/empty). flowforge wireframeBuilder도 같은 boxKind 휴리스틱을 쓴다(같은 뿌리).

→ flowforge는 (a) charter wireframe.html을 **정적 서빙**하거나 (b) user-flow.md를 읽어 **ReactFlow로 재렌더**(인터랙티브 편집·레이아웃 저장과 통합)할 수 있다. 트레이드오프는 §4.

### 2-4. PRD.md — 매핑 충돌

charter PRD.md = `## decision:`(append 이력, date/capability/why/what/success/status). flowforge prdBuilder = proposal.md+design.md의 `##` 섹션을 **5섹션 고정 매핑**(overview/value/target/metrics/attributes). **구조가 완전히 다르고 의미도 다르다**(charter=이력 누적, flowforge=현재 진실 5섹션). → PRD는 매핑하지 말고 **docs/PRD.md를 decision 타임라인 뷰로 따로** 렌더하는 게 정직.

---

## 3. 탐색 질문별 옵션 (결정 후보)

### Q1. 두 번째 입력 모드를 어떻게 둘까?

| 옵션 | 내용 | 장 | 단 |
|---|---|---|---|
| **A. DOCS_ROOT 환경변수 + docsDir 입력** | OPENSPEC_ROOT처럼 DOCS_ROOT(기본 cwd/docs) 추가. 빌더에 docsDir 경로 분기 | 기존 패턴 답습, 대칭적 | 빌더가 두 입력 스키마를 알아야 함 |
| **B. /api/docs/* 라우트 신설** | change 라우트와 병렬로 docs 전용 라우트. 어댑터가 charter→공유타입 변환 | change 경로 무손상(하위호환 명확), 관심사 분리 | 라우트·어댑터 신규 코드량 ↑ |
| **C. docs를 가상 change로 어댑트** | charter docs/를 메모리상 change 구조로 변환해 기존 빌더 재사용 | 빌더 재사용(코드 최소) | charter→OpenSpec 손실 변환(assert/metric 버려짐), 가짜 change 혼란 |

**도로로 추천: B(라우트 신설) + 경량 어댑터.** 이유: 제약이 "change 단위 깨지 말 것 + additive"인데, 별도 라우트가 격리를 코드 구조로 보장한다. 어댑터는 charter 문법→flowforge 공유타입(shared/*.ts) 변환만 담당(charter 문법은 안 건드림 = 소유 경계 준수). C는 assert/metric/invariant를 버리게 되어 charter의 명시성을 낭비한다.

### Q2. charter spec.md를 누가 파싱하나? (어댑터 vs specParser 개조)

- specParser는 OpenSpec WHEN/THEN 전용이고 **golden test로 Python과 1:1 동치 고정**돼 있다(개조하면 change 동작 깨질 위험). → **별도 `charterSpecParser`(또는 어댑터)** 신설이 안전. charter 라인문법(`## capability:`, `assert:endpoint`, `invariant:`, `metric:`)을 파싱하는 정규식은 **charter_status.py / audit_match.py가 이미 정의**(RE_CAP/RE_ASSERT_EP/RE_INVARIANT/RE_METRIC) — flowforge는 그 문법을 **읽기 전용으로 포팅**(TS 정규식)하면 됨. charter 문법 변경 금지 제약 충족.

### Q3. user-flow.md → 그래프/와이어프레임 매핑

charter user-flow.md는 flowforge가 이미 가진 노드 모델과 잘 맞는다:
- `### 화면:` → `GraphNode {id: screen-<slug>, kind:"screen"}` (휴리스틱 isScreenSpec **불필요** — 명시됨)
- `- goto: 화면명` → `GraphEdge {from, to, dangling}` (flowTarget 추론 **불필요** — 명시됨, dangling은 대상 화면명 매칭 실패 시만)
- `- goto: (METHOD /path)` → API 호출 엣지(또는 노드 메타로 spec.md assert:endpoint와 교차검증)
- `- step:` → wireframe box (boxKind 휴리스틱은 charter_wireframe.py와 동일하니 재사용)

→ **어댑터가 user-flow.md를 기존 SpecGraph/Wireframe 공유타입으로 거의 직역 가능.** 이게 가장 깔끔한 직결 지점.

### Q4. wireframe.html: 정적 서빙 vs 재렌더

| 옵션 | 장 | 단 |
|---|---|---|
| **정적 서빙** | charter가 만든 그대로(진실 1개), 코드 최소 | flowforge 인터랙티브 편집/레이아웃 저장과 단절(iframe 박제) |
| **재렌더** (user-flow.md→ReactFlow) | 기존 wire 탭 UX 일관, 편집·저장 통합 | charter wireframe.html과 미세 차이 가능(boxKind 동기화 필요) |

**도로로 추천: 재렌더 우선, 정적 서빙은 "원본 보기" 보조.** 이유: flowforge의 가치는 인터랙티브 시각화인데 iframe 박제는 그걸 죽인다. boxKind 휴리스틱이 이미 charter_wireframe.py와 같은 뿌리라 재렌더해도 거의 일치. 단 "charter 원본 HTML 그대로 보기" 링크를 같이 두면 진실 비교 가능.

### Q5. change 뷰 ↔ docs 뷰 UI 공존

- 현재 상단: change 선택 드롭다운(`/api/projects`) + 탭(prd/spec/flow/ia/wire).
- 옵션 (a) **소스 토글**: "변경(change) / 상주(docs)" 모드 스위치 → 같은 탭 UI 재사용(docs 모드면 docs/ 읽음). 사용자 멘탈모델 단순.
- 옵션 (b) 드롭다운에 `docs:상주문서`를 가상 항목으로 추가 → 선택 시 docs 뷰.
- **도로로 추천: (a) 소스 토글.** charter docs는 "프로젝트당 하나의 상주문서"라 change 목록과 성격이 다르다(드롭다운에 섞으면 1개짜리 목록이 어색). 토글이 두 레이어(상주 vs 변경)의 개념을 UI로 직접 반영 — charter-living-docs 설계의 두 레이어와 정합.

---

## 4. 하위호환 / 소유 경계 체크

- ✅ change 라우트·빌더·specParser **무손상**(B안: 신규 라우트/어댑터만 추가). golden test 영향 0.
- ✅ docs/ 읽기는 **additive** (없으면 docs 모드 비활성/빈 상태, change 모드는 그대로).
- ✅ charter 문법 **읽기 전용**: 어댑터가 charter 정규식을 TS로 포팅해 소비만. spec.md/user-flow.md를 flowforge가 쓰지 않음.
- ✅ charter 스키마 소유 = agentic-harness. 갭은 어댑터에서 흡수(charter 쪽 변경 요구 0).

---

## 5. 미해결/추가 탐색 거리 (propose 전 짚을 것)

1. **DOCS_ROOT 기본값**: cwd/docs vs 프로젝트별 지정? 쏙쏙은 `/home/gaegul/ssoksok/docs/`. flowforge 자신의 docs/도 있음(`flowforge/docs/spec.md` 존재) → 어느 docs를 볼지 선택 UI 필요할 수 있음.
2. **assert:endpoint / metric / invariant 시각화**: spec.md의 이 1급 라인을 그래프/트리에 **어떻게 보여줄지**(노드 배지? 별도 패널? metric 미충족 경고?). flowforge에 없던 정보라 새 표현 설계 필요.
3. **goto:(METHOD /path) ↔ assert:endpoint 교차검증**: user-flow의 API goto가 spec.md assert:endpoint에 실재하는지 flowforge가 보여주면(dangling endpoint) audit 가치를 시각화로 확장 가능 — 범위 확장 후보(propose에서 scope 결정).
4. **PRD decision 타임라인 뷰**: 새 탭(`decisions`)으로 둘지, 기존 prd 탭을 source별 분기할지.
5. **charter docs SEED 표시 존중**: user-flow.md/PRD.md에 `SEED`(사람검토 전) 마킹 있음 → flowforge가 SEED 상태를 시각적으로 표시할지(미검증 데이터임을 사용자에게 알림).

---

## 6. propose로 넘길 결정 후보 (요약)

| # | 결정 | 도로로 추천 | 대안 |
|---|---|---|---|
| D1 | 두 번째 입력 모드 | **/api/docs/* 라우트 + 어댑터 (B)** | DOCS_ROOT env(A), 가상change(C) |
| D2 | charter spec.md 파싱 | **별도 charterSpecParser (charter 정규식 TS 포팅)** | specParser 개조(✗ golden test 위험) |
| D3 | user-flow.md 매핑 | **어댑터가 화면→GraphNode/goto→GraphEdge 직역** (휴리스틱 제거) | - |
| D4 | wireframe.html | **user-flow.md 재렌더(ReactFlow) + 원본 HTML 보기 링크** | 정적 서빙만 |
| D5 | UI 공존 | **상주/변경 소스 토글** | 드롭다운 가상항목 |
| D6 | PRD | **decision 타임라인 별도 뷰** (5섹션 매핑 안 함) | - |

> 다음 단계 제안: 이 탐색을 openspec-propose로 넘겨 design.md/proposal.md에 D1~D6 결정을 캡처. scope는 "user-flow.md → graph/wireframe 직결"을 예광탄(MVP)으로 좁히고, spec.md assert/metric 시각화·교차검증은 후속 change로 분리 권장(charter-living-docs의 단계별 검증 원칙 상속).
