## Context

6b-features — 기능명세(features.md) 트리에 승인/반려 편집 UI를 얹는다. 6a(PRD 승인 루프)가 방금 archive됐고(`planning-approval-edit-ui-prd`), 그 공통 5축(사이드카 제안 큐·apply 라우트·역직렬화·skeleton 승인 인터랙션·"승인 없이 불변" SSOT)을 features로 확장한다.

**조사(2026-07-01, Explore + 본체 실측)로 확정한 현 상태:**
- `docs/planning/features.md` 스키마: `# 서문`(H1+인용, 파서 무시) → `## 요구사항`(+ `<!-- capability: <키> -->` 주석 + `(중요도:…, 상태:…)` 속성 줄 + 산문 설명) → `### 기능`(속성) → `#### 상세기능`(속성). 3단 헤더 위계.
- `featureTreeBuilder.ts:46` `buildDocsPlanningFeatures(docsDir)`가 직접 라인스캔으로 트리 조립. 노드 속성 = 중요도(낮음|중간|높음)·상태(시작전|진행중|완료|중단). capability는 **요구사항에만**.
- 🔴**노드 id 불안정**: `id = ${parent.id}__${kind[0]}-${slug(label)}#${index}`(featureTreeBuilder.ts:70). `slug`는 한글을 전부 `x`로(specParser.ts:64) → id 구분력이 사실상 경로(parent.id)+형제 순번(#index)뿐. label이 바뀌거나 형제 순서가 바뀌면 id가 흔들린다. **6a의 고정 5키(overview 등) 같은 자연 안정키가 features엔 없다** = 최대 난제.
- 🔴**파서가 산문을 버림**: FeatureTreeNode에 body/description 필드 없음(feature-tree-types.ts). 요구사항 아래 설명 문단을 저장 안 함 → **순진한 트리→md 재직렬화는 산문·서문·주석을 통째로 잃는다**(원본 손상). 6a는 섹션 body를 통째 보존했지만 features는 트리만으론 원문 복원 불가.
- `features.md` 쓰기 함수 **없음**(테스트 픽스처만) → 역직렬화 신규 필요.
- 6a 재사용: 사이드카 큐 IO 패턴(readDocsPrdSuggestions/writeDocsPrdSuggestions/prdSuggestionsPath), applyPrdSuggestions 골격(승인=반영후제거·반려=제거·skipped/writeFailed 표면화), isPrdApplyRequest(body 형태 동일), 라우트 2개·web PrdApprovalPanel·App.tsx 배선 — 전부 **패턴 복제 가능**. 단 writeDocsPlanningPrd(5섹션 조립)만 재사용 불가(트리 재직렬화가 근본 다름).

## Goals / Non-Goals

**Goals (6b-features 예광탄 — 이 change):**
- features 트리 노드의 **속성(중요도·상태) 승인 편집** 세로관통: AI/스킬이 속성 변경 제안을 `features.suggestions.json`에 쌓음 → flowforge UI에서 개별/일괄 승인·반려 → 승인분만 features.md의 해당 속성 줄 교체 반영. 산문·서문·capability·위계는 **전부 보존**.
- 6a 공통 5축을 features로 확장(사이드카 큐·apply 라우트·역직렬화·승인 인터랙션·SSOT 불변식).
- 노드 안정 식별: capability 키(요구사항) + 트리 상대 경로 기반 안정 nodePath로 승인 대상 지정(위치 slug id 대신).

**Non-Goals (이 change 밖 — 후속에서):**
- **노드 add/remove·label 변경·구조 변경** — 산문 손실·노드 식별 불안정 난제가 크므로 **속성 변경만 예광탄**으로 먼저. 구조 편집은 featureTreeBuilder를 "노드별 원문 라인범위 추적"으로 확장한 뒤 별도 change.
- 유저플로우 재생성 승인(6b-userflow), 와이어프레임(6b-wireframe).
- flowforge LLM 호출(제안 생성=외부 스킬, 6a와 동일).

## Decisions

### D1. 편집 대상 = 노드 속성(중요도·상태)만. (예광탄 스코프 축소)
features 전체 트리 편집(add/remove/label/구조)은 산문 손실(파서가 설명 문단을 안 담음)·노드 id 불안정(한글 slug=`x`) 두 난제가 크다. **속성 줄만 교체**하면 label·위계·capability·산문을 원문 그대로 두고 `(중요도:…, 상태:…)` 줄 한 개만 바꾸므로 안전하고 결정론적이다. manyfast features도 "상태/우선순위 트래킹"이 핵심. **대안**: 전체 트리 편집 → 기각(예광탄 과대, 역직렬화 난제로 데이터 손상 위험). 구조 편집은 후속 change에서 원문 라인범위 추적 도입 후.

### D2. 노드 식별 = 안정 nodePath (label 슬러그 id 대신).
현재 위치 기반 id는 label 변경 시 흔들리나, **속성만 바꾸는 이 스코프에선 label이 안 바뀌므로** id 안정성 문제가 없다. 제안은 `nodePath`(요구사항 label / 기능 label / 상세기능 label 경로, 원문 헤더 텍스트로 매칭)로 대상 지정. 반영 시 features.md에서 그 헤더 줄을 찾아 **직후 속성 줄만** 교체. **대안**: featureTreeBuilder id 재사용 → 기각(한글 slug=x라 구분력 없음). nodePath는 헤더 원문 텍스트라 사람이 읽기 쉽고 안정적.

### D3. 제안 큐 스키마 = 속성 교체 제안 배열 (shared 신규 타입)
```
FeatureSuggestion = {
  id: string            // 승인/반려 대상 지정(스킬 부여, 안정)
  nodePath: string[]    // [요구사항label, 기능label?, 상세기능label?] — 헤더 원문 텍스트 경로
  op: "set-attrs"       // 예광탄=속성 교체만
  priority?: FeaturePriority  // 새 중요도(낮음|중간|높음). 생략 시 미변경
  status?: FeatureStatus      // 새 상태(시작전|진행중|완료|중단). 생략 시 미변경
  rationale?: string
}
FeatureSuggestionQueue = { version: 1, suggestions: FeatureSuggestion[] }
```
- 기존 `FeaturePriority`/`FeatureStatus` 재사용(새 어휘 안 만듦, feature-tree-types.ts).
- **대안**: op union(add/remove/set-attrs 전부) → 기각(예광탄은 set-attrs만, 나머지 후속).

### D4. 역직렬화 = 원문 라인 패치 (전체 재조립 아님). ★핵심 안전 전략
features.md **원문을 읽어**, nodePath로 대상 헤더 줄을 찾고, 그 헤더 **직후의 속성 줄만** 새 `(중요도:…, 상태:…)`로 교체(속성 줄이 없으면 헤더 직후에 삽입). **다른 모든 줄(서문·산문·capability 주석·다른 노드)은 원문 그대로 슬라이스 보존**. 6a의 preamble 보존을 노드 단위 라인패치로 일반화. → 산문 손실 0, capability 보존 자동(안 건드림). **대안**: 트리→md 전체 재직렬화 → 기각(산문·서문 손실).

### D5. self-roundtrip 방어 (features판)
write 전 결과를 재파싱(buildDocsPlanningFeatures)해 **write 전후 트리 구조 불변식**을 검증: (a) 노드 개수 동일 (b) capability 키 집합 동일 (c) 대상 노드의 속성만 바뀌고 label·위계 불변. 하나라도 깨지면 안 쓰고 false → 라우트 422(원본 보호). 6a의 "정확히 5섹션" 검증의 features판. 속성 값이 화이트리스트(낮음|중간|높음 / 시작전|진행중|완료|중단)가 아니면 승인 단계에서 거부.

### D6. 라우트 2개 (docs.ts에 신설)
- `GET /api/docs/:project/planning-features-suggestions` — 제안 큐 읽기(없으면 빈 큐 200).
- `POST /api/docs/:project/planning-features-suggestions/apply` — body `{approve:[], reject:[]}`(id 목록). 승인=속성 반영 후 큐 제거, 반려=반영 없이 제거. 파싱실패·불변식 위반=422, 미실재 id/nodePath=skipped 표면화, 경로조작=404, 잘못된 body=400. 6a 라우트 계약 그대로.

### D7. 웹 UI = skeleton 단계 features 섹션에 승인 인터랙션 (FeatureApprovalPanel 신규)
`App.tsx`의 planningFeatures 렌더(현재 읽기전용 ReactFlow, `nodesDraggable={false}`) 위에 제안 큐가 있으면 승인 카드 목록: 노드별 [현재 속성 → 제안 속성] 대비 + 개별 [승인]/[반려] + 하단 일괄. 제출 → POST apply → features·큐 재조회(dashReqToken race 가드). 큐 비면 순수 읽기 뷰. 6a PrdApprovalPanel 구조 참고하되 diff 표시가 "섹션 body 대비"→"속성 before/after"로 변형.

### D8. 스킬 계약 = openspec-plan SKILL.md에 features 속성 제안 절차 추가
6a에서 PRD 제안 큐 절차를 넣었듯, features 속성 갱신 제안 시 `features.suggestions.json`에 FeatureSuggestion으로 쌓고 "flowforge UI에서 승인"하는 절차 추가. generation/스킬 동작이라 archive 시 view/apply capability만 docs/spec.md 흡수(1~6a 교훈).

## Risks / Trade-offs

- [nodePath 헤더 텍스트 매칭 — 같은 label 헤더가 여러 개면?] → 같은 부모 아래 동일 label 헤더는 실무상 드물지만, 매칭 시 **전체 경로(요구사항/기능/상세기능)로 유일성 확보** + 여전히 모호하면 첫 매치 + skipped에 경고. self-roundtrip이 "노드 개수 불변"으로 오작동 감지.
- [속성 줄이 헤더 직후에 없는 노드] → 삽입(헤더 다음 줄에 새 속성 줄). self-roundtrip이 노드 개수·capability 불변 확인하므로 위계 안 깨짐.
- [nodePath에 특수문자/개행] → 헤더 텍스트라 개행 불가(단일 줄). 매칭은 trim 후 정확 비교.
- [제안 op 확장성] → set-attrs만이라 구조 편집 요구 시 후속 change 필요(의도적 축소, Non-Goal 명시).
- [동시 apply] → 개인용 단일 사용자(6a와 동일, 범위 밖). apply는 매 요청 큐 재읽기.
- [검증 제약] → 라이브 OPENSPEC_ROOT=wowa라 로컬 DOCS_ROOT 주입 검증. 검증 서버 PID 지정 kill. 픽스처는 changeCount≥1 카드 조건 충족 필요(6a 실측 함정).

## 화면 구성 / UI

- 화면 구조·흐름은 `prototype.html`을 단일 출처로 한다(DESIGN.md 없어 와이어). React로 번역 구현.
- 핵심 화면: skeleton features 트리 위 "제안 N건" 배너 → 노드별 속성 before/after 카드 → 개별/일괄 승인·반려 → 제출 후 트리 재렌더(속성 뱃지 갱신).

## Open Questions

<!-- 없음. D1(속성만 예광탄) 스코프 축소 = 사용자 확정(2026-07-01, 추천안 채택). 나머지(nodePath 식별·라인패치 역직렬화·self-roundtrip)는 조사로 확정. 구조 편집(add/remove/label)은 후속 change. -->
