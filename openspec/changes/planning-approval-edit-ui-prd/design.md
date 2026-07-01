## Context

flowforge는 OpenSpec 기반 계층 대시보드로 "읽어서 비추는 거울"이 정체성이다. 기획 단계(openspec-plan) 산출물 5종을 읽어 렌더한다. 조사(2026-07-01, Explore 5축 + 본체 확인)로 확정한 현 상태:

- **쓰기가 열린 곳은 딱 하나**: 유저플로우 좌표 overlay JSON(`docs/planning/user-flow/<group>-vN.overlay.json`). `docs.ts` PUT `/api/docs/:project/planning-user-flow/layout`(line 136) → `writeDocsUserFlowOverlay`(`lib/docs.ts:141`). 명세 `.md`는 절대 안 건드림(주석 line 151).
- **명세 `.md`는 전부 읽기전용 SSOT**: `prd.md`/`features.md`/`user-flow/*.md`를 쓰는 함수는 존재하지 않는다. `docs.ts:13` "docs는 SSOT(읽기전용)". `lib/docs.ts:9-11` 동일.
- **각 산출물 현재 렌더** (skeleton 단계, `App.tsx:415-495`):
  - PRD = `PrdPanel.tsx` 문서 패널(HTML 텍스트, `App.tsx:421`) — 인라인 편집 부착에 적합.
  - features = `FeatureNode` ReactFlow 트리, `nodesDraggable={false}`(`App.tsx:434`) — 읽기전용.
  - 유저플로우 = `SpecNode`/`graphAdapter` ReactFlow 그래프, 좌표만 쓰기(`onNodeDragStop`, `App.tsx:212-224`).
  - 와이어프레임 = **planning 렌더 자체가 부재**(라우트·빌더·렌더 전무).
- **승인/반려 shared 타입 전무**: `shared/src/`에 approval/reject/suggestion diff를 표현할 타입 없음. `feature-tree-types.ts:6` 주석에 "승인 UI에서 진화"라 미래 작업으로 예고만.
- **overlay 사이드카 패턴이 재사용 틀**: `readDocsUserFlowOverlay`/`writeDocsUserFlowOverlay`(경로 화이트리스트 `isSafeFlowToken` + `mkdirSync` recursive + `writeFileSync` JSON) + `isLayoutOverlay`(PUT body 런타임 검증). 승인 상태 저장에 이 구조를 복제 가능(단 `LayoutOverlay` 타입은 좌표 전용이라 그대로는 못 씀).
- **스킬 쪽 승인루프 미구현**: `openspec-plan/SKILL.md:234` "**수정-승인 루프** — AI 제안 → 사용자 개별/일괄 승인·반려 → 반영 (flowforge 편집 UI와 연동)"이 "다음 change에서 확장"(line 229)으로 예고됨. 현재 스킬은 제안이 아니라 곧바로 최종 `.md`를 저작한다. 즉 "AI 제안" 생성 계약과 승인 반영 계약을 이 단계에서 정해야 한다.

이 change는 flowforge를 **"읽기 거울" → "일부 편집형"으로 처음 전환**한다(명세 `.md`에 처음으로 쓰기가 생긴다). 아키텍처적으로 되돌리기 어려운 방향 결정이라 사용자 확정을 받았다(2026-07-01).

## Goals / Non-Goals

**Goals (6a 예광탄 — 이 change):**
- **PRD 승인 루프 세로관통**: AI(스킬/봇)가 제안을 사이드카 큐(`docs/planning/prd.suggestions.json`)에 쌓음 → flowforge UI에서 **개별/일괄 승인·반려** → 승인분만 `docs/planning/prd.md`에 반영 → 반영된 제안은 큐에서 제거.
- 명세 `.md`(prd.md)에 대한 flowforge의 **첫 쓰기 경로**를 안전하게 연다(경로안전 `resolveDocsDir` + body 검증 재사용).
- overlay 사이드카 패턴을 승인 큐용으로 복제(read/write/검증). 명세 `.md`는 승인 전까지 SSOT 유지(반려=원본 불변).
- manyfast 정책 준수: 변경항목 표시(제안 트리/목록) + 개별 승인·반려 + 하단 일괄 승인·반려.

**Non-Goals (이 change 밖 — 6b 전체에서):**
- features(트리 승인)·유저플로우(노드 편집+재생성) 승인 UI — **6b로 미룸**(예광탄 검증 후 같은 패턴을 확장).
- 와이어프레임 planning 렌더/재생성 — planning 경로에 아예 부재라 별도 큰 작업(6b 이후).
- flowforge UI 안에서 "AI 제안을 새로 생성"(LLM 호출) — 제안 생성 주체는 스킬/봇(외부), flowforge는 **큐를 읽어 승인·반영만**. (flowforge는 LLM 호출 안 함, 개인용 정적 뷰어 정체성 유지.)
- 제안 큐의 실시간 협업/동시편집 충돌 처리(개인용, 단일 사용자).

## Decisions

### D1. 편집 대상 = PRD만 (예광탄). 사용자 확정 Q1-1.
문서 패널(`PrdPanel`)이라 인라인/섹션 단위 승인 UI를 붙이기 가장 쉽고, 승인루프 본질(제안→개별/일괄 승인·반려→반영)을 최소 스코프로 세로관통 실증할 수 있다. features/유저플로우는 6b로 미룬다(같은 사이드카+승인 패턴을 확장). **대안**: 3종 동시 → 기각(한 change에 위험, 예광탄 원칙 위배).

### D2. 편집 방식 = 사이드카 제안 큐 + 승인 시 `.md` 반영. 사용자 확정 Q2-1.
AI 제안을 `prd.suggestions.json`에 쌓고, UI에서 개별/일괄 승인 → 승인분만 `prd.md`에 반영 → 큐에서 제거. 반려는 큐에서 제거(원본 `.md` 불변). overlay 사이드카 패턴과 동형이라 아키텍처 정합. manyfast "변경항목 트리뷰 + 개별/일괄 승인"과 일치. **대안**: UI 인라인 직접편집→바로 저장 → 기각(AI 제안 개념이 약해 manyfast 승인루프가 아님).

### D3. 제안 큐 저장 위치 = 명세 옆 사이드카 JSON `docs/planning/prd.suggestions.json`. 사용자 확정 Q3-1.
overlay JSON과 같은 디렉토리(`docs/planning/`)에 두어 `resolveDocsDir` 경로안전을 그대로 재사용한다. 명세 `.md`는 SSOT 유지. **대안**: 별도 `.approvals/` 디렉토리 → 기각(새 경로안전 로직 필요, 이득 없음).

### D4. 제안 큐 스키마 = PRD 섹션 단위 제안 배열 (shared 신규 타입)
PRD는 5섹션 고정(개요·핵심가치·타겟·성공지표·속성설정). 제안은 **섹션 교체(replace) 단위**로 표현한다(섹션 안 부분 diff는 예광탄 과함 — 섹션 통째 교체가 승인·반영이 결정론적이고 안전).

```
PrdSuggestion = {
  id: string          // 안정적 식별자(승인/반려 대상 지정). 스킬이 부여(예: "sug-개요-1").
  section: PrdSectionKey  // 기존 prd-types.ts의 5키 재사용(overview|value|target|metrics|attributes)
  op: "replace"       // 예광탄=섹션 교체만. (add/remove는 6b 후보)
  proposedBody: string  // 그 섹션의 새 본문(마크다운). 반영 시 이 섹션을 이걸로 교체.
  rationale?: string  // 제안 근거(선택, UI 표시용)
}
PrdSuggestionQueue = {
  version: 1
  suggestions: PrdSuggestion[]
}
```
- **id 안정성**: 승인/반려는 id로 지정. 스킬이 제안 생성 시 부여. flowforge는 id로만 큐를 조작(내용으로 매칭 안 함).
- **PrdSectionKey 재사용**: `shared/src/prd-types.ts`의 5섹션 키를 그대로 씀(새 어휘 안 만듦, prd.md 파서와 정합).
- **대안**: 자유 텍스트 patch/diff → 기각(반영이 비결정론적, 파싱 취약). 섹션 교체가 PRD 5섹션 고정 구조에 안전.

### D5. 승인 반영 = 섹션 교체 후 `prd.md` 재작성 (writeDocsPlanningPrd 신규)
승인된 제안들의 `proposedBody`로 해당 섹션을 교체한 새 `prd.md` 전체를 만들어 원자적으로 쓴다. 기존 5섹션 파서(`buildDocsPlanningPrd`가 쓰는 `splitSections`/`sectionBody`)의 **역방향**(섹션맵→마크다운)을 구현한다. 미승인 섹션은 원본 유지. **읽기 SSOT 불변식은 "승인 없이는 안 바뀜"으로 재정의**(승인이 곧 사용자 의도이므로 SSOT 정합). **대안**: 제안을 그대로 append → 기각(5섹션 고정 순서가 깨짐).

### D6. 라우트 3개 (docs.ts에 신설)
- `GET /api/docs/:project/planning-prd-suggestions` — 제안 큐 읽기(없으면 빈 큐 `{version:1,suggestions:[]}`, 404 아님 — 큐 부재=제안 없음).
- `POST /api/docs/:project/planning-prd-suggestions/apply` — body `{approve: string[], reject: string[]}`(id 목록). approve id는 섹션 교체 반영 후 큐에서 제거, reject id는 반영 없이 큐에서 제거. 응답=반영 결과(적용된 섹션 수, 남은 제안 수).
- (제안 큐 **생성/추가**는 flowforge가 안 함 — 스킬/봇이 `prd.suggestions.json`을 직접 씀. flowforge는 읽기+승인반영만.)
- 경로안전 `resolveDocsDir` 재사용, body 런타임 검증(`isPrdApplyRequest`)은 `isLayoutOverlay` 패턴 복제.

### D7. 웹 UI = skeleton 단계 PRD 섹션에 승인 인터랙션 (PrdPanel 확장 or 래퍼)
`App.tsx:421` planning PRD 렌더 옆/위에 **제안 큐가 있으면** 변경항목 목록을 표시: 섹션별 제안 카드(현재 본문 vs 제안 본문) + 각 카드에 [승인][반려] 버튼 + 하단 [모두 승인][모두 반려] 일괄 버튼. 승인·반려 제출 → POST apply → 성공 시 PRD 재조회(dashReqToken race 가드 재사용). 제안 큐 비면 승인 UI 숨김(순수 읽기 뷰로 복귀). **대안**: 새 DashStage 신설 → 기각(skeleton이 이미 PRD 컨텍스트 보유).

### D8. 스킬 계약 = openspec-plan SKILL.md에 "AI 제안 → 큐 → 승인 반영" 절차 명문화
`SKILL.md:234` 미구현 항목을 채운다: PRD 갱신 제안 시 **직접 prd.md를 덮어쓰지 말고**(멱등 가드와 별개), 변경 제안을 `prd.suggestions.json`에 `PrdSuggestion` 형태로 쌓고 "flowforge UI에서 승인하라"고 안내하는 절차 추가. 스킬 문서 동작이라 flowforge 코드에 endpoint/symbol 없음 → archive 시 **generation/스킬 capability는 보류**(1~5단계 교훈: view capability만 흡수, 거짓연결 0). flowforge의 **view/apply capability만** docs/spec.md 흡수 대상.

## Risks / Trade-offs

- [명세 `.md` 첫 쓰기 = 읽기전용 SSOT 아키텍처 전환] → SSOT 불변식을 "승인 없이는 불변"으로 재정의. 승인=사용자 의도 반영이므로 정합. **되돌리기**: apply 라우트/writeDocsPlanningPrd 제거 시 순수 읽기로 복귀(제안 큐 JSON은 무해).
- [섹션 교체 반영 시 원본 손상] → 반영 전 5섹션 파싱 성공을 가드(파싱 실패=422, 원본 불변). 원자적 쓰기(전체 문자열 1회 write). 승인 대상 섹션만 교체, 나머지 원본 보존 단위테스트.
- 🔴[H1 title 유실 함정] `splitSections`는 `# PRD: <프로젝트명>` 최상단 H1을 서문으로 **버린다**(markdown.ts:40). 역직렬화(섹션맵→prd.md)가 H2 5섹션만 재조립하면 H1 title이 사라져 원본 손상. → `writeDocsPlanningPrd`는 원본 `prd.md`에서 **첫 H2(`## 개요`) 앞의 서문(H1 title 포함)을 그대로 보존**하고, 그 뒤 5섹션만 교체 반영한다. 원본에 H1 없으면 없는 대로 유지(지어내지 않음).
- [제안 큐와 prd.md 불일치(제안이 가리키는 섹션이 원본에 없음)] → apply 시 존재하지 않는 섹션 op는 스킵+응답에 표면화(silent drop 금지).
- [동시 승인 요청(경합)] → 개인용 단일 사용자라 무시 가능. apply는 매 요청 전체 큐를 다시 읽어 처리(stale 큐 write 방지).
- [id 중복/부정 토큰] → apply body id는 큐에 실재하는 id만 처리, 미실재 id는 무시+표면화. 경로 토큰(project)은 resolveDocsDir 화이트리스트로 차단.
- [라이브 서버 OPENSPEC_ROOT=wowa] → 이 change는 로컬 DOCS_ROOT 주입으로만 검증(라이브 미반영, 기존 change 동일 제약). 검증 서버는 PID 지정 kill.

## 화면 구성 / UI

- 화면 구조·흐름·이동의 명세는 `prototype.html`을 단일 출처로 한다(DESIGN.md 없어 와이어프레임). 이 HTML은 명세이지 구현물이 아니다 — web(React)으로 같은 화면·흐름을 번역해 구현한다.
- 핵심 화면: skeleton 단계 PRD 섹션 위 "제안 N건" 배너 → 섹션별 제안 카드(현재 vs 제안 대비) → 개별 [승인]/[반려] + 하단 일괄 → 제출 후 PRD 재렌더.

## 6b 전체 로드맵 (예광탄 검증 후 — 이 change 밖, 별도 change들)

예광탄(6a PRD)이 propose→apply→verify(실픽셀)→review→archive 통과하면, **같은 사이드카+승인 패턴**을 확장한다. 각각 별도 openspec change로 도그푸딩:

1. **6b-features**: 기능명세 트리 승인 — `features.suggestions.json`(요구사항/기능/상세기능 노드 단위 제안: add/replace/remove/속성변경). FeatureNode 트리를 읽기전용→승인 인터랙션(노드별 [승인]/[반려] + 일괄). writeDocsPlanningFeatures(트리→features.md 역직렬화, capability 키 보존). manyfast "채팅지시+트리승인" 대응.
2. **6b-userflow**: 유저플로우 재생성 승인 — 명세 `.md`(Mermaid)는 재생성 only(manyfast 정책). 제안=새 버전 `<group>-v(N+1).md` 후보를 `userflow.suggestions.json`에 담고, 승인 시 새 버전 파일 생성(폴더 버전 누적). 좌표 overlay는 기존 드래그 저장 유지. manyfast "노드 직접편집+재생성" 중 재생성 승인부.
3. **6b-wireframe (옵션)**: planning 와이어프레임 렌더 자체가 부재 → 먼저 렌더(빌더+라우트+web) 구축 후 재생성 승인. 큰 작업이라 최후순위.
4. **스킬 확장**: 각 산출물 제안 생성 절차를 SKILL.md에 순차 게이트로 확장(6a에서 PRD만, 6b에서 features/userflow).

**공통 재사용 축**: (a) 사이드카 제안 큐 JSON(`<산출물>.suggestions.json`) (b) POST apply 라우트(approve/reject id) (c) writeDocs<산출물>(역직렬화) (d) skeleton 단계 승인 인터랙션 (e) SSOT="승인 없이 불변" 불변식. 6a가 이 5축의 레퍼런스 구현이 된다.

## Open Questions

<!-- 없음. 편집범위(PRD만)·방식(사이드카 큐)·저장위치(명세 옆 JSON)·6b 로드맵 모두 사용자 확정(2026-07-01). -->
