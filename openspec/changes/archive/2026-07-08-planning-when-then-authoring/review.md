# 배포 전 최종 검토 — planning-when-then-authoring
검토일: 2026-07-08 / 검토 범위: 이 change 커밋(7e52580·9d04d10·86064af·81fd2a7) — `shared/feature-tree-types.ts`(when/then 필드)·`server/parser/featureTreeBuilder.ts`(RE_WHEN/RE_THEN)·`web/featureTreeAdapter.ts`(전달)·`docs/planning/features.md`(도그푸딩). `FeatureDetailPanel.tsx`는 무수정(이미 렌더). 앱 전체 아님.

> ⚠️ **note**: 러너 review 서브프로세스가 산출물 없이 exit 1로 죽어(세션 한도/외부 kill 추정), 본체가 직접 리뷰함(작업트리 점검 후 마무리 — 서브에이전트 한도 폴백대로).

## review criteria brief
- changeTypes: **backend(파서)+frontend(어댑터 전달)+doc(features.md)**, 신규 렌더 UI 0
- criteria: 1·2·5·6·8·9·10 in · 3 out(N+1·락 없음, 정규식 1회) · 4·7 out(신규 화면 0 — 기존 패널 데이터만)
- ruleSets: resolvedFrom `~/.claude/rules/` · selected 10-coding-style·20-testing · absent 없음
- designYardsticks: D-1(memo 복제·첫 매치)·D-2(additive 옵셔널)·D-3(어댑터 전달·패널 무수정)·D-4(featureTreeBuilder만)·D-5(도그푸딩) / nonGoals 와이어 요소·에지케이스 자동소비·AI 제안
- specsVerifyFocus: verify PASS 6/6(표시·한쪽만·부재 회귀)
- adversarialScope: full change scope (NOT narrowed)

## 반드시 수정해야 할 항목
- 없음

## 수정하면 좋은 항목
- 없음(memo 선례의 정확한 복제 — 신규 위험 표면 0).

## 현재 상태로 유지해도 되는 항목
- **memo 동형 파싱** — `featureTreeBuilder.ts:121-124` RE_WHEN/RE_THEN이 memo(:117)와 같은 귀속 규칙(직전 헤더 노드·빈 값 무시·첫 매치만 `current.when === undefined` 가드). capability 주석보다 뒤 매칭이라 접두어 분리로 `<!-- capability: -->` 미삼킴.
- **additive 옵셔널** — `feature-tree-types.ts:47-48` `when?`/`then?`, 어댑터가 `when !== undefined`일 때만 전달(:156-157) — 없으면 노드 data에 필드 자체 없음(회귀 0, verify "부재" 시나리오 PASS).
- **패널 무수정** — `FeatureDetailPanel`은 이미 `(when || then)`일 때만 렌더(D-3). 신규 컴포넌트·CSS 0.
- **라이브 grounding** — 재배포 후 `/api/docs/flowforge/planning-features`에 도그푸딩 2건(when="기획 탭 클릭"/then="5종 뷰 로드" 등) 실재 확인.

## 리팩토링 추천 항목
- 없음.

## 적대적 검토 (4 페르소나)
- **파괴자**: 빈 값(`<!-- when:  -->`)·when만·then만·양쪽·부재 5케이스 verify RED로 커버. 정규식 `(.*?)` non-greedy + 첫 매치 가드라 중복 저작도 첫 것만(폭주 없음). **터지는 지점 없음.**
- **신입 개발자**: 주석에 memo 동형·귀속 규칙·D-1 근거 명시. RE_WHEN/RE_THEN 네이밍이 의도 그대로.
- **보안 감사자**: when/then은 features.md 저작 텍스트 → 상세 패널 표시. XSS? 상세 패널이 텍스트로 렌더(dangerouslySetInnerHTML 미사용 — 기존 필드와 동일 경로). 사용자 저작 로컬 문서라 인젝션 벡터 없음. **CLEAN.**
- **게으른 시니어**: memo 있는데 when/then 또 만든 게 중복? → **아님**(의미가 다름 — memo=자유 메모, when/then=구조화 동작 시나리오, 상세 패널이 별 섹션으로 렌더). 파서 로직은 memo 4줄 복제로 최소. 신규 UI 0. "안 짜도 될 코드" 없음.
- 2+ 페르소나 중복: 없음.

## 최종 배포 가능 여부

**배포 가능**

- verify PASS 6/6(표시·한쪽만·부재 전건), 테스트 390/390(when/then 신규 6, 회귀 0), 라이브 API grounding 확인. 치명 0. memo 선례의 정확한 복제라 신규 위험 표면 없음.
- design 결정(memo 복제·additive·패널 무수정·featureTreeBuilder만·도그푸딩) 전부 준수. manyfast 대조도 design.md에 명시(상세기능 레벨 구조화 = 받아들임기준의 세밀 버전).

## 개선 우선순위 (제안)
1. (후속·별도 change) ② 와이어 요소가 이 when/then을 소비 — "버튼(요소) → when 클릭 → then 이동"까지 한 화면에. manyfast "페이지 노드↔상세기능" 모델 참고.
2. (후속) 유저플로우 에지케이스가 then의 예외 경로를 소비.
