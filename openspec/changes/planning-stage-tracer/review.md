# 배포 전 최종 검토 — planning-stage-tracer
검토일: 2026-06-28 / 검토 범위: 이 change의 diff만 —
- agentic-harness: `skills/openspec-plan/SKILL.md`(신설, PRD 생성 단계만)
- flowforge server: `server/src/parser/prdBuilder.ts`(buildDocsPlanningPrd 추가), `server/src/routes/docs.ts`(planning-prd 라우트)
- flowforge web: `web/src/api.ts`(fetchDocsPlanningPrd), `web/src/App.tsx`(openProject 로드 + skeleton 렌더)
- 테스트: `docsPlanningPrd.test.ts`(4), `planningPrd.test.ts`(4)
- 도그푸딩: `docs/planning/prd.md`

> verify 입력: verify.json **최종 PASS** (8 scenario, server 8/8·web 6/6, edge 4req 충분, android/ios SKIPPED, archive 게이트 open). review는 재실행하지 않고 이를 판단 input으로 소비.

## 반드시 수정해야 할 항목
- 없음 (코드 리뷰 CRITICAL 0 / HIGH 0, verify FAIL 0·검증안함 0)

## 수정하면 좋은 항목
- **skeleton 화면 planningPrd 팝인 레이아웃 시프트** (`web/src/App.tsx:289` `{planningPrd && ...}`): capabilities가 먼저 도착해 skeleton 렌더 후 planningPrd가 늦게 들어오면 PRD 섹션이 나중에 끼어들며 시각적 점프. 기능 버그 아님(CONCERN). 로딩 자리 placeholder로 완화 가능 — 다음 단계.
- **404와 네트워크 에러 미구분** (`web/src/App.tsx:171-173` catch에서 둘 다 null): planning PRD 미작성(정상)과 실제 서버 장애를 같게 흡수 → 향후 디버깅 난이도. 예광탄 scope에선 수용 가능, 본구현에서 구분 고려.

## 현재 상태로 유지해도 되는 항목
- **경로조작 방어**: resolveDocsDir(`..` + 화이트리스트 `^[A-Za-z0-9_-]+$`) 재사용, 라우트가 그대로 통과(`routes/docs.ts:69-71`). verify에서 `..%2f` 404 실증. CLEAN.
- **XSS**: PrdPanel(`PrdPanel.tsx:4-15`)이 dangerouslySetInnerHTML 안 쓰고 텍스트 노드/`<strong>`만 → React 자동 이스케이프. 새 공격면 0. CLEAN.
- **에러 응답**: safe() 래퍼가 상세를 stderr에만, 클라엔 `{error}`만. 민감정보 노출 0. CLEAN.
- **fetch URL 인코딩 미적용**: 기존 fetchDocsGraph/Prd 등과 동일 관례 + 서버 화이트리스트가 비영숫자 차단이라 인코딩 필요 문자 자체가 없음. 일관성 유지.

## 리팩토링 추천 항목
- **buildPrd의 인라인 `make` 람다 ↔ 모듈 레벨 `makeSection` 통합** (`prdBuilder.ts:20-22` vs `:59-63`): 동일 로직이 두 곳. 이번 change 귀책 아님(buildPrd는 기존 코드)이나, 본구현 때 buildPrd의 make를 makeSection으로 교체하면 일관성↑. LOW.

## 적대적 검토 (4 페르소나)
- **파괴자**: planning PRD fetch가 capabilities와 경주 → 둘 다 같은 dashReqToken으로 가드, 늦은 응답은 토큰 불일치로 폐기(`App.tsx:165-193`). race 안전. 404/500 모두 catch→null로 graceful(서버 안 죽음). 터질 지점: 위 "팝인 레이아웃 시프트"가 유일(시각, 비치명).
- **신입 개발자**: planningPrd state·주석("기획 PRD 미작성 — 정상")이 의도를 설명. buildDocsPlanningPrd가 buildPrd와 분리돼 "change PRD vs planning PRD" 구분 명확. 숨은 가정 1개 = hasDocs가 charter 문서 요구(아래 보안감사자/한계와 중복) — 테스트 픽스처에 PRD.md를 둬서 문서화돼 있음.
- **보안 감사자**: 경로조작·XSS·에러노출 전부 기존 안전장치 재사용으로 막힘(위 CLEAN 3건). 인증/인가는 이 라우트가 읽기전용 공개 docs라 기존 정책과 동일. 새 인젝션 벡터 없음. rate limiting은 기존 docs 라우트와 동일(예광탄 범위 밖).
- **게으른 시니어**: 과잉구현 없음 — buildDocsPlanningPrd는 splitSections/sectionBody/makeSection 재사용(중복 0), web은 새 컴포넌트/타입 0(기존 PrdPanel·Prd 재사용), App.tsx 배선은 state 1개+fetch 6줄로 최소. "안 짜도 될 코드" 없음. (오히려 기존 make/makeSection 중복은 *기존* 코드라 이 change가 만든 게 아님.)
- 2+ 페르소나 중복 발견(심각도 상승): hasDocs charter 의존(신입·보안감사자·한계 모두 언급)이나 전부 CONCERN/수용가능 수준 — 심각도 상승해도 BLOCK 아님(다음 change 과제).

## 디자인 리뷰 (화면 작업 있음)
- 화면 작업 감지됨(App.tsx/PrdPanel 렌더, prototype.html 존재). DESIGN.md 없음 → 일반 휴리스틱.
- verify의 Playwright 실픽셀(verify-shots/planning-prd-render.png)로 관찰: PRD 5섹션이 기존 PrdPanel 다크테마로 일관 렌더, 콘솔에러 0. 새 UI 컴포넌트 없이 기존 스타일 재사용이라 시각 일관성 유지. UX 이슈 = 위 팝인 레이아웃 시프트(수정하면 좋음). criteria 4(UX)·7(반응형)은 기존 PrdPanel 재사용이라 신규 회귀 없음.

## 최종 배포 가능 여부
**배포 가능** — CRITICAL/HIGH 0, verify PASS, 보안 3종 CLEAN, 과잉구현 0. CONCERN 2건(팝인 시프트·에러 미구분)은 비치명·예광탄 수용 가능. 알려진 한계(hasDocs charter 의존)는 의도적 제외와 함께 다음 change 과제로 명시됨(예광탄 대상 flowforge는 charter 보유라 실동작 무영향).

## 개선 우선순위 (제안)
1. hasDocs에 planning/prd.md 인정 추가 — planning-only 프로젝트 지원(본구현 1순위, 매핑/기능명세 단계와 함께). 영향: 중.
2. skeleton planningPrd 로딩 placeholder — 팝인 시프트 완화. 영향: 소(UX).
3. 404 vs 네트워크 에러 구분 — 디버깅성. 영향: 소.
4. buildPrd make ↔ makeSection 통합 — 일관성. 영향: 소.
