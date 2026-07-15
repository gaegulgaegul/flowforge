# Design — cross-project-layout-persistence

## Context

`cross-project-change-views`(archive 2026-07-08)가 `?project=` 쿼리로 타 프로젝트 change **조회**를 열었으나, **쓰기(layout 저장)는 따라오지 않았다.** 조회는 순수 read 라 RO 마운트에서 문제없지만, layout 은 유일한 write 경로다.

확정된 사실(2026-07-15 실측):
- `docker inspect` 마운트 플래그: `PROJECTS_ROOT`(`/home/gaegul` → `/data/docs-root`) = **RW=false**.
- 라이브 `PUT /api/changes/implement-ios-app/layout?project=wowa-wt-dashboard` → **500**.
- 컨테이너 로그: `mkdir '/data/docs-root/wowa-wt-dashboard/openspec/changes/implement-ios-app/viz'` 실패.
- 컨테이너 내 셸 `mkdir` 직접 시도 → `Read-only file system`(EROFS). Node `mkdirSync` 는 같은 조건을 **ENOENT** 로 표면화한다(에러 코드 표기만 다르고 근본은 RO 마운트 — 진단 시 혼동 주의).
- 사용자 도달 가능: `web/src/App.tsx:289` → `api.ts:426 saveLayout(id, layout, project?)` → `?project=` PUT. **UI 드래그로 실제로 밟힌다.**

## Goals

- 타 프로젝트 change 의 레이아웃이 저장되고 재조회 시 복원된다.
- 홈 RO 보안 경계를 보존한다.
- 쓰기 불가 상황이 generic 500 이 아니라 진단 가능한 응답으로 나온다.
- 테스트가 프로덕션 RO 조건을 재현한다(관대한 픽스처가 결함을 가리지 못하게).

## Non-Goals

- 홈 마운트 RW 전환 — **명시적 거부**(아래 Decisions D1).
- 레이아웃을 change 레포(git)에 커밋하는 것 — 시각화 산출물은 레포 오염 대상이라 과거에도 `.gitignore` 로 배제해 왔다.
- 다중 사용자 동시 편집 충돌 해결 — 단일 사용자 환경(개인 홈서버).
- 글로벌 루트(`OPENSPEC_ROOT`) 저장 경로의 마이그레이션 — 기존 오버레이는 읽기 폴백으로 계속 읽는다(무손실).

## Decisions

### D1. 저장 위치 = 전용 RW 볼륨 (사용자 확정 2026-07-15)

**결정**: 호스트 `flowforge/data/graph-overlay/` → 컨테이너 `/data/graph-overlay`(RW), env `OVERLAY_ROOT`.

**근거**: `WIREFRAME_FEEDBACK_ROOT`(`docker-compose.yml:23-26`)가 **동일한 RO-홈 문제**를 이미 이 패턴으로 해결했다. 주석에 근거가 남아 있다("홈은 RO라 docsDir 하위 write 불가(EROFS) → feedback.json 은 이 RW 볼륨에"). 새 패턴을 발명하지 않고 검증된 선례를 재사용한다.

**거부된 대안**:
- **홈 마운트 RW 전환** — `server/src/lib/projects.ts:36-37` 이 무인증 홈 전체 마운트의 의도적 보안 경계로 RO 를 명시(리뷰 C-1 강화 결정). 코드 변경은 가장 적지만 홈 전체가 쓰기 노출된다. **보안 후퇴라 거부.**
- **저장 불가를 409 로 알리고 기능 포기** — 인프라 무변경이라 안전하지만, 타 프로젝트 그래프를 드래그해도 저장이 안 되는 반쪽 기능이 된다. 사용자가 기능 완성을 택했다.

**트레이드오프(수용)**: 레이아웃이 change 레포와 분리 저장된다. 레포를 옮기면 레이아웃이 따라가지 않는다. 대신 시각화 산출물이 소스 레포를 오염시키지 않는다(과거 wowa `.gitignore` 에 `openspec/**/viz/` 를 넣어 막던 문제가 구조적으로 해소).

### D2. 저장 경로 규약 = `<OVERLAY_ROOT>/<project>/<changeId>.json`

**결정**: 프로젝트별 디렉토리 하위에 change id 를 파일명으로.

**근거**: change id 는 `[A-Za-z0-9_-/]` 로 이미 검증된다(`changes.ts:63-69`). 프로젝트명도 `^[A-Za-z0-9_-]+$` 화이트리스트 + 심링크 탈출 가드를 통과한다(`projects.ts:33-47`). 두 검증된 값의 조합이라 경로조작 위험이 새로 생기지 않는다.

**주의**: change id 에 `/` 가 허용된다(라우트가 `:id(*)`). 파일명에 `/` 가 들어가면 하위 디렉토리가 되므로 **`mkdirSync(recursive:true)` 로 부모를 만들거나 id 를 flatten** 해야 한다. apply 단계에서 실제 id 형태를 확인해 결정한다(추측하지 않는다).

### D3. 글로벌 루트 경로는 읽기 폴백으로 보존

**결정**: `readOverlay()` 는 `OVERLAY_ROOT` 우선, 없으면 기존 `<changeDir>/viz/graph-overlay.json` 도 읽는다.

**근거**: 글로벌 루트(`OPENSPEC_ROOT`=wowa-app, RW)에는 이미 저장된 오버레이가 존재한다. 폴백 없이 바꾸면 그 레이아웃이 통째로 사라진 것처럼 보인다(사용자 데이터 유실). 쓰기는 새 규약으로 단일화하되 읽기는 둘 다 본다.

### D4. 쓰기 불가 = 409 `read_only_target` (fail-closed 방어 유지)

**결정**: 대상이 쓰기 불가면 generic 500 이 아니라 409 + 기계 판독 가능한 에러 코드.

**근거**: 설계상 쓸 수 없는 대상은 서버 내부 오류가 아니다. 500 은 진단을 방해한다(이번 조사에서 실제로 로그를 봐야 원인을 알 수 있었다). D1 로 정상 경로는 200 이 되지만, **볼륨 미마운트·권한 오설정 같은 배포 사고 시 정직한 신호가 나오도록** 방어는 남긴다.

**주의**: 에러 메시지에 내부 경로를 노출하지 않는다(`30-security` — 내부 에러 상세 클라이언트 노출 금지). 경로는 서버 로그에만.

### D5. 테스트가 프로덕션 RO 조건을 재현

**결정**: `graphCrossProject.test.ts` 에 RO 루트 케이스 추가(`chmod 0555` 픽스처).

**근거**: 현 테스트(`:110-127`)는 쓰기 가능한 `mkdtempSync` tmp 루트를 써서 **프로덕션보다 관대**하다. green 인 채로 프로덕션 500 이 났다 — 픽스처가 결함을 가린 실사례. 이 change 로 정상 경로가 열려도, RO 대상이 409 로 거부되는지는 별도 재현이 필요하다.

**무력화 프로브 필수**: 409 방어를 제거하면 그 테스트가 red 가 되는지 확인한다(방어가 실제로 동작함을 실증).

## Risks / Open Questions

- **컨테이너 실행 유저 = root**(`docker exec id` 확인). 호스트 볼륨 디렉토리 소유권이 어긋나면 호스트에서 파일을 못 읽을 수 있다. 볼륨 생성 시 소유권을 확인한다.
- **`OVERLAY_ROOT` 미설정 시 동작**: env 없으면 기존 `<changeDir>/viz/` 로 폴백할지, 아니면 명시적 실패로 갈지 — apply 에서 결정. 외부 PC/테스트 환경에서 안 깨지는 쪽(폴백)이 유력하나, 폴백이 조용한 실패를 만들면 안 된다.
- **change id 의 `/` 포함 여부**: D2 주석 참조. 실제 id 형태를 확인 후 flatten 여부 결정.
- **프론트 409 처리**: `App.tsx:289` 가 `.catch()` 로 로깅만 한다. 409 를 사용자에게 알릴지는 확인 후 최소 범위로. 이 change 의 정상 경로에선 409 가 안 나므로 우선순위 낮음.

## 화면 구성 / UI

이 change 는 **서버·인프라 변경**이며 새 화면을 만들지 않는다. 프론트는 무변경 예상(409 알림이 필요하면 기존 에러 처리에 최소 추가). 화면 프로토타입 대상 아님.
