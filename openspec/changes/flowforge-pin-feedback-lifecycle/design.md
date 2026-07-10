# Design — flowforge-pin-feedback-lifecycle

> Phase 6(핀 피드백 후속 액션). 와이어에 핀으로 남긴 피드백이 **저장(append)에서 끝나는** 문제(피드백3)를 해결한다. 목표는 피드백의 **생애주기(open→resolved) 관리 + 재조회**까지 — 그 피드백을 소비해 와이어를 재생성하는 것은 범위 밖(외부 스킬·별도 change).

## 배경 / 현재 상태 (확정, 파일경로)

- **저장(append만)**: 핀 피드백은 `<project>.feedback.json`에 append만 된다 — `server/src/lib/wireDocs.ts:317-346` `appendWireframeFeedback`. 좌표(`xPct/yPct` 0~100)·빈텍스트·미존재 화면 id 방어는 이미 있음(`wireDocs.ts:324-330`).
- **스키마**: `WireFeedbackItem`(`shared/src/wire-suggestion-types.ts:42-55`)은 `screenId/text/ts/xPct/yPct/region`만. **`id`·`author`·`status` 필드 자체가 없다** → resolve 개념의 원천 불가.
- **읽기 부재**: feedback을 다시 읽어 화면에 표시하는 GET 라우트·뷰·`useEffect`가 없다. 서버는 POST append 라우트만(`server/src/routes/docs.ts:469-499`). append 시 기존 배열을 읽는 `readFeedbackSidecar`(`wireDocs.ts:296`) 하나만 있고 write 내부 전용. → **새로고침하면 로컬 핀이 사라진다**(`web/src/WireframePinFeedback.tsx:260` `useState<Pin[]>([])`).
- **처리 부재**: resolve/삭제/수정 핸들러 없음. UI "수정"조차 in-place 아니라 또 append(`web/src/api.ts:357-373` `postWireframeFeedback`=write only) → 중복 누적.
- **설계 의도**: "flowforge는 write만, AI 호출 안 함"(A안 파일 릴레이 — `WireframePinFeedback.tsx:11`, `wireDocs.ts:313`). 후속 처리를 외부로 미룸. 하지만 실질적 후속 처리가 하나도 없어 "쓰고 잊는 로그"가 됨.

## 목표 (최소)

1. 스키마에 `id`·`status`(open/resolved) 필드 추가.
2. feedback **GET 라우트** + 목록/인박스 뷰(새로고침 후에도 유지).
3. **resolve 토글** + `id` 기반 **in-place 수정**(중복 누적 제거).
4. 기존 id/status 없는 레코드 **하위호환**.

## D1. 스키마 확장 (shared)

`WireFeedbackItem`(`shared/src/wire-suggestion-types.ts`)에 2개 필드 추가:

```ts
export type WireFeedbackStatus = "open" | "resolved";

export interface WireFeedbackItem {
  readonly id: string;                 // ← 신규: 안정적 영속 식별자(서버 append 시 부여)
  readonly status: WireFeedbackStatus; // ← 신규: 신규 피드백=open
  readonly screenId: string;
  readonly text: string;
  readonly ts: string;
  readonly xPct: number;
  readonly yPct: number;
  readonly region?: string;
}
```

- 기존 필드는 불변. `id`·`status`만 추가.
- `id` 생성 방식: **`ts + 짧은 난수`** 또는 `crypto.randomUUID()`. 신규 의존성 없이 Node `crypto` 내장 사용(tech-evaluation: 새 라이브러리 지양). `ts`는 이미 주입 시계(`nowIso`)로 스탬프되므로, 테스트 안정성을 위해 id 생성도 주입 가능한 형태(선택적 id 생성기 파라미터)로 두면 결정적 테스트가 쉽다.
- `author` 필드는 **추가하지 않는다**(단독 사용 환경 — 사용자 프로필상 1인 서버, 작성자 구분 불필요. 과도한 스키마 지양).

## D2. id 부여 & 하위호환 기본값 주입 (server/lib)

핵심: **id 부여 규칙을 lib의 단일 지점**에 두고 append와 read가 공유한다(드리프트 방지).

- **append**(`appendWireframeFeedback` 확장): 저장 레코드에 `id`(생성)·`status:"open"` 부여.
- **read**(신규 목록 함수, 예 `readWireframeFeedback(docsDir, project)`): 파일을 읽어 배열을 반환하되, **id/status 없는 구버전 레코드에 기본값 주입** — `status` 없으면 `"open"`, `id` 없으면 생성. 생성 규칙은 **결정적**(예: `${ts}-${index}` 또는 좌표+ts 해시)으로 두어, 같은 레코드가 read마다 다른 id를 얻지 않게 한다(resolve 대상 지정 안정성).
- **마이그레이션 정책**: 기본값 주입은 **읽을 때(lazy)** 한다. 파일을 즉시 재기록하지 않고, 첫 write(append/resolve/update)가 일어날 때 정규화된 전체 배열을 재기록한다(read-modify-write가 자연히 파일을 최신 스키마로 승격). 이로써 읽기 전용 조회가 파일을 건드리지 않는다(부작용 최소).

## D3. GET 라우트 + resolve/update 핸들러 (server/routes)

기존 POST append 라우트(`docs.ts:469`)는 **불변**. 3개를 신설:

- **GET** `/api/docs/:project(*)/planning-wireframe-feedback` — `readWireframeFeedback`로 배열 반환(빈 파일=`[]`). 기존 라우트들과 같은 `resolveDocsDir`(`docs.ts:474`)·404 처리 패턴 재사용.
- **resolve/update** — `id`로 대상 지정. 방식 택1(구현 시 확정, 둘 다 spec THEN 만족):
  - 옵션 A: `PATCH /api/docs/:project(*)/planning-wireframe-feedback/:id` body=`{ status?, text? }` — RESTful, 하나의 라우트로 resolve(status)·수정(text) 겸용.
  - 옵션 B: resolve 전용 + update 전용 라우트 분리.
  - 본 설계는 **옵션 A(PATCH 겸용)** 권장 — resolve와 수정이 같은 in-place read-modify-write 경로를 공유하므로 라우트 1개로 충분(게으름 위계).
- **핸들러 동작**(lib `updateWireframeFeedback(docsDir, project, id, patch)`): 파일을 다시 읽고(read) → `id` 매칭 레코드 찾기 → 없으면 `{ ok:false }`(라우트가 404) → 있으면 `status`/`text` 패치(좌표·screenId·id 보존) → 전체 배열 재기록(write). **read-modify-write**라 다른 직전 변경을 덮어쓰지 않는다.
- **입력 검증**: 기존 `isWireframeFeedbackRequest`(`docs.ts:459-467`)와 같은 화이트리스트 방식. `status`는 `"open"|"resolved"`만 허용, `text`는 append와 동일하게 빈문자 거부. 경로 traversal은 기존 `resolveDocsDir`가 방어(`docsWireframeApproval.test.ts:211`에 `..%2f` 거부 테스트 존재 — 신규 라우트도 같은 함수 경유).

## D4. web 목록/인박스 뷰 + resolve 토글 + in-place 수정

`web/src/WireframePinFeedback.tsx`(⌘/Ctrl+클릭→좌표%→팝오버→핀, 목록=`PinList` `:210`)에 배선:

- **마운트 로드 `useEffect`(신규)**: 프로젝트 진입 시 `fetchWireframeFeedback(project)` GET → 반환 배열을 로컬 `Pin[]`(`:260` `useState<Pin[]>([])`)으로 **시딩**. 서버 `WireFeedbackItem`(screenId/xPct/yPct/text/region/id/status)을 로컬 `Pin`(`:32-42`)으로 매핑. 이로써 **새로고침 후에도 핀 유지**. 로컬 `Pin.id`(표시 번호)와 서버 `id`(영속)를 분리 관리하거나, `Pin`에 서버 `id`(예 `serverId`)·`status` 필드를 추가.
- **resolve 토글 UI**: `PinList`(`:210`)의 각 항목과/또는 핀 팝오버에 resolve 버튼. 클릭 → `resolveWireframeFeedback(project, serverId, nextStatus)` PATCH → 성공 시 로컬 상태의 그 핀 `status` 갱신 → 목록/마커에 resolved 스타일 반영(예: 흐리게/체크). 다시 누르면 open.
- **수정 in-place**: 기존 핀 텍스트 수정 저장(`WireframePinFeedback.tsx:297` 부근 `postWireframeFeedback` 호출 지점) 분기 — **기존 핀(서버 id 있음)이면 PATCH(update), 새 핀이면 기존 POST(append)**. 이로써 수정이 중복 append를 만들지 않음.
- **빈 상태**: `PinList`는 이미 빈 목록 처리(`:215` `pins.length === 0`) — GET이 빈 배열이면 그대로 노출.

## D5. race / 동시성 방어

- flowforge 서버는 **단일 프로세스**(cloudflared 뒤 단일 컨테이너). 동시 요청은 Node 이벤트 루프에서 순차 처리되지만, feedback write는 `readFileSync`→push/patch→`writeFileSync`(sync I/O)라 한 핸들러의 read-modify-write가 원자적으로 완료된 뒤 다음이 실행된다(sync write는 이벤트 루프를 블록).
- 따라서 파일 잠금은 불필요. **각 write 핸들러가 자기 write 직전에 파일을 다시 읽는 read-modify-write**만 지키면 append/resolve/update가 서로의 변경을 덮어쓰지 않는다. 이 원칙을 lib 함수 계약으로 박는다(핸들러가 stale 배열을 재사용하지 않음).
- 비동기 write(`writeFile` promise)로 바꾸면 인터리빙 여지가 생기므로, 기존 `writeFileSync`(`wireDocs.ts:344`) sync 방식을 유지한다.

## 의도적 제외 (범위 밖)

- **change/spec 자동 반영**: resolve된 피드백을 상위 change나 표준 spec에 자동 흡수·기록하지 않는다. 피드백↔spec 연결은 별도 change의 몫.
- **AI 와이어 재생성**: 피드백을 읽어 그 지점만 와이어를 재생성하는 것은 **외부 스킬**(openspec-plan 계열)이 A안 파일 릴레이로 담당 — flowforge는 여전히 write/read만 하고 LLM을 부르지 않는다(설계 의도 유지, 아래 "A안 관계" 참조).
- **hard delete UI**: soft close(resolve)를 1차 수단으로 하고, 영구 삭제 UI는 노출하지 않는다(실수 방지, 피드백은 이력으로 보존).
- **author/멀티유저**: 단독 사용 환경이라 작성자 구분·권한 분리는 두지 않는다.

## "A안 파일 릴레이" 설계 의도와의 관계

기존 주석("flowforge는 write만, AI 호출 안 함" — `WireframePinFeedback.tsx:11`, `wireDocs.ts:313`)의 본질은 **"flowforge가 LLM을 직접 호출하지 않는다"**이지, "flowforge가 피드백을 다시 읽거나 상태를 관리하지 않는다"가 아니다. 이 change는 그 선을 지킨다:

- flowforge는 여전히 **파일 read/write만** 한다 — GET(read)·PATCH(read-modify-write)는 파일 조작일 뿐 AI 호출이 아니다.
- resolve/status는 **파일 안의 상태 플래그**다. 외부 스킬은 그 파일을 읽어 `status:"open"`인 피드백만 소비하고, 처리 후 `resolved`로 표시하는 릴레이를 이어갈 수 있다(즉 status는 A안 릴레이를 **끊는 게 아니라 상태를 붙여 더 잘 굴리는** 확장).
- 즉 이 change는 A안 릴레이의 **파일 계약을 풍부하게** 한다(id로 지정 가능, status로 진행 추적). 릴레이의 AI 쪽(재생성)은 그대로 외부에 남는다.

## 검증

flowforge는 커밋≠라이브(`reference_flowforge_deploy`) — VERIFY에서 `docker compose up -d --build`로 재빌드 후, Playwright(`~/.cache/ms-playwright`) 실픽셀로:
1. 핀을 남기고 **새로고침 → 유지되는지**(현재는 소실).
2. resolve 토글 → 목록/마커에 resolved 반영, 다시 토글 → open.
3. 기존 핀 텍스트 수정 → 배열 길이 안 늘고 in-place 갱신(중복 없음).
4. 구버전 `feedback.json`(id/status 없는 레코드) 로드 → 크래시 없이 목록 표시.

관련: [[project_flowforge_wireframe_redesign]](와이어 재설계 3단계·핀 피드백), [[reference_flowforge_deploy]](재빌드 필수), `shared/src/wire-suggestion-types.ts:42-55`(스키마), `server/src/lib/wireDocs.ts:317`(append), `server/src/routes/docs.ts:469`(POST 라우트), `web/src/WireframePinFeedback.tsx`(핀 UI).
