# design — planning-approval-edit-ui-userflow (6b-userflow)

## Context

- 선례 6b-features(archive 2026-07-01): 사이드카 큐(`features.suggestions.json`) → `GET/POST planning-features-suggestions(/apply)` → 승인분만 속성 줄 제자리 교체, `structureInvariantHolds`(재파싱 fingerprint 비교) 위반 시 422. web은 `FeatureApprovalPanel`(카드+개별/일괄) → App에서 apply 후 재조회. 요청/응답은 6a `PrdApplyRequest/Result` 재사용.
- 유저플로우 원천: `docs/planning/user-flow/<stem>.md` Mermaid flowchart. **에지 줄에 노드 정의 인라인**(`Start(["앱 진입"]) --> Grid["카드 그리드"]`), 노드 라벨 SSOT = 첫 정의 줄, 한 줄에 노드·에지 혼재. capability 마커·속성 줄 없음.
- 파서 `planningUserFlowBuilder`: 골든 미커버(단위 테스트만). `RE_EDGE`가 실선 `-->`/점선 `-.->`(+`|라벨|`)을 라인 로컬로 추출, 점선=kind edgecase.
- per-stem 사이드카 선례: `<stem>.overlay.json`(드래그 좌표, docs 유일 쓰기 예외·`isSafeFlowToken` 토큰 가드).

## Goals / Non-Goals

**Goals:**
- 에지 추가 제안의 승인 루프(큐→검증→append→재조회)를 6b 계약(스키마·422·skipped 표면화·무력화 프로브)대로.
- 결정 ③ 2단계(AI 에지케이스 제안)의 소비 파이프 완성 — edgeKind 'edgecase'(점선) 지원이 1급.

**Non-Goals:** proposal 참조(삭제/수정·라벨 편집·제안 생산기·와이어프레임·비화면 newNode).

## Decisions

- **D-1 편집 단위 = 에지 추가(append)만**: 기존 줄 무수정 원칙. 인라인 노드 정의 SSOT 파괴 위험(다른 에지가 쓰는 정의 삭제)이 원천 차단되고, append 한 줄은 라인 로컬로 결정론적. 수정/삭제는 라인 범위 추적 도입 후 별 change(6b-features가 구조 편집을 미룬 것과 동일 판단).
- **D-2 append 위치 = 첫 mermaid 코드블록의 닫는 ``` 직전**: 파서가 블록 내 어느 줄이든 에지를 인식하므로 끝 append가 안전·가독 최선(사람이 나중에 정렬해도 무방). 블록이 없으면 skipped(지어내지 않음).
- **D-3 신규 노드는 to 측 인라인 정의만, 화면 box 고정**: `From -.->|라벨| NewId["새 화면"]`. 에지케이스 분기의 전형(에러 안내 화면)과 일치. newNode.id는 `[A-Za-z0-9_]+` + 기존 id와 대소문자 무시 충돌 금지. from 측 신규는 불허(출발점 없는 고아 흐름 방지).
- **D-4 라벨 안전 게이트**: 에지 라벨·newNode 라벨에 `"`·`|`·개행 금지(Mermaid 문법·RE_EDGE 파괴 벡터). 위반은 그 제안만 skipped(전체 apply를 죽이지 않음). 렌더는 기존 파서·웹 경로 그대로(신규 이스케이프 로직 없음).
- **D-5 self-roundtrip 방어 = 전/후 그래프 비교**: `buildUserFlowFromLines`(파서의 기존 라인 파싱 경로 재사용, 파서 무수정)로 append 전/후를 파싱해 — 기존 노드 id·라벨 집합 보존, 기존 에지(from·to·kind·label) 전부 보존, 신규 에지 정확히 1개·제안과 일치 — 위반 시 쓰기 취소·422·큐 유지. 6b-features의 fingerprint보다 강한 완전 비교(에지 수가 작아 비용 무시 가능). **무력화 프로브 필수**(방어 return true 시 테스트 red — 6b-features 교훈).
- **D-6 큐 = per-stem `<stem>.suggestions.json`**: 유저플로우는 버전이 여럿(main-v1·v2)이라 features의 단일 파일과 달리 stem별 격리. overlay.json과 나란한 기존 사이드카 규약. stem은 `isSafeFlowToken` 게이트 재사용.
- **D-7 apply 계약 = 6a/6b 재사용**: `PrdApplyRequest`(approve[]/reject[])·`PrdApplyResult`(applied/rejected/skipped/writeFailed). 신규 계약 발명 금지. skipped 사유는 result에 표면화(모호·검증 위반·대상 부재).

## Risks / Trade-offs

- **append-only의 한계**: 잘못 승인한 에지를 UI로 못 지운다(문서에서 손으로 지우는 건 언제나 가능 — 기획 문서는 사람 소유). 완화: 승인 전 카드에 실선/점선·from→to를 명시하고 반려를 1급으로. 삭제 op는 후속.
- **동일 제안 중복 승인**: 같은 에지를 두 번 승인하면 중복 줄. 완화: 검증 단계에서 "제안 에지가 이미 존재"면 skipped(멱등).
- **stem 불일치**: 큐 파일의 flow와 쿼리 stem이 어긋나면 잘못된 문서에 붙을 위험 — 큐는 per-stem 파일이라 경로 자체가 격리(D-6), apply는 쿼리 stem 파일만 읽고 쓴다.

## 화면 구성 / UI

- 신규 화면 없음 — 기존 유저플로우 탭(activePlanTab="flow") 그래프 위에 `UserFlowApprovalPanel`을 6b-features 패널과 동일 자리·스타일로 얹는다. 카드: [from → to] 화살표(점선이면 점선 표기)·라벨·rationale·[승인][반려], 하단 [모두 승인][모두 반려]. 큐 비면 패널 자체 미렌더(기존 규약).
