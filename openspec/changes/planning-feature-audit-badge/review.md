# 배포 전 최종 검토 — planning-feature-audit-badge

검토일: 2026-07-04 / 검토 범위: 이 change의 diff에 한정 (앱 전체 아님) — `shared/src/audit-capability-types.ts`, `server/src/lib/auditSummary.ts`(+`__tests__/auditSummary.test.ts`), `server/src/routes/docs.ts`(audit-capabilities 라우트, +`__tests__/docs.planning.test.ts`), `web/src/api.ts`, `web/src/featureTreeAdapter.ts`, `web/src/App.tsx`, `web/src/FeatureNode.tsx`, `web/src/styles.css` (커밋 b044112 · 3b58154 · 8d1a59a)

## review criteria brief

- changeTypes: **[backend, frontend]** — backend: `server/src/lib/·routes/·shared` 소스+테스트, frontend: `web/src/*.tsx·styles.css` + `prototype.html` 존재 + task 3.x UI 태스크
- criteria: 1 in / 2 in / 3 in / 4 **in**(frontend 有) / 5 in / 6 in / 7 **in**(frontend 有) / 8 in / 9 in / 10 in — out 없음
- ruleSets: { resolvedFrom: [`~/.claude/rules/`], selected: [10-coding-style, 20-testing, 30-security, 60-design, 70-adversarial-review], absent: [`<repo>/.claude/rules/`(없음)] }
- designYardsticks:
  - decisions: D-1(결정론 집계·UNVERIFIABLE 불감점), D-2(별도 엔드포인트+web 병합), D-3(신뢰 경계=projDir만·빈 맵 폴백), D-4(claim은 fail일 때만·텍스트 렌더), D-5(배지 어휘 분리), D-6(미감사도 표시·비요구사항 노드 배지 없음)
  - nonGoals: 유저플로우·IA 뷰 확장, 실시간 재계산, 신선도 표시, leaf 단위 매칭 — 이들의 부재를 지적하지 않음
- specsVerifyFocus: verify.json `finalJudgment: FAIL` — 요구사항 3(상세 패널) 시나리오 3건 전부 `검증 안 함`(기능 미구현), edge-case 8클래스 전부 missing, archiveGate closed. 요구사항 1(서버 5건)·2(웹 4건)는 실증 PASS(jest 238건 + gstack 실픽셀·DOM)
- adversarialScope: **full change scope (NOT narrowed by this brief)**

## verify 입력 (openspec-verify 실증 결과)

- `verify.json` (2026-07-04T02:40): **FAIL** — pass 9 / fail 0 / 검증안함 3. archiveGate.open=false, reason="예외 미검증(검증 불충분): 상세 패널에 audit 상세를 노출한다".
- 구현·검증된 부분의 실증 근거는 견고: jest 26 suites/238 tests EXIT=0, 라이브 API 실측(cap-fail/clean/unknown), gstack 실픽셀+DOM 단언(배지 3종·비요구사항 노드 0개·fetch 실패 강등·120노드 대량·race 가드 — evidence/*.png 6장).
- 이 리뷰는 검증을 재실행하지 않고 verify 결과를 판단 입력으로 소비한다.

## 반드시 수정해야 할 항목

1. **[기준 9·spec traceability] 요구사항 3 "상세 패널에 audit 상세를 노출한다" 미구현** — spec 시나리오 3건(클릭 시 audit 섹션 / fail이면 failClaims 나열 / clean·unknown이면 생략) 전부 검증 안 함. 증거: `tasks.md:20`(task 4.1 미체크), verify 실측 `grep -c 'audit' web/src/FeatureDetailPanel.tsx = 0`, `verify.json:4`(finalJudgment FAIL)·`verify.json:12-13`(archiveGate closed), 실픽셀 `evidence/web-detail-panel-fail-node.png`(fail 노드 클릭에도 audit 섹션 부재). 데이터는 이미 노드 data에 실려 있고(`web/src/featureTreeAdapter.ts:43` `FeatureNodeData.audit`) 서버는 `failClaims`를 전송 중이므로 소비부만 남은 상태. **D-4 준수 필수**: claim·reason은 텍스트 렌더만(dangerouslySetInnerHTML 금지).
2. **[기준 9] 검증 게이트 태스크 미완** — `tasks.md:24-25` task 5.1(flowforge 실데이터 audit.json 갱신)·5.2(5단계 게이트 + 상세 패널 포함 UI 검증) 미체크. 4.1 구현 후 openspec-verify 재실행으로 FAIL을 해소해야 archive 가능. 증거: `tasks.md:24`, `tasks.md:25`.

## 수정하면 좋은 항목

1. **[기준 5] `AUDIT_BADGE[audit.status]` 런타임 폴백 부재** — `web/src/FeatureNode.tsx:68` 서버가 3값 외 status를 보내면(배포 스큐: 구 번들+신 서버 등) `AUDIT_BADGE[audit.status].cls`가 TypeError → 노드 렌더 크래시(에러 바운더리 없음 → 그래프 전체 백지). TS 계약상 정상 경로에선 불가능해 확실성 낮음(그래서 이 티어). `AUDIT_BADGE[audit.status] ?? AUDIT_BADGE.unknown` 한 줄로 방어 가능.
2. **[기준 4·D-6 일관성] capability 빈 문자열 요구사항 노드는 배지가 아예 안 뜸** — `web/src/featureTreeAdapter.ts:132` `n.capability !== ""` 조건으로, features.md에서 capability 주석이 빠진 요구사항은 audit 맵이 있어도 배지 없음. D-6의 "숨기지 않는다" 원칙과 미세하게 어긋남(미감사 표시가 더 정직). 다만 "키가 없으면 매칭 축 자체가 없다"는 해석도 가능 — 빌더가 요구사항에 capability를 보장하는지 불확실해 이 티어에 둔다.
3. **[기준 10] fail 빨강 하드코딩 중복** — `web/src/styles.css:311` `#f06a6a` vs 기존 상태칩 `중단` `#f2675a`(FeatureNode.tsx STATUS_COLOR) — 근접한 빨강 2종이 각각 리터럴로 존재. `--red` 토큰 승격 시 드리프트 방지. DESIGN.md 부재라 현재는 관례 수준.
4. **[기준 3] 기능명세 뷰 로드 시 dagre 레이아웃 2회 계산** — `web/src/App.tsx` planningFeatures 도착 시 audit 없이 1회, featureAudit 도착 시 재계산 1회(effect 의존성 `[planningFeatures, featureAudit]`). 120노드 실측에서 문제없음이 확인됐으나(evidence/web-large-120-reqs.png), audit 도착 시 노드 배열 교체로 사용자가 그 사이 드래그한 위치가 초기화되는 짧은 창이 있다. 배지만 patch하는 병합(기존 노드 유지 + data만 갱신)으로 개선 가능 — 현재 규모에선 낮은 우선순위.

## 현재 상태로 유지해도 되는 항목

- **`readFileSync` 동기 읽기** (`server/src/lib/auditSummary.ts:51`) — 요청당 소형 JSON 1회, 기존 `readAuditStatus` 패턴과 동일. verify가 동시성 na 사유로 실증한 대로 무상태·읽기전용.
- **failClaims가 현재 웹에서 미소비** — task 4.1의 소비자가 곧 붙는 스펙 주도 선행 구현. 삭제가 아니라 완성이 답.
- **빈 맵 폴백(throw 금지)의 조용한 강등** — design R-3에서 인지된 트레이드오프이고, 스키마 가정이 단위 테스트 11건으로 박제돼 드리프트 시 테스트가 먼저 깨진다.
- **D-2 별도 엔드포인트 + web 병합** — 기존 planning-features API 계약 무저촉(additive), path·childRefs 파생 선례와 동일 패턴. 골든 회귀 0 실증.

## 리팩토링 추천 항목

- 배지/칩 pill 스타일(`feature-tree-attr`·`feature-tree-audit` 등)의 색상 리터럴을 CSS 변수로 토큰화 — DESIGN.md가 없으므로 `/design-consultation`으로 디자인 시스템을 정의하면서 함께 정리하는 게 순서.
- `featureTreeAdapter`의 audit 3상태(맵 undefined / 빈 맵 / 키 없음→UNAUDITED) 의미가 App(null)→adapter(hasAudit)→FeatureNode(audit &&)에 걸쳐 분산 — 지금은 주석으로 커버되나, 상세 패널(4.1)이 같은 규칙을 또 소비하게 되면 판별 헬퍼 하나로 모을 것.

## 적대적 검토 (4 페르소나)

- **파괴자**: ① `FeatureNode.tsx:68` AUDIT_BADGE 인덱싱에 폴백 없음 — 예상 밖 status 1건이 그래프 전체 렌더를 죽인다(위 "수정하면 좋은 1", 확률 낮음). ② audit fetch 레이스는 dashReqToken으로 방어됨을 evidence/web-race-stale-guard.png가 실증 — 추가 발견 없음. ③ failClaims 배열 무제한 수집(`auditSummary.ts:33`) — 초대형 audit.json이면 응답 비대. 로컬 도구 + 자기 산출물이라 실위험 낮음.
- **신입 개발자**: audit 배지의 "없음 vs 미감사" 구분이 3파일에 걸친 암묵 규약(App의 null, adapter의 hasAudit+빈문자 capability, FeatureNode의 `audit &&`) — 각 지점에 주석은 있으나 전체 그림은 design.md D-6까지 읽어야 완성된다. 판별 로직 집약 권장(리팩토링 항목과 병합).
- **보안 감사자**: ① 경로 조작은 기존 resolveDocsDir 재사용 + `..%2f` 404 통합테스트로 방어 실증, audit.json 내부 경로(scanRoot) 불신도 테스트 박제(D-3) — 신규 공격면은 읽기전용 파일 1개로 최소. ② 발견: 향후 4.1에서 claim·reason(audit.json 유래 자유 텍스트)이 패널에 렌더될 때가 실제 XSS 경계 — D-4의 "텍스트 렌더만"이 스펙에 있으나 아직 코드·테스트로 강제되지 않음(미구현). 4.1 구현 시 dangerouslySetInnerHTML 부재를 리뷰 필수 체크로. ③ rate limiting 부재는 기존 전 라우트와 동일한 로컬 도구 수준 — 신규 이슈 아님.
- **게으른 시니어**: 과잉구현은 사실상 없음 — 새 의존성 0, 기존 가드(resolveDocsDir)·기존 파생 패턴(path/childRefs)·기존 pill 스타일 재사용, diff도 스펙 THEN에 1:1 대응. 굳이 꼽으면 ① `CapabilityAuditFailClaim`을 별도 인터페이스로 분리한 것(인라인으로 충분)과 ② UNAUDITED 상수+hasAudit 게이트의 3상태 구분이 "빈 맵도 미감사 도배" 단순안 대비 코드가 조금 더 큰데, 이는 D-6가 명시적으로 요구한 동작이라 제거 대상 아님. "안 짜도 될 코드" 실질 0건 — 근거: 3커밋 합계 +441/-12줄 중 테스트가 236줄.
- 2+ 페르소나 중복 발견(심각도 상승): **없음** — 신입·리팩토링 항목의 "3상태 분산"은 같은 주제지만 결함이 아닌 가독성 지적이라 상승 미적용.

## 디자인 리뷰 (frontend 변경 있음 → 정적 검토)

- 라이브 재실행 대신 verify의 gstack 실픽셀 증거로 **정적 검토** 수행: 배지 3종이 기존 priority/status pill과 동일한 pill 문법(999px 라운드·10px·보더)으로 위계 일관, 미감사는 저채도 무채색으로 경고 오독 방지(D-5 준수 확인 — evidence/web-badges-features-view.png). 모바일/반응형은 이 뷰 전체가 데스크톱 그래프 캔버스(ReactFlow 줌/팬)라 배지 추가로 인한 신규 반응형 리스크 없음(기준 7 해당 없음에 준함).
- **디자인 시스템 미정의** — 레포에 DESIGN.md 없음. 색상 리터럴 드리프트(위 fail 빨강 2종)가 그 증상. `/design-consultation` 권장.

## 최종 배포 가능 여부

**배포 불가** — verify `finalJudgment: FAIL`. spec 3개 요구사항 중 1개(상세 패널 audit 상세)가 통째로 미구현이라 이 change는 자기 스펙을 충족하지 못한 상태다. 구현·검증된 2/3(서버 집계·라우트, 노드 배지)은 실증 근거가 견고하고 코드 품질도 양호하므로, **task 4.1 구현 + 5.1·5.2 재검증(verify PASS) 후 재리뷰**하면 통과 전망이 높다.

## 개선 우선순위 (제안)

1. task 4.1 상세 패널 audit 섹션 구현 (반드시-1) — 배포 불가의 유일한 원인, 데이터는 이미 노드에 실려 있어 소비부만 작성. D-4(텍스트 렌더) 준수를 테스트로 박제.
2. task 5.1·5.2 + openspec-verify 재실행 (반드시-2) — archive 게이트 해소의 공식 경로.
3. AUDIT_BADGE 폴백 1줄 (좋은-1) — 비용 대비 방어 효과 최대(그래프 전체 백지 방지).
4. capability 빈 문자열 요구사항의 미감사 표시 (좋은-2) — D-6 정직 원칙 정합, 빌더 보장 확인 후 결정.
5. 빨강 토큰화·3상태 헬퍼 집약 (좋은-3·4 + 리팩토링) — 4.1이 같은 규칙을 소비하기 직전인 지금이 적기.
