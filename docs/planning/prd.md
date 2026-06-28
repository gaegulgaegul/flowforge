> owner: @gaegul

# PRD: flowforge 기획 단계(openspec-plan)

## 개요
flowforge는 홈서버 프로젝트들을 한눈에 보는 계층형 기획 대시보드다. 그러나 flowforge가 비추던 5종 뷰의 원천은 openspec change의 개발 명세(proposal.md)라, "PRD 뷰"는 진짜 PRD가 아니라 개발 명세를 PRD 형식으로 재배치한 그림자였다. 이 기획 단계(openspec-plan)는 OpenSpec에 없던 manyfast식 "기획 산출물 생성 workflow"를 신설해, flowforge가 비추는 게 진짜 기획 산출물이 되게 한다. 목표는 아이디어→기획(PRD·기능명세·유저플로우·와이어)→개발 명세→구현이 하나의 체인으로 이어지는 것.

## 핵심가치
- **문제**: OpenSpec엔 기획 산출물을 *생성하는* 단계가 통째로 없다(1층 빈칸). 기획 정보는 spec/proposal에 흩어져 있고, flowforge는 그 그림자만 비춘다.
- **해결**: openspec-plan 스킬이 manyfast 원형대로 PRD→기능명세→유저플로우를 순차 게이트로 생성하고 docs/planning/에 저장한다. flowforge가 그 원본을 읽어 실체로 렌더한다.
- **차별점**: manyfast는 기획 SaaS(생성 후 MCP로 외부 개발 연동)이고 OpenSpec은 명세 기반 개발 프레임워크인데, 이 단계는 둘을 잇는다 — 기획 산출물이 capability 키로 개발 change와 매핑되고, 끝단에서 audit이 코드와 대조하는 spec.md로 변환된다(charter 흡수). 개인 워크플로우 전용이라 인증·결제·멀티테넌시는 버린다.

## 타겟·시나리오
- **사용자**: flowforge를 운영하는 단독 개발자(홈서버 24시간 상주, openspec 도그푸딩).
- **시나리오**: 새 기능 아이디어가 생기면 openspec-plan으로 PRD를 먼저 쓴다 → 기능명세·유저플로우로 구체화 → propose가 기능 하나씩 change로 변환 → apply로 구현. flowforge 대시보드에서 프로젝트 카드를 열면 그 프로젝트의 기획 PRD가 보이고, capability를 따라 내려가면 그 기획이 어떤 change로 구현됐는지 드릴다운된다.

## 성공지표
- flowforge가 docs/planning/prd.md를 읽어 PRD뷰로 5섹션을 렌더한다(그림자 아닌 실체). ← 예광탄 성공 기준.
- PRD→기능명세→유저플로우→와이어가 capability 키로 change와 매핑돼, "이 기능 = PRD 섹션 + 유저플로우 + 구현 change들"이 한 화면에 묶인다.
- 리스크: charter 흡수 시 audit B등급 게이트(라인문법·metric 강제 등)를 빠뜨리면 audit이 깨진다. 오픈이슈: 기능명세 이후 단계(유저플로우/와이어 생성, spec.md 변환)는 다음 change에서 구현.

## 속성설정
- **카테고리**: 개발 도구 / 기획 대시보드 (개인용, 비-SaaS).
- **사용자 역할**: 단독 운영자(@gaegul) — 기획 작성·검토·승인/반려를 모두 수행.
- **서비스 환경**: 홈서버(flowforge.gaegul.house), TypeScript(server Express + web React/ReactFlow), 파일 기반(docs/planning/ 읽기·overlay JSON 쓰기), openspec 도그푸딩.
