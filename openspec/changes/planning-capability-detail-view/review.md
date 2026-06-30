# 배포 전 최종 검토 — planning-capability-detail-view
검토일: 2026-06-30 / 검토 범위: shared/src/dashboard-types.ts·index.ts, server/src/lib/capabilityIndex.ts, server/src/routes/projects.ts, web/src/api.ts, web/src/App.tsx, server 테스트 2파일 (이 change의 diff만 — 전체 앱 아님)

## 실증 검증 입력 (verify.json)
- verify 최종 판정 **PASS** (9/9 scenario, FAIL 0·검증 안 함 0·SKIPPED 2[android/ios 적용불가]). archive 게이트 open.
- server 6(런타임 curl + jest 152/152)·web 3(Playwright 실픽셀: 통합 화면 co-locate·빈 섹션 명시·5종 뷰 진입). edge-case 충분(N/A 사유 명시). verify.html grounding 통과(매핑 18행·이미지3 로드·콘솔에러0).
- review는 재실행하지 않고 이 실증 결과를 판단 입력으로 삼음.

## 반드시 수정해야 할 항목
- 없음 (CRITICAL 0. code-reviewer가 제기한 HIGH 2건은 보안 치명이 아니며 아래대로 보강 완료).

## 수정하면 좋은 항목
- **[해결됨] cap 파라미터 미검증** (`projects.ts:144,125`): `cap`이 화이트리스트 검증 없이 `byCapability.get(cap)`/`capabilityLabel`에 주입됐다. cap은 파일 경로로 전혀 안 들어가(메모리 Map 조회·라벨 폴백에만 사용) 경로조작 위험은 없으나, 빈/특수문자 cap도 200 빈 응답을 줬다. → `isValidCapKey`(`/^[A-Za-z0-9_-]+$/`) 추가, 두 라우트(`/:cap`, `/:cap/changes`) 진입부에서 미통과 시 400. 테스트 추가(특수문자 cap→400). **검증: 정상 cap 200·특수문자 400 실측, 테스트 152/152.**
- **[해결됨] App.tsx non-null assertion** (`App.tsx:331`): `d.features!.root` → `d.features && d.features.root.children.length > 0 ? d.features.root : null`로 narrowing. web typecheck PASS.

## 현재 상태로 유지해도 되는 항목
- **라우팅 순서** (`projects.ts:121,145`): `/:cap/changes`(먼저)와 `/:cap`(나중)는 세그먼트 수가 달라 충돌 없음. 적대 검증에서 `/capabilities/pay/changes`=changes route, `/capabilities/pay`=detail route 정확히 분리 실측. (code-reviewer가 "cap='changes'면 충돌"이라 했으나 분석 오류 — `/capabilities/changes`는 한 세그먼트라 `/:cap/changes`에 매칭 안 됨. 게다가 cap 검증이 영문 슬러그만 허용하므로 무관.)
- **거짓연결 0**: features 필터(`r.capability === cap` 글자단위), 유저플로우 마커(`RE_FLOW_CAP ^>\s*capability:\s*([A-Za-z0-9_-]+)\s*$` 줄앵커), changes(`byCapability` 재사용) — 전부 정확 비교. 적대 검증에서 Mermaid 노드 라벨 안 가짜 `capability:` 텍스트·줄 중간 `> capability:`(앞에 텍스트) 모두 오매칭 0 실측.
- **읽기전용**: 신규 쓰기 라우트 없음(GET만). docsDir=`join(dir,"docs")`는 resolveProjectDir로 검증된 안전 경로 기반, cap은 경로 미사용. `safe()` 래핑으로 내부 에러 미노출.
- **재사용**: indexFor/buildDocsPlanningFeatures/listDocsUserFlows/readDocsUserFlowSpec/featureTreeAdapter/PrdPanel·CapabilityChangeList 전부 재사용. 신규는 종합 함수 1개·라우트 1개·마커 스캔 헬퍼(한 줄 정규식)·web state·dead fetchCapabilityChanges 제거. design 의도(generation 무변경·PRD 섹션 분할 없음·docs 읽기전용·유저플로우 stem만) 준수.

## 리팩토링 추천 항목
- **[CONCERN] indexFor 요청마다 spec.md 재파싱** (`projects.ts:88-95`): 요청/프로세스 캐시 없음. 홈서버 단독·소규모라 실질 영향 낮음. 중기에 Map 캐시 검토(파일 watch 없이 가능). 이 change 밖 기존 동작이라 스코프 보류.
- **[CONCERN] RE_CAP 키 비표준 문자 허용** (`capabilityIndex.ts:17` `(.+?)`): charter spec.md의 capability 키에 공백 등 비표준 문자가 들어오면 `RE_FLOW_CAP`(영문 슬러그만) 매칭 실패→유저플로우 영구 미연결. 단 capability 키는 features.md/spec.md/change specs 디렉토리명 모두 영문 슬러그 규약이라 실제 발생 안 함. RE_CAP 강화는 기존 capabilityIndex 동작 변경(스코프 확대)이라 이 change에선 보류.

## 적대적 검토 (4 페르소나)
- **파괴자**: scanUserFlowCaps가 flow마다 readFileSync(N회 IO) — flow 수 많으면 비용. 단 프로젝트당 수~수십 개·읽기전용이라 비치명(design에 리스크 명시). features.md/유저플로우 없는 프로젝트→빈 구조 200(verify S4 실측). 빈 capability→세 섹션 빈 상태 명시(verify lonely 실측). race=dashReqToken 가드가 종합 fetch에도 적용(token 불일치 폐기) 확인.
- **신입 개발자**: RE_FLOW_CAP/scanUserFlowCaps/capFeatures 빈 트리 표면화 모두 주석으로 의도 설명. CapabilityDetail 타입 JSDoc 명확. 매직넘버·하드코딩 없음.
- **보안 감사자**: 경로조작=resolveProjectDir 화이트리스트 재사용(verify S5 404 실측), cap=화이트리스트 추가(보강), 읽기전용, 에러=safe() 래핑(verify S6 safe-4xx). XSS=PrdPanel dangerouslySetInnerHTML 미사용(features/유저플로우/change는 텍스트 렌더). 민감정보 로그 없음. rate limiting=홈서버 단독이라 N/A.
- **게으른 시니어**: 과잉구현 거의 없음 — 종합 함수는 byCapability 재사용·features는 filter 한 줄·유저플로우는 마커 스캔 한 줄. dead fetchCapabilityChanges는 제거함(안 짠 코드로 회귀). CapabilityChangeRef 타입은 응답 계약상 필요(인라인보다 공유 타입이 맞음). "안 짜도 될 코드" 없음.
- 2+ 페르소나 중복 발견(심각도 상승): 없음.

## 디자인 리뷰
- 화면 작업 있음(App.tsx capChanges 단계 통합 drill-down). DESIGN.md 없음 → 일반 휴리스틱. Playwright 실픽셀(verify)에서 features ReactFlow + 유저플로우 목록 + change 목록 co-locate 레이아웃 정상 렌더·콘솔에러0 관찰. skeleton 단계의 검증된 ReactFlow 패턴(nodeTypes 컴포넌트 밖) 재사용. DESIGN.md 미정의 — `/design-consultation` 권장(이 change 범위 밖).

## 최종 배포 가능 여부
**배포 가능** — CRITICAL 0, HIGH 2건은 보안 치명 아니며 cap 화이트리스트 보강으로 해소(테스트 152/152·정상200/특수400 실측). verify PASS(9/9)·grounding 통과. CONCERN 2건(indexFor 캐시·RE_CAP 강화)은 비치명·스코프 밖 후속 과제.

## 개선 우선순위 (제안)
1. (해결됨) cap 화이트리스트 검증 — 방어적 일관성, 빈/특수 cap 차단.
2. (해결됨) non-null assertion 제거 — strict 패턴 일관성.
3. (후속) indexFor Map 캐시 — 규모 커지면. 영향 낮아 비긴급.
4. (후속) RE_CAP 키 화이트리스트 강화 — 기존 capabilityIndex 스코프. 비표준 키 도입 시점에.
