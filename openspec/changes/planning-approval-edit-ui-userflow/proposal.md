# 6b-userflow — 유저플로우 승인 편집 (에지 추가 예광탄)

## Why

6b 승인 루프(AI가 사이드카 큐에 제안 → 화면에서 승인/반려 → 승인분만 기획 문서에 반영)는 PRD(6a)·기능명세 속성(6b-features)까지 구현됐지만, 유저플로우는 여전히 읽기 전용이다(드래그 좌표 저장만 가능, 문서 편집 경로 없음). 로드맵 ③의 사용자 확정 범위다(2026-07-05 명섭 1번 — 원천 있는 유저플로우 먼저, 와이어프레임은 원천 부재로 별도 논의).

편집 단위는 features와 다르게 잡아야 한다. features.md는 노드마다 독립 속성 줄이 있어 제자리 교체가 안전했지만, 유저플로우 Mermaid는 **에지 줄에 노드 정의가 인라인**돼 있고(노드 라벨의 원천 = 그 노드가 처음 정의된 줄) 한 줄에 노드·에지가 혼재한다 — 기존 줄을 수정/삭제하면 다른 에지가 쓰는 노드 정의가 사라질 수 있다. 그래서 예광탄은 **에지 추가(append)만** 한다: 기존 줄은 한 줄도 건드리지 않으므로 인라인 정의 문제가 원천 차단되고, 라인 단위로 결정론 패치가 된다.

이 선택은 다음 단계와 맞물린다: 안2 확정 결정 ③(유저플로우 에지케이스 자동 분기)의 2단계 = "AI 추론으로 예외 분기를 **제안**"인데, 그 제안이 흘러들 승인 파이프가 바로 이 change다(에지케이스 점선 에지 추가 제안 → 사람 승인 → 문서 반영).

## What Changes

유저플로우 문서(docs/planning/user-flow/<stem>.md)에 대한 에지 추가 제안 큐와 승인 UI를 만든다.

- **제안 스키마(shared)**: `UserFlowSuggestion` — `{ id, op: 'add-edge', from(기존 노드 id), to(기존 노드 id) 또는 newNode { id, label }(신규 화면 노드 인라인 정의), edgeKind: 'happy'|'edgecase', label?, rationale? }`. 큐 = `docs/planning/user-flow/<stem>.suggestions.json`(overlay.json과 같은 per-stem 사이드카 패턴).
- **큐 조회/apply 라우트(server)**: `GET .../planning-user-flow-suggestions?flow=<stem>`(부재=빈 큐 200), `POST .../planning-user-flow-suggestions/apply?flow=<stem>` — 6a/6b-features의 `PrdApplyRequest`/`PrdApplyResult` 재사용, 승인분만 Mermaid 코드블록 끝(닫는 ``` 직전)에 에지 줄 append.
- **결정론 검증(적용 전)**: from 노드 존재, to 노드 존재 또는 newNode 동반(id 토큰 `[A-Za-z0-9_]+`·기존 id와 충돌 금지), label에 `"`·`|` 금지(Mermaid 문법 파괴 차단). 위반은 해당 제안만 `skipped`로 표면화.
- **self-roundtrip 방어(D5 계승)**: append 후 재파싱해 (a) 파싱 성공 (b) 기존 노드 전부 보존(라벨 동일) (c) 기존 에지 무손상 (d) 새 에지가 제안대로 존재 — 하나라도 깨지면 422, 원본 보존, 큐 유지.
- **승인 패널(web)**: `UserFlowApprovalPanel` — 유저플로우 탭 그래프 위에 배치(6b-features와 동일 자리·UX): from→to·실선/점선·라벨·rationale 카드, 개별/일괄 승인·반려, 적용 후 그래프·큐 재조회.

**Non-Goals**: 에지 삭제·수정, 노드 라벨 수정(인라인 정의 SSOT 문제 — 라인 범위 추적 도입 후 별 change), 에지케이스 자동 **생성기**(결정 ③ 2단계의 제안 생산자 — 이 change는 소비 파이프만), 와이어프레임(원천 부재 — 별도 논의), newNode의 화면 외 모양(start/action/section — 예광탄은 화면 box만), overlay/드래그 저장 경로 변경(무관·무손상).

## Capabilities

### New Capabilities
- `planning-userflow-approval-edit`: 유저플로우 문서에 대한 에지 추가 제안을 사이드카 큐로 받고, 승인분만 결정론 검증 + self-roundtrip 방어를 거쳐 Mermaid에 append 반영하는 능력. 반려·검증 위반은 문서를 건드리지 않는다.

### Modified Capabilities
<!-- 없음. planning-userflow-view(읽기 그래프)·overlay 저장은 무변경 — 승인 편집은 additive 신규 능력. -->

## Impact

- **신규 shared**: `user-flow-suggestion-types.ts`(`UserFlowSuggestion`·큐 타입). 기존 `PrdApplyRequest/Result` 재사용(신규 요청/응답 타입 없음 — [[feedback_api_contract]] 일관).
- **신규 server**: `lib/userFlowDocs.ts`(큐 읽기·검증·append·self-roundtrip), `routes/docs.ts` 라우트 2개.
- **신규/수정 web**: `UserFlowApprovalPanel.tsx` 신설, `api.ts` fetch/apply 2개, `App.tsx` flow 탭 배선(로드·콜백·재조회).
- **수정 테스트**: userFlowDocs 단위(검증·append·방어·무력화 프로브), 라우트 통합(큐 조회·apply·422·404), 기존 회귀 0.
- **🔴 수정 금지**: `planningUserFlowBuilder.ts`(파서 — 재파싱에 소비만)·`graphBuilder.ts`·`specParser.ts`·`flowBinder.ts`·`__golden__/`·기존 `planning-user-flow` GET/PUT 응답 스키마·유저플로우 .md 원문(append 외).
- **의존성**: 신규 npm 패키지 없음.
- **소유 경계**: 제안 큐 생산자는 AI/스킬(범위 밖), flowforge는 큐 소비·승인 반영만.
