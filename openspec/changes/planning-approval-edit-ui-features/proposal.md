## Why

6a(PRD 승인/반려 편집 UI)로 flowforge가 "읽기 거울 → 일부 편집형"으로 처음 전환됐고, 사이드카 제안 큐 + 개별/일괄 승인·반려 + 승인분만 명세 반영이라는 공통 5축을 깔았다. 하지만 승인 루프는 아직 PRD 하나뿐이다 — 기능명세(features.md)는 여전히 읽기전용 ReactFlow 트리(`nodesDraggable={false}`)로만 렌더된다. manyfast features의 핵심 가치인 **상태/우선순위 트래킹**(중요도·상태 편집)을 flowforge에서 승인 루프로 닫으면 기획 단계 편집이 한 걸음 더 완성된다.

**Why now / 왜 속성만**: features는 PRD(5섹션 고정 문서)와 근본적으로 다르다 — (1) 파서가 요구사항 산문(설명 문단)을 저장하지 않아 트리→md 전체 재직렬화는 원문을 손상시키고, (2) 노드 id가 한글 label에서 slug=`x`로 무너져 위치 기반이라 label 변경 시 흔들린다. 이 두 난제를 한 번에 풀려 하면 예광탄이 과대해지고 데이터 손상 위험이 크다. 그래서 **노드 속성(중요도·상태)만** 먼저 승인 편집한다 — 노드 label·위계·산문·capability를 원문 그대로 두고 `(중요도:…, 상태:…)` 줄 하나만 교체하는 **원문 라인 패치**라 안전하고, 승인 루프 본질(제안→개별/일괄 승인·반려→반영)은 그대로 담는다. 구조 편집(add/remove/label)은 원문 라인범위 추적을 도입한 뒤 별도 change로 확장한다(사용자 확정: "1 하고 검증되면 2 진행").

## What Changes

- **features 제안 큐 사이드카 JSON 도입**: AI(openspec-plan 스킬/봇)가 노드 속성 변경 제안을 `docs/planning/features.suggestions.json`에 `FeatureSuggestion`(nodePath·op:set-attrs·priority?·status?)으로 쌓는다. flowforge는 이 큐를 읽어 승인·반영만 한다(제안 생성=외부, LLM 호출 없음 — 6a와 동일).
- **승인/반려 라우트 2개 신설**(docs.ts): 제안 큐 읽기(GET) + 승인·반려 적용(POST apply, approve/reject id 목록). 6a 라우트 계약(404/400/422/skipped) 그대로.
- **features.md 원문 라인 패치**(`writeDocsPlanningFeaturesAttrs`): 승인된 제안의 nodePath로 대상 헤더를 찾아 **직후 속성 줄만** 교체(없으면 삽입). 서문·산문·capability 주석·다른 노드·위계는 원문 슬라이스 보존. features.md에 대한 flowforge 첫 쓰기 — 읽기전용 SSOT를 "승인을 통해서만 바뀐다"로 재정의(6a 불변식 확장).
- **self-roundtrip 방어(features판)**: write 전 결과를 재파싱해 노드 개수·capability 키 집합 불변 + 대상 노드 속성만 변경을 검증. 깨지면 422(원본 보호).
- **웹 승인 UI**(skeleton features 섹션): 제안 큐가 있으면 노드별 [현재 속성 → 제안 속성] 대비 카드 + 개별 [승인]/[반려] + 하단 일괄. 제출 → POST apply → features·큐 재조회. 큐 비면 순수 읽기 뷰.
- **스킬 계약 명문화**(openspec-plan SKILL.md): features 속성 갱신 제안 시 `features.suggestions.json`에 쌓고 "flowforge UI에서 승인"하라는 절차 추가(6a PRD 절차의 features판).

## Capabilities

### New Capabilities
- `planning-features-approval-queue`: flowforge가 `docs/planning/features.suggestions.json`(노드 속성 변경 제안 큐)을 읽어 반환하는 읽기전용 엔드포인트 + 큐 스키마(nodePath·op:set-attrs·priority?·status?·안정 id). 큐 부재=빈 큐(404 아님), 깨진 JSON·미인식 항목 안전 폴백.
- `planning-features-approval-apply`: 승인/반려 적용 엔드포인트 — approve id는 nodePath 대상 헤더의 속성 줄을 교체 반영(원문 라인 패치, 산문·capability·위계 보존) 후 큐에서 제거, reject id는 반영 없이 큐에서 제거. self-roundtrip 불변식(노드 개수·capability 불변) 위반·파싱 실패=422(원본 보호), 미실재 id/nodePath=skipped 표면화, 경로 조작 차단.

### Modified Capabilities
<!-- 없음. 기존 planning-features-view(읽기)는 무손상. 승인 UI는 skeleton features 섹션에 얹히지만 기존 트리 렌더 동작 불변. -->

<!-- generation(openspec-plan 스킬이 features.suggestions.json을 쌓는 절차)은 스킬 문서 동작이라 flowforge 코드에 endpoint/symbol 없음 → SKILL.md는 tasks에서 수정하되 archive 시 main spec 흡수 대상 아님(1~6a 교훈: view/apply만 흡수, 거짓연결 0). -->

## Impact

- **신규 shared 타입**: `@flowforge/shared`에 `FeatureSuggestion`/`FeatureSuggestionQueue`(6a PrdApplyRequest/Result는 재사용). 기존 `FeaturePriority`/`FeatureStatus` 재사용(새 어휘 안 만듦).
- **신규 server**: `server/src/lib/docs.ts`에 제안 큐 read/write(6a `readDocsPrdSuggestions`/`writeDocsPrdSuggestions` 패턴 복제) + `writeDocsPlanningFeaturesAttrs`(원문 라인 패치, 6a writeDocsPlanningPrd와 다른 신규) + body 검증(6a `isPrdApplyRequest` 재사용). `server/src/routes/docs.ts`에 GET/POST 라우트 2개. 경로안전 `resolveDocsDir` 재사용.
- **신규 web**: `web/src/FeatureApprovalPanel.tsx`(6a PrdApprovalPanel 구조 참고, diff 표시는 속성 before/after), `web/src/api.ts`에 fetch/apply 2함수, `App.tsx` skeleton features 섹션에 승인 인터랙션(dashReqToken race 가드 재사용).
- **스킬**: `openspec-plan/SKILL.md`에 features 속성 제안 절차 추가(agentic-harness 소스).
- **무손상(하위호환)**: 기존 `buildDocsPlanningFeatures`·GET planning-features·FeatureNode/featureTreeAdapter 렌더 변경 0(제안 큐 없으면 기존과 동일). PRD 승인(6a)·유저플로우/change 뷰 변경 0. 신규 npm 패키지 없음.
- **아키텍처(6a 확장)**: features.md 첫 쓰기 = 읽기전용 SSOT 경계를 features로 확장(6a에서 prd.md에 이미 열림). 되돌리기=apply 라우트·writeDocsPlanningFeaturesAttrs 제거 시 순수 읽기 복귀.
- **후속(이 change 밖)**: 노드 add/remove·label 변경·구조 편집(원문 라인범위 추적 도입 후 별도 change), 유저플로우 재생성 승인(6b-userflow), 와이어프레임(6b-wireframe).
- **검증 제약**: 라이브 OPENSPEC_ROOT=wowa라 로컬 DOCS_ROOT 주입 검증. 검증 서버 PID 지정 kill. 픽스처 changeCount≥1 카드 조건(6a 실측 함정).
