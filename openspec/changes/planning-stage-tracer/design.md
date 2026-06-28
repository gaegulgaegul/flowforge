## Context

flowforge는 openspec change의 proposal/spec/design을 읽어 5종 뷰(PRD·기능명세·유저플로우·와이어·IA)로 비추는 조망 대시보드다. 그런데 그 원천은 **개발 명세**라, flowforge의 "PRD 뷰"는 진짜 PRD가 아니라 proposal.md를 PRD 형식으로 재배치한 그림자다.

이 문제를 풀기 위해 "OpenSpec에 manyfast식 기획 산출물 생성 단계(openspec-plan)를 신설한다"는 정의를 완료했다(전체 흐름: plan→wireframe→explore→propose→apply, charter는 plan에 흡수·audit 유지, 매핑은 capability 키, 저장은 docs/planning/). 이 change는 그 정의의 **예광탄**으로, 4종 중 PRD 하나만 "생성→flowforge 렌더"까지 세로로 관통해 핵심 구조가 서는지 최소 비용으로 검증한다.

**현재 상태(조사됨, file:line):**
- `server/src/parser/prdBuilder.ts:24` `buildPrd(changeDir)` — change의 proposal.md+design.md를 읽어 고정 5섹션 Prd 생성. docs/planning은 안 읽음.
- `server/src/lib/docs.ts:13` `docsRoot()`=`DOCS_ROOT ?? cwd`, `readDocsFile(docsDir, name)`(:67), `resolveDocsDir`(경로안전 `..` 차단).
- `server/src/routes/docs.ts:51` `GET /api/docs/:project/prd`는 PRD.md→DecisionTimeline 반환(다른 타입, web 미연결).
- `web/src/PrdPanel.tsx:113` `PrdPanel({prd})` — 5섹션 렌더(경량 마크다운, XSS 안전). `web/src/api.ts:109` `fetchPrd`.
- 이 서버에 Playwright 1.61.1 + chromium 헤드리스 설치됨(실픽셀 관찰 가능).

## Goals / Non-Goals

**Goals:**
- openspec-plan 스킬이 PRD 5섹션을 `docs/planning/prd.md`에 생성한다(예광탄: PRD 단계만).
- flowforge가 `docs/planning/prd.md`를 읽어 기존 PrdPanel로 렌더한다(기존 자산 재사용, 신규 컴포넌트/타입 0).
- "스킬→docs/planning/→flowforge 렌더" 세로 관통 + "flowforge가 docs/planning/ 읽기"(최대 구조 리스크) 실증.

**Non-Goals (의도적 제외 — 다음 change):**
- 기능명세서·유저플로우·와이어 생성, openspec-plan 나머지 단계.
- features.md → docs/spec.md 변환과 charter B등급 8게이트 이식(audit 호환).
- capability 키 매핑 역방향 인덱스·drill-down, 버전 누적(폴더 버전).
- D3 승인/반려 편집 UI, openspec-wireframe 스킬, charter 폐기.
- 외부 발행·배포, 라이브 서버 OPENSPEC_ROOT/DOCS_ROOT 운영 변경.

## Decisions

- **PRD 빌더를 확장(재사용) vs 새 빌더**: 기존 `buildPrd`의 5섹션 파싱 로직을 재사용하는 `buildDocsPlanningPrd(docsDir)`를 추가한다. 입력만 `docs/planning/prd.md`로 바뀌고 출력 타입은 동일한 `Prd`. → 새 PrdPanel/타입을 안 만들어도 렌더가 그대로 동작(게으름 위계: 기존 코드 재사용). 대안(완전 새 파서·새 컴포넌트)은 스키마가 같은데 중복이라 기각.
- **라우트 위치**: `GET /api/docs/:project/planning-prd` 신설(docs.ts). 기존 `/api/docs/:project/prd`(DecisionTimeline)와 응답 타입이 달라 경로를 분리한다. 경로안전은 기존 `resolveDocsDir` 재사용(`..` 차단). 대안(기존 /prd에 합치기)은 반환 타입 충돌이라 기각.
- **저장 위치 docs/planning/**: charter 상주문서(`docs/spec.md`·`docs/PRD.md`)와 물리적으로 분리. `docs/PRD.md`(charter, DecisionTimeline) ≠ `docs/planning/prd.md`(plan, 5섹션 PRD) — 이름이 비슷해 혼동 위험이 크므로 디렉토리로 격리.
- **스키마 = manyfast 원형 5섹션**: flowforge PrdPanel이 이미 이 스키마로 렌더 중이라 바꾸면 빌더가 깨진다. 원형 유지가 정답.
- **도그푸딩 입력**: flowforge 자체의 기획(이 "기획 단계 신설")을 PRD로 써서 `flowforge/docs/planning/prd.md`로 만든다 → verify의 실제 입력이 됨. flowforge가 openspec 도그푸딩 프로젝트인 정체성과 일치.

## Risks / Trade-offs

- [docs/planning/prd.md를 flowforge가 못 읽음(경로/루트 오설정)] → DOCS_ROOT 명시 기동 + curl 200 확인 + Playwright 실픽셀로 grounding. 정적 점검(파일 생성)으로 PASS 판정하지 않는다.
- [`docs/PRD.md`와 `docs/planning/prd.md` 혼동으로 charter 문서 오염] → 신규 디렉토리에만 쓰고, 빌더는 `planning/prd.md` 경로를 명시적으로만 읽음. 기존 docs/PRD.md 라우트는 무수정.
- [예광탄이 PRD만 검증 → 매핑/게이트/버전은 미검증] → 의도된 범위. 나머지는 같은 패턴 반복이라 구조 리스크 낮음. proposal "의도적 제외"에 명시.
- [라이브 flowforge.gaegul.house는 OPENSPEC_ROOT가 wowa를 가리킴] → 이 change는 로컬 검증만. 운영 배포는 범위 밖(Non-Goals).

## Migration Plan

- 신규 파일·라우트 추가만(파괴적 변경 없음). 롤백 = 추가한 함수·라우트·api·호출 제거로 원복.
- flowforge `docs/planning/prd.md`는 신규 생성(기존 파일 미변경)이라 삭제로 롤백.

## Open Questions

- 없음(예광탄 범위는 확정). 다음 change에서 정할 것: features.md 매핑 키 주입 방식, spec.md 변환 시 audit B등급 게이트 이식 순서, 승인/반려 UI 인터랙션 상세.

## 화면 구성 / UI

- 화면 구조·흐름의 명세는 `prototype.html`을 단일 출처로 한다(DESIGN.md가 없어 와이어프레임 골격으로 그려짐). **이 HTML은 명세이지 구현물이 아니다** — flowforge의 기존 `PrdPanel`(React)로 같은 화면(5섹션 PRD 렌더)을 번역해 구현한다. 이 예광탄에서 "화면"은 기존 PrdPanel 재사용이므로 신규 UI 컴포넌트는 만들지 않는다.
