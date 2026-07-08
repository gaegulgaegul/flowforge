# planning-when-then-authoring — design

## Context

`FeatureDetailPanel.tsx:73-74`가 이미 `node.when`/`node.then`을 읽고 `:199`에서 `(when || then)`일 때만 WHEN/THEN 섹션을 렌더한다(지어내지 않음). 서버 파서 `featureTreeBuilder.ts`는 `<!-- memo: … -->`(RE_MEMO:24)를 읽어 `FeatureNode.memo`에 싣는 선례가 있다 — 옵셔널·비파괴·정규식. WHEN/THEN은 이 memo 패턴의 복제로 완성된다(신규 렌더 UI 0).

### manyfast 대조 (설계 참고 — 항상 manyfast 벤치마킹, 명섭 지시)

manyfast 기능명세서는 **요구사항 노드에 "받아들임기준 체크리스트"**를 담고, **예외처리는 유저플로우가 아니라 별도 "개발 지침"(export .md)에 산문으로** 뺀다(reference_manyfast_spec §27·§57). 즉 manyfast의 "동작 명세"는 (a) 요구사항 레벨 받아들임기준 + (b) 다운스트림 산문 예외처리로 갈린다. 우리 WHEN/THEN은 **상세기능 레벨의 구조화된 동작 시나리오**라 manyfast보다 세밀하고 뷰 안에 남는다(산문 export로 빼지 않음) — 이건 에지케이스 자동분기 결정과 같은 결의 "우리가 앞서가는 지점". 다만 개념 정렬을 위해: 우리 WHEN/THEN은 manyfast "받아들임기준"의 **상세기능 레벨 구조화 버전**으로 위치시킨다(요구사항 체크리스트 → 상세기능 WHEN/THEN). 이렇게 두면 후속에서 요구사항 레벨 받아들임기준 롤업(자식 WHEN/THEN 집계)도 열려 있다.

## Goals / Non-Goals

**Goals:**

- 상세기능 노드에 WHEN/THEN을 저작하는 최소 문법 + 파싱 + 상세 패널 표시
- memo 선례와 동형(옵셔널·비파괴·featureTreeBuilder 내부만 — 다른 파서 무저촉)

**Non-Goals:**

- 와이어프레임 요소·동작(②, 별도 change) / 유저플로우 에지케이스 자동 소비 / AI 제안 생성(사람 저작이 원천)

## Decisions

- **D-1 문법 = memo 복제.** 노드 헤더 아래 `<!-- when: … -->` `<!-- then: … -->`. `RE_WHEN`/`RE_THEN`은 `RE_MEMO`와 같은 형태(`<!--\s*when:\s*(.*?)\s*-->`). capability/priority/memo와 네임스페이스 안 겹침(접두어 명시). 한 노드에 각 최대 1개(첫 매치).
- **D-2 필드 = additive 옵셔널.** `FeatureNode.when?`/`then?` — 없으면 필드 자체 없음(memo와 동일). 기존 노드·소비자 무영향. WHEN만 있고 THEN 없거나 그 반대도 허용(상세 패널이 각각 있을 때만 렌더).
- **D-3 web = 어댑터 전달만.** `featureTreeAdapter`가 when/then을 노드 data로 넘긴다. `FeatureDetailPanel`은 무수정(이미 렌더 코드 보유). 신규 컴포넌트·CSS 0(기존 `feature-detail-whenthen` 클래스 사용 중).
- **D-4 파싱 위치 = featureTreeBuilder만.** memo가 그 안에서 파싱되듯 when/then도 동일. 금지: 다른 파서(specParser/graphBuilder/screenRegistry) 무저촉.
- **D-5 도그푸딩.** flowforge features.md의 상세기능 1~2건에 실제 when/then 저작(예: "planning-features 라우트 조회" 상세기능에 when="탭 클릭", then="그 프로젝트 openspec에서 5종 뷰 로드") — 원천이 실재함을 라이브로 실증.

## Risks / Trade-offs

- 기획 문서가 무거워질 수 있음(상세기능마다 WHEN/THEN) — 옵셔널이라 강제 아님, 필요한 노드만 저작(memo와 같은 자율성). manyfast가 이걸 안 한 것과 대비되는 의도적 선택(사용자 결정 — "제 안대로").
- web 자동 테스트 러너 부재는 계승 — 파싱은 server jest, 상세 패널 표시는 verify 실픽셀.

## 화면 구성 / UI

- 신규 화면 0. 기존 상세 패널의 WHEN/THEN 섹션(⚡ 시나리오)이 데이터를 받아 실제로 뜨는 것뿐. 시각 기준 = 기존 `feature-detail-whenthen` 스타일.
