## Context

`hierarchical-project-dashboard` change가 카드 그리드(`project-card-grid` capability)를 도입할 때, audit 상태 배지는 **예광탄 단계라 의도적으로 정적(`unknown`)으로 미뤘다**(design.md Non-Goals: "audit 상태 실시간 산출(이번엔 정적/저장본 수준)", Open Questions: "audit 상태 배지: 실시간 vs 저장본 — 이번엔 정적 표기로 진행, 실시간화는 후속"). 그 결과 `server/src/lib/projects.ts:89`에 `const auditStatus: AuditStatus = "unknown"`가 하드코딩으로 남았다.

본 change는 그 후속을 **실시간 재산출이 아니라 저장본(`audit.json`) 읽기**로 닫는다. audit.json은 agentic-harness `openspec-audit`가 결정론적으로 산출해 `<project>/docs/audit.json`에 저장하므로, flowforge는 그 `finalJudgment`만 읽어 배지로 매핑하면 된다. 신규 산출 엔진·신규 의존성 0.

**단일 진실(이 design이 따르는 출처):**
- `server/src/lib/projects.ts` — 하드코딩 위치(line 89)와 이미 계산된 `projDir`(line 72)
- `shared/src/dashboard-types.ts:14` — `AuditStatus = 'unknown' | 'clean' | 'warn' | 'fail'`(멤버는 `clean`, `pass` 아님)
- `web/src/ProjectGrid.tsx`(`AUDIT_LABEL`) — 배지 렌더는 이미 완비(변경 0)
- `<project>/docs/audit.json` — `finalJudgment` 어휘 `PASS | FAIL | 조건부 | UNVERIFIABLE`(실측: flowforge=`조건부`, wowa-app=`FAIL`)

**제약 (반드시 준수):**
- 코드·타입·프론트 무손상(additive): `AuditStatus`/`ProjectCard` 타입 변경 0, `ProjectGrid.tsx` 변경 0, 기존 라우트·합성 로직 변경 0.
- audit.json 산출 스키마는 agentic-harness 소유 → flowforge는 `finalJudgment` **읽기전용** 소비만.
- 경로 신뢰 경계: audit.json 안의 호스트 절대경로(`scanRoot`)를 신뢰하지 않고, 스캔이 이미 계산한 `projDir`로만 경로 구성.

## Goals / Non-Goals

**Goals:**
- 카드 audit 배지가 저장된 `audit.json`의 `finalJudgment`를 반영(spec↔코드 갭 해소).
- audit.json 없는/깨진/미인식 프로젝트는 정당한 `unknown` 폴백(throw 0).
- 어휘 매핑(`PASS|FAIL|조건부|UNVERIFIABLE` → `clean|fail|warn|unknown`)을 한 함수에 격리.

**Non-Goals:**
- audit **실시간 재산출**(openspec-audit를 flowforge가 호출하지 않는다 — 저장본만 읽음).
- audit 항목(`items[]`)·counts·reason의 **상세 시각화**(이번엔 finalJudgment 한 필드만 배지로).
- audit.json 신선도 검사·갱신 트리거·캐시(매 요청 스캔 시 읽기, 예광탄 정책 그대로).
- `AuditStatus`에 새 멤버 추가(`조건부` 전용 색 등) — 기존 4멤버에 매핑.

## Decisions

### D-1. audit 리더 = 스캔이 이미 가진 `projDir` 기준 `<projDir>/docs/audit.json` 읽기

`listProjectCards`는 카드마다 `projDir = join(root, name)`를 이미 계산한다(line 72). 그 `projDir`에 `readAuditStatus(projDir)`를 한 번 호출해 `docs/audit.json`을 읽는다. **경로를 audit.json 내부 `scanRoot`로 재구성하지 않는다**(호스트 절대경로 신뢰 금지 — 컨테이너 바인드마운트 `/data/docs-root/<project>` 와 호스트 `/home/gaegul/<project>` 가 다르므로 박힌 경로는 깨진다).

- **대안 기각**: audit.json의 `spec`/`scanRoot` 경로로 역추적 → 컨테이너/호스트 경로 불일치로 깨짐 + 절대경로 신뢰는 path-traversal 표면. `projDir` 기준이 유일하게 안전.

### D-2. 어휘 매핑 = 순수 함수 `mapFinalJudgment(j) → AuditStatus`

| audit.json `finalJudgment` | `AuditStatus` | 배지(`AUDIT_LABEL`) |
|---|---|---|
| `PASS` | `clean` | 정상 |
| `FAIL` | `fail` | 실패 |
| `조건부` | `warn` | 경고 |
| `UNVERIFIABLE` | `unknown` | audit 미확인 |
| (필드 없음 / 비문자열 / 미인식 값) | `unknown` | audit 미확인 |

- `조건부`(한글)는 audit.json에 한글로 저장된 어휘이므로 매핑 키도 한글 문자열 리터럴(`"조건부"`)로 비교. (spec 본문 SHALL은 영문이지만, 매핑 대상 **데이터 값**은 audit.json이 실제로 쓰는 한글 어휘 그대로.)
- `clean`이지 `pass` 아님(타입 멤버 주의), `warn`이지 `warning` 아님.

### D-3. 폴백 = 모든 실패 경로가 `unknown`(throw 0)

파일 없음(`existsSync` false) · 읽기 실패(`readFileSync` 예외) · `JSON.parse` 예외 · `finalJudgment` 미인식 → 전부 `unknown` 반환. 카드 스캔은 한 프로젝트의 audit 읽기 실패로 전체가 깨지면 안 된다(기존 `countChanges`의 try/catch 무시 패턴과 동일 철학).

## Risks / Trade-offs

- **[저장본 신선도 — audit.json이 오래돼 실제 코드 상태와 어긋날 수 있음]** → 본 change는 "저장본 반영"이 계약이다(실시간 재산출은 Non-Goal). audit 재산출은 agentic-harness `openspec-audit` 책임. 배지는 "마지막 audit 결과"를 뜻한다.
- **[`finalJudgment` 어휘가 미래에 바뀌면 매핑 누락 → 조용히 unknown]** → 미인식은 `unknown`(틀린 색보다 안전한 폴백)이고 거짓 green을 만들지 않는다. 새 어휘 추가 시 매핑 테이블에 한 줄 추가로 확장.
- **[매 요청 파일 읽기 I/O]** → 프로젝트당 작은 JSON 1개, 예광탄은 캐시 없이도 충분. 성능 이슈 시 캐시는 후속(스캔 전체와 같은 정책).
- **[audit.json의 다른 필드(items/counts)를 안 쓴다 — 정보 손실]** → 의도된 범위(배지 한 칸 = finalJudgment 한 필드). 상세 시각화는 별도 change(design Non-Goals).

## Migration Plan

- **배포**: additive. 타입·프론트·기존 라우트 무변경, `projects.ts` 한 파일의 상수→리더 교체. 기존 카드 그리드 흐름 그대로.
- **롤백**: `readAuditStatus(projDir)` 호출을 다시 `"unknown"` 상수로 되돌리면 즉시 원복(데이터 마이그레이션 없음).
- **grounding**: `PROJECTS_ROOT=/home/gaegul`로 서버 기동 후 `GET /api/projects`(또는 카드 그리드 UI)에서 `flowforge`=경고/`wowa-app`=실패/audit.json 없는 프로젝트=audit 미확인 확인.
