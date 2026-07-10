# Tasks — flowforge-wireframe-iframe

> Phase 5. 와이어를 좌표 없는 JSON 박스(`WireScreen2` + `WireframeDeviceFrame`)에서 **화면별 HTML 문서 + sandbox iframe** 렌더로 전환한다. AI 생성 로직 자체는 flowforge 밖(harness openspec-plan) — 이 change는 flowforge 측 렌더·데이터모델·보안·핀좌표·받을 계약만 구현한다. **보안이 절반**이므로 sandbox·CSP·XSS를 acceptance로 강제하고 적대적 리뷰를 배포 전 필수로 둔다.

## Tasks

### Sequential: 데이터 모델 교체 (선행 필수, BREAKING)
- [ ] RED: 화면별 HTML 문서 타입 스키마 가드 테스트 — `{id,title,device:'desktop'|'mobile',html:string}` 유효성, 요소 배열 아님 검증
- [ ] GREEN: shared에 화면별 HTML 문서 타입 신설(`wire-screen2-types.ts` 옆), planning 원천의 `WireScreen2` 요소배열 역할 폐기
- [ ] GREEN: 서버 `buildDocsPlanningWireframe2`·승인분 원천(`<project>.wireframe.json`)·제안 큐 포맷을 요소배열 → HTML 문서 배열로 교체(`wireDocs.ts`), 없음/깨짐 안전 폴백(throw 금지)
- [ ] GREEN: `GET /api/docs/:project/planning-wireframe` 응답 계약 교체 — 각 화면이 `html` 문서 담음(`routes/docs.ts:210`) — [render §3 원천이 HTML 문서다]

### Parallel Group 1: 보안 상수·격리 (렌더 전 확정 — 보안 절반)
- [ ] RED: sandbox 속성 테스트 — 렌더 iframe `sandbox`에 `allow-scripts` 있고 `allow-same-origin` **없음** 검증 [parallel] — [security §1 sandbox로 격리 렌더]
- [ ] RED: 상위 DOM 직접 삽입 금지 정적 게이트 — 와이어 HTML을 sandbox iframe 밖(`dangerouslySetInnerHTML`/상위 `innerHTML`)으로 삽입하는 코드 부재 grep/AST [parallel] — [security §1 상위 DOM 직접 삽입 금지]
- [ ] RED: CSP 문자열 단위 검증 — 문서 CSP(외부 script/img/style/font/connect 차단·`default-src 'none'` 기반)·앱 CSP(`frame-ancestors`) 포함 [parallel] — [security §2 외부 리소스 차단 / 앱 프레이밍 방어]
- [ ] GREEN: sandbox 속성값·CSP 문자열을 단일 상수 모듈로 추출(렌더러·서버·테스트 공유, drift 방지), `allow-same-origin` 미부여를 상수 레벨에서 고정 [parallel]

### Parallel Group 2: iframe 렌더러 (데이터모델·상수 완료 후)
- [ ] RED: iframe 렌더 컴포넌트 테스트 — 화면별 HTML이 `<iframe srcdoc>`에 표시, 폐기된 요소박스 클래스(`wf-df-el--*`) planning 와이어에 부재 [frontend] — [render §1 화면별 HTML을 iframe에 표시 / 폐기 박스 렌더러 미사용]
- [ ] GREEN: iframe 렌더러 구현 — `WireframeDeviceFrame`의 본문을 iframe로 교체, 디바이스 프레임 크롬·토글·화면 탭은 재사용(게으름 위계) [frontend] — [render §1 데스크탑/모바일 프레임 유지]
- [ ] GREEN: 문서 CSP를 srcdoc HTML에 주입(외부 리소스 차단), 문서 스크립트를 CSP 안에서만 실행 [frontend] — [security §2 스크립트는 정책 안에서만 실행]
- [ ] GREEN: `styles.css:937-940`대 `wf-df-el--*` 요소박스 CSS 정리(프레임 크롬 CSS 잔존) [frontend]

### Parallel Group 3: 앱 CSP 헤더 (서버 — 현재 helmet/CSP 전무)
- [ ] RED: 앱 응답에 CSP `frame-ancestors`(clickjacking 방어) 헤더 존재 검증 — [security §2 flowforge 앱 프레이밍 방어]
- [ ] GREEN: 서버 CSP 헤더 미들웨어 신설(무의존 최소; helmet 도입 시 §90 기술평가 통과) — `server/src`

### Sequential: 실동작 (피드백5) — 렌더러 완료 후
- [ ] RED: 폼/입력/버튼 실동작 테스트(Playwright) — input 타이핑 반영·버튼 클릭 반응·문서 내 화면전환이 iframe 안에 갇힘 [frontend] — [render §2 입력 반영 / 버튼·폼 반응 / 문서 내 화면전환 iframe에 갇힘]
- [ ] GREEN: `allow-scripts` 부여로 문서 동작 활성, 모드별 pointer-events로 보기모드=문서 동작·핀모드=오버레이 캡처 [frontend]

### Sequential: 핀 좌표계 재검토 (iframe 표면)
- [ ] RED: 핀 좌표 재계산 테스트 — iframe 요소 바운딩 박스 기준 xPct/yPct 산출·저장 핀 재표시, iframe 내부 DOM 미접근 [frontend] — [render §4 핀은 iframe 표면 좌표 / 저장 핀 재표시]
- [ ] GREEN: `WireframePinFeedback` 오버레이를 iframe 위 레이어로 재배치, 좌표를 iframe 표면 기준 재계산, `flowforge-pin-feedback-lifecycle`와 좌표계 조정 [frontend]

### Sequential: 보안 acceptance 실측 (XSS·탈출·유출) — 배포 전 게이트
- [ ] RED: 악성 페이로드 픽스처 실측(Playwright) — `window.parent`/`window.top`/쿠키/localStorage 접근 시도가 거부됨(부모 컨텍스트 무노출) — [security §1 상위 프레임 접근 차단]
- [ ] RED: 외부 리소스 로드/`fetch`/XHR/WebSocket 시도가 CSP로 차단(외부 네트워크 0) 실측 — [security §2 외부 리소스 로드 차단]
- [ ] RED: XSS 페이로드(`<script>`/`onerror=`/`javascript:`)·악성 스크립트가 sandbox 경계 못 넘어 부모 오리진 무손상 실측 — [security §3 악성 스크립트 격리 / XSS 부모 전이 안 됨]
- [ ] RED: 문서 내 top-level navigation·`location` 변경·폼 top submit이 iframe에 갇힘(앱 외부 URL 미이탈) 실측 — [security §3 화면 전환은 상위 앱을 벗어나지 않음]
- [ ] GREEN: 위 실측이 모두 방어됨을 확인(격리·CSP·top-navigation 미허용 조합)

### Sequential: harness 받을 계약 검증 (생성 로직은 이 change 밖)
- [ ] RED: 전달 문서 계약 가드 — `{id,title,device,html}` 스키마·화면 id 화면목록 정합·자족성(외부 참조는 CSP 차단으로 렌더 안 됨)·제약 위반 문서 안전 폴백 — [contract §1 스키마·화면 id 정합 / §2 자족성·제약 위반 안전 처리]
- [ ] GREEN: 원천 read 시 계약 위반 문서 안전 폴백(필터/거부)·격리 항상 유지 최소 가드

### Sequential: 적대적 리뷰 (§70 배포 전 필수)
- [ ] REVIEW: 3페르소나 적대적 리뷰 — 파괴자(sandbox 우회·external resource·top navigation), 신입(allow-same-origin 금지 이유 주석), 보안감사자(XSS 벡터·frame-ancestors). 각 1건 이상, 2+ 중복 발견 시 심각도 +1, BLOCK은 배포 불가

### Sequential: 정합·회귀
- [ ] GREEN: change 경로 와이어(`WireframePanel`·`wireframeBuilder`·golden) 무저촉 회귀 0 확인 — [render §1 별 경로 무변경]

### Sequential: 검증 게이트 (마지막 필수)
- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경: iframe 렌더·실동작·핀좌표·보안 실측을 `docker compose up -d --build` 라이브 반영 후 Playwright 실픽셀) 전부 PASS
