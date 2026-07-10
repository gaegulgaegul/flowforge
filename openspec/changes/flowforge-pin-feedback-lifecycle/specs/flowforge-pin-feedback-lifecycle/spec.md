## ADDED Requirements

### Requirement: 핀 피드백에 안정적 id와 status를 부여한다

flowforge는 핀 피드백을 저장할 때 각 피드백에 **안정적 식별자 `id`**와 **상태 `status`**(`"open" | "resolved"`)를 SHALL 부여한다. 신규 피드백의 `status`는 항상 `open`이다. `id`는 서버가 append 시 생성하며(예: 타임스탬프+난수 또는 uuid), 같은 피드백을 이후 resolve·수정으로 지정하는 대상 키가 된다. 스키마(`WireFeedbackItem`, `shared/src/wire-suggestion-types.ts:42-55`)에 `id`·`status` 필드를 추가한다(기존 `screenId/text/ts/xPct/yPct/region`은 불변). 클라이언트의 `Pin.id`(`web/src/WireframePinFeedback.tsx:34`, 화면 내 표시 번호)와 달리 서버 `id`는 파일에 저장되는 영속 식별자다.

#### Scenario: 새 핀 피드백에 id와 open status 부여

- **WHEN** 사용자가 와이어에 새 핀 피드백을 남긴다(POST append)
- **THEN** 저장된 피드백 레코드에 고유한 `id`와 `status: "open"`이 부여되어 `<project>.feedback.json`에 기록된다

#### Scenario: id는 피드백마다 고유하다

- **WHEN** 사용자가 같은 화면에 서로 다른 핀 피드백 2건을 남긴다
- **THEN** 두 레코드는 서로 다른 `id`를 갖는다(이후 개별 resolve/수정이 가능하도록)

### Requirement: 저장된 피드백을 GET으로 재조회해 표시한다

flowforge는 저장된 핀 피드백을 **GET 라우트로 불러와 목록/인박스 뷰에 SHALL 표시**한다. 마운트 시(또는 프로젝트 진입 시) 이 GET을 호출해 로컬 세션 상태(`useState<Pin[]>`, `web/src/WireframePinFeedback.tsx:260`)를 서버 데이터로 시딩하므로, **새로고침 후에도 남긴 핀이 유지**된다(현재는 GET 부재로 새로고침 시 소실 — `docs.ts`에 feedback GET 라우트 없음). GET은 해당 프로젝트의 모든 피드백을 좌표(`xPct/yPct`)·상태(`status`)와 함께 반환한다.

#### Scenario: 피드백 목록을 열면 저장된 핀들이 GET으로 로드된다

- **WHEN** 사용자가 피드백 목록/인박스를 연다(또는 와이어 탭에 진입한다)
- **THEN** 서버에 저장된 그 프로젝트의 모든 핀 피드백이 GET으로 로드되어 목록과 와이어 위 좌표에 표시된다

#### Scenario: 새로고침해도 핀이 유지된다

- **WHEN** 사용자가 핀을 남긴 뒤 페이지를 새로고침한다
- **THEN** 새로고침 후에도 저장된 핀이 GET 재조회로 다시 표시된다(로컬 상태 소실 없음)

#### Scenario: 빈 목록

- **WHEN** 아직 아무 피드백도 없는 프로젝트에서 목록을 연다(feedback 파일 없음)
- **THEN** GET이 빈 배열을 반환하고 "피드백 없음" 빈 상태가 표시된다(크래시 없음)

### Requirement: 핀을 resolve하면 상태가 resolved로 바뀐다

flowforge는 핀 피드백을 **resolve**할 수 있고, resolve 시 그 피드백의 `status`가 `resolved`로 SHALL 바뀌며 목록/인박스에 즉시 반영된다. resolve는 `id`로 대상 피드백을 지정하는 서버 핸들러(update)로 처리되고, 파일에 in-place 반영된다(삭제가 아닌 soft close). 이미 resolved인 핀을 다시 토글하면 `open`으로 되돌아간다.

#### Scenario: 핀 resolve 시 status 변경

- **WHEN** 사용자가 open 상태의 핀을 resolve한다
- **THEN** 그 핀의 `status`가 `resolved`로 바뀌어 파일에 in-place 저장되고, 목록/인박스에서 resolved로 표시된다

#### Scenario: resolved 핀을 다시 열기

- **WHEN** 사용자가 resolved 상태의 핀을 다시 토글한다
- **THEN** 그 핀의 `status`가 `open`으로 되돌아간다

#### Scenario: 존재하지 않는 id를 resolve

- **WHEN** 서버에 없는 `id`로 resolve/update를 요청한다
- **THEN** 서버는 404(또는 no-op)로 안전하게 거부하고 기존 피드백 파일을 변경하지 않는다(크래시·손상 없음)

### Requirement: 피드백 수정은 중복 append가 아니라 in-place 갱신이다

flowforge는 기존 핀 피드백의 텍스트를 **수정**할 때, 새 레코드를 또 append하지 않고 `id`로 지정한 레코드를 **in-place로 SHALL 교체**한다. 현재는 수정도 POST append(`web/src/api.ts:357`→`wireDocs.ts:317` append 전용)라 같은 지점 피드백이 **중복 누적**된다 — 이 change는 그 중복을 제거한다. in-place 갱신은 `id`·`screenId`·좌표를 보존하고 `text`(와 필요 시 `ts`)만 갱신한다.

#### Scenario: 기존 핀 수정 시 중복이 생기지 않는다

- **WHEN** 사용자가 이미 저장된 핀의 텍스트를 고쳐 저장한다
- **THEN** 그 `id`의 레코드가 in-place로 갱신되고, 피드백 배열의 길이는 늘지 않는다(중복 append 없음)

#### Scenario: in-place 갱신은 좌표를 보존한다

- **WHEN** 사용자가 핀의 텍스트만 수정한다
- **THEN** 그 핀의 `id`·`screenId`·`xPct`·`yPct`는 그대로 유지되고 `text`만 바뀐다

### Requirement: id/status 없는 기존 레코드를 하위호환한다

flowforge는 이 change 이전에 저장된 `<project>.feedback.json`의 **`id`·`status`가 없는 레코드**를 읽을 때, 크래시 없이 기본값을 SHALL 부여한다: `id`를 생성(예: 인덱스·`ts` 기반 결정적 파생 또는 새 uuid)하고 `status`를 `open`으로 채운다. 이로써 기존 피드백도 목록에 나타나고 resolve/수정 대상이 될 수 있다. 읽기 시 기본값 주입은 파일을 즉시 재기록하거나(마이그레이션) 메모리에서만 채우거나 둘 중 하나로 하되, 어느 경우든 기존 데이터 손실이 없어야 한다.

#### Scenario: 구버전 레코드 읽기

- **WHEN** `id`·`status` 필드가 없는 기존 피드백이 담긴 파일을 GET으로 읽는다
- **THEN** 각 레코드에 `id`가 부여되고 `status`가 `open`으로 채워져 목록에 정상 표시된다(누락 필드로 인한 크래시 없음)

#### Scenario: 구버전 레코드도 resolve할 수 있다

- **WHEN** 기본값이 부여된 구버전 레코드를 resolve한다
- **THEN** 그 레코드의 `status`가 `resolved`로 갱신되어 저장된다(부여된 id로 지정 가능)

### Requirement: 동시 write에도 파일이 손상되지 않는다

flowforge 서버는 단일 프로세스에서 feedback 파일에 write한다. append·resolve(update)·in-place 수정이 연달아 일어나도 파일이 깨지거나 레코드가 유실되지 않도록, 각 write는 **최신 파일을 읽어 반영한 뒤 전체를 순차 재기록**을 SHALL 수행한다(read-modify-write). 단일 프로세스이므로 파일 잠금은 필요 없으나, 각 핸들러가 자기 write 직전에 파일을 다시 읽어 다른 핸들러의 직전 변경을 덮어쓰지 않는다.

#### Scenario: append 직후 resolve

- **WHEN** 핀을 append한 직후 그 핀을 resolve한다
- **THEN** append된 레코드가 resolved로 갱신되고, 다른 기존 레코드는 유실되지 않는다(read-modify-write로 최신 상태 반영)

## TDD Plan

- **Red**:
  - 스키마/lib 테스트 — `appendWireframeFeedback`가 반환/저장 레코드에 `id`(고유)·`status:"open"`을 넣는지. 목록 read 함수가 id/status 없는 구버전 레코드에 기본값을 주입하는지. resolve(update)가 `id`로 지정한 레코드의 `status`를 토글하고 존재하지 않는 id는 no-op/거부하는지. in-place 수정이 배열 길이를 늘리지 않고 `text`만 바꾸며 좌표를 보존하는지.
  - 라우트 테스트 — feedback **GET**이 저장된 배열을 반환(빈 파일=빈 배열), resolve/update 라우트가 200/404를 올바로 내는지(`supertest`, 기존 `docsWireframeApproval.test.ts` 패턴 재사용).
  - web 테스트 — 마운트 시 GET으로 pins를 시딩하는 `useEffect`, resolve 토글이 상태를 반영, "수정"이 append가 아니라 update 경로를 호출하는지(fetch mock).
- **Green**:
  - `shared/src/wire-suggestion-types.ts`: `WireFeedbackItem`에 `id`·`status` 추가(+ `WireFeedbackStatus = "open" | "resolved"`).
  - `server/src/lib/wireDocs.ts`: `appendWireframeFeedback`가 id·status 부여; 목록 read 함수(하위호환 기본값 주입) + `resolveWireframeFeedback`/`updateWireframeFeedback`(id 기반 in-place, read-modify-write) 신설.
  - `server/src/routes/docs.ts`: feedback **GET** 라우트 + resolve/update 라우트 신설(POST append 라우트 `:469` 불변).
  - `web/src/api.ts`: `fetchWireframeFeedback`·`resolveWireframeFeedback`(GET/PATCH) 신설.
  - `web/src/WireframePinFeedback.tsx`: 마운트 로드 `useEffect`(pins 시딩), 목록/인박스에 resolve 토글, 수정→update 배선.
- **Refactor**: id 부여·기본값 주입을 lib의 단일 지점으로(append·read가 같은 규칙 공유), 상태 토글 로직을 순수 함수로 분리해 테스트 용이하게.
- **Mock 대상**: 서버 테스트는 `WIREFRAME_FEEDBACK_ROOT`를 tmp로(`docsWireframeApproval.test.ts:49-63` 방식), `ts`는 주입 시계(`nowIso`)로 안정화. web은 fetch mock. 실파일 write는 tmp 볼륨에서 실제 read-modify-write를 검증.
