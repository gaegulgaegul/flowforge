# flowforge-wireframe-sandbox-security

## Purpose

AI가 생성한 임의 와이어 HTML/JS 렌더의 격리·CSP·XSS 방어 계약을 정의한다. 와이어 HTML은 `allow-scripts`는 부여하되 `allow-same-origin`은 부여하지 않는 sandbox iframe 안에서만 렌더되어 부모 오리진(flowforge 앱)의 DOM·쿠키·스토리지·토큰에 접근하지 못한다. CSP로 외부 리소스 로드와 네트워크 유출을 차단하고 앱 자체의 프레이밍 방어(frame-ancestors)를 세우며, XSS 페이로드가 sandbox·CSP 경계를 넘어 부모로 전이되지 못하도록 강제한다.

## Requirements

### Requirement: AI 생성 와이어 HTML은 sandbox iframe으로 격리된다

flowforge가 AI 생성 HTML 와이어 문서를 렌더할 때 SHALL, 그 문서를 `sandbox` 속성이 설정된 iframe 안에서만 표시한다. iframe에는 `allow-scripts`를 부여하되 `allow-same-origin`은 부여하지 **않는다**(둘을 동시에 주면 sandbox가 무력화되어 문서가 부모 오리진의 쿠키·localStorage·DOM에 접근할 수 있다). 격리는 우회 불가한 기본값이며, 어떤 코드 경로도 와이어 HTML을 sandbox 없이 상위 DOM에 직접 삽입(예: `dangerouslySetInnerHTML`로 flowforge 문서에 주입)해서는 안 된다.

#### Scenario: sandbox 속성으로 격리 렌더

- **WHEN** 와이어 HTML 문서를 렌더한다
- **THEN** 문서는 `sandbox` 속성이 설정된 iframe 안에 표시되고, 렌더된 iframe DOM에서 `sandbox` 값에 `allow-same-origin`이 없음이 확인된다

#### Scenario: 상위 프레임 접근 차단

- **WHEN** 와이어 HTML 내 스크립트가 `window.parent`·`window.top`·부모 `document`·쿠키·localStorage에 접근을 시도한다
- **THEN** sandbox(allow-same-origin 미부여)로 인해 접근이 거부되고, flowforge 앱 컨텍스트(토큰·상태·DOM)는 노출되지 않는다

#### Scenario: 상위 DOM 직접 삽입 금지

- **WHEN** 렌더 코드 경로를 검사한다
- **THEN** 와이어 HTML을 sandbox iframe이 아닌 경로(상위 문서 `innerHTML`/`dangerouslySetInnerHTML` 등)로 삽입하는 코드가 없다

### Requirement: 와이어 HTML은 CSP 정책 안에서만 스크립트를 실행한다

와이어 HTML 문서에 스크립트가 포함될 때 SHALL, 그 스크립트는 문서에 적용된 Content-Security-Policy 정책 안에서만 실행된다. CSP는 외부 리소스 로드(외부 script/style/img/font/fetch·트래킹 픽셀)를 차단해 네트워크 유출 표면을 없애고, 문서가 부모 앱을 프레이밍하거나 벗어나지 못하게 한다. flowforge 앱 자체도 프레이밍 방어(`frame-ancestors`)를 갖춘다(서버에 CSP 헤더가 현재 전무 — 이 change에서 신설).

#### Scenario: 외부 리소스 로드 차단

- **WHEN** 와이어 HTML이 외부 URL의 스크립트·스타일·이미지·폰트를 로드하거나 외부로 `fetch`/`XHR`/WebSocket을 시도한다
- **THEN** CSP가 요청을 차단하고 외부 네트워크로 데이터가 나가지 않는다(인라인 자산만 허용)

#### Scenario: 스크립트는 정책 안에서만 실행

- **WHEN** 와이어 HTML에 스크립트가 있다
- **THEN** 스크립트는 문서에 선언된 CSP가 허용하는 범위에서만 실행되며, 정책 밖 실행(외부 소스 로드 등)은 차단된다

#### Scenario: flowforge 앱 프레이밍 방어

- **WHEN** flowforge 앱 응답의 보안 헤더를 검사한다
- **THEN** CSP `frame-ancestors`(또는 동등 방어)가 설정되어 신뢰되지 않은 상위 프레임에 clickjacking 대상으로 임베드되지 않는다

### Requirement: XSS 페이로드는 sandbox 밖으로 탈출하지 못한다

와이어 HTML에 악성 스크립트나 XSS 페이로드가 포함되어도 SHALL, sandbox·CSP 경계 안에 갇혀 flowforge 앱(부모 오리진)을 손상시키지 못한다. 렌더는 항상 격리 안에서만 일어나며, 신뢰되지 않은 HTML이 부모 컨텍스트에서 실행될 경로가 없다.

#### Scenario: 악성 스크립트 격리

- **WHEN** 와이어 HTML에 `alert`·부모 접근 시도·리다이렉트 등 악성 스크립트가 들어 있다
- **THEN** 스크립트는 sandbox iframe 안에서만 (allow-scripts 범위) 돌고, 부모 오리진의 DOM·저장소·토큰에 도달하지 못한다

#### Scenario: XSS 페이로드가 부모로 전이되지 않음

- **WHEN** `<script>`·`onerror=`·`javascript:` 등 XSS 페이로드를 담은 와이어 HTML을 렌더한다
- **THEN** 페이로드는 sandbox 경계를 넘지 못하고 flowforge 앱 컨텍스트에서 실행되지 않는다

#### Scenario: 화면 전환은 상위 앱을 벗어나지 않는다

- **WHEN** 와이어 HTML 내에서 링크 클릭·`location` 변경·폼 제출 등 네비게이션이 발생한다
- **THEN** 네비게이션은 iframe 안에 갇히거나 차단되어(top-level navigation 미허용) flowforge 앱이 외부 URL로 끌려가지 않는다

## TDD Plan

- **Red**:
  - 렌더된 iframe의 `sandbox` 속성에 `allow-scripts`는 있고 `allow-same-origin`은 없음을 검증하는 컴포넌트 테스트.
  - 와이어 HTML 렌더 경로가 sandbox iframe만 사용하고 상위 DOM 직접 삽입(`dangerouslySetInnerHTML` 등)이 없음을 grep/AST로 확인하는 정적 게이트.
  - CSP 문자열(문서용·앱용)에 외부 소스 차단·`frame-ancestors`가 포함되는지 단위 검증.
  - 악성 페이로드 픽스처(`window.parent` 접근, 외부 `fetch`, `<script>` XSS, `javascript:` 링크, top-level navigation)를 담은 HTML을 렌더해 부모 오리진이 손상되지 않음을 Playwright로 실측(콘솔·네트워크·부모 상태 관찰).
- **Green**: sandbox 속성 고정(allow-same-origin 미부여)·문서 CSP 주입·앱 CSP 헤더 미들웨어를 최소 구현해 위 테스트 통과.
- **Refactor**: sandbox 속성·CSP 상수를 단일 상수 모듈로 추출(렌더러·서버 헤더·테스트가 같은 값 공유 — drift 방지).
- **적대적 리뷰(§70 필수)**: 파괴자(sandbox 우회·external resource·top navigation), 신입(왜 allow-same-origin 금지인지 주석), 보안감사자(XSS 벡터·frame-ancestors 부재) 3페르소나 각 1건 이상. 2개 이상 페르소나 중복 발견 시 심각도 +1.
- **Mock 대상**: AI 생성 로직(외부 스킬) — flowforge는 산출 HTML만 소비하므로 생성 Mock 불필요. 악성 HTML은 테스트 픽스처로 직접 주입한다.
