# 배포 전 최종 검토 — planning-features-generation
검토일: 2026-06-28 / 검토 범위: shared(`feature-tree-types.ts`·`index.ts`), server(`featureTreeBuilder.ts`+test·`routes/docs.ts`+test), web(`FeatureNode.tsx`·`featureTreeAdapter.ts`·`App.tsx`·`api.ts`·`styles.css`), agentic-harness(`openspec-plan/SKILL.md`), 도그푸딩(`docs/planning/features.md`). 커밋 f0a9da3~574dd3c + d75d573.

> 역할 분리: 실증은 openspec-verify(verify.json) — 최종 PASS, 11 scenario 전부 PASS, FAIL/검증안함/검증불충분 0 = **cleanly verified**. review는 재실행하지 않고 그 결과를 판단 입력으로 쓴다.
>
> changeTypes: **backend**(server·shared) + **frontend**(web FeatureNode/adapter, prototype.html) + **doc**(SKILL.md, features.md). criteria 전부 in-scope.
> code-reviewer 위임 결과 병합: CONCERN 2건(아래 처리), 나머지 CLEAN(id 고유성·비정상 깊이·분리 위반 없음·경로조작·race 가드·빈문자열·dagre).

## 반드시 수정해야 할 항목
- 없음. verify 최종 PASS, 보안(경로조작 resolveDocsDir 재사용)·분리(SpecTree diff 0줄) 회귀 없음. critical 0.

## 수정하면 좋은 항목
- **[해결됨] RE_ATTRS 본문 산문 오매칭** (`featureTreeBuilder.ts:84`, code-reviewer CONCERN). `(중요도:…, 상태:…)` 패턴이 본문 산문 중간에 있어도 속성으로 오매칭하던 문제 → 정규식에 줄 시작·끝 앵커(`^…$`) 추가로 해결, 회귀 테스트 추가(커밋 574dd3c). 발화 확률은 낮았지만(스킬이 스키마대로 생성) 저비용 견고성 개선이라 즉시 반영.

## 현재 상태로 유지해도 되는 항목
- **(기준1·2 유지보수/과잉구현)** featureTreeBuilder는 markdown.ts가 ###/#### 위계를 못 잡아 직접 라인 스캔(design 결정2). slug는 specParser 재사용, 새 의존성 0. dagre는 specTreeAdapter 복제(design 결정3 — 공유 추출 안 함이 분리 유지). 게으른 시니어 관점에서 dagre 중복은 *의도된* 분리 비용(결정1)이라 과잉구현 아님.
- **(기준6 보안)** featureTreeBuilder가 받는 docsDir은 resolveDocsDir 통과한 안전 경로, `join(docsDir,"planning","features.md")`는 고정 하위경로(사용자 입력 추가 없음). 라우트는 GET만(쓰기 0). 경로조작 404 테스트·민감정보 미노출(safe) 확인.
- **(기준3 병목)** 단일 features.md 파싱(라인 스캔 O(n)), dagre는 수십 노드 규모(도그푸딩 17노드). N+1·락·외부동기호출 없음.
- **(기준4·7 UX/반응형 — 디자인 리뷰 병합)** Playwright 실픽셀 관찰: 기능명세 트리가 3단 위계(요구사항 파랑→기능 주황→상세기능 회색) dagre LR로 그려지고, priority/status 뱃지·capability 칩 표시, 콘솔에러 0. DESIGN.md 없어 일반 휴리스틱(kind별 색 구분 명확, 칩 가독). prototype은 와이어프레임. `.dash-feature-flow` 고정 높이 480px — 작은 화면에선 스크롤(허용). DESIGN.md 정의 시 `/design-consultation` 권장.
- **(기준5 예외)** 파일없음→null→404, 비정상 헤더 깊이→throw 없이 가장 가까운 조상에 매닮, 빈 파일→빈 children. FeatureNode 빈 priority/status/capability 미렌더, 알 수 없는 kind 폴백.
- **(분리 전략 입증)** featureTreeAdapter/FeatureNode가 SpecTree 타입·specTreeAdapter import 0(code-reviewer 확인). change spec-tree diff 0줄, 테스트 회귀 0.

## 리팩토링 추천 항목
- 없음(권장 안 함). dagre 중복은 분리 유지 비용으로 의도됨(결정3). 공유 추출하면 결합 재발 → 하지 않음.

## 적대적 검토 (4 페르소나)
- **파괴자 (Saboteur)**: ①본문 산문 속성 오매칭 → **수정 완료**(앵커). ②헤더 레벨 건너뜀(## 다음 ####) → throw 없이 요구사항 직하 detail로 매닮(safe, 테스트 확인). ③capability 주석이 여러 줄 떨어져 있어도 다음 헤더 전까지 매칭 — 스키마는 헤더 직후지만 본문에 capability 주석 쓸 일 없어 무해. ④동시성: 순수 읽기(공유상태 없음) race 불가, web은 dashReqToken 가드.
- **신입 개발자 (New Hire)**: featureTreeBuilder docstring에 문법 스키마·markdown.ts 미지원 이유·MutableNode→freeze 의도 명시. RE_ATTRS 앵커에 수정 근거 주석. 매직값은 KIND_BY_LEVEL/정규식으로 명명. id 생성식이 다소 빽빽하나 주석으로 보완 가능(LOW). 6개월 뒤 읽힘.
- **보안 감사자 (Security Auditor)**: 공격면=project 파라미터뿐, resolveDocsDir 화이트리스트+`..` 차단이 빌더 호출 전 선행. features.md 내용은 텍스트 파싱만(eval/실행 없음), capability 키는 `[A-Za-z0-9_-]`로 제한(주입 불가). XSS: FeatureNode가 label/capability를 React 텍스트로 렌더(dangerouslySetInnerHTML 안 씀) → 이스케이프됨. 민감정보 미노출.
- **게으른 시니어 (Lazy Senior)**: ①FeatureTree 전용 타입·렌더는 사용자 확정 결정(B 분리)이라 YAGNI 통과. ②markdown.ts splitSections 재사용 검토했으나 ###/#### 미지원이라 직접 스캔 불가피(중복 아님). ③dagre 중복은 결정3의 의도된 비용. ④slug·specParser 재사용. **불필요하게 부풀린 코드 없음** — 단 dagre 공유 추출 유혹을 의도적으로 거부한 것이 정답(결정1 위배 방지).
- 2+ 페르소나 중복 발견(심각도 상승): RE_ATTRS 오매칭을 파괴자·code-reviewer 둘 다 지적(심각도 상승 대상이었으나 **이미 수정 완료**라 잔여 없음).

## 한계 (다음 change 후보)
- **hasDocs가 planning/features.md 단독 프로젝트 미인식** (code-reviewer CONCERN 2): features.md만 있고 prd.md 없는 프로젝트는 404. 단 이는 **design.md Non-Goals에 명시적 제외**("features.md 단독 인식은 필요해지면 별도 change") — openspec-plan은 PRD를 features보다 먼저 생성하므로 정상 경로엔 문제없음. 의도된 스코프 제외. 다음 단계(유저플로우/spec.md 변환)에서 hasDocs를 planning 산출물 전반으로 넓힐 때 함께 처리 후보.

## 최종 배포 가능 여부
**배포 가능.** 치명 0, verify 최종 PASS(cleanly verified), code-reviewer CONCERN 2건 중 1건(오매칭) 수정 완료·1건(hasDocs)은 design Non-Goals 명시 제외. 4페르소나 critical 0. design 결정 5개 전부 준수, 분리 전략(SpecTree 무수정) 입증.

## 개선 우선순위 (제안)
1. (다음 change) hasDocs를 planning 산출물 전반(features.md 등)으로 확장 — 유저플로우 단계와 함께. (영향: planning-only 프로젝트 범위, 중간)
2. (선택, 매우 낮음) featureTreeBuilder id 생성식에 한 줄 주석 추가. (가독성)
- 그 외 즉시 조치 항목 없음(RE_ATTRS는 이미 해결).
