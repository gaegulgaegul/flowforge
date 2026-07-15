## Why

flowforge 대시보드에서 **타 프로젝트 change 의 유저플로우 그래프를 드래그하면 레이아웃 저장이 HTTP 500 으로 실패한다.** 사용자가 실제로 밟는 경로다 — `web/src/App.tsx:289` 가 `selectedProject` 를 실어 `saveLayout(selected, layout, selectedProject)` 을 호출하고, `web/src/api.ts:426` `saveLayout(id, layout, project?)` 이 `?project=` 를 붙여 PUT 한다.

라이브 실측(2026-07-15):

```
PUT /api/changes/implement-ios-app/layout?project=wowa-wt-dashboard
  -> 500 {"error":"internal_error"}
컨테이너 로그: mkdir '/data/docs-root/wowa-wt-dashboard/openspec/changes/implement-ios-app/viz' 실패
```

근본원인은 **쓰기 대상이 읽기 전용 마운트**라는 것이다. `docker inspect` 로 확인한 권위 있는 마운트 플래그:

| 호스트 | 컨테이너 | RW |
|---|---|---|
| `/home/gaegul/wowa-app/openspec` | `/data/openspec` (`OPENSPEC_ROOT`) | **true** |
| `/home/gaegul` | `/data/docs-root` (`PROJECTS_ROOT`) | **false** |
| `/home/gaegul/flowforge/data/wireframe-feedback` | `/data/wireframe-feedback` | true |

`writeOverlay()`(`server/src/lib/changes.ts:88-92`)가 `<changeDir>/viz/` 를 `mkdirSync` 하는데, 크로스 프로젝트 경로는 `PROJECTS_ROOT`(RO) 하위라 실패한다. 글로벌 루트(`OPENSPEC_ROOT`, RW)로 가는 기존 경로는 정상이므로 **크로스 프로젝트 조회 기능(`cross-project-change-views`, archive 2026-07-08)이 읽기만 열고 쓰기는 못 따라온 미완성 구간**이다.

두 가지가 이 결함을 가렸다:

1. **테스트가 프로덕션보다 관대하다.** `server/src/routes/__tests__/graphCrossProject.test.ts:110-127` 이 PUT layout 200 + 파일 생성을 검증하지만, 쓰기 가능한 `mkdtempSync` tmp 루트를 쓴다. 프로덕션의 RO 조건을 재현하지 않아 green 인 채로 프로덕션에서 500 이 난다.
2. **500 은 틀린 코드다.** 설계상 쓸 수 없는 대상은 서버 내부 오류가 아니라 알려진 제약이다. `safe()` 가 raw 예외를 generic 500 으로 뭉갠다.

## What Changes

- **레이아웃 오버레이 저장 위치를 전용 RW 볼륨으로 분리한다.** 호스트 `flowforge/data/graph-overlay/` → 컨테이너 `/data/graph-overlay`(RW), env `OVERLAY_ROOT`. 저장 경로 규약 = `<OVERLAY_ROOT>/<project>/<changeId>.json`. **홈 마운트는 RO 로 유지한다**(보안 경계 보존, 아래 Impact 참조).
  - 선례: `WIREFRAME_FEEDBACK_ROOT`(`docker-compose.yml:23-26`)가 **동일한 RO-홈 문제**를 전용 RW 볼륨으로 이미 해결했다. 주석에 근거까지 남아 있다("홈은 RO라 docsDir 하위 write 불가(EROFS) → feedback.json 은 이 RW 볼륨에"). 같은 패턴을 재사용한다.
- **읽기 경로도 같은 규약을 따른다.** `readOverlay()` 가 쓰기가 간 곳에서 읽어야 저장→재조회가 일관된다. 기존 `<changeDir>/viz/graph-overlay.json` 도 **읽기 폴백**으로 남겨 이미 저장된 글로벌 루트 오버레이가 유실되지 않게 한다.
- **쓰기 불가를 정직한 상태 코드로 표면화한다.** 어떤 이유로든 대상이 쓰기 불가면 generic 500 이 아니라 기계 판독 가능한 에러(409 + `read_only_target`)로 응답한다. 이 change 로 정상 경로는 200 이 되지만, 방어는 남긴다(fail-closed).
- **테스트가 프로덕션 조건을 재현하게 한다.** RO 루트 케이스(`chmod 0555` 픽스처)를 추가해 관대한 tmp 픽스처가 결함을 가리지 못하게 한다. 무력화 프로브로 방어 실효성을 확인한다.
- **BREAKING 아님**: 기존 글로벌 루트(`OPENSPEC_ROOT`) 저장 경로는 그대로 동작한다(읽기 폴백 유지). 프론트 API 계약(`saveLayout(id, layout, project?)`) 무변경.

## Capabilities

### New Capabilities
- `cross-project-layout-persistence`: 타 프로젝트(`PROJECTS_ROOT` 하위, RO 마운트) change 의 그래프 레이아웃을 전용 RW 볼륨에 저장·재조회하고, 쓰기 불가 대상은 정직한 상태 코드로 거부한다.

### Modified Capabilities
(없음 — 기존 `cross-project-change-views` 의 읽기 requirement 는 불변. 쓰기 경로만 additive 로 보완.)

## Impact

- **서버**: `server/src/lib/changes.ts` — `writeOverlay`/`readOverlay` 가 `OVERLAY_ROOT` 규약을 따르도록. `server/src/routes/graph.ts:130-147` — PUT layout 이 쓰기 불가를 409 로 매핑.
- **인프라(비가역 — 승인 게이트 필요)**: `docker-compose.yml` 에 볼륨 1줄 + env 1줄 추가, 호스트 `flowforge/data/graph-overlay/` mkdir, `.gitignore` 에 산출물 제외. **`docker compose up -d --build` 로 라이브 컨테이너 재생성**이 필요하다(§4 사전 확인 대상).
- **🔴 홈 마운트를 RW 로 뒤집지 않는다**: `server/src/lib/projects.ts:36-37` 이 무인증 홈 전체 마운트의 **의도적 보안 경계**로 RO 를 명시한다(리뷰 C-1 로 강화된 결정). 이 change 는 그 경계를 보존한다.
- **데이터**: 레이아웃이 change 레포 밖(전용 볼륨)에 저장된다 — 트레이드오프. 레포에 시각화 산출물이 섞이지 않는 이점도 있다(과거 wowa `.gitignore` 에 `openspec/**/viz/` 를 추가해 오염을 막던 문제가 구조적으로 해소).
- **프론트**: 무변경 예상. 단 409 응답 시 사용자에게 알리는 처리는 확인 후 필요하면 최소 추가.
- **테스트**: `graphCrossProject.test.ts` 에 RO 루트 재현 케이스 추가. 기존 548 테스트 회귀 0 유지.
- **검증**: 라이브 재배포 후 `PUT layout?project=wowa-wt-dashboard` **200** + 저장 파일 실재 + 재조회 일치를 실측한다. 500 재현이 사라졌음을 같은 명령으로 확인한다.
