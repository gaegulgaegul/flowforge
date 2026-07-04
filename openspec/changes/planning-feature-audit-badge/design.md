# design — planning-feature-audit-badge

## Context

- 기획 기능명세 뷰: `GET /api/docs/:project/planning-features` → `featureTreeBuilder`가 `docs/planning/features.md`를 3단 트리(요구사항→기능→상세기능)로 파싱, web `featureTreeAdapter`가 ReactFlow 노드로 변환. **요구사항 노드만 capability 키 보유**(`FeatureNode.capability`, `<!-- capability: 영문키 -->`).
- audit 데이터: `<projDir>/docs/audit.json`(openspec-audit 산출·저장본). `items[]` 원소 = `{ capability, feature, line, kind, claim, verdict(PASS|FAIL|UNVERIFIABLE), reason, method, evidence }`. 카드 배지(`wire-card-audit-status`)는 `finalJudgment` 1개 값만 소비 중 — capability 단위 `items[]`는 미소비.
- 노드 클릭 상세 패널(`FeatureDetailPanel`, 커밋 4e8c112)이 이미 있어 상세 노출 자리가 준비됨. path·childRefs를 web 어댑터에서 파생하는 선례 존재.
- 실데이터 현황: features.md 요구사항 9키 중 3키(planning-features-view·planning-only-recognition·planning-prd-view)가 최신 감사 capability와 겹침. 나머지 6키는 docs/spec.md에 capability로 없음 → 감사 데이터 없음 → "미감사"가 정직한 표시.

## Goals / Non-Goals

**Goals:**
- 요구사항 노드에 capability 단위 audit 판정 배지(정합/불합/미감사) 표시.
- 상세 패널에 audit 상세(판정·PASS/FAIL/검증불가 건수·FAIL claim 목록) 노출.
- 매칭은 capability 영문 키 **문자열 동치만**(거짓 연결 0). 골든·기존 API 계약 무저촉(additive).

**Non-Goals:**
- 유저플로우·IA 뷰 확장(후속), audit 실시간 재계산, 신선도 표시, 기능/상세기능 leaf 단위 매칭(축이 다름 — proposal Non-Goals 참조).

## Decisions

- **D-1 집계 규칙(결정론)**: capability별 items에서 `FAIL ≥ 1 → fail` / `FAIL = 0 ∧ PASS ≥ 1 → clean` / 그 외(항목 없음·전부 UNVERIFIABLE) → `unknown`. **UNVERIFIABLE은 status를 깎지 않는다** — audit_match는 산문 줄(freetext)을 전부 UNVERIFIABLE로 남기므로(모든 capability에 존재) 이를 결함 취급하면 전 노드가 warn으로 도배돼 신호가 죽는다. 건수로만 노출해 사용자가 검증가능성 비율을 볼 수 있게 한다. `warn`은 이 축에서 미사용(카드 배지의 finalJudgment 조건부 전용 어휘로 남김).
- **D-2 데이터 흐름 = 별도 엔드포인트 + web 병합**: `GET /api/docs/:project/audit-capabilities` 신설, web이 planning-features와 **병렬 fetch 후 어댑터에서 capability 키로 병합**. 대안(planning-features 응답에 서버측 병합)은 기존 API 계약 변경 + featureTreeBuilder 우회 불가라 기각. 상세 패널의 path·childRefs "web 파생" 선례와 같은 패턴.
- **D-3 신뢰 경계 = readAuditStatus와 동일**: 이미 검증된 `projDir` 기준으로만 경로 구성, audit.json 내부 경로(scanRoot 등) 불신, 소비 필드는 `items[].{capability, verdict, kind, claim, reason}`만. 파일 없음·깨진 JSON·items 비배열은 **빈 맵 폴백**(throw 금지) — 배지만 사라지고 그래프는 정상.
- **D-4 FAIL claim 상세는 fail일 때만**: 상세 패널 audit 섹션에 FAIL 항목의 `claim`(+`reason`)을 나열하되 fail 상태일 때만. clean/unknown이면 판정·건수만(패널 소음 방지). claim은 텍스트 렌더(dangerouslySetInnerHTML 금지 — XSS 경계).
- **D-5 배지 어휘·라벨**: 노드 배지 = `정합`(clean, 초록) / `불합 N`(fail, 빨강+FAIL 건수) / `미감사`(unknown, 회색·저채도). 카드 배지의 AUDIT_LABEL(정상/실패/미확인)과 어휘를 다르게 하는 이유: 카드는 프로젝트 전체 finalJudgment, 노드는 capability 단위 spec↔코드 정합이라 의미 축이 다름 — 같은 라벨을 쓰면 "카드는 경고인데 노드는 정합"이 모순처럼 읽힌다.
- **D-6 audit 데이터 없는 요구사항도 배지 표시(미감사)**: 숨기지 않는다 — "이 기능은 아직 감사 안 됨"이 안2의 정직 원칙에 부합. 단 기능/상세기능(비요구사항) 노드는 capability 키가 없으므로 배지 자체를 렌더하지 않는다(지어내지 않음).

## Risks / Trade-offs

- **저장본 신선도**: 배지는 마지막 감사 시점의 저장본을 비춘다(실시간 아님). 완화: verify에서 openspec-audit 재실행으로 최신화 후 grounding, 신선도 표시는 후속. 이는 카드 배지와 동일한 기존 정책.
- **UNVERIFIABLE 미반영의 맹점**: 산문만 잔뜩 있고 assert가 1개뿐인 capability도 그 1개가 PASS면 `clean`. 완화: 건수(검증가능 n/전체 m)를 배지 옆이 아닌 상세 패널에 노출해 과신 방지.
- **audit.json 스키마 드리프트**: items[] 필드가 openspec-audit 쪽에서 바뀌면 배지가 조용히 unknown으로 강등된다(throw 금지의 대가). 완화: 소비 필드를 D-3에 명시하고 단위 테스트로 스키마 가정을 박제 — 드리프트 시 테스트가 먼저 깨진다.

## 화면 구성 / UI

- 화면 구조·흐름의 단일 출처는 기존 기능명세 뷰(라이브)와 `FeatureDetailPanel` — 이 change는 **기존 화면에 배지·섹션을 additive로 얹는 것**이라 신규 화면·이동(딥링크) 없음. 프로토타입 생성 스크립트 판정에 따름(신규 화면 spec 없으면 스킵이 정상).
