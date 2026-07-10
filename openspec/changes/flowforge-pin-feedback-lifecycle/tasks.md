# Tasks — flowforge-pin-feedback-lifecycle

## Tasks

### Sequential Group A: 스키마 확장 (shared — 나머지의 토대)

- [ ] A.1 (RED) `shared` 타입 테스트/타입체크 — `WireFeedbackItem`에 `id`·`status` 필드가 요구되도록 하는 사용처를 추가해 현재 실패(타입 에러) 확인
- [ ] A.2 `shared/src/wire-suggestion-types.ts:42-55` — `WireFeedbackStatus = "open" | "resolved"` 추가, `WireFeedbackItem`에 `id: string`·`status: WireFeedbackStatus` 필드 추가(기존 `screenId/text/ts/xPct/yPct/region` 불변)
- [ ] A.3 (GREEN) `shared` 빌드/타입체크 통과 확인

### Sequential Group B: server lib — id 부여·하위호환·in-place (spec THEN 매핑)

- [ ] B.1 (RED) `server/src/lib/__tests__/wireDocs.test.ts` — append 레코드에 고유 `id`·`status:"open"` 부여 / 목록 read가 id·status 없는 구버전 레코드에 기본값(id 생성·status="open") 주입 / update가 id 기반 in-place로 status 토글·text 갱신하고 좌표 보존 / 존재하지 않는 id는 no-op → 실패 확인
- [ ] B.2 `wireDocs.ts:317` `appendWireframeFeedback` 확장 — 저장 레코드에 `id`(생성, Node `crypto`/`ts`+난수, 주입 가능) + `status:"open"` 부여 (THEN: 새 핀=고유 id+open)
- [ ] B.3 `wireDocs.ts` 신규 `readWireframeFeedback(docsDir, project)` — 파일 배열 반환 + id/status 없는 레코드에 결정적 기본값 주입(하위호환, lazy·읽기 시 파일 미변경) (THEN: 구버전 레코드 정상 표시)
- [ ] B.4 `wireDocs.ts` 신규 `updateWireframeFeedback(docsDir, project, id, patch)` — read-modify-write로 id 매칭 레코드의 `status`/`text` in-place 패치(id·screenId·좌표 보존), 미매칭 id는 `{ok:false}` (THEN: resolve 토글·in-place 수정·미존재 id 거부·좌표 보존·append 후 resolve 시 타 레코드 유실 없음)
- [ ] B.5 (GREEN) B.1 테스트 전부 통과 확인

### Sequential Group C: server routes — GET + resolve/update (B 완료 후)

- [ ] C.1 (RED) `server/src/routes/__tests__/docsWireframeApproval.test.ts` 확장 — feedback **GET**이 저장 배열 반환(빈 파일=`[]`) / PATCH가 id로 status·text 갱신 200, 미존재 id 404 / `..%2f` 경로 traversal 거부 → 실패 확인 (`WIREFRAME_FEEDBACK_ROOT` tmp 패턴 `:49-63` 재사용)
- [ ] C.2 `server/src/routes/docs.ts` — **GET** `/api/docs/:project(*)/planning-wireframe-feedback` 신설(`readWireframeFeedback`, `resolveDocsDir`+404 패턴, POST 라우트 `:469` 불변) (THEN: 목록 GET 로드·빈 목록)
- [ ] C.3 `server/src/routes/docs.ts` — **PATCH** `/api/docs/:project(*)/planning-wireframe-feedback/:id` body=`{status?,text?}` 신설(`updateWireframeFeedback` 호출, status 화이트리스트·빈텍스트 거부·미존재 id 404) (THEN: resolve/재열기/in-place 수정/미존재 id 거부)
- [ ] C.4 (GREEN) C.1 테스트 전부 통과 확인

### Sequential Group D: web api 클라이언트 (C 완료 후)

- [ ] D.1 (RED) `web/src/api.ts` 대상 테스트 — `fetchWireframeFeedback`(GET)·`resolveWireframeFeedback`/`updateWireframeFeedback`(PATCH)가 올바른 엔드포인트·body로 호출되는지(fetch mock) → 실패 확인
- [ ] D.2 `web/src/api.ts` — `fetchWireframeFeedback(project)` GET + `updateWireframeFeedback(project, id, patch)` PATCH 신설(`postWireframeFeedback` `:357` 불변)
- [ ] D.3 (GREEN) D.1 통과 확인

### Sequential Group E: web UI — 시딩·목록·resolve 토글·in-place 수정 (D 완료 후)

- [ ] E.1 (RED) `web/src/WireframePinFeedback.tsx` 테스트 — 마운트 시 GET으로 pins 시딩 / resolve 토글이 status 반영 / 기존 핀 수정이 append 아닌 update 호출 → 실패 확인(fetch mock)
- [ ] E.2 `WireframePinFeedback.tsx` — 마운트 로드 `useEffect` 신설: `fetchWireframeFeedback(project)` → 서버 `WireFeedbackItem`을 로컬 `Pin`(`:32-42`)으로 매핑해 `setPins` 시딩(`Pin`에 서버 `id`·`status` 반영) (THEN: 새로고침 후 핀 유지·목록 GET 로드)
- [ ] E.3 `WireframePinFeedback.tsx` `PinList`(`:210`)/팝오버 — resolve 토글 버튼 추가 → `updateWireframeFeedback(project, serverId, {status})` → 로컬 status 갱신·resolved 스타일 반영, 재토글=open (THEN: resolve/재열기)
- [ ] E.4 `WireframePinFeedback.tsx` 저장 분기(`:297` 부근) — 기존 핀(서버 id 있음)=PATCH update, 새 핀=기존 POST append 로 분기 (THEN: 수정 시 중복 없음·좌표 보존)
- [ ] E.5 (GREEN) E.1 통과 확인

### Sequential Group F: 라이브 반영 + UI 실픽셀 검증

- [ ] F.1 `docker compose up -d --build`로 flowforge 라이브 반영(커밋≠라이브, `reference_flowforge_deploy`)
- [ ] F.2 Playwright(`~/.cache/ms-playwright`) — 핀 남긴 뒤 **새로고침 → 핀 유지** 실픽셀 캡처(현재는 소실이었음)
- [ ] F.3 Playwright — resolve 토글 → 목록/마커 resolved 반영, 재토글 → open 캡처
- [ ] F.4 Playwright — 기존 핀 텍스트 수정 → 목록 길이 불변(중복 없음)·좌표 유지 캡처
- [ ] F.5 구버전 `<project>.feedback.json`(id/status 없는 레코드) 로드 → 크래시 없이 목록 표시 확인

## Verify

- [ ] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 시) 전부 PASS
