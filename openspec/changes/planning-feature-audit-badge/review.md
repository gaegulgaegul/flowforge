# 배포 전 최종 검토 — planning-feature-audit-badge

## 재검토: 2026-07-04 (2차 — task 4.1 구현 후)

검토일: 2026-07-04 / 검토 범위: 직전 리뷰(배포 불가) 이후 신규 커밋 diff에 한정 — `web/src/FeatureDetailPanel.tsx`(+43줄 audit 섹션)·`web/src/styles.css`(+38줄) (커밋 4dd09f7), `docs/audit.json` 실데이터 갱신 (커밋 3d87b0d, 코드 아님) + 직전 리뷰 지적사항 해소 여부 추적. 1차 리뷰 범위(서버 lib·라우트·노드 배지)는 재리뷰하지 않고 결과를 승계한다.

### review criteria brief (2차)

- changeTypes: **[frontend, doc]** — frontend: `FeatureDetailPanel.tsx`·`styles.css` (4dd09f7), doc: `docs/audit.json` 갱신 (3d87b0d — openspec-audit 산출물, 실행 소스 아님)
- criteria: 1 in / 2 in / 3 in(claim 목록 대량 경로) / 4 in / 5 in / 6 in(XSS 경계) / 7 in / 8 in / 9 in / 10 in — out 없음
- ruleSets: { resolvedFrom: [`~/.claude/rules/`], selected: [10-coding-style, 20-testing, 30-security, 60-design, 70-adversarial-review], absent: [`<repo>/.claude/rules/`(없음)] }
- designYardsticks: decisions D-4(claim은 fail일 때만·텍스트 렌더·dangerouslySetInnerHTML 금지)·D-5(배지 어휘)·D-6(미감사도 표시·비요구사항 생략)이 이번 diff의 직접 yardstick. nonGoals(신선도 표시·실시간 재계산 등)의 부재는 지적하지 않음
- specsVerifyFocus: verify.json(2026-07-04T12:04) **finalJudgment: PASS** — 12/12 시나리오, 검증안함 0, archiveGate.open=true. 요구사항 3 시나리오 3건(직전 verify에서 검증 안 함)이 금회 전부 실증 PASS — XSS 페이로드(`<img onerror>`) 텍스트 렌더 직접 실증(window.__xss 미발동) 포함
- adversarialScope: **full change scope (NOT narrowed by this brief)**

### verify 입력 (openspec-verify 실증 결과)

- `verify.json` (2026-07-04T12:04): **PASS** — pass 12 / fail 0 / 검증안함 0 / skipped 0. archiveGate.open=true.
- 상세 패널 3시나리오 실증: 클릭→audit 섹션(판정+건수), fail→FAIL claim 2건 나열 + XSS 페이로드 리터럴 텍스트 렌더 실증, clean/unknown→claim 목록 생략 + 비요구사항 노드 섹션 자체 없음 (evidence/web-detail-panel-fail-node.png, web-detail-panel-clean-node.png).
- 이 리뷰는 검증을 재실행하지 않고 verify 결과를 판단 입력으로 소비한다.

### 직전 리뷰 "반드시 수정" 항목 추적

1. ~~요구사항 3 상세 패널 미구현~~ → **해결됨** — `web/src/FeatureDetailPanel.tsx:142-174` audit 섹션 구현(커밋 4dd09f7). D-4 준수 확인: claim·reason 모두 JSX 텍스트 렌더(`{f.claim}`), dangerouslySetInnerHTML 사용처 0, verify가 XSS 페이로드로 직접 실증. D-6 준수: `node.kind === "requirement"` 게이트로 비요구사항 섹션 생략.
2. ~~task 5.1·5.2 미완~~ → **해결됨** — 5.1: `docs/audit.json` 2→13 capability 갱신(커밋 3d87b0d). 5.2: verify 재실행 PASS 12/12, jest 238/238, 라이브 실픽셀(tasks.md 전 항목 체크).

### 직전 리뷰 "수정하면 좋은" 항목 추적

1. AUDIT_BADGE 런타임 폴백 부재 → **미해결 + 확산** — `web/src/FeatureNode.tsx:68` 그대로이고, 같은 무폴백 인덱싱 패턴이 `web/src/FeatureDetailPanel.tsx:149-153`(`AUDIT_META[node.audit.status]`)에 복제됨. 아래 2차 발견 1로 승계.
2. capability 빈 문자열 요구사항 배지 없음 → **미해결** — `web/src/featureTreeAdapter.ts:132` 변경 없음. 이월.
3. fail 빨강 하드코딩 중복 → **미해결 + 심화** — 아래 2차 발견 2로 승계(노드 vs 패널 색 불일치로 발전).
4. dagre 레이아웃 2회 계산 → **미해결(저우선 유지)** — 변경 없음, 120노드 실증 문제없음이라 이월.

### 반드시 수정해야 할 항목

- 없음

### 수정하면 좋은 항목

1. **[기준 5·8 / 파괴자+신입 중복 → 티어 내 최상위] audit status 무폴백 인덱싱이 2개 파일로 확산** — `web/src/FeatureNode.tsx:68`·`web/src/FeatureDetailPanel.tsx:149-153` 둘 다 `RECORD[audit.status]`를 폴백 없이 인덱싱. 3값 외 status 유입 시(배포 스큐: 구 번들+신 서버) 노드는 그래프 전체, 패널은 상세 뷰가 크래시. TS strict 계약상 정상 경로에선 재현 불가라 critical 아님(증거 규칙상 이 티어 유지). 페르소나 2개 중복 발견이라 티어 내 1순위로 상승. 수정: 상수·폴백을 한 곳(shared 또는 web util)으로 집약하면 아래 3과 함께 해소.
2. **[기준 4 / 디자인] '불합' 빨강이 노드와 패널에서 다름** — 노드 배지 `#f06a6a`(`web/src/styles.css:311`) vs 패널 배지 `#f2675a`(`web/src/FeatureDetailPanel.tsx:43`). 같은 fail 상태를 두 화면 요소가 다른 빨강으로 표시 — 같은 노드를 클릭하면 배지 색이 미묘하게 바뀌어 보인다. `AUDIT_META` 주석("어휘 정렬")대로 라벨은 정렬됐으나 색은 아님. FAIL claim 카드 보더(`styles.css:765` `#f06a6a`)까지 합치면 빨강 리터럴 3곳.
3. **[기준 10·2 / 게으른 시니어] AUDIT_BADGE·AUDIT_META 중복 상수** — 1차 리뷰 리팩토링 권고("상세 패널이 같은 규칙을 소비하게 되면 판별 헬퍼로 집약")가 예측한 그대로, 같은 3상태 어휘·색 매핑이 `FeatureNode.tsx:38`과 `FeatureDetailPanel.tsx:41`에 각각 리터럴로 존재. 위 1·2의 근본 원인이므로 셋을 한 번에: 상태→{label, color} 매핑 1곳 + 폴백 1곳.
4. **[기준 10 / 20-testing] D-4 텍스트 렌더의 회귀 테스트 미박제** — 1차 리뷰 개선 우선순위 1이 "D-4 준수를 테스트로 박제"였으나 패널 audit 섹션은 jest/컴포넌트 테스트 없이 gstack 1회 실증만 존재. XSS 실증(verify)은 견고하나 1회성 — 이후 리팩토링에서 dangerouslySetInnerHTML이 들어와도 잡는 자동 게이트가 없다. 부분 반영(실증 O / 박제 X)으로 판정.

### 현재 상태로 유지해도 되는 항목

- **UNAUDITED(0·0·0) 노드의 "감사 데이터 없음" 분기** (`FeatureDetailPanel.tsx:155-161`) — 건수 합 0은 어댑터 UNAUDITED 센티널에서만 발생(집계는 items 있는 키만 생성). D-6 요구 동작이고 verify cap-missing 프로브로 실증.
- **fetch 실패 시 audit 섹션 자체 생략** — 배지 없음 강등(task 3.1 정책)과 일관. verify가 fetch reject 시뮬레이션으로 패널 정상 실증.
- **failClaims 무제한 나열** — 패널 body가 `overflow-y: auto`(`styles.css:625`)라 스크롤로 수용, `word-break: break-all`로 긴 claim 개행. 로컬 도구+자기 산출물 수준에서 충분.
- **docs/audit.json 갱신(3d87b0d)** — 코드가 아닌 감사 산출물 재생성. finalJudgment 조건부(PASS 63/FAIL 0/UNVERIFIABLE 76)는 openspec-audit 파이프라인 판정 그대로.

### 리팩토링 추천 항목

- 위 "수정하면 좋은 1·2·3" 통합 리팩토링: audit 3상태 → {label, color(토큰)} 매핑을 단일 모듈로 승격 + `?? unknown` 폴백 + 빨강 CSS 변수화. 1차 리뷰의 "3상태 헬퍼 집약"과 동일 항목의 구체화.

### 적대적 검토 (4 페르소나 — 2차 diff 대상)

- **파괴자**: ① `AUDIT_META[node.audit.status]` 무폴백(위 1) — 패널 크래시 벡터, 확률 낮음. ② `key={f.claim+'#'+i}` — index 포함이라 중복 claim에도 key 충돌 없음, 목록이 정적(재정렬 없음)이라 안전. ③ Esc 핸들러·오버레이 닫기 기존 로직 무저촉(additive 섹션) — 추가 발견 없음.
- **신입 개발자**: AUDIT_BADGE(FeatureNode)와 AUDIT_META(패널)가 이름도 다르고 fail 색도 달라(위 2·3), 6개월 뒤 "어느 쪽이 진실?"이 됨. 주석("어휘 정렬")이 색 불일치를 가리는 부작용도 있다.
- **보안 감사자**: D-4 경계 실코드 확인 — claim·reason은 `{f.claim}`/`{f.reason}` JSX 텍스트 노드로만 렌더, dangerouslySetInnerHTML 사용처 0(파일 전체 grep), verify가 `<img onerror>` 페이로드로 인젝션 무발동 실증. 1차 리뷰가 "4.1 구현 시 필수 체크"로 예고한 항목이 이행됨. 발견: 실증이 1회성이라 회귀 게이트 부재(위 4) — 공격 성립이 아니라 방어 지속성 이슈.
- **게으른 시니어**: 43줄 additive, 기존 `feature-detail-badge`·`feature-detail-field` 클래스 재사용, 신규 의존성 0 — 부풀림 없음. 유일한 지적: AUDIT_META를 새로 짠 것 자체가 중복(FeatureNode 것을 export해 쓰거나 shared로 — 위 3). "안 짜도 될 코드" = 상수 7줄이 실질 전부.
- 2+ 페르소나 중복 발견(심각도 상승): **있음** — 무폴백 인덱싱+상수 중복(파괴자①·신입·게으른 시니어)이 같은 뿌리. 티어 내 1순위로 상승 반영(critical 승격은 증거 규칙상 보류 — 정상 경로 재현 불가).

### 디자인 리뷰 (frontend 변경 있음 → 정적 검토)

- verify의 gstack 실픽셀로 정적 검토: audit 섹션이 기존 패널 필드 문법(라벨 소제목+본문)과 위계 일관, FAIL claim 카드는 좌측 3px 빨강 보더로 심각도 시각화 — capability `<code>` 블록과 모노스페이스 정렬(evidence/web-detail-panel-fail-node.png). clean 노드는 판정·건수만으로 소음 없음(web-detail-panel-clean-node.png, D-4).
- 발견: 노드 배지와 패널 배지의 불합 빨강 불일치(위 "수정하면 좋은 2") — 같은 상태의 색 이원화는 60-design의 일관성 원칙 위반(경미).
- 모바일(≤820px): 패널이 하단 시트로 전환되고 body `overflow-y: auto`라 claim 목록 길이는 스크롤 수용 — 신규 반응형 리스크 없음(정적 판단, 실기기 미확인).
- 디자인 시스템 미정의(DESIGN.md 없음) — 1차 지적 유지, `/design-consultation` 권장.

### 최종 배포 가능 여부

**배포 가능** — verify finalJudgment PASS(12/12, 검증안함 0), archiveGate open. 1차 리뷰의 배포 불가 사유(요구사항 3 미구현·게이트 태스크 미완)는 모두 해결됨을 코드·verify 양쪽에서 확인. 남은 발견 4건은 전부 non-blocking(크래시 벡터는 정상 경로 재현 불가, 나머지는 일관성·기술부채). openspec-archive 진행 가능.

### 개선 우선순위 (제안)

1. audit 3상태 매핑 집약 + 폴백 + 빨강 토큰화 (좋은 1·2·3 통합) — 발견 4건 중 3건을 한 리팩토링으로 해소, 2+ 페르소나 중복 항목.
2. D-4 텍스트 렌더 회귀 테스트 박제 (좋은 4) — verify 1회 실증을 자동 게이트로 전환.
3. capability 빈 문자열 미감사 표시 (1차 이월) — 빌더 보장 확인 후 결정.
4. dagre patch 병합 (1차 이월) — 현 규모 실증상 최저 우선.

---

## 이전 검토 (1차, 2026-07-04 — 배포 불가)


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
