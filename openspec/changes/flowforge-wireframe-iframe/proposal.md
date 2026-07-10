## Why

와이어가 실제 화면과 전혀 다르고(피드백4) 정적이다(피드백5). 근본 원인 2가지:

1. **원천이 하드코딩 픽스처 + 좌표 없는 박스 스키마.** 현재 원천은 `planningWireframeFixture.ts`(5화면 고정)이며(`buildDocsPlanningWireframe2` = 승인분 JSON ?? 픽스처, `wireDocs.ts:285-287`), 데이터 모델은 좌표(x/y/w/h)가 없는 `WireScreen2` 요소 배열이다(`wire-screen2-types.ts:31-39` — kind/label/goto/span만, grid/stack/tree/form 힌트뿐). 렌더러(`WireframeDeviceFrame.tsx`)는 이 힌트를 CSS grid/flex로 근사하므로 실제 화면과 레이아웃이 근본적으로 다르다.
2. **동작이 전무하다.** 요소는 `goto` 화면전이만 있고 onChange/onInput/onSubmit이 0이다. input/button은 클릭해도 정적 회색 박스일 뿐 — 실제 입력·제출이 일어나지 않는다.

또한 flowforge 프로젝트 자체에 와이어 데이터가 없다(피드백9). `flowforge.wireframe.json` 부재로 항상 픽스처 폴백이 뜨고, 유저플로우 main-v2 화면 id와 픽스처 화면 id의 교집합이 0이다. 좌표 없는 JSON을 계속 채워 넣어도 실화면 근접은 불가능하다.

**확정 방향(사용자 결정 G3): 와이어를 iframe + HTML/JS로 전환한다.** 좌표 없는 JSON 박스 대신, 화면별 **실제 HTML/JS 문서**를 sandbox iframe에 렌더한다. 진짜 HTML이면 실화면 근접(피드백4)과 클릭·입력 동작(피드백5)이 한 번에 해결된다. 렌더 방식 재검토(피드백8)의 귀결이다.

단, 이 전환의 절반은 **보안**이다. AI가 생성한 임의 HTML/JS를 렌더한다는 것은 큰 공격 표면을 여는 것이다. sandbox 격리·CSP·XSS 방어를 acceptance로 못 박지 않으면 이 change는 배포해서는 안 된다.

## What Changes

- **WireScreen2 박스 렌더러 폐기.** `WireframeDeviceFrame.tsx`(좌표 없는 요소 배열을 CSS grid/flex로 근사)를 폐기하고, 화면별 HTML 문서를 sandbox iframe에 표시하는 렌더러로 대체한다. `wire-screen2-types.ts`의 요소 배열 모델은 planning 와이어 원천에서 폐기된다.
- **데이터 모델: 요소 배열 → HTML 문서.** planning 와이어 원천이 `WireScreen2[]`(regions/elements)에서 **화면별 HTML 문자열**(id·title·device·html)로 교체된다. `buildDocsPlanningWireframe2`와 `GET /api/docs/:project/planning-wireframe` 응답 계약이 바뀐다.
- **iframe sandbox 격리.** AI 생성 HTML은 `sandbox` 속성으로 격리한다 — `allow-scripts`는 부여하되 `allow-same-origin`은 부여하지 않는다(둘 다 주면 sandbox가 무력화되어 부모 프레임/쿠키/스토리지 접근이 열린다). 상위 프레임(flowforge 앱)으로의 접근·탈출을 차단한다.
- **CSP 정책.** iframe 문서(`srcdoc`/blob)에 Content-Security-Policy를 적용해 스크립트를 정책 안에서만 실행하고, 외부 리소스 로드(네트워크 유출·트래커)를 차단한다. flowforge 앱 자체의 프레이밍 방어(`frame-ancestors`)도 함께 세운다(서버에 CSP 헤더가 현재 전무 — `server/src`에 helmet/CSP 없음).
- **XSS 방어 경계.** 승인·저장 시 HTML 문서를 검증하고, 렌더는 항상 sandbox 안에서만 한다. `allow-same-origin` 부여·부모 컨텍스트 직접 삽입(dangerouslySetInnerHTML로 상위 DOM에 주입)은 금지한다.
- **핀 피드백 좌표계 재검토.** 현재 핀은 박스 프레임 위 오버레이 좌표(`WireframePinFeedback.tsx`, `renderOverlay`, `getBoundingClientRect` 기반 xPct/yPct)다. iframe 전환 시 오버레이는 iframe **위** 레이어에 위치하고, 좌표는 iframe 요소의 바운딩 박스 기준으로 재계산한다(iframe 내부 DOM 좌표가 아니라 iframe 표면 좌표 — cross-origin/sandbox라 내부 접근 불가).
- **BREAKING: 와이어 데이터 스키마 교체.** 승인분 원천 포맷(`<project>.wireframe.json`)·제안 큐·렌더 계약이 요소 배열에서 HTML 문서로 바뀐다. 이전 스키마와 호환되지 않는다.

## Capabilities

### New Capabilities
- `flowforge-wireframe-html-render`: 화면별 HTML 문서를 sandbox iframe에 렌더하는 flowforge 측 렌더러. 실제 HTML이므로 실화면 근접(피드백4)이며, 문서 내 폼/입력/버튼이 실제 동작한다(피드백5, 정적 아님). 디바이스 프레임(데스크탑/모바일)·화면 전환은 유지하되 본문은 iframe.
- `flowforge-wireframe-sandbox-security`: AI 생성 HTML 렌더의 격리·CSP·XSS 방어 계약. iframe `sandbox`(allow-scripts O / allow-same-origin X), CSP(스크립트 제한·외부 리소스 차단·frame-ancestors), 상위 프레임 접근·네비게이션 탈출 차단, 악성 스크립트·XSS 페이로드·외부 리소스 로드 시도에 대한 acceptance.
- `flowforge-wireframe-html-contract`: harness(openspec-plan)가 생성해 flowforge에 전달할 화면별 HTML 산출물의 계약 — 화면 id(유저플로우/IA 정합)·디바이스·문서 구조·인라인 자산·허용/금지 요소. 생성 주체는 flowforge 밖(스킬), flowforge는 소비·렌더만 한다(읽기 거울 원칙 유지).

## Impact

- **웹**: `WireframeDeviceFrame.tsx` 폐기·대체(box 렌더 → iframe 렌더). `WireframePinFeedback.tsx` 좌표계 재검토(iframe 표면 오버레이). App.tsx 와이어 탭 배선(HTML 문서 fetch·렌더). `styles.css:937-940`대 박스 렌더 CSS 정리.
- **shared**: 와이어 타입 교체 — `wire-screen2-types.ts`(요소 배열 모델)의 planning 원천 역할 폐기, 화면별 HTML 문서 타입 신설.
- **서버**: `wireDocs.ts`의 `buildDocsPlanningWireframe2`·제안 큐·승인분 원천 포맷 교체(JSON 요소배열 → HTML 문서). `routes/docs.ts:210` 응답 계약(`screens`) 변경. **CSP 헤더 신설**(현재 서버에 CSP/helmet 없음 — `server/src` 확인) — flowforge 앱과 iframe 문서 양쪽.
- **보안**: 임의 HTML/JS 렌더는 이 change의 절반. sandbox·CSP·XSS를 spec의 acceptance로 강제하고, 적대적 리뷰(§70)를 배포 전 필수로 둔다.
- **harness 짝작업(flowforge 밖)**: openspec-plan의 와이어 생성 단계가 현재 "로우피델리티 박스 5종 HTML"을 명시(SKILL.md:276)한다. 이를 **화면별 실 HTML/JS 문서 생성**으로 확장해야 flowforge가 받을 계약이 성립한다. 생성 로직 자체는 이 change 범위 밖이나, 산출물이 "화면별 HTML 문서"임을 이 change의 계약(`flowforge-wireframe-html-contract`)이 정의한다.
- **선행(약한 관계)**: 딥링크 URL(`flowforge-deeplink-url`) — 화면 딥링크가 iframe 화면 전환과 맞물릴 수 있으나 강결합 아님.
- **핀 피드백 change와의 관계**: `flowforge-pin-feedback-lifecycle`과 좌표계를 공유·조정한다(iframe 표면 좌표로 통일).
