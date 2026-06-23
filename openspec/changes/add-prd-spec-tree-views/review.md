# 배포 전 최종 검토 — add-prd-spec-tree-views
검토일: 2026-06-23 / 검토 범위: 이 change의 diff(85134ad..HEAD) 17개 파일 — shared/src/{prd-types,spec-tree-types,index}.ts, server/src/parser/{markdown,prdBuilder,specTreeBuilder}.ts + 테스트, server/src/routes/graph.ts, web/src/{PrdPanel,SpecTreeNode,specTreeAdapter,api,App}.tsx, web/src/styles.css. (전체 앱 아님)

> 실증 검증: openspec-verify 스킬 미실행(verify.json 없음). 대신 build(shared→server→web PASS)·test(31 PASS, 골든 동치 포함)·API 시나리오(PRD 5섹션 매핑·빈 섹션 표면화·404/경로조작 차단)·브라우저 실렌더(PRD 5섹션 문서, 기능명세서 52노드 트리 31 WHEN/THEN)를 직접 수행해 받아들임 기준을 검증함. 적대적 리뷰는 self-review 함정 방지를 위해 별도 세션(code-reviewer 에이전트)이 수행.

## 반드시 수정해야 할 항목
- 없음 (critical 0건. 보안 XSS·경로탈출·에러 경로노출 전항목 클린)

## 수정하면 좋은 항목
- **[해결됨] change 전환 시 stale 상태 플래시** (`web/src/App.tsx`): change 선택 useEffect가 이전 상태를 초기화하지 않아, 새 데이터 fetch 완료 전 직전 change의 PRD/기능명세서가 순간 잔류. 파괴자+UX 2페르소나 중복 지적(심각도 상승). → 본 검토 후 useEffect 초입에 `setPrd(null)`/`setSpecRoot(null)`/`setSpecNodes([])`/`setSpecEdges([])` 초기화 추가로 해결.
- **[해결됨] PRD 탭 로딩 중 빈 화면** (`web/src/App.tsx`): prd가 null이면 아무것도 안 보임(정상 로딩 중 피드백 없음). → "불러오는 중…" 플레이스홀더 추가로 해결.
- **[유지] 동기 IO(readFileSync/readdirSync)**: prdBuilder/specTreeBuilder가 동기 IO. 단 기존 iaBuilder/graphBuilder/wireframeBuilder와 100% 동일 패턴이고 개인 단독·소규모 spec 환경이라 실질 병목 아님. 향후 async fs 일괄 전환 시 함께.

## 현재 상태로 유지해도 되는 항목
- **경로조작 차단**: `resolveChangeDir`이 라우터 진입 전 `..`+비허용문자 차단. 빌더는 검증된 dir만 받고 파일명은 하드코딩 리터럴이라 추가 조작 불가.
- **심볼릭링크 미차단**: realpath 미호출이나 OPENSPEC_ROOT 쓰기권한이 필요한 관리자급 공격 + 기존 파서 동일 설계. 개인 도구라 실질 위협 없음.
- **`화면 구성 / UI` 한국어 헤더 매핑**: design.md D1 표에 명시된 의도. 없는 프로젝트는 target 섹션 empty 표면화(=지어내지 않음 원칙과 일치).
- **PrdPanel XSS 안전**: dangerouslySetInnerHTML 미사용. renderInline/renderMarkdown이 텍스트를 React 노드로 자동 이스케이프. `[^*]+` ReDoS-free 확인.
- **에러 경로 노출 없음**: safe-error가 상세를 stderr에만, 클라이언트엔 일반 메시지.

## 리팩토링 추천 항목
- **PRD 매핑 테이블 상수화**: buildPrd 내 인라인 배열 → 함수 외부 `PRD_SECTION_MAP` 추출 시 헤더 추가 위치 명확.
- **연속 표 줄 버퍼링**: PrdPanel이 표 줄을 1줄씩 `<pre>`로 분리 렌더 → listBuffer처럼 tableBuffer로 묶으면 자연스러움. (실데이터 영향 작음)
- **노드 크기 상수 단위 주석**: specTreeAdapter NODE_W=240/H=48/96에 `// px, CSS .spec-tree-node와 일치` 주석.

## 적대적 검토 (3 페르소나)
- **파괴자**: change 전환 시 이전 PRD/트리 stale 플래시(setPrd(null) 미호출). 데이터 유실 아닌 UI 플래시. → 해결함. 그 외 빈 디렉토리·undefined 캡처그룹·거대 입력은 가드/이스케이프로 안전.
- **신입 개발자**: 노드 크기 매직넘버 단위 주석 부재, `metrics=성공지표`인데 소스가 Risks/Open Questions라 매핑 의도 주석 권장. 치명 아님.
- **보안 감사자**: XSS 벡터 없음, 경로탈출 없음, 에러 경로노출 없음 — 전항목 클린(깨끗함 근거 명시).
- 2+ 페르소나 중복 발견(심각도 상승): **stale 상태 플래시**(파괴자+UX). critical 미달(데이터 오염 아닌 UI) → "수정하면 좋은"으로 분류, 본 검토 후 해결.

## 최종 배포 가능 여부
**배포 가능** — critical 0건, 보안 클린. 2페르소나 중복 지적된 stale 플래시 및 로딩 피드백은 본 검토 직후 수정 반영(저비용·기존 탭에도 있던 패턴 개선).

## 개선 우선순위 (제안)
1. change 전환 stale state 초기화 — 잘못된 데이터 순간 표시 UI 버그, 2페르소나 중복. (해결됨)
2. PRD 로딩 피드백 — 빈 화면 대신 "불러오는 중…". (해결됨)
3. PRD 매핑 테이블 주석/상수화 — 6개월 뒤 유지보수성. (선택)
4. 연속 표 줄 버퍼링 — 시각 다듬기. (선택)
