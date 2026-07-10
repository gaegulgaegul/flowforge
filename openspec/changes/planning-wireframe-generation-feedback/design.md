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

### D2. 피드백 형태 = B형 — 화면별 자유 텍스트 → 그 화면만 재생성 (대화형)
- 위저드 3택(승인/반려/건너뛰기)이 아니라, **각 화면에 자유 텍스트 피드백을 남기면 그 화면만 AI가 다시 만든다.**
- 반려(A형: 반려+사유→전체 재생성)는 기각. 화면 단위 대화형이 명섭 님 의도.
- 사람은 레이아웃을 손저작하지 않는다(원천 100% AI). 확인·피드백만, 반영도 AI가.

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

## 열린 설계 세부 (propose에서 구체화)
- feedback 사이드카 파일 경로/스키마 정확한 규약 (screenId·text·ts·상태)
- 재생성분이 큐로 오는지 vs `.md`/JSON 직접인지 (generation은 직접write, approval은 큐 — 와이어는 어느 쪽?)
- "그 화면만" 재생성의 화면 단위 격리 방법 (WireScreen2.id 기준)
- flowforge 컨테이너 write 제약(홈 RO 마운트 여부 — audit-trigger 때 `/home/gaegul:...:ro`였음). feedback write가 어느 볼륨에 떨어지는지 확인 필요.
- 폐기 잔재 없음(element 세로박스는 1단계에서 이미 제거 완료).

## 화면 구성 / UI

- 화면 구조·흐름·이동(딥링크)의 명세는 `prototype.html`을 단일 출처로 한다. (DESIGN.md가 없어 와이어프레임 골격으로 그려짐 — 실제 디자인 토큰 미반영.) **이 HTML은 명세이지 구현물이 아니다 — WebView로 그대로 쓰지 말고**, 웹(React)으로 같은 화면·흐름을 번역해 구현한다.
- 이 change의 UI 핵심: 와이어 뷰(디바이스 프레임, 1단계 `WireframeDeviceFrame` 재사용) + 화면별 자유 텍스트 피드백 입력(신규 textarea→write) + 와이어 승인 위저드(`ApprovalWizard` 셸 재사용).

관련: [[project-flowforge-wireframe-redesign 메모리]], 1단계 spec=`openspec/specs/planning-wireframe-device/spec.md`
