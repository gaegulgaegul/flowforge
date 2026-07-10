# Flowforge 피드백 실행계획

> 근거: `FEEDBACK_TODO.md` (피드백 15건 + 조사 완료). 이 문서는 그걸 **근본원인별로 묶고 착수 순서**를 잡은 계획이다.
> 원칙: 구조변경과 동작변경 분리, 단계별 검증 후 다음(§5). harness 작업과 flowforge 작업 분리 표기.

---

## 0. 한 줄 비전 (피드백에서 수렴한 그림)

**flowforge = openspec change의 단일 확인 창구.**
`change 선택 → 5종 탭(PRD·기능명세·유저플로우·와이어)으로 모든 산출물 확인`, propose가 끝나면 그 flowforge change URL을 링크로 받는다. 산출물은 화면(page)을 허브로 서로 연결되고, 와이어는 실제 화면에 가깝고 동작한다.

---

## 1. 근본원인별 그루핑 (15건 → 5개 축)

| 축 | 피드백 | 근본 문제 |
|---|---|---|
| **A. change 단일 진입로 + 링크** | 6, 13, 14, 15 | 기획문서 유무로 change 뷰 진입이 갈림(13). change→5종 탭을 표준 진입로로(14), 뷰 선택식→액션(6), propose 링크를 flowforge change URL로(15, 딥링크 URL 부재) |
| **B. 산출물 구조 재정의** | 7, 1, 2, 11 | 산출물 4종(PRD·기능명세·유저플로우·와이어)+IA 제거(7). 기능명세/IA를 다이어그램 아닌 리스트/트리로(1,2). "기능명세서"가 planning·change 두 계보에 중복(11) |
| **C. 산출물 상호연결(화면 허브)** | 9, 12 | 화면 id 공유는 있는데 산출물 간 상호참조 UI 부재. 유저플로우 노드→와이어(9), 유저플로우 노드→연관 기능명세(12) |
| **D. 와이어프레임 근본** | 4, 5, 8, 9-데이터 | 픽스처 기반이라 실화면과 다름(4), 정적이라 인터랙션 없음(5), 렌더 방식 iframe+html/js 검토(8), flowforge 자체 와이어 데이터 없음(9) |
| **E. 핀 피드백 후속 액션** | 3 | 저장(append)에서 끝, resolve/목록/반영 없음. status·id 필드조차 없음 |

---

## 2. 상위 결정 게이트 (착수 전 사용자 확정 필요 — 이게 정해져야 나머지가 굴러감)

> 아래는 코드로 못 정하는, 사용자만 정할 수 있는 방향. **여기부터 답이 필요.**

- **G1. planning 계보의 운명 (B·A의 뿌리)** — ✅**확정: (b)** planning 유지 + 모든 프로젝트에서 change 목록도 항상 노출(13 함정만 제거). 최소 변경, 14 발언과 정합.
  - → Phase 1 = App.tsx:989~ `planTabsAvail===0` 분기를 없애 기획 탭과 change 목록을 **병존** 렌더. planning 뷰는 안 건드림.
- **G2. IA 제거 (B)** — ✅**확정: IA 뷰만 제거, 화면 id 데이터 존치.** 화면 id 마커(`<!-- screen: -->`)는 유저플로우·와이어 조인키라 유지. 산출물 5종→4종.
- **G3. 와이어 렌더 노선 (D)** — ✅**확정: iframe+html/js 전환.** 진짜 HTML/JS로 그려 실화면 근접(4)+클릭·입력 동작(5)을 한 방에. 부담=검증·보안(iframe sandbox·XSS)·AI 생성물 신뢰. 과거 "인터랙티브 죽임" 기각은 *정적 박제* 기준이라 지금 노선과 무관. → **Phase 5가 "박스 개선"이 아니라 "렌더 아키텍처 교체 + 생성물이 HTML"로 재정의됨.**
- **G4. 링크/발행 경계 (A)** — ✅**확정: 링크만 flowforge로.** openspec.gaegul.house 원문/verify/review 발행은 유지, propose 완료 안내 링크만 flowforge change URL로 추가/교체. 최소 변경.

---

## 3. 착수 순서 (의존성 기반 페이즈)

### Phase 0 — 딥링크 URL 스킴 (모든 것의 병목, flowforge)
> 15번 조사 확정: flowforge에 URL 라우팅이 0. 이게 없으면 A축 전체(링크·진입로)가 불가.
- **flowforge**: `web/src/App.tsx`에 change 뷰 딥링크. `openChangeViews`/`tabBtn`에서 `history.pushState`로 `?project=X&change=Y&tab=prd` 기록 + 마운트 useEffect로 URL 파싱→상태 복원(`setDashStage("views")`). 서버 API는 이미 `?project=` 지원(무변경).
- 검증: `docker compose up -d --build` → 실제 URL 클릭으로 5종 탭 복원 라이브 확인.
- 선행: 없음. **여기부터 시작 가능.**

### Phase 1 — change 단일 진입로 (A: 13·14·6)
- **flowforge**: 기획문서 있는 프로젝트도 change 목록 접근 가능하게(App.tsx:989~ `planTabsAvail===0` 분기 제거/완화). change 선택→5종 탭을 표준 동선으로.
- 선행: 없음(Phase 0과 병행 가능). G1 결정 필요.

### Phase 2 — propose 링크를 flowforge URL로 (A: 15, harness)
- **harness**: openspec-propose `SKILL.md:166-178,197` 링크 안내를 `https://flowforge.gaegul.house/?project=<p>&change=<name>&tab=prd`로. 소스+캐시 1.1.8 양쪽.
- 선행: **Phase 0 필수**(URL 스킴 존재해야 조립 가능). G4 결정 필요.
- ⚠️ 미확인: flowforge가 propose-생성 change 디렉토리까지 서빙 가능한지 별도 확인.

### Phase 3 — 산출물 구조 재정의 (B: 7·1·2·11)
- **flowforge(프론트)**: 기능명세·IA를 리스트/트리 렌더로(1·2). IA 뷰 제거(7, G2대로 화면 id 마커는 존치). "기능명세서" 두 계보 이름 구분(11).
- harness 영향: 거의 없음(순수 프론트). **단 7번은 features.md 화면목록 마커 건드리지 말 것**.
- 선행: G1·G2 결정.

### Phase 4 — 산출물 상호연결 (C: 9·12)
- **flowforge**: 화면 id를 허브로 유저플로우 노드↔와이어(9)·↔기능명세(12) 상호참조 패널/딥링크. 데이터(화면 id 공유·featureTree.screens)는 이미 있음 → 저비용.
- 선행: Phase 1(진입로) 후가 자연스러움.

### Phase 5 — 와이어 근본: iframe+html/js 전환 (D: 4·5·8·9) 🔴 가장 큼, harness 필수
> G3 확정으로 재정의: 와이어 = 좌표없는 JSON 박스 → **실제 HTML/JS 문서를 iframe에 렌더**. 4(실화면)·5(인터랙션)·8(렌더방식)이 이 전환으로 한꺼번에.
- **flowforge(프론트/백)**: 와이어 렌더 아키텍처 교체 — `WireScreen2` JSON 박스 렌더러(`WireframeDeviceFrame.tsx`) 폐기하고 **HTML 문자열을 iframe(sandbox)으로 렌더**. 데이터 모델도 "요소 배열"→"화면별 HTML 문서"로. 보안=iframe `sandbox` 속성·CSP·XSS 방어 필수(§30-security).
- **harness**: openspec-plan 와이어 생성 단계 신설(현재 미구현, SKILL.md:3,13,276). 산출물이 이제 `wireframe.suggestions.json`(박스)이 아니라 **화면별 HTML**(AI 생성). 이게 채워져야 flowforge 와이어가 실데이터(9의 근본).
- 핀 피드백(E)이 iframe 위 좌표라 renderOverlay 재검토 필요(현 핀은 박스 렌더 위 좌표).
- 선행: G3=확정. **flowforge 렌더 교체 + harness HTML 생성 둘 다 필요 — 9번은 harness 생성이 핵심.**
- ⚠️ 리스크: AI가 생성한 임의 HTML/JS를 렌더 = 보안 표면 큼. sandbox 격리·스크립트 정책 설계가 이 Phase의 절반. 적대적 리뷰(§70) 필수.

### Phase 6 — 핀 피드백 후속 액션 (E: 3)
- **flowforge**: 핀 스키마에 id·status 추가 → feedback GET+목록/인박스 뷰 → resolve 토글. (그 위 change/spec 반영은 별도.)
- 선행: 독립(언제든). harness 무관.

---

## 4. harness vs flowforge 작업 분리 (한눈)

| Phase | flowforge | harness |
|---|---|---|
| 0 딥링크 URL | ✅ App.tsx 라우팅 신설 | — |
| 1 change 진입로 | ✅ 분기 완화 | — |
| 2 propose 링크 | — | ✅ SKILL.md 링크 수정 |
| 3 산출물 구조 | ✅ 렌더·IA제거 | (마커 건드리지 않기) |
| 4 상호연결 | ✅ 상호참조 UI | — |
| 5 와이어 근본 | ✅ 렌더 개선 | 🔴 와이어 생성 단계 신설 |
| 6 핀 피드백 | ✅ 스키마·뷰·resolve | — |

**harness 실작업 = Phase 2(링크) + Phase 5(와이어 생성)** 둘뿐. 나머지는 flowforge 프론트/백엔드.

---

## 5. 추천 착수 순서 (의존성 최소, 효과 빠른 것부터)

1. **Phase 0 (딥링크 URL)** — 병목 제거, 독립, 즉시 가능.
2. **Phase 1 (change 진입로)** — 13 함정 해소, 비전의 핵심 동선. G1 결정 후.
3. **Phase 2 (propose 링크)** — Phase 0 위에서 harness 한 줄. G4 결정 후.
4. **Phase 6 (핀 피드백)** — 독립·작음, 아무 때나 끼워넣기 좋음.
5. **Phase 3 (산출물 구조)** — G1·G2 결정 후.
6. **Phase 4 (상호연결)** — Phase 1·3 후.
7. **Phase 5 (와이어 근본)** — 가장 크고 harness 얽힘. G3 결정 후 마지막.

> 각 Phase는 openspec change 하나로 독립 배포 가능하게(MVP 단위). flowforge는 openspec 도그푸딩 중이니 각 Phase를 propose→apply→verify→archive로.

---

## 6. 열린 질문 (사용자 답 대기)

- G1(planning 운명) / G2(IA 데이터 존치) / G3(와이어 노선) / G4(링크 경계) — §2.
- 어느 Phase부터 실제 착수할지.

---
_작성: 2026-07-10. 근거=FEEDBACK_TODO.md 조사 완료분._
