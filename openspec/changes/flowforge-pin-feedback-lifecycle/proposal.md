## Why

핀 피드백은 **저장(append)에서 끝난다** — 남긴 피드백으로 뭘 하는 기능이 없다(피드백3).

- **읽어 오는 경로 자체가 없다.** 저장된 피드백을 다시 화면에 표시하는 GET 라우트·뷰·`useEffect`가 전부 없다(서버 POST 라우트만 존재: `server/src/routes/docs.ts:469-499`, GET 없음). 핀은 `web/src/WireframePinFeedback.tsx:260`의 `useState<Pin[]>([])` 로컬 세션 상태뿐이라 **새로고침하면 사라진다**. append 시 기존 배열을 읽는 `readFeedbackSidecar`(`wireDocs.ts:296`) 하나만 있고 그건 write 내부용이다.
- **처리(resolve/삭제/수정) 핸들러가 없다.** 남긴 피드백을 "해결됨"으로 표시하거나 지우거나 고칠 방법이 없다. UI의 "수정"조차 in-place가 아니라 또 한 번 POST → **중복 누적**된다(`web/src/api.ts:357` `postWireframeFeedback`는 write 전용, `wireDocs.ts:317` `appendWireframeFeedback`는 append 전용).
- **스키마에 상태·식별자 필드조차 없다.** `WireFeedbackItem`(`shared/src/wire-suggestion-types.ts:42-55`)은 `screenId/text/ts/xPct/yPct/region`만 갖는다 — `id`도 `status`도 없어 **resolve라는 개념이 원천부터 성립할 수 없다**. `Pin.id`(`WireframePinFeedback.tsx:34`)는 화면 내 표시 번호일 뿐 저장되지 않는다.

즉 핀 피드백은 "쓰고 잊는" 로그다. 남긴 사람이 무엇을 남겼는지 다시 볼 수도, 처리했다고 표시할 수도 없다.

## What Changes

- **스키마에 `id`·`status` 필드를 추가**한다. `id`는 안정적 식별자(서버가 append 시 부여), `status`는 `"open" | "resolved"` enum(신규 피드백은 `open`). 기존 `<project>.feedback.json`의 id/status 없는 레코드는 읽을 때 기본값(`id` 생성, `status="open"`)을 부여해 **하위호환**한다.
- **feedback GET 라우트 + 목록/인박스 뷰**를 신설한다. 저장된 핀을 GET으로 불러와 화면에 표시하므로 **새로고침 후에도 유지**된다(현재는 소실). 마운트 시 로드하는 `useEffect`가 로컬 세션 상태(`useState<Pin[]>`)를 서버 데이터로 시딩한다.
- **resolve 토글**을 추가한다. 핀을 resolve하면 `status`가 `resolved`로 바뀌고 목록/인박스에 즉시 반영된다(다시 토글하면 `open`).
- **수정을 in-place 갱신으로 바꾼다.** "수정"이 또 한 번 append가 아니라 `id` 기반 in-place 교체가 되어 중복 누적을 없앤다.

### Non-Goals (범위 밖)

- resolve/피드백을 **상위 change·spec에 자동 반영**하거나 **AI로 와이어를 재생성**하는 것. "flowforge는 write만, AI 호출 안 함(A안 파일 릴레이)"(`WireframePinFeedback.tsx:11`, `wireDocs.ts:313`) 설계 의도를 유지한다 — 이 change는 피드백의 **생애주기(open→resolved) 관리와 재조회**까지만 담당하고, 그 피드백을 소비해 무언가를 재생성하는 것은 외부 스킬(별도 change)의 몫이다.
- 핀 삭제(hard delete)의 UI 노출은 최소로 — resolve(soft close)를 1차 수단으로 한다.

## Capabilities

### New Capabilities

- `flowforge-pin-feedback-lifecycle`: 핀 피드백에 안정적 `id`와 `status`(open/resolved)를 부여하고, 저장된 피드백을 GET으로 재조회해 목록/인박스로 표시하며(새로고침 후에도 유지), resolve 토글과 id 기반 in-place 수정으로 피드백의 생애주기를 관리한다. id/status 없는 기존 레코드는 읽을 때 기본값을 부여해 하위호환한다.

### Modified Capabilities

(없음 — 기존 append write 경로/좌표·빈텍스트 방어는 불변, 필드·조회·처리만 확장)

## Impact

- **shared**: `shared/src/wire-suggestion-types.ts` — `WireFeedbackItem`에 `id: string`·`status: "open" | "resolved"` 필드 추가(+ status enum 타입). 기존 필드(`screenId/text/ts/xPct/yPct/region`) 불변.
- **server**: `server/src/lib/wireDocs.ts` — feedback 목록 read 함수 + resolve/update(in-place, id 기반) 핸들러 신설, `appendWireframeFeedback`가 `id`·`status:"open"`을 부여하도록 확장, 읽기 시 id/status 없는 레코드에 기본값 주입(하위호환). `server/src/routes/docs.ts` — feedback **GET 라우트** + resolve/update 라우트 신설(기존 POST append 라우트 `:469` 불변). 단일 프로세스 append/write이므로 race는 순차 파일 write로 방어.
- **web**: `web/src/api.ts` — feedback GET·resolve 클라이언트 함수 신설(`postWireframeFeedback` `:357` 불변). `web/src/WireframePinFeedback.tsx` — 마운트 로드 `useEffect`(로컬 pins를 서버 데이터로 시딩), 목록/인박스 뷰에 resolve 토글 UI, "수정"을 in-place 갱신으로 배선.
- **배포/검증**: flowforge는 커밋≠라이브(`reference_flowforge_deploy`) — VERIFY에서 `docker compose up -d --build`로 재빌드 후, 핀을 남기고 **새로고침해도 유지**되는지·resolve 토글이 반영되는지·수정이 중복을 만들지 않는지를 Playwright 실픽셀로 확인한다.
- **하위호환**: 기존 `<project>.feedback.json`(id/status 없는 레코드)이 읽기 시 기본값을 받아 크래시 없이 목록에 나타나야 한다.
