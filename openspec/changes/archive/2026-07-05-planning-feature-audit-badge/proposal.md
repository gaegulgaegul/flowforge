# 기획 그래프 기능 노드 단위 audit 배지

## Why

안2 결정(2026-07-02)의 마지막 미구현 조각: **"검증기준(assert/invariant/metric) 결과는 화면에 audit 배지로만 표시(기능 카드에)"**. `wire-card-audit-status`(2026-07-04 archive)로 프로젝트 카드에는 audit 전체 판정 배지가 채워졌지만, 그건 프로젝트당 1개 값이다. 정작 "**어느 기능이** 코드와 정합/불합인가"는 여전히 화면 어디에도 없다 — audit.json `items[]`에 capability 단위 판정(PASS/FAIL/UNVERIFIABLE)이 이미 저장돼 있는데도, 기획 기능명세 그래프의 요구사항 노드는 그 데이터를 전혀 보여주지 않는다.

기획 기능명세 그래프의 요구사항 노드는 capability 키(`<!-- capability: ... -->`)를 이미 가지고 있고(기획↔change 매핑 출발점), audit items도 capability 키로 집계돼 있다 — **양쪽 다 같은 영문 불변 키를 쓰므로 문자열 동치 매칭만으로 배지가 배선된다**(거짓 연결 0 원칙, 이름 유사도 추측 금지). flowforge의 존재 이유("기획 한눈에 + 정합성 자동감사 대시보드")로 가는 다음 증분이며, 방금 만든 노드 클릭 상세 패널(FeatureDetailPanel)에 상세 내역을 얹기에도 자연스러운 시점이다.

## What Changes

기획 기능명세 뷰(planning features)의 **요구사항 노드**에 capability 단위 audit 배지를 표시하고, 노드 클릭 상세 패널에 audit 상세(판정·건수·FAIL 항목)를 추가한다.

- **audit capability 집계 lib 신설(server)**: `<projDir>/docs/audit.json`의 `items[]`를 capability 키별로 집계해 `{ status, pass, fail, unverifiable }` 맵을 만든다. 판정 규칙(결정론): FAIL 1건 이상 → `fail` / FAIL 0 & PASS 1건 이상 → `clean` / 검증가능 항목 0(전부 UNVERIFIABLE 또는 데이터 없음) → `unknown`. UNVERIFIABLE(산문 줄)은 결함 신호가 아니므로 status를 깎지 않고 건수로만 노출한다. 파일 없음·깨진 JSON·필드 없음은 빈 맵 폴백(throw 금지) — `readAuditStatus`와 동일한 신뢰 경계(audit.json 내부 경로 불신, 필요 필드만 소비).
- **audit 집계 라우트 신설(server)**: `GET /api/docs/:project/audit-capabilities` — 위 집계 맵 반환. 기존 `planning-features` 응답·featureTreeBuilder는 **무변경**(API 계약 불변, 골든 무저촉).
- **web 병합·배지 렌더**: featureTreeAdapter가 audit 맵을 capability 키 동치로 요구사항 노드 data에 병합(web 파생 — 상세 패널의 path·childRefs와 같은 패턴). FeatureNode에 배지(정합/불합/미감사) 렌더, FeatureDetailPanel에 audit 섹션(판정·PASS/FAIL/검증불가 건수·FAIL claim 목록) 추가. audit 데이터 로드 실패는 배지 없음으로 강등(그래프 렌더를 막지 않는다).

**Non-Goals**: 유저플로우·IA 뷰 배지 확장(후속 additive), audit 실시간 재계산(저장본만 반영 — 산출은 openspec-audit 소유), audit.json 신선도(마지막 감사 시각) 표시, 기능(feature)·상세기능 leaf 단위 매칭(audit items의 `feature` 필드는 docs/spec.md `### 기능:` 헤딩이라 features.md 트리와 다른 축 — capability 단위만 결정론 매칭 가능).

## Capabilities

### New Capabilities
- `planning-feature-audit-badge`: 기획 기능명세 뷰 요구사항 노드에 capability 단위 audit 판정 배지를 표시하고, 상세 패널에 audit 상세(판정·건수·FAIL 항목)를 노출하는 능력. 데이터 원천은 저장된 `docs/audit.json` `items[]`(읽기전용 소비), 매칭은 capability 영문 키 문자열 동치만.

### Modified Capabilities
<!-- 없음. planning-features-view의 기존 요구(트리 파생·렌더)는 무변경 — 배지는 additive 신규 능력. -->

## Impact

- **신규 server**: `server/src/lib/auditSummary.ts`(items[] 집계), `routes/docs.ts`에 라우트 1개 추가(`GET /api/docs/:project/audit-capabilities`).
- **신규/수정 web**: `web/src/api.ts`(fetch 1개), `featureTreeAdapter.ts`(audit 맵 병합 — web 파생), `FeatureNode.tsx`(배지), `FeatureDetailPanel.tsx`(audit 섹션), `styles.css`(배지 스타일).
- **신규 shared**: `CapabilityAuditSummary` 타입.
- **수정 테스트**: auditSummary 단위(집계·폴백), 라우트 통합(맵 반환·404), 기존 테스트 전부 비파괴.
- **🔴 수정 금지(골든·계약 보호)**: `featureTreeBuilder.ts`·`specParser.ts`·`flowBinder.ts`·`graphBuilder.ts`·`__golden__/`·기존 `planning-features` 응답 스키마.
- **의존성**: 신규 npm 패키지 없음.
- **소유 경계**: audit.json 산출은 agentic-harness `openspec-audit` 소유 — flowforge는 `items[]`의 `capability`·`verdict`(+상세 패널용 `kind`·`claim`·`reason`)만 읽기전용 소비. ⚠️ 현재 flowforge의 저장본 audit.json은 구버전(2 capability만 포함)이라, verify 단계에서 openspec-audit을 재실행해 최신화한 뒤 실데이터 grounding 한다(코드 작업 아님, 검증 전제).
