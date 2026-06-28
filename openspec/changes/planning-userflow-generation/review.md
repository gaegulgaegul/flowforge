# 배포 전 최종 검토 — planning-userflow-generation
검토일: 2026-06-29 / 검토 범위: 이 change의 diff만 (전체 앱 아님)
- server/src/parser/planningUserFlowBuilder.ts (Mermaid→SpecGraph 정규식 파서, 신규)
- server/src/lib/docs.ts (readDocsUserFlowSpec/Overlay·writeDocsUserFlowOverlay·listDocsUserFlows, docs 첫 쓰기 IO)
- server/src/routes/docs.ts (GET planning-user-flow + PUT layout 라우트)
- server/src/lib/changes.ts (isLayoutOverlay 공용화분)
- web/src/api.ts (fetchDocsPlanningUserFlow·saveDocsPlanningUserFlowLayout)
- web/src/App.tsx (planningUserFlow 렌더 + onPlanningFlowNodeDragStop 드래그→PUT)
- openspec-plan/SKILL.md (agentic-harness, 유저플로우 생성 단계)
- 도그푸딩 docs/planning/user-flow/main-v1.md(+overlay.json)

## verify 입력 (실증 결과 — review는 재실행 안 함, 판단만)
verify.json = **PASS 11/11** (FAIL 0 · 검증 안 함 0 · 예외 미검증 0 · SKIPPED android/ios만). 모든 acceptance scenario가 server(jest 36/36 + 런타임 curl) + web(Playwright 실픽셀)로 실측됐고 edge-case 8종 충분(5 Requirement covered/N/A+사유). → 이 change는 **깨끗하게 실증됨**. 아래 발견은 verify가 잡지 않는 코드 품질·위생·미래확장 관점.

## criteria brief (in-session)
- changeTypes: backend(parser/lib/routes) + frontend(web App/api, ReactFlow 렌더) + doc(SKILL.md/spec/design)
- 10기준 in/out: 1·2·3·5·6·8·9·10 in-scope, 4·7(UX·반응형) in-scope(frontend 변경 있음)
- ruleSets: 10-coding-style + 20-testing + 30-security + 60-design + 70-adversarial (resolved from ~/.claude/rules/)
- designYardsticks: 결정1 SpecGraph 재사용(분리 안 함) / 결정2 Mermaid 라이브러리 없이 정규식 / 결정3 docs 첫 쓰기 3중가드 / 결정4 generation 보류·view만 흡수 / Non-Goals=와이어·spec변환·매핑·승인UI·Mermaid 전체문법·기존 파이프 수정
- adversarialScope: full change scope (NOT narrowed by this brief)

## 반드시 수정해야 할 항목
- 없음 (CRITICAL 0 · HIGH 0). docs 첫 쓰기 라우트의 3중 가드(경로조작·group/version 화이트리스트·isLayoutOverlay)가 verify S10/S11에서 4xx 차단 실측됨. 배포 차단 사유 없음.

## 수정하면 좋은 항목
- **[CONCERN] writeDocsUserFlowOverlay 예외 미수렴 — 계약 불일치** (`server/src/lib/docs.ts:144-145`). JSDoc은 "토큰 부정 false / 성공 true" 이진 계약인데 mkdirSync/writeFileSync에 try-catch 없음 → EACCES/ENOSPC/EROFS 등에서 throw. 현재는 라우트의 `safe()` 래퍼가 잡아 500을 돌려주므로 **크래시 없음**(동작 안전). 다만 미래 호출자가 `const ok = write…()`로 try-catch 없이 쓰면 함정. 수정: try-catch로 false 수렴(읽기쪽 readDocsUserFlowOverlay는 이미 try-catch 있어 비대칭). 비치명 — 다음 change에서 4단계(spec 변환) 작업 시 함께.
- **[CONCERN] PUT layout이 명세 .md 존재 확인 안 함 — 팬텀 overlay** (`server/src/routes/docs.ts:152`). `flow=phantom-v99`처럼 .md 없는 stem에 유효 LayoutOverlay를 PUT하면 `phantom-v99.overlay.json`이 생성됨(토큰 형식만 검사). listDocsUserFlows는 .md만 열거 → orphan overlay 정리경로 없음. **보안 위험 낮음**(내용이 `{id:{x,y}}` 고정), GET은 graph null이면 404라 팬텀은 조회도 안 됨. 위생 문제. 수정: 쓰기 전 `listDocsUserFlows(dir).includes(flow)` 확인 후 없으면 404.
- **[CONCERN] ReactFlow `key` 고정 → 버전 전환 시 fitView 미작동** (`web/src/App.tsx:439`, `key="d-planning-user-flow"`). switchPlanningFlow로 다른 버전 전환 시 인스턴스 리마운트 안 돼 fitView가 새 그래프에 재조정 안 됨(드래그 좌표가 버전마다 달라 화면 밖 가능). **현재 임팩트 0**(도그푸딩 단일 버전 main-v1). 다버전 누적 시 마찰 — 5단계(버전 UI) 작업 시 `key={`d-planning-user-flow-${planningFlowName}`}`로 수정.

## 현재 상태로 유지해도 되는 항목
- **SpecGraph 재사용(결정1)**: 유저플로우 본질이 화면 그래프라 change·charter user-flow와 같은 SpecGraph가 정확. 2단계 features를 FeatureTree로 분리한 것과 대비해 일관된 판단(트리 vs 그래프 성격 차이). 과잉추상화 아님.
- **Mermaid 라이브러리 없이 정규식(결정2)**: 파싱만 필요한데 렌더용 수백KB 의존성 추가는 과함(게으름 사다리 ③). flowchart 노드+엣지만 정규식 수십 줄로 충분, verify에서 노드11·엣지12·라벨7 정확 파싱 실측. 정당.
- **overlay read/write가 changes.ts와 유사하나 공통 추출 안 함(결정3 trade-off)**: 경로만 다른 얇은 함수 중복 < 두 관심사(viz/ change용 vs user-flow/ 기획용) 결합. 의도된 결정, 위반 아님.
- **노드 모양→kind 매핑 NODE_PATTERNS**: 긴 패턴 먼저(stadium/circle before box) + scan 제거로 박스가 stadium 내부 [] 재매칭 방지(`:75-84`). 멀티워드 라벨(공백) 정상 파싱 실증함.

## 리팩토링 추천 항목
- **[LOW] 파이프(`|`) 포함 엣지 라벨 오인식** (`planningUserFlowBuilder.ts:49` RE_EDGE `[^|]*`). `A -->|a|b| B`처럼 라벨에 `|`가 있으면 `b`가 target으로 잘못 파싱(비표준 Mermaid 입력). 설계상 "미지원은 무시"인데 이건 무시 아닌 wrong-parse. 빈도 극히 낮음 — 주석으로 제한 명시면 충분.
- **[LOW] 2단계 split 순회 의도 주석** (`planningUserFlowBuilder.ts:68·91`). body를 두 번 순회(노드 먼저 전수집→엣지에서 참조)하는 순서 의존이 코드에 안 보임. `// 2단계: 노드 전수집 후 엣지 — 순서 의존` 한 줄 권장.
- **[LOW] express.json limit 명시** (`server/src/index.ts`). isLayoutOverlay에 엔트리 상한 없으나 express.json 기본 100kb가 1차 방어(약 4500 엔트리, 순회 ~1ms 수용). limit을 코드에 명시하면 검증과 쌍으로 의도 분명.

## 적대적 검토 (4 페르소나)
- **파괴자**: Mermaid 파서가 비정상 입력(빈 코드블록→빈 그래프, 미지원 라인→무시, 모양 안 닫힘→매칭 실패로 bare-id 보강)에서 throw 안 함 확인(`:70` 선언라인 skip, `:99` bare id 보강). **단 라벨 내 `|`는 wrong-parse**(LOW로 분류). 드래그 PUT race: onNodeDragStop이 드래그 종료 1회만 호출, 전체 좌표 멱등 덮어쓰기라 race 무해. writeDocsUserFlowOverlay IO 예외 미수렴(CONCERN으로 등록).
- **신입 개발자**: 노드 모양→kind 매핑이 파일 상단 주석(`:9-15`)으로 명문화됨(매직 아님). nodeId가 slug+mermaidId 접미로 충돌 방지 의도 주석 있음(`:121`). **2단계 split 순회 순서 의존은 주석 없음**(LOW로 등록). 변수명(stripNodeShapes/extractMermaid/RawNode) 의도 분명.
- **보안 감사자**: docs 첫 쓰기 3중 가드 실측 차단 — project=resolveDocsDir(`..` 404), group/version=isSafeFlowToken 화이트리스트(`../escape` 400), body=isLayoutOverlay(string/array 400). isLayoutOverlay 프로토타입 오염: 입력이 `{id:{x:number,y:number}}` 형태만 통과하므로 `__proto__` 키가 와도 값이 좌표객체여야 해 실익 없음. symlink overlay 경유 쓰기는 **로컬 단일사용자+CF Access 환경이라 공격면 아님**(불확실 표시, 다중사용자 되면 재평가). JSON 파싱 폭탄=express.json 100kb 차단.
- **게으른 시니어**: 안 짜도 될 코드 탐색 — SpecGraph 재사용(타입 신설 0)·정규식 파싱(라이브러리 0)·overlay 얇은 중복(결합 회피)·web graphAdapter/SpecNode 재사용(렌더 신설 0)·App.tsx 드래그 6줄 최소. **과잉구현 발견 없음** — 오히려 design이 게으름 사다리(②중복 ③라이브러리)를 의식적으로 피한 흔적(결정2 대안 기각 명시). 새 의존성 0.
- 2+ 페르소나 중복 발견(심각도 상승): 없음 (각 발견 단독).

## 디자인 리뷰 (frontend 변경 — 조건부 게이트)
화면 작업 감지됨(web/App.tsx ReactFlow 렌더 + prototype.html 존재). DESIGN.md 없음(prototype=와이어). 실픽셀은 verify에서 이미 라이브 관찰(Playwright 8904): 시작 stadium(초록)·화면 box·행동 diamond(주황) 노드 모양 구분 + 엣지 라벨(카드 클릭/PRD/유저플로우 등) 렌더, 콘솔에러 0. **기존 change/charter graph·FeatureTree·SpecTree 렌더와 동일 SpecNode 4타입 재사용**이라 시각 일관성 유지(슬롭 없음). DESIGN.md 미정의 → 신규 디자인 시스템 결정 시 `/design-consultation` 권장(이 change 범위 밖). criteria 4(UX): 버전 select는 여럿일 때만 노출(`:425`), 단일은 숨김 — 적절. criteria 7(반응형): dash-feature-flow 컨테이너가 기존 그래프 뷰와 동일 레이아웃 상속, 별도 회귀 없음.

## 최종 배포 가능 여부
**배포 가능** — CRITICAL 0 · HIGH 0. verify PASS 11/11로 모든 acceptance가 실증됐고, 적대 패스 발견은 전부 CONCERN(동작 안전한 위생/계약)·LOW(주석/명시). docs 첫 쓰기의 보안 가드는 실측 차단 확인. design 결정 위반 없음.

## 개선 우선순위 (제안)
1. **PUT 팬텀 overlay 방지** (CONCERN, routes/docs.ts:152) — orphan 파일 위생. 다음 change(4·5단계)에서 .md 존재확인 추가. 영향: 디렉토리 청결, 보안 낮음.
2. **writeDocsUserFlowOverlay 예외 수렴** (CONCERN, docs.ts:144) — 읽기/쓰기 계약 대칭. 현재 동작 안전(safe 500)이라 비긴급.
3. **ReactFlow key 버전화** (CONCERN, App.tsx:439) — 5단계 다버전 UI 작업 시 fitView 재조정. 현재 임팩트 0.
4. **LOW 3종**(`|` 라벨 주석 / split 순서 주석 / express.json limit) — 가독성·견고성, 여유 시.
