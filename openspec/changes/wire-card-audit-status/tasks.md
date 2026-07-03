## Tasks

### Sequential: audit 리더 + 매핑 (단위 RED → GREEN, 같은 파일)

- [x] 1.1 RED: `server/src/lib/__tests__/projects.test.ts`에 매핑·폴백 단위 테스트 추가 — 임시 픽스처 `<root>/<project>/docs/audit.json`을 만들어: (a) `"조건부"`→`warn` (b) `"FAIL"`→`fail` (c) `"PASS"`→`clean` (d) audit.json 없음→`unknown` (e) 깨진 JSON→`unknown` (f) `"UNVERIFIABLE"`/필드없음→`unknown`. 기존 `makeChange`/`makeCharter` 헬퍼 옆에 `makeAudit(root, project, finalJudgment)` 추가. (기존 `(c) auditStatus 허용값` 테스트는 비파괴 — `unknown` 폴백 케이스로 그대로 통과)
- [x] 1.2 GREEN: `server/src/lib/projects.ts`에 매핑 순수 함수 추가 — `mapFinalJudgment(j: unknown): AuditStatus`: `"PASS"→clean` / `"FAIL"→fail` / `"조건부"→warn` / 그 외(`"UNVERIFIABLE"`·미인식·비문자열) → `unknown`. `countChanges`(line~30)·`hasCharter`(line~24) 형제 헬퍼로 배치.
- [x] 1.3 GREEN: `server/src/lib/projects.ts`에 audit 리더 함수 추가 — `readAuditStatus(projectDir: string): AuditStatus`: `join(projectDir, "docs", "audit.json")`을 `existsSync` 가드 후 `readFileSync(…, "utf-8")` + `JSON.parse`, `parsed.finalJudgment`만 꺼내 `mapFinalJudgment`에 전달. 파일없음·읽기실패·`JSON.parse` 예외는 `try/catch`로 모두 `unknown` 반환(throw 금지). audit.json 안의 `scanRoot` 등 다른 필드는 읽지 않는다(경로 신뢰 경계).

### Sequential: 하드코딩 제거 (리더 배선)

- [x] 2.1 GREEN: `server/src/lib/projects.ts:89` 하드코딩 교체 — `const auditStatus: AuditStatus = "unknown";`를 `const auditStatus: AuditStatus = readAuditStatus(projDir);`로 교체(`projDir`는 line~72에서 이미 계산됨, 재구성 금지). `out.push({ … auditStatus })` 그대로.
- [x] 2.2 GREEN: `server/src/lib/projects.ts` 주석 갱신 — 헤더 docblock line 9(`auditStatus = 정적(예광탄은 'unknown'; …)`)와 line 89 인라인 주석(`// 예광탄: 정적. 실시간 산출은 후속.`)을 실제 동작(`audit.json finalJudgment 매핑, 저장본 반영, 없으면 unknown 폴백`)에 맞게 수정.

### Sequential: 라우트 통합 테스트 (Group 1 GREEN 의존)

- [ ] 3.1 RED: `server/src/routes/__tests__/projects.test.ts`의 `GET /api/projects` describe(line~62 픽스처 근처)에 단언 추가 — `makeChange`로 만든 픽스처 프로젝트에 `docs/audit.json`(`"finalJudgment": "조건부"`)을 심어, `GET /api/projects` 응답의 해당 카드 `auditStatus === "warn"`을 단언. audit.json 없는 픽스처 카드는 `auditStatus === "unknown"`도 함께 단언(폴백 회귀 방지). 픽스처 헬퍼에 `makeAudit(project, finalJudgment)` 추가.

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [ ] 4.1 VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트(위 단위·통합 픽스처 포함) → UI(프론트 코드 변경 없음 — `ProjectGrid.tsx`/`AUDIT_LABEL` 무손상이라 신규 UI 시나리오 0; 단 실데이터로 `PROJECTS_ROOT=/home/gaegul` 서버 기동 시 `flowforge` 카드가 "경고", `wowa-app` 카드가 "실패", audit.json 없는 프로젝트가 "audit 미확인"으로 렌더되는지 브라우저/응답으로 grounding) 전부 PASS

<!--
선택(이 change 범위에 포함하지 않음 — spec delta가 이미 audit 채움 시나리오를 명시):
- charter docs/spec.md 본문에 audit 시각화 추가는 별도 change. 본 change는 카드 배지 한 곳만 배선.
-->
