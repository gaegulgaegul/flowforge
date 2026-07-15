## Tasks

이 change 는 서버(`changes.ts`·`graph.ts`)+인프라(`docker-compose.yml`) 수정이다. 프론트는 무변경 예상. server 워크스페이스 jest 로 검증하고, 라이브 실측(500 재현이 사라졌는지)이 최종 게이트다.

**Affinity Analysis**: 쓰기/읽기 경로는 같은 파일(`changes.ts`)이라 순차. 라우트 에러 매핑(`graph.ts`)과 인프라(`docker-compose.yml`)는 파일 교집합이 없어 병렬 가능하나, RED 테스트는 둘 다 `graphCrossProject.test.ts` 를 만지므로 순차로 둔다.

### Sequential: 사실 확인 (추측 금지 — design Open Questions 해소)

- [x] 0.1 change id 형태 확인: 라우트가 `:id(*)` 라 id 에 `/` 가 들어올 수 있는지 실제 데이터로 확인(`ls <project>/openspec/changes/`). `/` 가 있으면 저장 파일명 flatten 여부 결정, 없으면 그대로. **결과를 design.md D2 에 반영**(추측으로 구현 금지).
- [x] 0.2 `OVERLAY_ROOT` 미설정 시 동작 결정: 기존 `<changeDir>/viz/` 폴백 vs 명시적 실패. 테스트·외부 PC 에서 안 깨지는 쪽을 택하되 **조용한 실패를 만들지 않는다**. design.md Open Questions 에 결정 기록.

### Sequential: 저장/읽기 경로 (RED → GREEN, 같은 파일 changes.ts)

- [x] 1.1 RED: `OVERLAY_ROOT` 설정 시 `writeOverlay` 가 `<OVERLAY_ROOT>/<project>/<changeId>.json` 에 쓰고 `PROJECTS_ROOT` 하위에는 `viz/` 를 만들지 않는 실패 테스트 작성 — `server/src/lib/__tests__/changes.test.ts`
- [x] 1.2 RED: `readOverlay` 가 `OVERLAY_ROOT` 우선 조회 + 기존 `<changeDir>/viz/graph-overlay.json` 폴백을 둘 다 읽는 실패 테스트 작성(무손실 보장, design D3) — 같은 파일
- [x] 1.3 GREEN: `server/src/lib/changes.ts` `writeOverlay`/`readOverlay` 를 `OVERLAY_ROOT` 규약으로 구현. 0.1·0.2 결정 반영. project 컨텍스트를 인자로 받도록 시그니처 확장(호출부 동시 수정 — [[feedback_api_contract]] 계약 일치). (테스트 실패 시 추측 수정 금지, 근본원인부터)

### Parallel Group 1 (독립 - 동시 실행 가능: 서로 다른 파일)

- [x] 2.1 GREEN: `server/src/routes/graph.ts:130-147` PUT layout 이 쓰기 불가를 409 + `read_only_target` 으로 매핑(generic 500 금지). **에러 본문에 내부 경로 미노출**(30-security), 경로는 서버 로그에만. 미지 프로젝트 404 는 기존 유지 [parallel]
- [x] 2.2 인프라: `docker-compose.yml` 에 `OVERLAY_ROOT: /data/graph-overlay` env + `./data/graph-overlay:/data/graph-overlay`(RW) 볼륨 추가. 호스트 `flowforge/data/graph-overlay/` mkdir. `.gitignore` 에 산출물 제외 추가. **홈 마운트는 RO 유지**(design D1 — 뒤집지 않는다). 🔴 컨테이너 재생성은 4.1 에서 [parallel]

### Sequential: 프로덕션 조건 재현 테스트 (design D5 — 픽스처가 결함 가리지 못하게)

- [x] 3.1 RED: `server/src/routes/__tests__/graphCrossProject.test.ts` 에 **RO 루트 케이스** 추가(`chmod 0555` 픽스처) — 쓰기 불가 대상이 409 로 거부되는지. 기존 `:110-127` 의 관대한 `mkdtempSync` 픽스처가 프로덕션 500 을 가렸던 실사례 재발 방지
- [x] 3.2 무력화 프로브: 409 방어를 제거하면 3.1 이 red 가 되는지 확인 → 원복. 방어가 실제로 동작함을 실증(형식적 테스트 금지)
- [x] 3.3 회귀 확인: `?project=` 없는 글로벌 루트 저장이 기존대로 동작하는지 테스트로 고정. server 기존 548 테스트 회귀 0

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] 4.1 VERIFY: **PASS** (2026-07-15, `verify.json`/`verify.html`). 5단계 전부 통과 — 빌드 0·타입체크 0·린트 0·테스트(server 554 PASS = 기존 548 + 신규 6, web 16/16 무영향)·실동작. 사용자 승인 후 `docker compose up -d --build` 재배포(docker inspect 확인: `/data/graph-overlay` RW=true 신규, `/data/docs-root` RW=false 유지, `OVERLAY_ROOT` env 주입). 라이브 실측: 이전 500 나던 동일 명령 → **200** `{"ok":true,"saved":2}`, `data/graph-overlay/wowa-wt-dashboard/implement-ios-app.json` 실재, 홈 하위 `viz/` 0건(find), 재조회 좌표 복원(두 번 로드 동일=영속), 글로벌 루트(`?project=` 없음) 200 회귀 0, 경로조작 404, 잘못된 본문 400. Playwright e2e: 노드 드래그 → 브라우저가 `PUT layout?project=wowa-wt-dashboard` 발신 → **200**. 시나리오 8/8 PASS.
