## Why

`project-card-grid` capability의 명세는 "각 카드가 [charter 유무 · change 개수 · **audit 상태**]를 표시한다"고 이미 요구하고, 프론트(`web/src/ProjectGrid.tsx`)는 `unknown→"audit 미확인"`/`clean→"정상"`/`warn→"경고"`/`fail→"실패"` 배지를 렌더할 준비가 끝나 있다. 그런데 백엔드가 그 값을 **하드코딩 상수**로만 채운다:

```ts
// server/src/lib/projects.ts:89
const auditStatus: AuditStatus = "unknown"; // 예광탄: 정적. 실시간 산출은 후속.
```

즉 audit.json이 실제로 존재하는 프로젝트(`flowforge` = `"조건부"`, `wowa-app` = `"FAIL"`)조차 항상 `"audit 미확인"` 배지로 표시된다. 명세는 audit 상태 표시를 요구하는데 코드는 진짜 상태를 무시하는 **spec↔코드 갭**이다(원래 예광탄 단계에서 "실시간 산출은 후속"으로 의도적으로 미룬 자백 주석이 line 9·89에 남아 있다).

audit.json은 이미 결정론적으로 산출·저장돼 있으므로(`openspec-audit` 산출물, `<project>/docs/audit.json`의 `finalJudgment` 필드), 실시간 재계산 없이 **저장본을 읽어 매핑**하기만 하면 배지가 진짜 상태를 반영한다. 별도 엔진·신규 의존성 없이 spec↔코드 갭을 닫는 가장 작은 change다.

**Why now**: 계층 대시보드(`hierarchical-project-dashboard`)와 charter 입력 엔진(`ingest-charter-living-docs`)이 archive돼 카드 그리드가 실제로 서빙되는 지금, audit 배지만 항상 회색("미확인")이라 한눈 조망의 신호 가치가 반쪽이다. audit.json은 이미 있으니 읽기만 배선하면 된다.

## What Changes

`server/src/lib/projects.ts`의 하드코딩 `auditStatus`를 제거하고, 각 프로젝트의 `<projDir>/docs/audit.json`을 읽어 `finalJudgment` 어휘를 `AuditStatus`로 매핑해 카드에 채운다.

- **audit.json 리더 추가**: 카드 스캔 중 이미 계산한 `projDir` 기준으로 `<projDir>/docs/audit.json`을 `readFileSync` + `JSON.parse`. 파일 없음·파싱 오류·필드 없음은 모두 `unknown`으로 폴백(throw 금지).
- **어휘 매핑 추가**: audit.json의 `finalJudgment`(`PASS | FAIL | 조건부 | UNVERIFIABLE`) → `AuditStatus`(`clean | warn | fail | unknown`). 매핑: `PASS→clean`, `FAIL→fail`, `조건부→warn`, `UNVERIFIABLE`/없음/미인식/파싱오류 → `unknown`.
- **하드코딩 제거**: `projects.ts:89`의 `const auditStatus: AuditStatus = "unknown"`을 리더 호출로 교체하고, line 9·89의 "예광탄 정적, 실시간 산출은 후속" 자백 주석을 갱신한다.
- **경로 신뢰 경계**: audit.json 안에 호스트 절대경로(`scanRoot`)가 박혀 있어도 신뢰하지 않는다. 이미 계산된 `projDir`로 경로를 구성하고 `finalJudgment` 필드만 소비한다.

## Capabilities

### Modified Capabilities
- `project-card-grid`: 카드의 audit 상태 배지를 **하드코딩 `unknown`이 아니라 실제 `audit.json`의 `finalJudgment`에서 채운다**. "audit 상태가 채워진다"는 동작을 명세에 ADDED Requirement로 추가(어휘 매핑·폴백 명시). 기존 카드 그리드·charter·change-count·한글 표시명 동작은 무손상.

### New Capabilities
<!-- 없음. project-card-grid에 audit 채움 요구를 추가하는 것으로 충분. -->

## Impact

- **수정 백엔드**: `server/src/lib/projects.ts` — audit.json 리더 함수 + `finalJudgment→AuditStatus` 매핑 함수 추가, `listProjectCards`의 하드코딩 `auditStatus` 교체(이미 보유한 `projDir` 사용). 함수 시그니처·반환 타입(`ProjectCard[]`) 불변(`auditStatus` 필드는 이미 존재).
- **수정 테스트**: `server/src/lib/__tests__/projects.test.ts`(매핑 5케이스 픽스처), `server/src/routes/__tests__/projects.test.ts`(`GET /api/projects`가 audit.json 가진 픽스처에 매핑값 반환 단언).
- **무손상(하위호환)**: `@flowforge/shared`의 `AuditStatus`/`ProjectCard` 타입 변경 0(이미 `'unknown' | 'clean' | 'warn' | 'fail'`). `web/src/ProjectGrid.tsx`·`AUDIT_LABEL` 변경 0(배지 렌더 이미 완비). `capabilityIndex.ts`·`koreanLabels.ts`·`routes/projects.ts` 합성 로직 변경 0(스캔이 더 정확한 값을 채울 뿐). 기존 `/api/changes/*`·`/api/docs/*`·`graph.ts` 변경 0.
- **소유 경계**: `audit.json` 산출은 agentic-harness `openspec-audit` 소유 → flowforge는 `finalJudgment` 필드를 **읽기전용**으로 소비만(산출·스키마 변경 0).
- **의존성**: 신규 npm 패키지 없음(기존 `node:fs`만).
- **데이터 신선도**: 매 요청 스캔 시 audit.json을 읽는다(예광탄 캐시 없음과 동일 정책). audit 재산출 시점은 flowforge 범위 밖(저장본을 그대로 반영).
