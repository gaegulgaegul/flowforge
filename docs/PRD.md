# flowforge 제품 요구 문서 (PRD.md)
> owner: @gaegul
> 상주 문서 — "왜 이렇게 만들기로 했나"의 의사결정 이력. (openspec-charter 생성, manyfast 1번)
> **append 모드: 결정마다 아래에 쌓는다. 과거 항목 절대 안 덮음.** audit 대조 대상 아님(이력이라 현재 코드와 달라도 정상 — spec이 '지금 진실', PRD이 '왜 그렇게 됐나').

## decision: identity-hierarchical-dashboard
- date: 2026-06-24
- capability: (해당 없음)
- why: 단일 change 뷰어로는 "홈서버 프로젝트들을 한눈에"라는 진짜 목표를 못 채운다. A(change 시각화)와 B(charter docs 뷰어) 정체성이 갈려 있었다.
- what: flowforge를 "프로젝트 → charter 뼈대 → change 세부"로 파고드는 계층형 기획 대시보드로 재정의한다. A와 B는 경쟁이 아니라 포함관계(charter ⊃ change).
- success: 홈서버 프로젝트 전체가 카드 그리드 한 화면에 보이고, 클릭으로 뼈대→세부까지 도달한다.
- status: active

## decision: project-card-grid-landing
- date: 2026-06-24
- capability: (해당 없음)
- why: 지금 첫 화면이 곧장 한 프로젝트 안으로 들어가버려 "한눈에" 레이어가 없다.
- what: 최상위 랜딩을 홈서버 프로젝트 카드 그리드로 한다. 카드마다 [charter 유무 / change 개수 / audit 상태] 배지를 표시.
- success: 프로젝트 목록이 카드로 한눈에 보이고, 각 프로젝트 상태를 카드에서 바로 파악한다.
- status: active

## decision: show-all-projects-even-without-charter
- date: 2026-06-24
- capability: (해당 없음)
- why: charter 뼈대 가진 프로젝트가 거의 없다(flowforge·ssoksok 정도, wowa는 change만). charter 있는 것만 보이면 "한눈에"가 반쪽이다. "뼈대 없음"도 그 자체로 정보(=charter 만들어야 할 신호).
- what: change 있는 모든 프로젝트를 카드로 노출한다. charter 있으면 🦴뼈대 카드(클릭→뼈대 그래프), 없으면 "뼈대 없음·change N개"로 표시하고 클릭하면 change 목록으로 간다. (사용자 선택 1-a)
- success: 홈서버 프로젝트가 카드에서 하나도 누락되지 않는다.
- status: active

## decision: capability-change-link-via-specs-dir
- date: 2026-06-24
- capability: (해당 없음)
- why: 큰기획(capability)↔세부기획(change)을 무엇으로 잇느냐가 drill-down 핵심이다. 새 태그를 신설하면 기존 charter "불변ID" 원칙과 이중 진실이 생겨 거짓연결 위험이 있다.
- what: 연결은 charter에 이미 있는 불변ID를 활용한다 — change의 `specs/<capability>/` 디렉토리명 = docs/spec.md의 `## capability: <키>`를 글자단위 비교(set 멤버십). 새 필드를 만들지 않고, 이름 자동추측(유사도)도 금지한다. (A-2)
- success: capability↔change 연결에 거짓연결 0건. 기존 change 소급 작업 없음.
- status: active

## decision: korean-labels-source-priority
- date: 2026-06-24
- capability: (해당 없음)
- why: specs/ 디렉토리명·capability 키가 영문 슬러그라 화면에 그대로 띄우면 무슨 기능인지 모른다. 사용자는 한글 기능명으로 보길 원한다. 단 연결 키는 영문 유지해야 한다(한글로 바꾸면 불변ID·골든테스트가 깨진다).
- what: 화면 표시명만 한글로 한다. capability(뼈대) 한글명 = 출처1: docs/spec.md의 `## capability: 키 — 한글` 병기(charter가 진실의 원천). change(세부) 한글명 = 출처3: proposal.md의 사람이 쓴 한글 제목. 출처2(flowforge 내 키→한글 맵)는 한글이 아직 없는 옛 capability용 폴백. (출처 1+3, 2는 폴백)
- success: flowforge 모든 화면이 한글 기능명으로 보인다. 연결은 영문 키로 안전하게 유지된다.
- status: active

## decision: tracer-bullet-first
- date: 2026-06-24
- capability: (해당 없음)
- why: charter 시스템의 일관된 교훈 = "9종 동시구현=BDUF, 한 개 예광탄으로 가치부터 증명". (예광탄 우선)
- what: 첫 구현을 프로젝트 1개로 [카드→뼈대 그래프(한글)→capability 클릭→change drill-down] 세로 한 줄 관통으로 한다. 멀티프로젝트·폴백·옛 데이터·편집은 그 다음.
- success: 한 프로젝트 끝에서 끝까지 계층 drill-down이 실제 동작한다(grounding 확인).
- status: active
