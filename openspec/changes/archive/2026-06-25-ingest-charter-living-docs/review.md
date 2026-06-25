# Review — ingest-charter-living-docs

검토자: 독립 리뷰어 (구현 세션과 무관)
검토일: 2026-06-24

---

## 스코프 (검토 대상 파일)

변경 브랜치 `feat/ingest-charter-living-docs` 커밋 5개, 2883줄 추가 / 42줄 수정:

- `shared/src/`: `docs-decision-types.ts`(신규), `graph-types.ts`/`wireframe-types.ts`/`index.ts`(옵셔널 필드 추가)
- `server/src/lib/docs.ts`(신규): DOCS_ROOT 스캔 + 경로 안전 해석
- `server/src/parser/`: `charterUserFlowParser.ts`, `charterPrdParser.ts`, `docsAdapter.ts`(모두 신규)
- `server/src/routes/docs.ts`(신규) + `index.ts`(mount 2줄 추가)
- `server/src/**/__tests__/`: `docs.test.ts`, `charterUserFlowParser.test.ts`, `charterPrdParser.test.ts`, `docsAdapter.test.ts`, `routes/docs.test.ts`(모두 신규)
- `web/src/`: `api.ts`, `App.tsx`, `SpecNode.tsx`, `WireframePanel.tsx`, `graphAdapter.ts`, `styles.css`(수정), `DecisionTimeline.tsx`(신규)

확인된 무수정 파일: `specParser.ts`, `golden.test.ts`, 기존 routes(`graph.ts` 등), 기존 builders — change 경로 무손상.

---

## verify 결과 요약 (판단 입력)

- `finalJudgment`: **조건부** (PASS 17 / FAIL 0 / 검증안함 0 / SKIPPED 15)
- `archiveGate.open`: `false` — SKIPPED 15건이 게이트를 막고 있음
- SKIPPED 15건의 성격: **웹 렌더 UI 시나리오 전부** (source 토글 노출, docs 드롭다운 전환, ReactFlow 그래프 표시, SEED 배지 시각 확인, DecisionTimeline 렌더 등). 브라우저 없는 CI 환경 제약으로 코드 존재(grep) + 서버 데이터 경로(curl) 만 확인됨. **실제 브라우저에서 픽셀 렌더 및 인터랙션은 미관찰.**
- server 레이어: jest 81/81 PASS (docs lib + parser 3종 + routes 모두)
- 이 review의 판정은 verify의 조건부를 그대로 이어받음. UI 렌더 미관찰은 실제 배포 위험이므로 솔직하게 기재.

---

## 10개 기준 검토

### 1 유지보수성

**결과: 양호**

- 새 코드가 `lib/docs.ts`, `parser/charter*.ts`, `routes/docs.ts`로 책임별 분리돼 있고, charter 정규식이 `charterUserFlowParser.ts` 한 곳에 집약됨. charter 문법이 바뀌면 이 파일만 수정하면 된다.
- 각 파일 상단 주석에 Python 원본 파일·함수 참조(`charter_wireframe.py`, `charter_status.py`)가 명시돼 있어 포팅 추적 가능.
- `docsAdapter.ts` 173줄, `charterUserFlowParser.ts` 152줄, `App.tsx` 증분 202줄 — 파일 400줄 상한 내.
- 함수 단위 최대 길이: `buildDocsGraph` 약 55줄(정의, 노드 생성, 엣지 생성의 3개 블록). 50줄 상한을 5줄 초과. 분할은 가능하나(노드 블록 / 엣지 블록), 현재 구조에서 `idByName`을 공유해야 해 인라인이 오히려 명확하다고 판단. 경계선 케이스.

File: `server/src/parser/docsAdapter.ts:85-140` (buildDocsGraph)

### 2 중복/불필요한 복잡성

**결과: 양호**

- `docsSlug`는 `specParser.slug`를 재사용하지 않고 독립 구현. 설계 D3 원안과 다르지만, 이유(한글 화면명이 모두 `screen-x`로 충돌 — 실데이터 검증됨)가 코드 주석에 명시됐고, 한글 유일성 회귀 테스트가 존재. 의도적 이탈.
- `buildIdMap`의 중복 이름 처리 로직(이름 기준 Map, slug 기준 used 카운터 2-레이어)은 다소 복잡하지만, 해결하는 문제(이름 다름 + slug 같음이 모두 올바르게 처리)가 복잡성을 정당화.
- App.tsx의 docs/change 분기가 useEffect 2개에 걸쳐 있어 처음 읽는 사람에게 부담. 그러나 기능 범위 대비 허용 수준.

### 3 병목 (N+1/락/대량/동기 외부호출)

**결과: 주의 (LOW)**

- `readFileSync`를 사용해 user-flow.md와 PRD.md를 동기 블로킹으로 읽음(`server/src/lib/docs.ts:70`). 기존 `changes.ts`도 동일한 패턴을 사용하므로 **이 change가 새 위험을 도입한 것은 아님**. 단일 사용자 홈서버 환경이라 실질 영향 없음.
- **파일 크기 상한 없음**: 수백 MB의 user-flow.md가 DOCS_ROOT에 존재하면 readFileSync가 이를 전부 메모리에 올린 뒤 동기 파싱. 이 패턴은 기존 코드와 동일한 기술부채.
- `listDocsProjects`의 readdirSync + lstatSync + statSync 루프는 DOCS_ROOT 아래 프로젝트 수에 선형이나, 1단계 깊이 한정이라 실질 문제 없음.

### 4 UX/UI 혼란 (프론트)

**결과: 수정 권장 (MEDIUM, 배포 블로킹 아님)**

**[4-A] docs 모드 프로젝트 전환 시 stale 그래프/와이어프레임 잔류**

`App.tsx`의 docs useEffect(lines 144-186)는 stale 방지를 위해 `setTimeline(null)`, `setPrd(null)`, IA/spec 상태를 비우지만 `setGraph(null)`, `setFlowNodes([])`, `setFlowEdges([])`, `setWireframe(null)`은 비우지 않는다. docsProject가 A→B로 바뀔 때 이전 A의 그래프와 와이어가 새 데이터가 도착할 때까지 그대로 남는다.

File: `web/src/App.tsx:162-170` — `setGraph(null)`, `setFlowNodes([])`, `setFlowEdges([])`, `setWireframe(null)` 누락.

**[4-B] source 전환 시 stale status 메시지 잔류**

source 전환 useEffect(lines 80-110)에서 `setStatus("")`를 호출하지 않는다. docs 모드 오류 메시지가 change 모드로 돌아왔을 때도 헤더에 남는다.

File: `web/src/App.tsx:87` (change 분기 진입 시) 및 `web/src/App.tsx:99` (docs 분기 진입 시) — `setStatus("")` 누락.

**[4-C] wire 탭: 로딩 중 빈 화면 무안내**

docs 모드에서 wireframe이 로딩 중일 때 `tab === "wire" && wireframe && <WireframePanel ...>`은 wireframe이 null이면 아무것도 렌더하지 않는다(빈 화면). change 모드의 prd 탭처럼 "불러오는 중…" 안내가 없다. UX 일관성 결여.

File: `web/src/App.tsx:323`

**[4-D] flow 탭: docs 모드에서도 빈 ReactFlow 표시**

docs 모드 + flow 탭 + docsProject가 있지만 graph 로딩 중인 경우, 이전 change 모드의 flowNodes가 남아 있으면 change 그래프가 보인다(4-A와 같은 근원). graph가 null인 경우는 빈 ReactFlow 캔버스가 표시된다(아무 안내 없음).

### 5 예외처리·오류·로딩 상태

**결과: 양호 (minor 1건)**

- 모든 서버 라우트가 `safe()` 래퍼를 통해 내부 에러를 `500 internal_error`로 변환, 스택 트레이스 미노출.
- `readDocsFile`은 `existsSync` + try/catch로 모든 파일 접근 실패를 null 반환으로 처리.
- `listDocsProjects`는 `readdirSync` 실패를 catch해 빈 배열 반환.
- `resolveDocsDir`는 존재하지 않는/docs 없는 경로를 null 반환 → 라우트에서 404 응답.
- **minor**: `fetchDocsWireframe`과 `fetchDocsPrd` 성공 시 `setStatus("")`가 호출되지 않아, 이전 fetchDocsGraph 에러 메시지가 와이어/PRD 성공 후에도 남을 수 있음. `fetchDocsGraph` 성공이 `setStatus("")` 하므로 세 요청이 병렬일 때 graph만 실패한 경우에 한함.

File: `web/src/App.tsx:180-185` — 와이어·PRD 성공 콜백에 setStatus("") 없음.

### 6 보안 (인증/인가/인젝션/민감정보)

**결과: 양호 (주의 1건)**

**경로 조작 분석 (resolveDocsDir):**

`server/src/lib/docs.ts:59-63`의 검사:

```
if (project.includes("..") || !/^[A-Za-z0-9_\-/]+$/.test(project)) return null;
```

- `..` 포함 → 차단됨. `a/../b`도 `..` 포함이므로 차단됨.
- URL 인코딩(`..%2F`): 화이트리스트 정규식에 `%`가 없어 차단됨.
- null byte(`\x00`): 화이트리스트에 해당 문자 없으므로 차단됨.
- 이중 인코딩(`%252F`): `%` 자체가 화이트리스트 밖이라 차단됨.

routes/docs.test.ts의 `..%2f..%2fetc` 테스트가 실제 차단을 회귀 보장함.

**주의 (MEDIUM — 배포 블로킹 아님): 슬래시 포함 프로젝트명이 1단계 스캔을 우회**

화이트리스트 정규식이 `/`(슬래시)를 허용한다. 따라서 `GET /api/docs/a/b/c/graph` 요청에서 Express의 `(*)`  와일드카드가 `project = "a/b/c"`를 캡처하고, `resolveDocsDir("a/b/c")`는 `DOCS_ROOT/a/b/c/docs/`를 참조한다. `listDocsProjects`는 1단계만 스캔하므로 이 경로는 목록에 나타나지 않는다.

파일 접근은 하드코딩된 이름(`user-flow.md`, `PRD.md`, `wireframe.html`)으로만 제한되므로 임의 파일 읽기는 불가능하다. 그러나 DOCS_ROOT 하위 임의 깊이의 경로에 해당 파일이 존재하면 API를 통해 노출된다.

현재 환경(단일 사용자 홈서버, DOCS_ROOT = 제어된 경로)에서 실질 위험은 낮으나, 아래와 같이 슬래시를 화이트리스트에서 제거하는 것이 명확한 설계다:

```typescript
// server/src/lib/docs.ts:59
if (project.includes("..") || !/^[A-Za-z0-9_\-]+$/.test(project)) return null;
```

File: `server/src/lib/docs.ts:59`

**safe-error.ts 확인**: 내부 에러 메시지 미노출 확인됨. XSS: DecisionTimeline.tsx에 `dangerouslySetInnerHTML` 미사용, React 자동 이스케이프 확인됨.

### 7 반응형 (프론트)

**결과: 제한적 검토 (웹 렌더 SKIP — 브라우저 미관찰)**

- header의 `flexWrap: wrap` 설정으로 좁은 화면에서 소스 토글·탭 버튼·드롭다운이 줄바꿈됨. 정적 코드 분석 기준 대응 있음.
- `dt-doc`의 `max-width: 860px`는 타임라인이 넓은 화면에서 과도하게 늘어나지 않게 제한. 적절.
- 실제 모바일/좁은 뷰포트에서의 레이아웃은 브라우저 미관찰로 확인 불가.

### 8 확장성

**결과: 양호**

- 새 docs 라우트가 기존 change 경로와 완전히 분리. charter 문법이 변경되면 `charterUserFlowParser.ts` 하나만 수정.
- `DOCS_ROOT`를 환경변수로 제어해 다중 프로젝트 스캔 가능. 현재는 1단계 깊이 한정(의도된 제약).
- IA·기능명세서 탭의 docs 지원은 Non-Goal로 명확히 분리돼 있어 향후 별도 change로 확장 가능.
- docsAdapter → shared 타입 변환 구조가 깔끔해 향후 `assert:`/`metric:` 파서 추가 시 동일 패턴 재사용 가능.

### 9 배포 전 필수 수정

상세는 "반드시 수정해야 할 항목" 참조. 이 change 범위 내에서 critical 이슈는 없음.

### 10 기술부채

- **D3 설계와 구현 불일치 미문서화**: `design.md`의 D3은 "slug 함수는 flowforge specParser.slug 재사용"이라 명시하지만 구현은 `docsSlug`로 변경. 코드 주석과 테스트에 이유가 있으나 design.md 자체가 업데이트되지 않아 추후 혼란의 여지. TODO 없는 설계 문서 불일치.
- **wireframe.html 서빙 미구현**: `D4`에서 "원본 보기 링크" 기능을 정의했으나 서버가 해당 파일을 서빙하지 않아 링크가 항상 텍스트 안내로 떨어짐. 코드 주석에 "아직 서빙 안 함"이 명시됐고 UI도 graceful degradation으로 처리됨. 후속 change 필요(이슈 참조 없음).

---

## 적대적 3-페르소나

### 파괴자 (Saboteur)

**[S1] 대용량 user-flow.md가 이벤트 루프를 블록한다**

`readFileSync`는 동기 호출이다. DOCS_ROOT에 100MB짜리 user-flow.md가 있으면 그 파일을 통째로 메모리에 올리고, 줄 단위 파싱이 완료될 때까지 Node 이벤트 루프 전체가 멈춘다. 이 동안 다른 요청(change 모드 그래프 조회 등)은 응답을 받지 못한다.

File: `server/src/lib/docs.ts:70` (`readFileSync`), `server/src/parser/docsAdapter.ts:75,170` (호출부)

재현: `yes "- step: x" | head -5000000 > ${DOCS_ROOT}/big/docs/user-flow.md` 후 `/api/docs/big/graph` 요청.

현재 홈서버 환경(단일 사용자, 파일이 직접 관리됨)에서는 실질 위험 낮음. 기존 changes.ts와 동일한 기술부채.

**[S2] `goto:` 대상 화면명에 특수문자가 있으면 엣지 id가 충돌한다**

엣지 id 생성 패턴: `${sourceId}->dangling:${g.target}`. `g.target`이 user-flow.md에서 파싱된 원문 화면명이다. 화면명에 `>`가 포함되면(`->`이 포함) id가 `screen-a->dangling:b->c` 형태가 돼 파싱 시 혼란을 줄 수 있다. ReactFlow 자체는 id를 문자열로 처리하므로 실제 충돌 여부는 화면명 패턴에 의존.

File: `server/src/parser/docsAdapter.ts:114,123,130` (엣지 id 생성)

이론적 취약점이며 charter 화면명 관례상 `>`를 포함하지 않으면 발현하지 않음.

### 신입 개발자 (New Hire)

**[N1] `buildIdMap`의 2-레이어 uniqueness 로직이 한눈에 안 들어온다**

```typescript
const idByName = new Map<string, string>(); // 화면명 → id
const used = new Map<string, number>();     // base slug → 사용 횟수
```

두 Map의 관계(이름이 다른데 slug가 같으면 `-2` 접미사)가 주석 없이 코드만 보면 즉시 파악하기 어렵다. 특히 `if (idByName.has(s.name)) continue;`가 "동명 화면은 첫 등장의 id를 재사용"한다는 의미인지, "이미 처리된 화면을 건너뛴다"는 의미인지 처음 읽는 사람은 헷갈릴 수 있다.

File: `server/src/parser/docsAdapter.ts:43-58`

**[N2] App.tsx의 docs useEffect 주석이 실제 동작과 맞지 않는다**

`// stale 플래시 방지 + docs에 없는 산출물(IA/기능명세서) 비우기` 주석 뒤에서 timeline/prd/ia/spec은 비우지만 graph/wireframe은 비우지 않는다. 신입이 "이미 stale 방지가 됐으니 graph도 비워져 있겠지"라고 가정하면 틀린 이해를 갖게 된다.

File: `web/src/App.tsx:162-170`

### 보안 감사자 (Security Auditor)

**[SEC1] 슬래시 허용 화이트리스트 — 목록에 없는 경로 접근 가능**

6번 기준에서 상세 기술. `resolveDocsDir`의 화이트리스트 `/^[A-Za-z0-9_\-/]+$/`가 슬래시를 허용해 `GET /api/docs/a/b/c/graph` 요청이 `DOCS_ROOT/a/b/c/docs/user-flow.md`를 읽는다. `listDocsProjects`가 반환하지 않는 경로다. 접근 가능한 파일은 `user-flow.md`, `PRD.md`, `wireframe.html`로 하드코딩돼 있어 임의 파일 읽기는 아니지만, DOCS_ROOT 내부 임의 깊이의 해당 파일이 노출된다.

File: `server/src/lib/docs.ts:59` — `/` 제거로 단순하게 차단 가능.

**[SEC2] safe-error.ts가 에러 원문을 stderr에 기록한다**

```typescript
process.stderr.write(`[flowforge] ${req.method} ${req.path} 실패: ${detail}\n`);
```

`req.path`에 attacker-controlled 값(긴 경로, 특수문자 등)이 포함될 수 있고, 이를 stderr에 그대로 씀. 현재 환경(홈서버 로컬 로그)에서 직접적인 공격 경로가 없으나, 로그 주입(CRLF, ANSI escape)이 이론적으로 가능.

File: `server/src/lib/safe-error.ts:11` — 기존 코드이므로 이 change의 신규 위험이 아님. 참고용 기재.

---

## 반드시 수정해야 할 항목 (critical)

**없음.**

경로 안전 검사(`resolveDocsDir`)는 `..` 포함 + 화이트리스트 2중 검사 + 라우트 테스트로 충분히 방어됨. 슬래시 허용 이슈(SEC1)는 실질 위험이 낮고(파일 접근은 하드코딩 이름으로 제한), 기존 `changes.ts`와 같은 패턴이라 배포 차단 수준이 아님.

---

## 수정하면 좋은 항목

### [권장-1] resolveDocsDir 화이트리스트에서 슬래시 제거 (MEDIUM)

File: `server/src/lib/docs.ts:59`

```typescript
// 현재
if (project.includes("..") || !/^[A-Za-z0-9_\-/]+$/.test(project)) return null;
// 수정
if (project.includes("..") || !/^[A-Za-z0-9_\-]+$/.test(project)) return null;
```

설계 의도("DOCS_ROOT/<project>/docs/ — project는 단일 디렉토리명")와 코드가 일치하게 된다. `listDocsProjects`가 반환하는 이름과 `resolveDocsDir`이 허용하는 이름의 집합이 일치한다. 슬래시를 허용할 이유가 현재 없으며, 제거해도 기능에 영향 없음.

docs.test.ts의 관련 테스트("resolveDocsDir는 화이트리스트 밖 문자를 거부한다") 업데이트 필요.

### [권장-2] docs 모드 프로젝트 전환 전 graph/wireframe 초기화 (MEDIUM)

File: `web/src/App.tsx:162` (stale 방지 블록)

```typescript
// 추가 필요
setGraph(null);
setFlowNodes([]);
setFlowEdges([]);
setWireframe(null);
```

다른 산출물(timeline/prd/ia/spec)은 이미 비우고 있다. 주석도 실제 동작과 일치하게 수정.

### [권장-3] source 전환 시 status 초기화 (LOW)

File: `web/src/App.tsx:87` (change 분기), `web/src/App.tsx:99` (docs 분기)

각 분기 진입 시 `setStatus("")` 추가. 교차 오염된 오류 메시지가 다른 모드에서 보이지 않도록.

### [권장-4] wire 탭 로딩 안내 추가 (LOW)

File: `web/src/App.tsx:323`

```tsx
// 현재
{tab === "wire" && wireframe && <WireframePanel wireframe={wireframe} />}
// 수정
{tab === "wire" && (wireframe
  ? <WireframePanel wireframe={wireframe} />
  : <div className="prd-loading">와이어프레임 불러오는 중…</div>
)}
```

prd 탭의 로딩 안내 패턴과 일관성.

### [권장-5] design.md D3 업데이트 (LOW)

D3 섹션이 "slug 함수는 flowforge specParser.slug 재사용"이라 명시하지만 구현은 `docsSlug`로 변경됨. design.md 결정 기록을 실제 구현과 맞게 업데이트해 미래 혼란 방지.

File: `openspec/changes/ingest-charter-living-docs/design.md:59`

### [권장-6] wireframe.html 서빙 후속 이슈 등록 (LOW)

`D4`의 "원본 보기" 링크 기능이 서버 측 정적 서빙 미구현으로 항상 텍스트 안내로 표시됨. 현재 코드는 graceful degradation으로 처리돼 배포 블로킹이 아니나, 이슈(참조 티켓) 없이 TODO 상태로 남는 것은 규칙 위반. 이슈 번호를 코드 주석 및 tasks.md에 추가할 것.

File: `server/src/parser/docsAdapter.ts:136` (wireframe.html 존재 시 originalHtml:true 반환하는 부분)

---

## 최종 판정: 조건부 가능 (치명 0건 — 수정 권장 6건)

**배포 가능 조건:**

1. **server 계층**: PASS 확정 (jest 81/81). change 경로 무손상 (specParser.ts, golden.test.ts, 기존 routes 미변경 확인됨).
2. **web 계층**: 코드 존재 및 서버 데이터 경로 검증됨. **실제 브라우저 렌더·인터랙션 미관찰** — 배포 전 또는 직후 수동 스모크 테스트 필수.
   - 확인 항목: source 토글 전환, docs 드롭다운 선택, flow 탭 그래프 표시, wire 탭 와이어프레임 표시, prd 탭 DecisionTimeline 렌더, SEED 배지 표시.
3. **critical 수정 없음** — 경로 안전 검사는 충분히 방어됨, XSS 없음, 기존 change 경로 무손상.

**권장-1(슬래시 화이트리스트 제거)은 단순한 한 줄 수정이며 설계 명확화 효과가 있어 배포 전 반영을 권장**하나, 현재 환경에서 배포 차단 사유는 아님.

SKIPPED 15건의 웹 렌더 시나리오를 브라우저에서 직접 확인하면 `archiveGate.open = true`로 전환 가능.
