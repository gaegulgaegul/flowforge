## Why

flowforge는 기획 단계(openspec-plan) 산출물 5종을 "읽어서 비추는 거울"이다. 지금 쓰기가 열린 곳은 유저플로우 좌표 overlay JSON 하나뿐이고, PRD/features 명세 `.md`는 저장 라우트조차 없는 읽기전용 SSOT다. manyfast의 핵심 워크플로우인 **수정-승인 루프**(AI 제안 → 사용자 개별/일괄 승인·반려 → 문서 반영)가 flowforge에는 통째로 없다 — `openspec-plan/SKILL.md:234`에도 "flowforge 편집 UI와 연동"으로 미구현 예고만 돼 있다.

**Why now**: 1~5단계(hasDocs 인정·기능명세·유저플로우·spec 변환·capability drill-down)로 읽기·렌더·매핑은 완성됐다. 이제 flowforge를 "읽기 거울 → 일부 편집형"으로 처음 전환해 승인 루프를 채우면 기획 단계가 실제 편집 워크플로우로 닫힌다. PRD는 문서 패널(`PrdPanel`)이라 승인 UI를 붙이기 가장 쉬워, 승인 루프 본질을 최소 스코프로 세로관통 실증하는 예광탄에 맞다(features·유저플로우는 같은 패턴을 6b에서 확장).

## What Changes

- **제안 큐 사이드카 JSON 도입**: AI(스킬/봇)가 PRD 갱신 제안을 `docs/planning/prd.suggestions.json`에 섹션 단위(`PrdSuggestion`)로 쌓는다. flowforge는 이 큐를 읽어 승인·반영만 한다(제안 생성=외부, LLM 호출 안 함).
- **승인/반려 라우트 2개 신설**(docs.ts): 제안 큐 읽기(GET) + 승인·반려 적용(POST apply, approve/reject id 목록).
- **명세 `.md` 첫 쓰기 경로**(`writeDocsPlanningPrd`): 승인된 제안의 섹션만 교체해 `prd.md`를 원자적으로 재작성. 미승인 섹션·H1 title 서문은 원본 보존. 반려는 큐에서만 제거(원본 불변). 이로써 flowforge가 명세 `.md`에 처음으로 쓴다 — **읽기전용 SSOT를 "승인 없이는 불변"으로 재정의**(승인=사용자 의도).
- **웹 승인 UI**(skeleton 단계 PRD 섹션): 제안 큐가 있으면 섹션별 제안 카드(현재 vs 제안) + 개별 [승인]/[반려] + 하단 [모두 승인]/[모두 반려]. 제출 → POST apply → PRD 재조회. 큐 비면 순수 읽기 뷰로 복귀.
- **스킬 계약 명문화**(openspec-plan SKILL.md): PRD 갱신 제안 시 직접 덮어쓰지 말고 `prd.suggestions.json`에 쌓고 "flowforge UI에서 승인"하라는 절차 추가.

## Capabilities

### New Capabilities
- `planning-prd-approval-queue`: flowforge가 `docs/planning/prd.suggestions.json`(제안 큐)을 읽어 반환하는 읽기전용 엔드포인트 + 큐 스키마(섹션 단위 replace 제안, 안정 id). 큐 부재=빈 큐(404 아님).
- `planning-prd-approval-apply`: 승인/반려 적용 엔드포인트 — approve id는 해당 섹션을 `proposedBody`로 교체해 `prd.md` 원자적 재작성 후 큐에서 제거, reject id는 반영 없이 큐에서 제거. 파싱 실패=422(원본 불변), 미실재 섹션/id는 스킵+표면화, 경로 조작 차단.

### Modified Capabilities
<!-- 없음. 기존 planning-prd-view(읽기)·다른 capability의 요구사항은 안 바뀐다. 승인 UI는 skeleton 단계에 얹히지만 기존 렌더 동작 무손상. -->

<!-- generation(openspec-plan 스킬이 prd.suggestions.json을 쌓는 절차)은 스킬 문서 동작이라 flowforge 코드에 endpoint/symbol이 없음 → 별도 capability로 두되 archive 시 흡수 보류(1~5단계 교훈: view/apply capability만 docs/spec.md 흡수, 거짓연결 0). SKILL.md 수정은 tasks에서 수행하되 main spec 흡수 대상 아님. -->

## Impact

- **신규 shared 타입**: `@flowforge/shared`에 `PrdSuggestion`/`PrdSuggestionQueue`/`PrdApplyRequest`(승인·반려 body) 추가. 기존 `PrdSectionKey` 재사용(새 어휘 안 만듦).
- **신규 server**: `server/src/lib/docs.ts`에 제안 큐 read/write + `writeDocsPlanningPrd`(섹션 교체 역직렬화, H1 서문 보존) + body 런타임 검증(`isPrdApplyRequest`, `isLayoutOverlay` 패턴 복제). `server/src/routes/docs.ts`에 GET/POST 라우트 2개. 경로안전 `resolveDocsDir` 재사용.
- **신규 web**: `web/src/api.ts`에 fetch/apply 2함수, `App.tsx` skeleton PRD 섹션에 승인 인터랙션(`PrdPanel` 확장 또는 래퍼), dashReqToken race 가드 재사용.
- **스킬**: `openspec-plan/SKILL.md`에 제안 큐 절차 추가(agentic-harness 소스).
- **무손상(하위호환)**: 기존 `buildDocsPlanningPrd`·GET planning-prd·`PrdPanel` 렌더 변경 0(제안 큐 없으면 기존과 동일). features/유저플로우/change 뷰·overlay PUT 변경 0. 신규 npm 패키지 없음(`node:fs`만).
- **아키텍처 전환(주의)**: 명세 `.md` 첫 쓰기 = 읽기전용 SSOT 경계를 처음 넘음. 되돌리기=apply 라우트·writeDocsPlanningPrd 제거 시 순수 읽기 복귀(제안 큐 JSON은 무해).
- **6b 후속**: 같은 사이드카+승인 패턴을 features(트리 승인)·유저플로우(재생성 승인)로 확장(별도 change, design.md의 6b 로드맵 참조). 6a가 5축 레퍼런스.
- **검증 제약**: 라이브 서버 OPENSPEC_ROOT=wowa라 로컬 DOCS_ROOT 주입으로만 검증. 검증 서버는 PID 지정 kill.
