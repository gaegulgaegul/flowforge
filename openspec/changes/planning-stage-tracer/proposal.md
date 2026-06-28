## Why

OpenSpec(agentic-harness 포함)에는 manyfast식 "기획 산출물(PRD·기능명세·유저플로우·와이어)을 *생성*하는 workflow"가 없다. propose/explore/charter는 모두 개발 명세·생각·검증 단계이지 기획 산출물 생성이 아니다(=기획 1층의 빈칸). 그 결과 flowforge가 비추는 5종 뷰는 "진짜 기획"이 아니라 개발 명세(proposal.md)를 변환한 그림자다.

이 change는 그 빈칸을 채우는 새 단계(openspec-plan)의 **예광탄(tracer bullet)**이다. 기획 4종 전부가 아니라 **PRD 한 개**만 생성→flowforge 렌더까지 세로로 관통해, "스킬이 docs/planning/에 기획 산출물을 만들고 flowforge가 그 원본을 읽어 비춘다"는 핵심 구조가 실제로 서는지 최소 비용으로 증명한다. 가장 큰 구조 리스크는 "flowforge가 docs/planning/ 경로를 읽는가"이며, 이 change가 그것을 정조준한다.

## What Changes

- **openspec-plan 스킬 신설(예광탄 범위)**: PRD 5섹션을 생성해 `docs/planning/prd.md`에 쓰는 단계만. (기능명세·유저플로우·와이어·spec.md 변환은 이 change에서 제외)
- **PRD 산출 스키마**: manyfast 원형 5섹션 고정(개요·핵심가치·타겟·시나리오·성공지표·속성설정). 소스가 없는 섹션은 지어내지 않고 비어있음으로 표면화.
- **flowforge가 docs/planning/prd.md를 읽어 렌더**: 기존 `Prd` 타입·`PrdPanel`(5섹션 렌더)·`lib/docs.ts`·`resolveDocsDir`(경로안전)를 재사용. 새 컴포넌트/타입/경로안전 로직은 만들지 않고 배선만 추가.
- 저장 위치는 신규 디렉토리 `docs/planning/` — 기존 charter 상주문서(`docs/spec.md`, `docs/PRD.md`)와 분리한다. (`docs/PRD.md` ≠ `docs/planning/prd.md`)

### 의도적 제외 (이 예광탄 밖 — 다음 change)
- 기능명세서·유저플로우·와이어프레임 생성 (openspec-plan 나머지 단계)
- features.md → `docs/spec.md` 변환과 charter B등급 게이트 이식 (audit 호환)
- capability 키 기반 기획↔change 매핑 역방향 인덱스, drill-down
- 유저플로우/와이어 폴더 버전 누적
- flowforge 승인/반려 편집 UI (D3)
- openspec-wireframe 스킬, charter 스킬 폐기
- 외부 발행·배포

## Capabilities

### New Capabilities
- `planning-prd-generation`: openspec-plan 스킬이 PRD 5섹션을 생성해 `docs/planning/prd.md`에 쓰는 능력. manyfast 원형 5섹션 고정 스키마, 빈 섹션은 지어내지 않고 표면화.
- `planning-prd-view`: flowforge가 `docs/planning/prd.md`를 읽어 기존 PrdPanel로 PRD 5섹션을 렌더하는 능력. `GET /api/docs/:project/planning-prd` 라우트, 경로조작 차단, 기존 Prd 파서 재사용.

### Modified Capabilities
<!-- 없음 — 기존 standing spec(openspec/specs/)의 요구사항을 바꾸지 않는다. flowforge의 PRD 빌더는 확장(신규 함수 추가)이지 기존 change-PRD 동작 변경이 아니다. -->

## Impact

- **agentic-harness 소스**(`/home/gaegul/agentic-harness/plugins/agentic-harness/skills/openspec-plan/`, 캐시 아님): SKILL.md 신설.
- **flowforge server**: `server/src/parser/prdBuilder.ts`(확장: `buildDocsPlanningPrd`), `server/src/routes/docs.ts`(신규 라우트), `server/src/lib/docs.ts`(기존 readDocsFile/resolveDocsDir 재사용).
- **flowforge web**: `web/src/api.ts`(fetchDocsPlanningPrd), `App.tsx`(호출·전달), 기존 `PrdPanel.tsx` 재사용.
- **환경변수**: `DOCS_ROOT`(기존) 사용.
- **데이터/안전**: `docs/planning/`는 신규 디렉토리(기존 charter docs 무수정). flowforge 자체에 도그푸딩용 `docs/planning/prd.md` 신규 생성. 비가역·외부발행 없음.
