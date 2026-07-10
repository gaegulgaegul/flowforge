# Design — planning-wireframe-generation-feedback

> 이 문서는 explore 대화(2026-07-10, 디스코드)에서 확정된 결정의 단일진실원이다.
> propose는 이 문서를 먼저 읽고 proposal/specs/tasks를 생성한다. 여기 적힌 결정을 재질문하거나 덮어쓰지 않는다.

## 배경 / 위치

flowforge 와이어 재설계 3단계 중 **후속 2단계(②AI 생성 + ③피드백 재생성)를 한 change로 묶은 것**.
- 1단계(`planning-wireframe-device`, archive 완료): 디바이스 프레임 렌더러. 지금 레이아웃 원천 = 하드코딩 픽스처(`server/src/parser/planningWireframeFixture.ts:189` `buildDocsPlanningWireframe2`). 주석에 "AI 생성물이 나중에 이 함수를 대체한다(후속 change)" 명시 — **이 change가 그 후속.**
- 목표 데이터 타입은 이미 확정: `shared/src/wire-screen2-types.ts` `WireScreen2[]`.

## 확정 결정 (명섭 님, explore 2026-07-10)

### D1. 스코프 = 옵션 (나) — 생성 + 렌더 + 피드백 루프 한 묶음
비교 페이지(https://claude.ai/code/artifact/605bb940-98c8-46bc-ac48-b9e999586b27)에서 (가)위저드부터 vs (나)생성기까지 중 **(나)** 선택. 즉 AI 레이아웃 생성 + 화면별 피드백 재생성까지 한 change.

### D2. 피드백 형태 = B형 인플레이스 핀 — 와이어 위 지점 클릭 → 그 좌표 피드백 (Figma 코멘트식)
**🔴정정 (2026-07-10, 명섭 님): "화면마다 입력칸 나열"이 아니다.** 확정 목업=https://claude.ai/code/artifact/58662136-ea2c-44e4-9a2d-cc1875574202 (단일진실원).
- **와이어프레임 위에서 고칠 지점을 ⌘(cmd)+클릭 → 클릭한 그 좌표에 팝오버(텍스트 입력) → 저장하면 그 자리에 핀이 꽂힌다.** Figma 코멘트처럼 인플레이스.
- **지점 단위(옵션 1)**: 피드백이 클릭한 좌표(xPct·yPct)에 묶인다. "여기(하단 메뉴)를 탭바로"처럼 위치가 의미를 가짐. 화면 단위(옵션 2, 위치는 그냥 트리거)가 아님.
- 핀이 꽂힌 영역(본문/상단메뉴/사이드/하단바)이 좌표에서 자동 인식돼 표시. 핀·목록 클릭 시 재열림. 데스크탑/모바일 각각.
- 외부 AI가 핀의 좌표+내용을 읽어 **그 지점만** 재생성(A안 릴레이 유지).
- 사람은 레이아웃을 손저작하지 않는다(원천 100% AI). 확인·피드백만, 반영도 AI가.
- **폐기**: 화면별 입력칸 나열 방식(`WireframeFeedbackInput` 초판)은 틀림 → 핀 방식으로 재구현.

### D3. 아키텍처 = A안 — 파일 릴레이 (flowforge는 쓰기만, 재생성은 밖 스킬)
flowforge는 LLM을 부르지 않는다(읽기 거울 원칙 유지). 재생성 트리거는:
```
사람: 화면 <home>에 "하단을 탭바로 바꿔줘" 피드백 입력
  │
  ▼  flowforge: feedback 사이드카에 append (write만) — 처음 생기는 "사람→AI 역방향" write
  │     docs/planning/wireframe/<project>.feedback.json (또는 서버 규약 경로)
  ▼
밖의 스킬(openspec-plan 계열)이 feedback을 읽고 → 그 화면만 AI 재생성 → 제안 큐 갱신
  │
  ▼  flowforge: 재조회(폴링/수동 새로고침) → 새 WireScreen2 표시
```
- B안(flowforge가 워커/AI 직접 호출) 기각 — flowforge를 최초의 AI 실행주체로 만들고 비가역 인프라(워커·인증·RCE 게이트)를 부름. 이 change 범위 밖.
- 최종 UX는 A/B 동일("피드백 남기면 그 화면이 다시 그려짐"). 차이는 즉시성뿐(A=스킬 돌 때).

## flowforge 기존 패턴 (조사 확인) — 상속 vs 신설

flowforge = "읽기 거울". 3도메인(features/prd/userflow) 공통:
- `*-generation`: 외부 스킬이 원천에 직접 write, flowforge 무관 (단, wireframe은 `.md`가 아니라 `WireScreen2[]` JSON 소비)
- `*-approval-queue` + `*-approval-apply`: 스킬이 `*.suggestions.json`에 완성 제안 → flowforge 승인/반려 3택 → 승인분만 반영
- 제안 큐 = `{version:1, suggestions:[...]}`, apply=`{approve:[],reject:[]}`, result=`{applied,rejected,remaining,skipped,writeFailed?,queuePruneFailed?}`. self-roundtrip 방어+422+배치상한200.
- 🔴 **재생성·피드백·자유텍스트입력 = 기존에 전혀 없음.** 위저드는 버튼 3택뿐, 사용자 텍스트→서버 write 경로 0. **B형은 flowforge 최초의 사람→AI 역방향 = 완전 신규 계약.**

| 항목 | 상속(재사용) | 신설 |
|---|---|---|
| 사이드카 큐 read/apply, throw금지, id dedup, prune재독 | ✅ docs.ts/featureDocs.ts/userFlowDocs.ts 원형 | — |
| self-roundtrip 방어 + writeFailed 422 + queuePruneFailed | ✅ 동일 계약 | — |
| 위저드 셸(순회·체크포인트·요약·appliedTick) | ✅ ApprovalWizard.tsx | — |
| WireScreen2[] 데이터 모델 + 디바이스 프레임 렌더 | ✅ wire-screen2-types.ts + WireframeDeviceFrame.tsx | — |
| 와이어 제안 큐(WireScreen2 제안) read/apply | — | 신설(3형 원형 복제) |
| **화면별 피드백 아이템**(screenId + 자유텍스트) | — | 신설 |
| **feedback 사이드카 write 경로**(flowforge→밖) | — | 신설 (flowforge 2번째 write, 첫 write=유저플로우 좌표 overlay) |
| **화면별 피드백 입력 UI**(textarea + 제출) | — | 신설 |
| **AI 재생성 자체** | — | flowforge 밖 스킬 책임(이 change는 계약·자리만, 실제 생성 로직은 별도) |

## 예상 capability 분할 (기존 네이밍 관례 따름)
- `planning-wireframe-generation` — AI가 WireScreen2[] 제안을 생성(밖 스킬). 입력=기능명세+유저플로우+화면목록. 결과=와이어 제안 큐. (features/userflow-generation과 동형, 단 산출=JSON 큐)
- `planning-wireframe-approval-queue` + `planning-wireframe-approval-apply` — 제안 큐 read + 승인 반영(픽스처 자리를 승인분으로 대체, `buildDocsPlanningWireframe2` 교체 지점)
- `planning-wireframe-feedback` — **신규**: 화면별 피드백 입력 → feedback 사이드카 write → 재조회로 재생성분 반영. (A안 파일 릴레이)

## 확정 설계 세부 (apply Phase 0 grounding 후 확정, 2026-07-10)

### D4. 저장 포맷 = JSON 사이드카 (라인패치 아님)
- 와이어 원천은 `WireScreen2[]` **JSON 구조체**라 features(라인 제자리 교체)·userflow(mermaid append)의 라인패치 invariant를 복제할 수 없다.
- **와이어 제안 큐 + 승인분 원천 = JSON 사이드카**. 큐=`<docsDir>/planning/wireframe.suggestions.json`, 승인분=`<docsDir>/planning/wireframe.json`(또는 동등). read/apply는 JSON parse/stringify, invariant는 `wireframeInvariantHolds`=**화면 id 집합 보존** 비교(라인 재파싱 아님 — spec이 이미 화면id 기준).
- **주의**: 승인분 원천(`wireframe.json`) write도 docsDir(홈 RO)에 떨어지면 안 됨 → 아래 D5 볼륨 규약 적용 대상. 단 큐 read는 외부 스킬이 쓴 걸 읽기만 하므로 RO에서도 됨. **write 대상(승인분·feedback)만 RW 볼륨.**

### D5. feedback write 볼륨 = B안 전용 RW 마운트 (명섭 님 확정 2026-07-10)
🔴 flowforge 컨테이너는 홈(`/home/gaegul`→`/data/docs-root`)을 **`:ro`** 마운트라 docsDir 하위 write 불가(EROFS). 기존 userFlowOverlay·PRD write도 프로덕션 마운트에선 실패하는 잠재버그(테스트만 tmp라 통과).
- **B안 규약**: feedback 전용 RW 볼륨 추가.
  - docker-compose.yml: env `WIREFRAME_FEEDBACK_ROOT: /data/wireframe-feedback` + volume `/home/gaegul/flowforge/data/wireframe-feedback:/data/wireframe-feedback`(RW, `:ro` 없음).
  - 호스트 폴더 `mkdir -p /home/gaegul/flowforge/data/wireframe-feedback` + flowforge `.gitignore`에 `data/wireframe-feedback/` 추가(피드백 git 오염 차단).
  - flowforge write 경로: `<WIREFRAME_FEEDBACK_ROOT>/<project>.feedback.json`. env 미설정 시 폴백은 tmp 또는 로컬(테스트).
- **승인분 원천(`wireframe.json`)도 같은 RW 볼륨에 두거나**, 승인 반영을 feedback과 같은 볼륨 규약으로. (홈 RO라 docsDir엔 못 씀.) → apply 때 승인분 저장 위치를 `WIREFRAME_FEEDBACK_ROOT` 하위(예: `<root>/<project>.wireframe.json`)로 통일.
- 홈 전체는 RO 유지(보안 표면 안 키움). graph-overlay가 `/data/openspec`에 쓰는 것과 같은 전용 RW 볼륨 패턴.
- **적용 시점**: apply 코드 완료 후 VERIFY의 `docker compose up -d --build` 때. 그전까지 컨테이너 무변경. 테스트는 tmp 픽스처라 마운트 무관하게 통과.

### D6. 재생성 격리 = 화면 id 단위
- 외부 스킬이 feedback을 읽어 그 `screenId` 화면만 재생성해 제안 큐 갱신. flowforge는 재조회로 그 화면만 갱신 반영, 타 화면 승인분 불변(`wireframeInvariantHolds` 화면id집합 보존이 이를 강제).

### D7. WireframeDeviceFrame 재사용 마찰 (Phase 0 발견)
- `WireframeDeviceFrame({screens})`는 항상 디바이스 토글+화면 탭 크롬을 렌더 → 위저드 renderCard 내 단일 미리보기로 쓰면 크롬이 딸려옴. 내부 `DesktopScreen`/`MobileScreen`은 미export.
- **대응**: 위저드 미리보기는 전체 `WireframeDeviceFrame`을 그대로 쓰되(크롬 허용) 제안 화면만 넘기거나, controls 숨김 prop 1개 추가(최소 신설). 순수 프레임 export는 과함 — controls 숨김 prop이 게으름위계상 최소.

### D8. 피드백 = 위저드 apply와 별도 경로 (Phase 0 확정)
- 위저드 `onApply(approve, reject)` 시그니처는 자유 텍스트를 못 나름 → **feedback write는 위저드 승인과 독립된 별도 라우트/핸들러**. 이건 spec/design과 일치(피드백은 승인/반려가 아니라 재생성 지시).

폐기 잔재 없음(element 세로박스는 1단계에서 이미 제거 완료).

## 화면 구성 / UI

- 화면 구조·흐름·이동(딥링크)의 명세는 `prototype.html`을 단일 출처로 한다. (DESIGN.md가 없어 와이어프레임 골격으로 그려짐 — 실제 디자인 토큰 미반영.) **이 HTML은 명세이지 구현물이 아니다 — WebView로 그대로 쓰지 말고**, 웹(React)으로 같은 화면·흐름을 번역해 구현한다.
- 이 change의 UI 핵심: 와이어 뷰(디바이스 프레임, 1단계 `WireframeDeviceFrame` 재사용) + 화면별 자유 텍스트 피드백 입력(신규 textarea→write) + 와이어 승인 위저드(`ApprovalWizard` 셸 재사용).

관련: [[project-flowforge-wireframe-redesign 메모리]], 1단계 spec=`openspec/specs/planning-wireframe-device/spec.md`
