# Tasks — flowforge-pin-feedback-lifecycle

## Tasks

### Sequential Group A: 스키마 확장 (shared — 나머지의 토대)

- [x] A.1 (RED) `WireFeedbackItem`에 id·status 사용처를 추가해 타입 에러 확인(append가 id/status 없이 생성 → 서버 typecheck FAIL)
- [x] A.2 `shared/src/wire-suggestion-types.ts` — `WireFeedbackStatus = "open" | "resolved"` 추가, `WireFeedbackItem`에 `id`·`status` 필드 추가(기존 필드 불변), index export
- [x] A.3 (GREEN) `shared` 빌드/타입체크 통과 확인

### Sequential Group B: server lib — id 부여·하위호환·in-place (spec THEN 매핑)

- [x] B.1 (RED) `wireDocs.test.ts` — append id·status:"open" / read 하위호환 기본값 / update in-place 토글·수정·미존재 id no-op → 확인
- [x] B.2 `appendWireframeFeedback` 확장 — 저장 레코드에 `id`(crypto.randomUUID, 주입 가능 genId) + `status:"open"` 부여 (THEN: 새 핀=고유 id+open)
- [x] B.3 신규 `readWireframeFeedback(docsDir, project)` — 배열 반환 + id/status 없는 레코드에 **결정적** 기본값 주입(`legacy-<i>-<ts>-<x>-<y>`), lazy(읽기 시 파일 미변경) (THEN: 구버전 정상 표시·id 안정)
- [x] B.4 신규 `updateWireframeFeedback(docsDir, project, id, patch)` — read-modify-write로 id 매칭 레코드 status/text in-place 패치(id·screenId·좌표 보존), 미매칭=`{ok:false}` (THEN: resolve·수정·미존재 거부·타 레코드 유실 없음)
- [x] B.5 (GREEN) B.1 테스트 전부 통과 확인(wireDocs 70건)

### Sequential Group C: server routes — GET + resolve/update (B 완료 후)

- [x] C.1 (RED) `docsWireframeApproval.test.ts` 확장 — GET 배열/빈 목록, PATCH status·text 200·미존재 404·빈text/화이트리스트밖 400, `..%2f` traversal 404 → 확인
- [x] C.2 `docs.ts` — **GET** `/api/docs/:project(*)/planning-wireframe-feedback` 신설(`readWireframeFeedback`, POST 라우트 불변)
- [x] C.3 `docs.ts` — **PATCH** `/api/docs/:project(*)/planning-wireframe-feedback/:id` body=`{status?,text?}` 신설(status 화이트리스트·빈텍스트 400·미존재 id 404, requireWriteAuth)
- [x] C.4 (GREEN) C.1 테스트 전부 통과 확인(route 27건)

### Sequential Group D: web api 클라이언트 (C 완료 후)

- [~] D.1 (RED) web 테스트러너 없음(worktree) — fetch-mock 단위 테스트 **미실행**. 계약은 typecheck·서버 라우트 테스트로 교차 보장.
- [x] D.2 `web/src/api.ts` — `fetchWireframeFeedback(project)` GET + `updateWireframeFeedback(project, id, patch)` PATCH 신설(`postWireframeFeedback` 불변)
- [x] D.3 (GREEN) 타입체크 통과 확인(web typecheck PASS)

### Sequential Group E: web UI — 시딩·목록·resolve 토글·in-place 수정 (D 완료 후)

- [~] E.1 (RED) web 테스트러너 없음 — 컴포넌트 fetch-mock 테스트 **미실행**. 배선은 typecheck·코드 리뷰로 보장, 실동작은 Group F(Playwright) 몫(환경 제약).
- [x] E.2 `WireframePinFeedback.tsx` — 마운트 로드 `useEffect`: `fetchWireframeFeedback(project)` → `WireFeedbackItem`을 로컬 `Pin`(serverId·status 포함)으로 시딩(device는 화면목록에서 파생) (THEN: 새로고침 후 핀 유지)
- [x] E.3 `PinList`/마커 — resolve 토글 버튼 추가 → `updateWireframeFeedback(project, serverId, {status})` → 로컬 status·resolved 스타일 반영, 재토글=open
- [x] E.4 저장 분기 — 기존 핀(serverId 있음)=PATCH update(중복 없음·좌표 보존), 새 핀=POST append 후 재조회로 serverId 확보
- [x] E.5 (GREEN) web 빌드/타입체크 통과 확인

### Sequential Group F: 라이브 반영 + UI 실픽셀 검증

- [~] F.1~F.5: **검증 안 함** — worktree에 docker/Playwright 미설치, web 테스트러너 없음. 라이브 배포(`docker compose up -d --build`) 후 별도 Playwright 실픽셀 필요(새로고침 유지·resolve 토글·중복없음·구버전 로드).

## Verify

- [~] VERIFY: 빌드 PASS(EXIT 0) → 타입체크 PASS(EXIT 0) → 테스트 PASS(server 504/504) → **린트·UI(Playwright) 안 함**(worktree 환경: lint 스크립트 미정의·Playwright/docker/web 테스트러너 없음). UI 실측은 라이브 배포 후 별도 필요.
