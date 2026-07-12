# Design — flowforge-wireframe-iframe

> Phase 5. 와이어를 좌표 없는 JSON 박스 렌더(`WireScreen2` + `WireframeDeviceFrame`)에서 **화면별 HTML 문서 + sandbox iframe** 렌더로 전환한다. 이 change의 절반은 보안이다 — 임의 HTML/JS를 렌더하기 때문. HOW를 격리·CSP·XSS·데이터모델·핀좌표·harness 계약 순으로 확정한다.

## D0. 배경 (왜 iframe인가)

- 현 렌더(`WireframeDeviceFrame.tsx`)는 `WireScreen2` 요소 배열(`wire-screen2-types.ts:31-39`, x/y/w/h 없음)을 CSS grid/flex로 근사한다 → 좌표가 없어 실화면과 근본적으로 다르다(피드백4).
- 요소는 `goto` 화면전이만 있고 입력/제출 동작이 0이다 → 정적(피드백5).
- 원천은 픽스처(`buildDocsPlanningWireframe2` = 승인분 ?? `PLANNING_WIREFRAME_FIXTURE`, `wireDocs.ts:285-287`)라 flowforge 프로젝트 자체 와이어가 없다(피드백9).
- **G3 결정**: 좌표 없는 JSON → 진짜 HTML/JS 문서를 iframe에 렌더. 실 HTML이면 실화면 근접(4) + 동작(5)이 동시 해결. 렌더 방식 재검토(피드백8)의 귀결.

## D1. 위협 모델 (STRIDE 간이 — 임의 HTML/JS 렌더)

렌더 대상은 **AI가 생성한, 검증되지 않은 HTML/JS**다. 신뢰 경계 = flowforge 앱 오리진(토큰·상태·DOM) vs 와이어 문서.

| STRIDE | 위협 | 방어 |
|---|---|---|
| **Spoofing** | 문서가 flowforge UI를 흉내내 사용자 속임 | iframe은 프레임 크롬 안에 명시 렌더 + "최종 아님" 캡션. 부모 UI와 시각 분리 |
| **Tampering** | 문서 스크립트가 부모 DOM/상태 변조 | sandbox(allow-same-origin 미부여) → 부모 DOM 접근 불가 |
| **Repudiation** | (해당 약함) | — |
| **Information Disclosure** | 부모 쿠키/localStorage/토큰 읽기, 외부로 유출 | sandbox(부모 오리진 격리) + CSP(외부 fetch/script/img 차단) |
| **Denial of Service** | 무한루프·대용량 DOM으로 탭 마비 | iframe 격리로 부모 앱은 생존. 성능 절: 화면당 1 iframe·비활성 언마운트(D9) |
| **Elevation of Privilege** | sandbox 탈출 → 부모 오리진 코드 실행 | allow-same-origin **금지**(핵심). top-level navigation 미허용. frame-ancestors |

핵심 단일 실패점: **`sandbox="allow-scripts allow-same-origin"`**. 둘을 함께 주면 sandbox가 무력화되어 문서가 부모 오리진으로 승격된다 → 절대 금지. 이 change의 가장 중요한 acceptance(`flowforge-wireframe-sandbox-security`).

## D2. iframe sandbox 설계 (allow-* 확정)

- **렌더 방식**: `<iframe srcdoc={html}>` (또는 blob URL). srcdoc은 문서를 인라인으로 넣어 별도 서빙 없이 격리한다.
- **sandbox 값**: `allow-scripts` **부여**(피드백5 동작 필요 — 입력/버튼/폼). `allow-same-origin` **미부여**(부모 오리진 격리 유지). `allow-forms`는 문서 내 폼 동작에 필요할 수 있으나 top-level submit로 새지 않게 검토(iframe 내부 처리 전제). `allow-top-navigation`·`allow-popups`·`allow-modals`·`allow-downloads`는 **미부여**(앱 탈취·이탈 방지).
  - 근거: allow-scripts + allow-same-origin **동시 부여 금지**(sandbox 무력화). 이건 상수로 박아 drift 방지(D8).
- **네비게이션 차단**: allow-top-navigation 미부여로 문서가 부모 창을 외부 URL로 끌고 가지 못한다. 화면 전환은 iframe 내부에서만.
- **격리 불변식**: 와이어 HTML을 sandbox iframe 이외 경로(상위 문서 `innerHTML`/`dangerouslySetInnerHTML`)로 삽입하는 코드가 존재하면 안 됨 → 정적 grep 게이트.

## D3. CSP 정책 (2겹)

1. **문서 CSP(iframe 안 문서)**: srcdoc HTML의 `<meta http-equiv="Content-Security-Policy">` 또는 렌더 시 주입. 방향:
   - `default-src 'none'` 기반, 인라인 스크립트/스타일만 허용(`'unsafe-inline'` 최소 — 문서가 자족 인라인이므로), 외부 `script-src`/`img-src`/`style-src`/`font-src`/`connect-src` **차단**(외부 리소스 로드·네트워크 유출 0).
   - 결과: 외부 CDN·트래킹 픽셀·외부 fetch/XHR/WebSocket 전부 차단(`flowforge-wireframe-sandbox-security` acceptance).
2. **앱 CSP(flowforge 자체)**: 서버에 CSP 헤더 신설(**현재 `server/src`에 helmet/CSP 전무 — 확인함**). `frame-ancestors`로 flowforge가 신뢰 안 되는 상위 프레임에 임베드(clickjacking) 안 되게. `frame-src`로 iframe 원천 통제.
   - helmet 도입 여부는 §90 기술평가 — 최소는 미들웨어로 헤더 직접 세팅(무의존). 도입 시 §90 체크리스트 통과.

## D4. HTML 데이터 모델 (요소배열 → 문서, BREAKING)

- **폐기**: `WireScreen2`(regions/elements)의 planning 원천 역할. 좌표 없는 요소 박스 모델은 planning 와이어에서 제거.
- **신설**: 화면별 HTML 문서 타입 — `{ id: string; title: string; device: 'desktop'|'mobile'; html: string }` (shared, `wire-screen2-types.ts` 옆 신규 파일). id는 유저플로우/IA/화면목록과 정합(화면 id 공유 규약 유지).
- **저장/전달**: 승인분 원천(`<WIREFRAME_FEEDBACK_ROOT>/<project>.wireframe.json`) 포맷이 요소배열 → HTML 문서 배열로 교체. 제안 큐·`buildDocsPlanningWireframe2`·`GET .../planning-wireframe` 응답(`routes/docs.ts:210`)이 새 계약 반환.
- **폴백**: 승인분 없음/깨짐 → 안전 폴백(빈 상태 또는 최소 폴백 문서). 렌더 throw 금지(현 `readApprovedWireframe`의 null 폴백 정신 유지).
- **BREAKING** 명시: 이전 `WireScreen2` 요소배열 스키마와 비호환. 기존 `<project>.wireframe.json`은 새 스키마로 재생성 필요(픽스처는 폐기 또는 폴백 HTML로 대체).

## D5. WireframeDeviceFrame 폐기·대체

- `WireframeDeviceFrame.tsx`(box 렌더)는 planning 와이어에서 폐기. 다만 **디바이스 프레임 크롬(데스크탑 브라우저 크롬 / 모바일 폰 프레임)·디바이스 토글·화면 탭은 재사용 가치가 있다** → 프레임 셸은 유지하고 **본문(요소 배치 영역)만 iframe로 교체**(게으름 위계 — 프레임 재작성 금지).
- `styles.css:937-940`대 `wf-df-el--*`(요소 박스) CSS는 정리. 프레임 크롬 CSS는 잔존.
- change 경로 와이어(`WireframePanel`·`wireframeBuilder`·golden)는 무저촉(별 경로) — 회귀 0 확인.

## D6. 핀 피드백 좌표계 (iframe 표면 오버레이)

- 현 핀(`WireframePinFeedback.tsx`)은 프레임 위 `renderOverlay` 오버레이 + `getBoundingClientRect` 기반 xPct/yPct(`PinLayer.onLayerClick`).
- iframe 전환 시: sandbox iframe **내부 DOM엔 접근 불가**(보안 경계, cross-origin 취급). 따라서 핀 좌표는 iframe **표면**(iframe 요소 바운딩 박스) 상대 위치로 재계산. 오버레이는 iframe **위** 절대 위치 레이어.
- iframe이 클릭을 삼키는 문제: 핀 모드/⌘ 클릭을 잡으려면 오버레이가 iframe 위에서 포인터 이벤트를 캡처(핀 모드 armed 시 `pointer-events` 제어). 보기 모드에선 iframe이 클릭을 받아 문서 동작(피드백5)이 살아야 함 → 모드별 pointer-events 토글.
- `flowforge-pin-feedback-lifecycle` change와 좌표계 공유·조정(iframe 표면 좌표로 통일).

## D7. harness가 생성할 HTML 계약 (짝작업)

- openspec-plan의 와이어 단계는 현재 "로우피델리티 박스 5종 HTML"(SKILL.md:276). 이를 **화면별 실 HTML/JS 문서 생성**으로 확장(harness 짝작업).
- 산출물 계약(`flowforge-wireframe-html-contract`): 화면당 `{id,title,device,html}`. html은 **자족적**(자산 인라인/data URI — CSP가 외부 로드 차단하므로 외부 참조 무의미), 부모 접근·top navigation 비의존.
- 생성 로직 자체는 이 change 밖(스킬). 이 change는 flowforge가 **받을 계약**만 정의 → flowforge는 소비·격리·렌더만. flowforge 서버는 LLM 미호출(읽기 거울 유지).

## D8. 재사용·상수화

- sandbox 속성값·CSP 문자열(문서용·앱용)을 **단일 상수 모듈**로 추출 → 렌더러·서버 헤더·테스트가 같은 값 공유(drift = 보안 구멍). allow-same-origin 미부여를 상수 레벨에서 못 박는다.
- 디바이스 프레임 셸·토글·탭·핀 오버레이 인프라(`getBoundingClientRect` 좌표)는 재사용.

## D9. 리스크 (크게 — 이 change의 절반)

- 🔴 **임의 HTML/JS 렌더 = 큰 공격 표면.** 완화: sandbox(allow-same-origin 금지) + 문서 CSP + 앱 CSP frame-ancestors + 상위 DOM 직접 삽입 금지 정적 게이트. 각각 `flowforge-wireframe-sandbox-security` acceptance로 강제.
- 🔴 **sandbox 우회.** allow-scripts + allow-same-origin 동시 부여가 대표 우회 → 상수로 금지 + 테스트로 부재 검증. top-level navigation·popups·downloads 미부여.
- 🔴 **XSS/데이터 유출.** CSP `connect-src`/`default-src 'none'`로 외부 유출 차단. 악성 페이로드 픽스처로 부모 오리진 무손상 실측(Playwright — 콘솔·네트워크·부모 상태 관찰).
- 🟠 **성능(iframe 다수).** 화면 수만큼 iframe이면 무겁다 → 활성 화면만 마운트(비활성 언마운트/지연 마운트), srcdoc 재생성 최소화.
- 🟠 **핀 좌표 정확도.** iframe 표면 좌표라 문서 내부 요소와 픽셀 정합이 느슨. 표면 상대 위치로 충분(지점 단위 피드백)하다는 전제 명시.
- 🟠 **CSP가 문서 동작을 과차단.** `'unsafe-inline'` 최소 허용으로 인라인 스크립트/스타일(자족 문서)은 살리되 외부만 차단하는 균형.
- **적대적 리뷰(§70) 배포 전 필수.** 3페르소나 각 1건 이상, 2+ 중복 발견 시 심각도 +1. BLOCK은 배포 불가.

## D10. 의도적 제외 (Non-Goals)

- **AI 와이어 생성/재생성 로직 자체** — harness(openspec-plan) 몫. 이 change는 flowforge 측 렌더 + 받을 계약만.
- **와이어 HTML 사람 저작 경로** — 없음(원천 100% AI 생성, 사람은 확인·피드백만, 전임 change 원칙 유지).
- **iframe 내부 DOM 세밀 검사/조작** — sandbox 격리라 불가. 핀은 표면 좌표만.
- **helmet 전면 도입** — 최소는 CSP 헤더 미들웨어(무의존). 도입은 §90 평가 후 선택.
