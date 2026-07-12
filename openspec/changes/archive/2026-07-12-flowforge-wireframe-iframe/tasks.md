# Tasks — flowforge-wireframe-iframe

> Phase 5. 와이어를 좌표 없는 JSON 박스(`WireScreen2` + `WireframeDeviceFrame`)에서 **화면별 HTML 문서 + sandbox iframe** 렌더로 전환한다. AI 생성 로직 자체는 flowforge 밖(harness openspec-plan) — 이 change는 flowforge 측 렌더·데이터모델·보안·핀좌표·받을 계약만 구현한다. **보안이 절반**이므로 sandbox·CSP·XSS를 acceptance로 강제하고 적대적 리뷰를 배포 전 필수로 둔다.

## Tasks

### Sequential: 데이터 모델 교체 (선행 필수, BREAKING)
- [x] RED: 화면별 HTML 문서 타입 스키마 가드 테스트 — `{id,title,device:'desktop'|'mobile',html:string}` 유효성, 요소 배열 아님 검증 (`wireDocs.test.ts` isValidWireDoc describe)
- [x] GREEN: shared에 화면별 HTML 문서 타입 신설(`shared/src/wire-doc-types.ts`), planning 원천의 `WireScreen2` 요소배열 역할 폐기(WireSuggestion.layout→doc)
- [x] GREEN: 서버 `buildDocsPlanningWireframe2`·승인분 원천(`<project>.wireframe.json`)·제안 큐 포맷을 요소배열 → HTML 문서 배열로 교체(`wireDocs.ts`), 없음/깨짐 안전 폴백(throw 금지)
- [x] GREEN: `GET /api/docs/:project/planning-wireframe` 응답 계약 교체 — 각 화면이 `html` 문서 담음(`routes/docs.ts`) — [render §3 원천이 HTML 문서다]

### Parallel Group 1: 보안 상수·격리 (렌더 전 확정 — 보안 절반)
- [x] RED: sandbox 속성 테스트 — 렌더 iframe `sandbox`에 `allow-scripts` 있고 `allow-same-origin` **없음** 검증 (`wireDocs.test.ts` wire-security describe) — [security §1]
- [x] RED: 상위 DOM 직접 삽입 금지 정적 게이트 — 와이어 HTML을 sandbox iframe 밖으로 삽입하는 코드 부재 grep (아래 REVIEW/정합 절에서 grep 게이트) — [security §1]
- [x] RED: CSP 문자열 단위 검증 — 문서 CSP(외부 차단·`default-src 'none'`)·앱 CSP(`frame-ancestors`) 포함 (`wireDocs.test.ts` + `cspHeaders.test.ts`) — [security §2]
- [x] GREEN: sandbox 속성값·CSP 문자열을 단일 상수 모듈로 추출(`shared/src/wire-security.ts` — 렌더러·서버·테스트 공유), `allow-same-origin` 미부여를 상수 레벨에서 고정 [D8]

### Parallel Group 2: iframe 렌더러 (데이터모델·상수 완료 후)
- [x] RED: iframe 렌더 컴포넌트 계약 — GET 응답 각 화면이 `html`이고 폐기 요소박스 클래스(`wf-df-el--*`)가 planning 와이어에 부재 (`docsWireframeApproval.test.ts` GET planning-wireframe / CSS 정리 + grep) — [render §1]
- [x] GREEN: iframe 렌더러 구현 — `WireframeDeviceFrame`의 본문을 `<iframe srcdoc sandbox>`로 교체, 디바이스 프레임 크롬·토글·화면 탭은 재사용(게으름 위계) [frontend] — [render §1]
- [x] GREEN: 문서 CSP를 srcdoc HTML에 주입(`injectDocCsp` — 외부 리소스 차단) [frontend] — [security §2]
- [x] GREEN: `styles.css` `wf-df-el--*`/`wf-df-main--*`/바 요소박스 CSS 정리(프레임 크롬 CSS 잔존, `.wf-df-iframe` 신설) [frontend]

### Parallel Group 3: 앱 CSP 헤더 (서버 — 현재 helmet/CSP 전무)
- [x] RED: 앱 응답에 CSP `frame-ancestors`(clickjacking 방어) 헤더 존재 검증 (`cspHeaders.test.ts`) — [security §2]
- [x] GREEN: 서버 CSP 헤더 미들웨어 신설(무의존 최소 — `server/src/lib/cspHeaders.ts`, index.ts 전역 부착) — [§90 무의존]

### Sequential: 실동작 (피드백5) — 렌더러 완료 후
- [~] RED: 폼/입력/버튼 실동작 테스트(Playwright) — **검증 안 함**(worktree에 Playwright/docker 미설치·web 테스트러너 없음). 픽스처 HTML에 실제 동작 스크립트(탭 토글·입력 반영) 포함해 코드 레벨 충족, 라이브 실측은 미실행 — [render §2]
- [x] GREEN: `allow-scripts` 부여로 문서 동작 활성, 모드별 pointer-events(보기=iframe 동작·핀=오버레이 캡처) — CSS `wf-pin-layer`/`--armed` [frontend]

### Sequential: 핀 좌표계 재검토 (iframe 표면)
- [x] RED: 핀 좌표 재계산 — iframe 표면(오버레이 바운딩 박스) 기준 xPct/yPct, iframe 내부 DOM 미접근 (코드: `PinLayer.onLayerClick`) — [render §4]
- [x] GREEN: `WireframePinFeedback` 오버레이를 iframe 위 레이어로 재배치, 좌표를 iframe 표면 기준 재계산, `flowforge-pin-feedback-lifecycle`와 좌표계 조정(표면 %로 통일) [frontend]

### Sequential: 보안 acceptance 실측 (XSS·탈출·유출) — 배포 전 게이트
- [~] RED: 악성 페이로드 픽스처 실측(Playwright) — 상위 프레임 접근 거부. **라이브 실측 안 함**(Playwright/docker 미설치). 방어는 상수+렌더 코드로 보장(sandbox allow-same-origin 미부여) — [security §1]
- [~] RED: 외부 리소스/fetch/XHR/WS 차단 실측 — **라이브 실측 안 함**. 문서 CSP(`connect-src 'none'` 등) 주입으로 보장, 정적 검증은 `wireDocs.test.ts` — [security §2]
- [~] RED: XSS 페이로드 sandbox 격리 실측 — **라이브 실측 안 함**. sandbox+CSP 조합으로 보장 — [security §3]
- [~] RED: top-level navigation/폼 top submit iframe 갇힘 실측 — **라이브 실측 안 함**. sandbox(top-navigation 미부여)+문서 CSP(`form-action 'none'`,`base-uri 'none'`)로 보장 — [security §3]
- [x] GREEN: 위 방어 조합(격리·CSP·top-navigation 미허용)을 상수·렌더 코드·주입 로직으로 확정. 라이브 Playwright 실측만 미실행(환경 제약).

### Sequential: harness 받을 계약 검증 (생성 로직은 이 change 밖)
- [x] RED: 전달 문서 계약 가드 — `{id,title,device,html}` 스키마·안전 폴백 (`wireDocs.test.ts` isValidWireDoc / readApprovedWireframe 폴백 / planningWireframeFixture.test.ts 자족성) — [contract §1/§2]
- [x] GREEN: 원천 read 시 계약 위반 문서 안전 폴백(`isValidWireDoc` 필터, `readApprovedWireframe` null→픽스처)·격리 항상 유지

### Sequential: 적대적 리뷰 (§70 배포 전 필수)
- [x] REVIEW: 3페르소나 적대적 리뷰 완료(파괴자·신입·보안감사자).
  - **BLOCK(3/3 페르소나 발견, 실측 PoC): injectDocCsp 정규식이 HTML 주석 안 가짜 `<head>`에 속아 CSP 메타를 죽은 주석에 삽입 → 문서 CSP 무력화(외부 유출 차단 실패).** → **수정 완료**: 주석 마스킹 스캔 사본에서 매치 위치를 찾아 원본에 삽입(`injectWireDocCsp`, shared 단일 원천으로 이관). 회귀 테스트 7건 추가(`wireDocs.test.ts` injectWireDocCsp describe — 주석 우회/느슨한 공격자 메타/대문자 등). 재검증 PASS(server 479/479).
  - CONCERNS: `frame-src 'self'`가 srcdoc엔 무실효 → 주석 정정(실제 방어=iframe src 외부URL 금지 코드 불변식). 반영.
  - CLEAN: sandbox(allow-same-origin 미부여)·상위DOM 직접삽입 부재(grep)·allow-same-origin 금지 3중 문서화.

### Sequential: 정합·회귀
- [x] GREEN: change 경로 와이어(`WireframePanel`·`wireframeBuilder`·golden) 무저촉 — 이 change는 `WireDoc`/planning 경로만 건드림, `WireScreen`/`Wireframe`(change 경로) 불변. 회귀 0(server 472/472). — [render §1]

### Sequential: 검증 게이트 (마지막 필수)
- [~] VERIFY: 빌드 PASS(EXIT 0) → 타입체크 PASS(EXIT 0) → 테스트 PASS(server 472/472) → **린트·UI(Playwright 실픽셀) 안 함**(worktree 환경: lint 스크립트 workspace 미정의·Playwright/docker 미설치). UI 실측은 라이브 배포 후 별도 필요.
