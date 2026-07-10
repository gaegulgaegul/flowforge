# Flowforge 피드백 작업 목록

> 사용자 피드백을 받는 대로 여기에 리스트업. 처리 상태를 함께 관리한다.
> 상태: 🆕 접수 / 🔄 진행중 / ✅ 완료 / ⏸ 보류

## 피드백 목록

### 1. 기능 명세를 다이어그램으로 보여줄 필요가 있나? 🆕
- 질문: 기능 명세(features)를 다이어그램(노드-엣지) 형태로 시각화하는 게 적절한가?
- **조사 결과**: 현재 기능명세 = ReactFlow 노드-엣지 다이어그램(요구사항→기능→상세기능 3단 계층 트리, dagre 좌→우). `FeatureNode.tsx:44-85`, `featureTreeAdapter.ts:105-194`, `App.tsx:1031-1043`. 데이터 스키마도 순수 계층 트리(`shared/src/feature-tree-types.ts:23-68`, `children` 중첩).
- **판단(내 의견)**: 다이어그램은 과함. 관계가 부모-자식 트리 하나뿐이라 엣지가 정보를 안 실음. 순수 계층은 들여쓴 **트리/아웃라인 리스트**가 밀도·검색·편집에 유리. 다이어그램은 관계가 트리가 아닐 때(N:M/순환/분기 = 유저플로우)에만 정당.
- **방향**: 기능명세 → 리스트/트리 뷰로 전환(다이어그램은 유저플로우 전용으로).

### 2. 화면 구조(IA)는 무엇을 보여주는가? (렌더 형태 검토) 🆕
- 질문: "화면 구조"(IA) 뷰가 현재 무엇을 어떤 형태로 보여주는지, 그게 적절한가?
- **조사 결과**: 기획 IA = 화면목록→화면→상세기능 계층 트리를 **기능명세와 같은 ReactFlow 노드-엣지 렌더러**로 그림(태그 어휘만 오버라이드). `IANode.tsx:13-36`, `iaAdapter.ts:62-107`, `App.tsx:1052-1064`, `App.tsx:288-293`. 스키마도 계층 트리(`shared/src/ia-types.ts:13-34`).
- **판단(내 의견)**: 문제 큼. IA는 "화면 인벤토리 + 위계"가 본질인데 기능명세와 시각적으로 구분 안 됨(둘 다 같은 트리 다이어그램). IA다우려면 **사이트맵 트리** + 각 화면이 담는 기능/데이터가 핵심. 이것도 계층 본질이라 리스트/트리가 나음.
- **방향**: IA → 사이트맵 트리 리스트로. "화면 구조" 산출물의 존재 이유(화면 목록·위계)가 또렷해지게.

> **1·2번 통합 근본 원인**: 5개 산출물 중 3개(기능명세/IA/유저플로우)를 한 ReactFlow 렌더러로 뭉갬. → 관계가 트리인 기능명세·IA는 리스트/트리로, 관계가 그래프인 유저플로우만 다이어그램으로 분리하는 게 방향.
> (참고 표 — PRD=텍스트 문서패널 `PrdPanel.tsx`, 와이어프레임=디바이스 프레임/박스 `WireframeDeviceFrame.tsx`·`WireframePanel.tsx`. 이 둘은 이미 산출물에 맞는 별도 렌더러.)

### 3. 와이어프레임 핀 피드백 → 후속 액션 부재 🆕🔴
- 문제: 와이어프레임에 핀으로 피드백을 남기는 것까지는 되는데, 그 **피드백으로 무슨 작업을 하는 기능이 없음**.
- 즉 핀 피드백이 "저장/표시"에서 끝나고, 반영·수정·추적(상태 전이: open→resolved 등)·산출물 재생성 같은 후속 액션이 없음.
- 확인 필요: 현재 핀 피드백 데이터가 어디까지 흘러가는가(저장 위치/스키마), 후속 액션 훅이 정말 없는지.
- 방향(후보): 핀 피드백 → ①상태관리(해결/미해결) ②피드백 목록/인박스 ③해당 change/spec 수정 트리거 ④AI로 피드백 반영안 제안. 어디까지 할지 결정 필요.
- **조사 결과(확정)**: **후속 액션 없음 — 서버 JSON 파일에 append하고 끝.**
  - 저장: `<project>.feedback.json`에 append만(`server/src/lib/wireDocs.ts:317-346`). 스키마 = screenId/text/ts/xPct/yPct/region (`shared/src/wire-suggestion-types.ts:42-55`). **id·author·status 필드 자체가 없음** → resolve 개념이 원천적으로 불가.
  - 읽기: feedback을 다시 읽어 화면에 표시하는 GET 라우트/뷰/useEffect 전부 없음(새로고침하면 로컬 핀 사라짐). append 시 기존 배열 읽기 용도의 `readFeedbackSidecar` 하나뿐.
  - 처리: resolve/삭제/수정 핸들러 없음. "수정"조차 in-place가 아니라 또 append(중복 누적).
  - 설계 의도: 코드 주석이 명시 — "flowforge는 write만, AI 호출 안 함(A안 파일 릴레이)"(`WireframePinFeedback.tsx:11`, `wireDocs.ts:313`). 후속 처리는 flowforge 밖 외부 스킬 몫으로 미룸.
  - **결론**: 사용자 지적 정확. 현재는 "피드백 우체통"만 있고 그걸 여는 쪽이 없음. 최소 ①id·status 필드 추가 ②feedback GET+목록/인박스 뷰 ③resolve 토글 부터 필요. 그 위에 change/spec 반영은 별도 결정.

### 4. 와이어프레임 렌더가 실제 화면과 전혀 다름 🆕🔴
- 문제: flowforge 자신을 대상으로 확인 중인데, flowforge가 그린 **와이어프레임 레이아웃이 실제 화면과 전혀 다름**. 즉 와이어프레임이 실제 만들 UI를 못 그림.
- 확인 필요: 와이어프레임 데이터가 어디서 오는가(사람 입력 vs AI 생성 vs spec 파생), 렌더러(`WireframeDeviceFrame.tsx`)가 요소를 실제 화면처럼 배치하는 능력이 어디까지인가. "전혀 다름"의 원인이 데이터 부실인지 렌더러 한계인지 구분.
- 방향(후보): 와이어프레임 요소 스키마·배치 정밀도 개선 / 실제 화면 스냅샷 기반 보정 / AI 생성 품질 개선. 원인 규명 후 결정.
- **조사 결과(확정) — 원인은 둘 다(데이터+렌더러 구조)**:
  - **데이터**: 손으로 쓴 하드코딩 픽스처 상수(`server/src/parser/planningWireframeFixture.ts`). AI 생성도 spec/유저플로우 파생도 아님. 코드 주석 명시: "사람이 레이아웃 손으로 쓰는 경로 없음(D-2), AI 생성물이 나중에 이 자리에 들어옴". 즉 지금 flowforge 자신 화면과 다른 건 당연 — 실제 화면 기반이 아니라 예시 픽스처라서.
  - **렌더러 표현력 한계**: 요소 스키마(`shared/src/wire-screen2-types.ts:31-39`)에 **x/y/width/height 좌표 필드가 없음**. 배치 = "영역(topbar/sidebar/body/bottombar) 소속 + body layout(grid/stack/tree/form) 힌트"로만 결정, CSS grid/flex로 흘림(`styles.css:937-940`, 컬럼 3/2/1 고정). **임의 픽셀 레이아웃 재현 불가 = 구조적 한계.**
  - 렌더러가 스스로 "회색조 로우피델리티 — 배치·흐름 점검용, 최종 디자인 아님"이라 캡션에 명시(`WireframeDeviceFrame.tsx:260-262`). 즉 "실제 화면과 다름"은 버그가 아니라 **의도된 저해상도**. 다만 사용자 기대(실제 화면 근접)와 어긋남 → 목표 재정의 필요.
  - **결정 갈림길**: (a) 로우피델리티 유지하되 데이터를 실제 spec 기반으로 채워 "구조라도 맞게" / (b) 하이피델리티로 목표 상향(좌표 스키마 도입+실화면 근접). manyfast 지향점(아래 5번)과 함께 결정.

### 5. 와이어프레임 정적 목업 → 인터랙티브 프로토타입 필요 🆕
- 문제: manyfast 와이어프레임은 화면의 동작·기본 프로세스 흐름(클릭·입력 등 **이벤트 처리**)이 되는 것 같았는데, flowforge 와이어프레임은 정적 목업임.
- 즉 "화면 하나의 그림"이 아니라 "클릭하면 다음으로 넘어가는 동작하는 프로토타입"이 필요.
- 확인 필요: manyfast(flowforge의 원본 참조)가 실제로 어떤 인터랙션을 지원했는지(산출물 스키마 메모리 참조), flowforge 와이어프레임에 이벤트/전이 개념이 있는지.
- 방향(후보): 와이어프레임 요소에 액션(클릭→화면전이) 바인딩 / 유저플로우와 와이어프레임 연결(플로우의 각 스텝 = 와이어프레임 화면) / 간이 프로토타입 재생 모드.
- 연관: manyfast 산출물 스키마 = [[reference_manyfast_spec]] (5종: PRD·기능명세3단·IA·유저플로우·와이어). 유저플로우↔와이어프레임 연결이 열쇠일 수 있음.
- **조사 결과(확정) — 화면전이만 있고 실동작 이벤트 없음**:
  - **있는 것**: 요소 `goto` → onClick으로 같은 와이어 안 다른 화면 전환(`setActiveId`, `WireframeDeviceFrame.tsx:29-46,180-191`). "클릭 프로토타입"으로 화면 A→B 이동은 됨. 단 와이어 미리보기 안에 갇힌 이동(앱 라우팅/URL 아님).
  - **없는 것**: `onChange`/`onInput`/`onSubmit`/`onKeyDown`/`value=` **전부 0건**. input·button kind 요소도 정적 회색 박스 — 타이핑·제출·상태변화 안 됨. → manyfast식 "입력이 실제 동작"은 아님.
  - **유저플로우↔와이어 연결**: 화면 id 문자열 공유(정합)는 설계됨(`wire-screen2-types.ts:61`, `planningWireframeFixture.ts:5-6` — 유저플로우·IA와 같은 id). **하지만 런타임 조인 코드(플로우 스텝↔와이어 화면 매핑)는 없음**. 이론상 매칭 가능한 어휘만 있고 실제 연결 동작은 미구현.
  - **결론**: goto 화면전이는 이미 됨. manyfast 수준(입력·폼 동작) 원하면 요소별 상태·이벤트 모델 추가 필요. 유저플로우↔와이어 id 정합이 이미 있으니 "플로우 스텝 클릭→해당 와이어 화면" 연결은 저비용으로 가능(열쇠 맞음).

### 6. 뷰 선택식 네비게이션 → 액션 기반으로 🆕
- 문제: 프로젝트 목록 / 기획 뷰 / 기능명세를 **순차로 선택(드릴다운)해서 들어가야** 함. 이렇게 "고르는" 게 아니라 **액션으로 바로 동작**해야 함.
- 해석: 현재 UX가 "프로젝트 고름 → 뷰 고름 → 산출물 탭 고름" 계층 선택 구조. 사용자는 이 단계 선택을 없애고 액션(하고 싶은 일) 중심으로 바로 진입/실행되길 원함.
- 확인 필요: 현재 상단 네비/탭 구조가 코드상 어떻게 돼 있는지(App.tsx 뷰 스위칭 로직), 어떤 선택 단계를 액션으로 대체할 수 있는지.
- 방향(후보): 명령 팔레트/액션 바 / 컨텍스트에 따라 자동으로 관련 뷰 노출 / 선택 단계 축소. 사용자와 "어떤 액션들"인지 구체화 필요.

### 7. 산출물 순서 확정 + 화면구조(IA) 제거 🆕
- 결정사항(사용자): 산출물은 **PRD → 기능명세서 → 유저플로우 → 와이어프레임** 순서. **화면 구조(IA)는 없어도 됨** — 와이어프레임이 그 역할을 처리할 수 있으니까.
- 근거: IA가 보여주려던 "화면 목록/위계"는 와이어프레임이 실제 화면들로 이미 담고 있음. IA를 별도 산출물로 두면 와이어프레임과 중복.
- 연관: 2번(IA가 기능명세와 뭉개진 트리 다이어그램)과 직결 — 2번의 "IA 렌더 개선"보다 **IA 산출물 자체 제거**가 더 근본적 해결일 수 있음. 단 IA의 화면 id 레지스트리(`screenRegistry`, `features.md`의 화면목록)는 유저플로우·와이어프레임이 공유하는 **데이터 기반**이라, "IA 뷰 제거"와 "화면 id 데이터 제거"는 구분 필요(데이터는 남기고 뷰만 뺄 수 있음).
- 확인 필요: IA 뷰를 제거해도 유저플로우/와이어프레임이 쓰는 화면 id 정합이 깨지지 않는지. 5종→4종으로 줄일 때 파이프라인(파서/어댑터/audit) 영향 범위.
- 방향: 산출물 4종(PRD/기능명세/유저플로우/와이어프레임)으로 재정의, 순서 고정, IA 뷰 제거(데이터는 유지 검토).

### 8. 와이어프레임 = iframe + HTML/JS 노선? (렌더 방식 근본 재검토) 🆕🔴🔑
- 사용자 기억: "와이어프레임은 iframe으로 보여주고 html + js로 작성하는 걸로 대화했던 것 같다."
- **메모리 확인 결과(중요)**: 그 결정 기록은 **없음**. 실제 채택된 노선은 반대에 가까움:
  - 현 와이어프레임 = **구조화 JSON 스키마(`WireScreen2`) → React 컴포넌트가 회색조 박스로 렌더** ([[project_flowforge_wireframe_redesign]], [[project_manyfast_clone]]).
  - "ReactFlow 아닌 순수 HTML/CSS로 렌더"까지는 맞음(사용자 기억의 "html" 부분과 접점). 하지만 **iframe 아님**, **html+js 자유저작 아님** — 좌표 없는 grid/stack 박스라 4번(실화면 안 맞음)·5번(정적) 원인.
  - 원천도 "100% AI 생성" 확정인데 현재는 하드코딩 픽스처에 머묾.
  - → 사용자가 떠올린 "iframe+html/js"는 **manyfast 원본 방식이거나 논의 중 나왔지만 미채택된 대안**으로 추정.
- **핵심 의미**: iframe+HTML/JS 노선으로 가면 **4·5번이 한 방에 풀림**. 진짜 HTML이면 실제 레이아웃(4번 해결) + 진짜 클릭·입력 동작(5번 해결). 지금의 JSON→박스 스키마는 태생적으로 둘 다 불가.
- **트레이드오프**:
  - JSON 스키마 노선(현재): 구조화·검증·audit 연동 쉬움 / 표현력·인터랙션 태생적 한계.
  - iframe+HTML/JS 노선: 실화면·실동작 재현 / 자유 HTML은 검증·구조매핑 어려움, 보안(iframe sandbox·XSS), AI 생성물 신뢰.
- **결정 필요(가장 근본적)**: 와이어프레임을 (a) 현 JSON→박스 스키마 유지하며 개선 vs (b) iframe+HTML/JS 자유 렌더로 전환. 이게 4·5·8번을 관통하는 상위 결정.
- ⚠️ 사용자 기억 vs 실제 구현이 어긋나므로, 실제로 iframe/html+js 논의가 있었는지 대화 히스토리(memory-bank search-conversations) 확인 필요.
- **✅ 대화 로그 확인 완료(2026-07-10)**: memory-bank MCP는 네이티브 바인딩 깨져 실패 → 대화 JSONL 원본 직접 grep. **결론: "와이어프레임을 iframe+html/js로 만들자"는 채택 결정 없음.** 오히려 iframe은 와이어 렌더 방식으로 나올 때마다 기각:
  - 2026-06-24 charter 통합 논의: "iframe 박제는 인터랙티브 시각화를 죽인다" → 재렌더(ReactFlow) 우선.
  - openspec 프로토타입 design: "WebView/iframe으로 그대로 쓰지 말고 React+ReactFlow로 번역 구현."
  - iframe 실사용처 = flowforge 와이어 아님, openspec 대시보드에서 완성 verify.html/prototype.html embed용.
  - **사용자 기억 출처 추정**: "html 작성"은 절반 사실(렌더러가 순수 HTML/CSS). "iframe"은 openspec 대시보드 embed 또는 charter 통합 때 논의만 되고 기각된 대안이 뒤섞인 것.
  - **의미**: iframe+html/js는 "복원할 과거 결정"이 아니라 **지금 새로 검토할 신규 방향**. 8번 결정은 여전히 유효(4·5번 한 방에 푸는 후보). 단 과거에 "인터랙티브 시각화를 죽인다"고 기각된 이력이 있으니 그 반론(iframe이 오히려 실동작을 살린다)을 짚고 결정해야.

### 9. flowforge 프로젝트 자체에 와이어프레임 산출물이 없음 🆕🔴
- 문제(정정): flowforge를 대상 프로젝트로 넣고 기획 산출물을 보니, **유저플로우 `main-v2`는 있는데 그에 대응하는 와이어프레임 산출물이 없음.** (앞서 "UI 연결 부재"로 오해 → 실제는 **flowforge 프로젝트의 와이어프레임 데이터 부재**.)
- 즉 산출물 파이프라인이 유저플로우까지는 채워졌는데 와이어프레임 단계는 flowforge 자신에 대해 비어있음.
- **✅ 조사 완료(라이브 API 실증, 2026-07-10)**: 가설 확정.
  - flowforge 와이어 승인분 `data/wireframe-feedback/flowforge.wireframe.json` **존재하지 않음** → `buildDocsPlanningWireframe2`가 **무조건 픽스처 폴백**(`wireDocs.ts:285-287`, `docs.ts:207-208` 주석 "고정 픽스처(D-6)").
  - 픽스처 = flowforge 목업 5화면(`grid/grid-m/skeleton/skeleton-m/features`)을 손으로 옮긴 고정 데이터(`planningWireframeFixture.ts`). 유저플로우 main-v2에서 파생된 게 아님.
  - **화면 id 교집합 = 0 (핵심 증거)**: 와이어 픽스처 id `[grid, skeleton, features...]` vs 유저플로우 main-v2 노드 id `[uflow-x-grid, uflow-x-skeleton, ...]` (접두어 체계 다름) → **매칭 하나도 없음**. 그래서 "main-v2에 대응하는 와이어 없음"으로 보임 = 사용자 지적 정확.
  - 근본: AI 와이어 생성기가 flowforge 밖(미배선) → `flowforge.wireframe.json` 생성/승인된 적 없음. "유저플로우 1개→와이어 1개" 자동 파생이 flowforge에서 안 돎.
  - flowforge 핀 피드백 파일에 남은 유일한 실데이터 = "manyfast 보고 똑같이 만들어라" 사용자 코멘트 1건(레이아웃 데이터 아님).
- 방향: 원인 규명 후 — (a)flowforge 와이어 실제 생성/승인 데이터 채우기 or (b)유저플로우→와이어 자동 파생 파이프 연결. 8번(렌더 방식)과 함께.
- 연관: 4·5·8번(와이어 데이터·렌더·인터랙션)의 구체적 증상. "유저플로우 1개→와이어 1개"([[reference_manyfast_spec]] §5) 파생이 flowforge에서 안 돎.

### 10. openspec-propose 산출물을 flowforge에서 확인 🆕🔴
- 문제: openspec-propose로 생성되는 문서들(proposal.md/design.md/spec.md/tasks.md)을 현재 **openspec.gaegul.house**(별개 리포트 서버)에서 확인함. 이걸 **flowforge에서 확인하기로 했던 것 같음** — 대화 확인 필요, 없으면 flowforge에서 보도록 구현.
- **✅ 대화 로그 확인 완료(2026-07-10) — 사용자 기억은 혼동**:
  - "propose 산출물을 flowforge에서 본다"는 결정 **없음(미결)**. 실제 결정(2026-06-19, 로그 원문): **"openspec.gaegul.house에 읽기전용 문서 뷰어를 만든다"** — 사용자 발언 "어디서 돌리든 발행만 하면 한 곳에서 본다", "openspec.gaegul.house = 외부 생성 openspec 문서를 폰/외부에서 확인하는 읽기 뷰어, change 페이지 탭=proposal/design/tasks/specs/verify/review/prototype". **"한 곳" = openspec.gaegul.house, flowforge 아님.**
  - 그 뷰어는 **이미 구현·배포됨**(`openspec-reports/server.py:80` DOC_MD=proposal/design/tasks, :723-724 탭 렌더). 즉 지금 openspec.gaegul.house에서 보는 게 **설계대로 정상**, 배선 누락 아님.
  - **flowforge엔 propose 원문 뷰어 없음**: flowforge는 proposal/design→PRD, spec.md→그래프/IA/트리로 **파싱해 시각화만** 함(원문 텍스트 뷰어 아님). tasks.md는 아예 안 읽음. change 탭=prd/spec/flow/ia/wire(전부 파생).
  - **기억 출처 추정**: flowforge가 proposal/design→PRD 패널, spec.md→그래프로 이미 매핑돼 있어 "flowforge가 propose를 보여준다"처럼 느껴진 것. 원문이 아니라 파생 시각화.
- **역할 경계(확정)**: openspec.gaegul.house = 발행/리포트/**원문 문서 뷰어**(verify·review·proposal·design·tasks 원문). flowforge = 그래프 **시각화**(파생 뷰).
- **결정 필요(신규 사안)**: propose 원문을 flowforge로도 가져올지는 **새로 결정**. 가져오려면 신규 구현(원문 탭 + tasks.md 리더 둘 다 부재). 두 시스템 역할 경계 재정의라 사용자 확인 먼저. → 지금 당장 "고쳐야 할 버그"는 아님. 원한다면 flowforge를 단일 창구로 통합하는 방향.

### 11. 기능명세서 뷰의 데이터 소스는? (planning vs propose) 🆕❓
- 질문: 기능 명세서가 **기획 단계(planning, `docs/planning/features.md`, openspec-plan 산출)**에서 나온 기능을 나열한 거냐, 아니면 **openspec-propose로 생성된 것(`changes/*/specs/*/spec.md`)**을 나열한 거냐?
- 배경: flowforge엔 두 계보가 있음(harness 조사 확인) — planning 기능명세(featureTreeBuilder) vs change spec-tree(specTreeBuilder). 둘 다 "기능"을 트리로 보여줄 수 있어 혼동 소지.
- **✅ 조사 완료(2026-07-10) — 답: 둘 다 있음, 같은 이름이 두 곳에**:
  - **"기능명세서" 레이블이 붙은 뷰가 정확히 2개**, 서로 다른 소스:
    | 뷰 | 나오는 위치 | 소스 | 산출 스킬 |
    |---|---|---|---|
    | change-view "기능명세서"(`spec`) | change 선택 후 5종 탭(`dashStage=views`, App.tsx:941) | `changes/*/specs/*/spec.md` (Requirement/Scenario) | **openspec-propose** |
    | planning "기능명세서"(`features`) | 프로젝트 진입 직후 skeleton 탭(`dashStage=skeleton`, App.tsx:993) | `docs/planning/features.md` (요구사항/기능/상세기능) | **openspec-plan** |
  - **답**: 프로젝트 열자마자 나오는 기획 단계 탭 = planning(openspec-plan). change 하나 고른 뒤 탭 = propose(spec.md). **어느 화면에서 봤느냐로 갈림.**
  - 🔴**혼란 지점(진짜 이슈)**: 탭 레이블 문자열이 **양쪽 다 똑같이 "기능명세서"**(App.tsx:941 vs :993). 이름만으로 구분 불가, 대시보드 단계(views vs skeleton)로만 구분됨. 노드 타입은 코드상 분리(specTree vs featureTree)돼 있지만 사용자 눈엔 같은 이름 두 개.
- **파생 피드백(11-a)**: 두 "기능명세서"를 이름으로 구별되게 하거나(예: 기획 기능명세 vs change 명세), 계보를 명확히 안내해야 함. 사용자가 "이게 기획 거냐 propose 거냐" 물은 것 자체가 혼란의 증거.

### 12. 유저플로우 노드 → 연관 기능명세 표시 필요 🆕🔴
- 문제: 유저플로우에서 노드를 선택하면 **흐름(전이)만** 나옴. 그 노드가 **기능명세서의 어떤 기능과 연관된 건지** 알 수 있어야 함.
- 즉 유저플로우 화면/노드 ↔ 기능명세 상세기능 연결이 UI에 없음. 노드 클릭 시 "이 화면은 기능명세의 X, Y 기능을 담는다"가 보여야.
- 근거(기존 조사): manyfast 모델에서 **페이지(화면) ↔ 상세기능(leaf)은 N:M 연결**이 핵심 엔티티([[reference_manyfast_spec]] §핵심재발견: "상세기능=leaf가 연결단위, 화면을 매개로", "'상세 기능 연결' 버튼"). flowforge featureTree 노드에 이미 `screens`(상세기능 N:M 연결화면) 파생 필드 존재(featureTreeAdapter). → **데이터는 있는데 유저플로우 쪽에서 역방향으로 못 봄.**
- 방향: 유저플로우 노드 클릭 → 그 화면 id로 기능명세 상세기능 역조회 → 연관 기능 목록 패널/딥링크. 화면 id 조인키 이미 존재하니 저비용.
- 연관: 9번(유저플로우↔와이어 연결)과 같은 뿌리 = **화면 id로 산출물 간 상호참조 UI가 통째로 미배선**. 유저플로우 노드에서 →와이어, →기능명세 양쪽 다 필요. "화면을 허브로 3산출물(유저플로우·기능명세·와이어) 상호연결"이 공통 해법.

### 13. 기획문서 있는 프로젝트는 change 5종 뷰 진입 불가 🆕🔴 (라이브 확정)
- 문제: flowforge에서 openspec change 문서를 보는 경로가 **기획문서 유무로 갈림**. `App.tsx:989~` dashStage 분기:
  - **기획문서(docs/planning/) 있는 프로젝트**(flowforge 자신·ssoksok 등) → skeleton에서 기획 탭만 렌더, **하단 change 목록 블록이 `planTabsAvail===0` 조건이라 숨겨짐** → **change 5종 뷰 입구 없음**.
  - **기획문서 없는 프로젝트**(wowa-app 등) → change 목록 떠서 → capability 클릭 → change 클릭 → 5종 탭 진입 가능.
- 즉 **flowforge에서 flowforge 자신의 change 문서를 볼 수 없음**(기획문서 있어서 change 목록 숨김). 이게 "openspec 문서 어디서 보냐"가 헷갈린 실제 원인.
- 라이브 확정(8812): wowa-app→server-foundation-auth change로 PRD(proposal+design 5섹션 실데이터)·spec-tree(scenarioCount 20) 정상 확인. 단 그래프/와이어는 백엔드 change라 빈 응답(정상).
- **못 보는 것(라이브 확정)**: tasks.md(파서 0), verify.html/review.md(안 읽음, openspec.gaegul.house 몫), 원문 raw 마크다운 뷰어(없음, 전부 파생 시각화).
- 방향: 기획문서 있는 프로젝트도 change 목록에 접근 가능하게(기획 탭 + change 목록 병존). 계보 통합/네비 재설계(6번)와 직결.
- **사용자 방향(14번)**: change를 선택하면 5종 탭을 보는 걸 일관 진입로로 (아래 14번).

### 13-a. openspec change 문서 확인 동선 (참고, 라이브 확정)
```
랜딩(프로젝트 카드) → 프로젝트 클릭 → [기획문서 없어야] 하단 change목록(capability별) → capability 클릭 → change 클릭 → 상단 5종 탭(PRD·기능명세·유저플로우·IA·와이어)
```
| 탭 | openspec 소스 | 형태 |
|---|---|---|
| PRD | proposal.md+design.md | 5섹션 텍스트 |
| 기능명세서 | spec.md | 트리 |
| 유저플로우 | spec.md WHEN/THEN | 그래프 |
| IA | spec.md | 계층 트리 |
| 와이어 | spec.md | 화면 박스 |
※ 전부 파싱된 파생 시각화(원문 아님). tasks/verify/review는 flowforge에서 못 봄.

### 14. change 선택 → 5종 탭이 일관된 진입로 🆕🔴 (사용자 방향 제시)
- 사용자 방향: "기능명세서는 **change를 확인하고 선택하면** 5종 탭을 확인하도록 하고 싶다."
- 해석: 산출물(기능명세 포함)을 보는 진입로를 **"change 선택 → 그 change의 5종 탭"**으로 일관화. 지금처럼 기획문서 유무로 갈려 어떤 프로젝트는 change 뷰에 아예 못 가는(13번) 구조를 없앰.
- 이게 수렴하는 지점: 13번(진입 불가 함정 해소) + 6번(뷰 선택식→액션 기반) + 7번(산출물 4종 재정의)이 한 방향.
- **결정/확인 필요 (내 해석, 애매점 표시)**:
  - (a) planning 계보(기획문서 기반 5종 뷰)와 change 계보 중 **change 계보를 주 진입로로** 삼는 것인가? 그럼 planning 탭(기획문서 있는 프로젝트의 기획 단계 뷰)은 어떻게 되나 — 유지/통합/제거?
  - (b) 아니면 planning은 그대로 두되, **모든 프로젝트에서 change 목록도 항상 보이게** 해서 change 선택→5종 탭 경로를 열어주는 것인가(13번 함정만 제거)?
  - (c) "기능명세서"가 11번에서 두 계보에 다 있었는데, change 계보 것으로 단일화하려는 의도인가?
  - → 이건 flowforge 정보구조의 상위 결정이라 사용자와 (a)/(b)/(c) 확정 필요.
- 방향(잠정): change가 flowforge의 1급 단위가 되고, change 선택 시 그 change의 spec.md에서 파생된 5종(PRD/기능명세/유저플로우/IA/와이어)을 보는 걸 표준 동선으로.

### 15. propose 완료 링크를 flowforge change 5종 탭 URL로 🆕🔴 (harness+flowforge)
- 요구: openspec-propose로 문서가 만들어지고 **문서 확인 링크를 전달할 때, flowforge의 그 change 5종 탭 화면 URL로** 전달해야 함.
- 배경: 14번(change→5종 탭 표준 진입로) 결정의 자연스러운 귀결. 지금은 propose 링크가 openspec.gaegul.house(원문 뷰어)로 추정 → flowforge change 뷰로 바꿈.
- **✅ 조사 완료(코드 근거, 2026-07-10)**:
  - 현재 propose 링크 = **`https://openspec.gaegul.house/<change-name>/`** (verify와 동일 발행 인프라: `publish_docs.py`, `VERIFY_UPLOAD_URL/TOKEN` env 게이트, URL은 모델이 `SKILL.md:178,197` 지시로 발행 JSON의 `url` 필드를 요약에 박음).
  - **flowforge change 딥링크 URL = 없음 (URL 라우팅 0)**: `useSearchParams`/`history.pushState`/`location.search`/`popstate`/react-router **전부 grep 0건**. 뷰 상태(project·change key·tab)가 전부 `useState` in-memory. `openChangeViews`(App.tsx:892)는 순수 setState, URL 안 건드림. 마운트 시 URL 판독 없음 → **어떤 URL로 와도 항상 grid에서 시작, 특정 change 탭 링크 존재 불가**.
- **필요 작업(2곳, 순서 있음)**:
  1. 🔴**(flowforge, 선행)** change 뷰 딥링크 URL 스킴 신설 — `App.tsx`: `openChangeViews`/`tabBtn`에서 `history.pushState`로 `?project=X&change=Y&tab=prd` 기록 + 마운트 useEffect로 URL 파싱해 상태 복원(`setDashStage("views")`). 서버 API는 이미 `?project=` 지원(변경 불필요). 배포=`docker compose up -d --build`로 라이브 검증.
  2. **(harness)** openspec-propose `SKILL.md:166-178,197`의 링크 안내를 `https://flowforge.gaegul.house/?project=<p>&change=<name>&tab=prd` 조립·노출로 수정(소스+캐시 1.1.8 양쪽). change name·project(VERIFY_PROJECT env) 재료 이미 있음.
- **판단 포인트(사용자 결정)**: openspec.gaegul.house 발행 유지한 채 **링크만 flowforge로** vs 발행 자체 대체. flowforge는 리포 직접 읽어 발행 없이도 change 봄(단 데이터 접근 경로 확인 필요=아래 미확인).
- ⚠️ **확인 못 함**: flowforge가 임의 프로젝트의 propose-생성 change 디렉토리까지 실제로 서빙 가능한지(리포 루트/`?project=` 해석 범위) = flowforge 서버 API 로직 별도 확인 필요.
- 연관: 13·14번(change 진입로) 선행 전제. 10번(역할 경계: openspec.gaegul.house=원문/리포트 vs flowforge=시각화) 재정리 직결 — propose만 flowforge로 갈리면 verify/review와 링크 일관성 결정 필요.

---

## 🧭 구조 정리: flowforge의 두 시각화 계보 (planning vs change)

> 여러 피드백(7·9·11·12번)을 관통하는 핵심 구조. flowforge엔 **같은 5종 뷰가 두 벌** 존재.

**A. planning 계보** (프로젝트 진입 직후 skeleton 단계) — 원천: `openspec-plan`
- PRD ← `docs/planning/prd.md`
- 기능명세 ← `docs/planning/features.md` (각각 별도 파일)
- 유저플로우 ← `docs/planning/user-flow/*.md` (Mermaid)
- IA·와이어 ← features.md 화면목록에서 파생

**B. change 계보** (change 하나 선택한 뒤 5종 탭) — 원천: `openspec-propose`
- PRD ← `proposal.md` + `design.md`
- 기능명세(spec-tree) ← `changes/*/specs/*/spec.md` (Requirement/Scenario)
- 유저플로우(graph)·IA·와이어 ← **전부 같은 `spec.md` 하나를 여러 각도로 파싱**
- `tasks.md` = 안 보여줌 / `prototype.html` = 안 읽음

**→ openspec-propose 산출물 매핑 요약**: proposal+design→PRD, spec.md→(기능명세·유저플로우·IA·와이어) 4뷰 동시, tasks/prototype→미표시.
**→ 혼란의 근원**: 같은 이름(기능명세서 등)이 두 계보에 붙음(11번). 산출물 간 상호참조 UI 부재(9·12번)도 이 두 계보가 화면 id로만 느슨히 엮여서.
⚠️ 미정: 사용자가 원하는 최종 그림이 planning 계보 중심인지, change 계보 중심인지, 둘을 어떻게 통합/구분할지 = 상위 결정 필요.

---

## 🔗 agentic-harness openspec-* 워크플로우 파급 분석

> 피드백 반영이 harness의 openspec-* 스킬(propose/plan/apply/verify/review/archive/audit)에 영향을 주는지 분석.
> 배경: flowforge는 harness `generate_prototype.py`를 시드 복제, planning 산출물 포맷(features.md·user-flow.md·spec.md 마커·화면 id `<!-- screen: id -->`·`## capability:`)을 harness와 정합하도록 설계됨.

- **✅ 조사 완료(2026-07-10)**. 핵심 3가지:
  1. **두 레포 간 런타임 코드 의존성 0** (import·공유파일·DB 없음). 결합 = harness가 마커 문법·파일배치 *생성* → flowforge가 *읽기전용 파싱*하는 **일방향 포맷 계약**뿐.
  2. **진짜 결합키 = 화면 id 마커(`<!-- screen: id -->`) + capability 영문키**. IA도 와이어도 **harness 산출물이 아님**(IA는 harness에 아예 없음, 와이어는 openspec-plan에 설계만 있고 **미구현**).
  3. **flowforge planning 5종 뷰 원천을 write하는 스킬 = openspec-plan 하나뿐.** 와이어 생성 스킬은 **없음**(`wireframe.suggestions.json` writer가 harness에 grep 0건).

### 스킬 → flowforge 표시 데이터 매핑
| openspec 스킬 | write하는 파일 | flowforge 어느 뷰 | 비고 |
|---|---|---|---|
| **openspec-plan** | prd.md, features.md(+화면목록·capability 마커), user-flow/*.md(Mermaid), spec.md | planning 5종 중 4종 원천(PRD·기능명세·유저플로우), IA·와이어도 features.md 화면목록서 파생 | **유일하게 planning 원천 write** |
| **openspec-propose** | changes/*/proposal·design·tasks·specs/*/spec.md·prototype.html | change 뷰(graph/ia/wireframe/spec-tree)=spec.md 파싱, PRD=proposal+design | prototype.html은 flowforge 안 읽음 |
| **openspec-explore** | design·proposal 초안 | propose가 이어받아 change 뷰로 | 단독 표시변경 확인 못함 |
| **openspec-apply** | 코드 구현 + tasks.md 체크 | **거의 무영향**(flowforge는 tasks 진행률 표시 안 함) | |
| **openspec-verify** | verify.json/html | **flowforge 반영 안 됨** → openspec.gaegul.house 몫 | ← 10번과 직결 |
| **openspec-review** | review.md | **flowforge 반영 안 됨**(읽는 코드 0) | |
| **openspec-archive** | change→archive/ 이동 + specs/ 병합 | change 목록 뷰에 반영(archive 펼침) | |
| **openspec-audit** | audit PASS/FAIL | flowforge audit 배지(`auditSummary.ts`) | 배선 경로 부분확인 |

### 피드백별 harness 파급
- **1·2·5·6번**: harness 영향 **없음**(순수 flowforge 프론트/파서).
- **3번**(핀 후속): 없음(flowforge 전용 RW 볼륨).
- **4·8번**(와이어 렌더/스키마): **조건부(약)** — 현재 harness에 와이어 생성기 없어 갈라질 대상 없음. 단 flowforge가 좌표 스키마로 가면 훗날 harness 와이어 구현 시 그 스키마 맞춰야 함(**미래 계약 부채**).
- **7번**(IA 제거): **거의 없음** — harness는 IA를 준 적 없어 제거해도 안 깨짐(audit/sync_specs/charter 모두 IA 안 읽음). 🔴**단 주의**: IA를 없앤다고 features.md의 `<!-- screen: id -->` 화면목록 마커까지 걷으면 유저플로우·와이어 조인키가 함께 무너짐 → **IA 뷰만 빼고 화면목록 마커는 유지**.
- **9번**(와이어 없음): **있음(공백 노출)** 🔴 — **이게 진짜 파급점.** flowforge 와이어를 채울 "외부 스킬"은 openspec-plan이어야 하는데 그 와이어 단계가 **설계만 있고 미구현**(SKILL.md:3,13,276이 예약 자리). `wireframe.suggestions.json` writer가 harness에 0건. → 와이어를 실제로 채우려면 **harness에 와이어 생성 단계 신설 필요**(flowforge만 고쳐선 안 됨).

**총평**: flowforge 프론트/렌더 피드백(1·2·5·6·8)은 harness 무관. 진짜 harness 작업이 필요한 건 **9번(openspec-plan에 와이어 생성 단계 신설)**. 7번은 "IA 뷰만 제거, 화면 id 마커는 존치"가 안전 조건.

---
_최종 업데이트: 2026-07-10_
