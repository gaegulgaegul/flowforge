# REVIEW — cross-project-layout-persistence

- **최종 배포 가능 여부: 배포 가능**
- 실행: 2026-07-15, code-reviewer 에이전트 위임(적대적 3페르소나, `rules/70-adversarial-review.md`)
- 리뷰 대상: `c45c333..be6ba21` 중 `server/`·`shared/`·`web/`·`docker-compose.yml`·`.gitignore`
- 반드시수정(BLOCK) 잔여: **0건**

## 판정: BLOCK 0 / HIGH 0

리뷰어가 실제로 실행해 검증했다(진술 신뢰 아님): 테스트 스위트 554/554 green 직접 실행, `resolveProjectDir`/`resolveChangeDir` 화이트리스트 추적, 무력화 프로브 주장 확인.

## 페르소나별 발견

### 파괴자 (Saboteur)

| 검증 항목 | 결과 |
|---|---|
| `archive/<name>` id 의 중첩 경로 저장 | 안전 — `mkdirSync(recursive:true)` 가 부모 생성 |
| **bare `archive` id 충돌** | **CONCERNS**(아래 상세) — 현재 발현 불가 |
| `OVERLAY_ROOT` 미설정 폴백이 조용한 실패인가 | **아님** — 폴백은 기존 정의된 동작으로 회귀. 크로스프로젝트 RO 대상은 409 방어가 커버 |
| readOverlay 폴백이 낡은 좌표로 새 좌표를 덮나 | **아님** — OVERLAY_ROOT 우선 조회 후 **없을 때만** 레거시 폴백. 신규 write 를 레거시가 가릴 수 없음 |
| 409 매핑이 진짜 에러까지 오분류하나 | **아님** — EROFS/ENOENT/EACCES 만 매핑, 나머지는 `throw`. 리뷰어가 sandbox(root)에서 RO 테스트 실행 시 OS 가 **EACCES** 를 냈고 코드가 이미 커버함을 실증 |

### 신입 개발자 (New Hire)

- **NIT**: 루트 env 4개(`OVERLAY_ROOT`/`OPENSPEC_ROOT`/`PROJECTS_ROOT`/`DOCS_ROOT`)의 용도·RO/RW 를 한눈에 보는 표가 없어 3개 파일을 오가야 전체 그림이 잡힌다. 각 루트의 개별 주석은 충분하나 집합적 인지 부하가 있다. → 후속 문서화 사안(이 change 의 저작 품질 문제 아님, `WIREFRAME_FEEDBACK_ROOT` 선례와 일관).
- **NIT**: `mkdirSync(join(p, ".."))` 가 `dirname(p)` 보다 덜 관용적. → **수정함**(아래).

### 보안 감사자 (Security Auditor)

경로조작 end-to-end 추적 결과 **새 탈출 벡터 없음**:
- `project` = `^[A-Za-z0-9_-]+$` 화이트리스트 + 심링크 탈출 가드(`projects.ts:38-46`).
- `changeId` = `^[A-Za-z0-9_\-/]+$` + 명시적 `..` 거부(`changes.ts:77`).
- `overlayTargetFromReq` 는 `resolveChangeFromReq` 가 두 값을 검증한 **뒤에만** 호출됨.
- 409 응답 본문 = `{error:"read_only_target"}` 뿐. 내부 경로는 `process.stderr` 로만(테스트가 응답 본문에 경로 부재를 assert — `graphCrossProject.test.ts:150-152`).

## CONCERNS 상세 및 대응 (커밋 `a54afe8`)

**지적**: `changeId` 가 bare `"archive"` 면 `<OVERLAY_ROOT>/<project>/archive.json`(파일)이 생기는데, 같은 프로젝트에 `archive/<name>` id 가 있으면 `archive` 가 디렉토리여야 해 **ENOTDIR** 충돌 → 처리 안 된 500.

**본체 교차검증(실측)**: 
- 전 프로젝트(flowforge/wowa-app/wowa-wt-dashboard/wowa-wt-ios/agentic-harness/ssoksok/stock-league) 순회 — `archive` 자체가 change 인 곳 **0건**.
- 라이브 재현 시도: `PUT /api/changes/archive/layout?project=wowa-wt-dashboard` → **404**(발현 불가 확인).
- `listChanges`(`changes.ts:58-62`)가 `name === "archive"` 를 컨테이너로 취급해 bare id 를 생성하지 않음.

**결론**: 배포 블로커 아님(현재 데이터로 발현 불가). 다만 저비용이라 **fail-closed 방어를 추가**했다 — 409 에러코드 allowlist 에 `ENOTDIR` 추가. 나더라도 500 이 아니라 진단 가능한 409 로 떨어진다. design 0.1 이 "슬래시 패턴은 archive/<name> 뿐"을 가정하면서 bare `archive` 충돌을 안 짚은 건 사실이므로, 가정이 깨질 때의 안전망을 남긴다.

**NIT 대응**: `join(p, "..")` → `dirname(p)`. 동작 동치를 `node -e` 로 실증(`archive/<name>` 중첩·단순 케이스 둘 다 동일).

**대응 후 검증**: 빌드 0 / 타입체크 0 / server **554 PASS**(회귀 0). 재배포 후 라이브 핵심 경로 `PUT layout?project=` **200** 유지 확인.

## 최종 배포 가능 여부

**배포 가능** — 반드시수정 0건. BLOCK/HIGH 없음. CONCERNS 1건은 발현 불가 잠재 이슈였고 안전망을 추가해 닫았다.

미해결 NIT(루트 env 4개 문서화)는 배포 블로커 아니며 후속 문서화 사안으로 남긴다.
