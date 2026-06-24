# flowforge 발견 로그 (discovery-log.md)

> owner: @gaegul
> 상주 문서 — "이 기능을 왜 만들기로/안 만들기로 했나"의 이력. (openspec-charter 생성)
> append 모드: 가설마다 아래에 쌓는다. 과거 절대 안 덮음. audit 대조 대상 아님(코드와 비교할 게 없음).
> §9 #5: propose 전 discovery 게이트. prototype은 구현 약속이 아니라 가설 검증 도구.

## hypothesis: link-by-name-similarity
- status: killed
- claim: change↔capability를 이름 유사도로 자동매칭하면 공짜로 연결할 수 있다.
- evidence: 오늘(2026-06-24) 대화 검토.
- verdict: 영↔한 사전이 필요하고 거짓연결 위험이 있다. charter "거짓✅ 금지" 원칙과 충돌 → 버림. 대신 specs/ 디렉토리명 불변ID를 채택(capability-change-link-via-specs-dir).
- date: 2026-06-24

## hypothesis: link-by-new-tag
- status: killed
- claim: proposal.md에 `capability:<부모키>` 새 줄을 박아 capability↔change를 명시 연결한다.
- evidence: 조사로 specs/ 디렉토리명 불변ID를 발견.
- verdict: specs/ 디렉토리명과 이중 진실 위험 → 이미 검증된 불변ID(A-2)로 대체. 단 "흡수 시 specs/ 디렉토리명을 기존 키와 정확히 맞추라"는 SKILL 명문화는 살린다. (A-1, A-2로 대체)
- date: 2026-06-24

## hypothesis: source-toggle-flat
- status: killed
- claim: charter docs와 change를 소스토글로 나란히 평면 배치한다.
- evidence: 오늘 대화에서 사용자가 정의한 정체성 검토.
- verdict: 사용자가 정의한 포함관계(charter⊃change)와 안 맞음 → 계층 drill-down으로 대체.
- date: 2026-06-24

## hypothesis: charter-only-cards
- status: killed
- claim: 카드에 charter 있는 프로젝트만 노출한다.
- evidence: 홈서버 프로젝트 현황 검토(wowa는 change만 있음).
- verdict: change만 있는 프로젝트(wowa)가 누락되어 "한눈에"가 반쪽이 됨 → show-all-projects-even-without-charter(1-a)로 대체.
- date: 2026-06-24

## hypothesis: node-click-destination
- status: parked
- claim: change 노드 클릭 종착지를 무엇으로 할지. 후보 2-a(기존 5종 뷰 그대로)/2-b(유저플로우만)/2-c(capability 패널 멈춤).
- evidence: 미검증 — 정적 HTML 목업 비교 예정.
- verdict: 사용자가 "세 안을 화면 목업으로 비교한 뒤 결정"하기로 함 → 보류. 구현 전 정적 HTML 3개를 비교한다.
- date: 2026-06-24
