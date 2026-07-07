# 배포 전 최종 검토 — panel-screen-deeplink
검토일: 2026-07-07 / 검토 범위: 이 change 의 diff 만 (전체 앱 아님) — `shared/src/ia-types.ts`, `server/src/parser/planningIaBuilder.ts`(+테스트), `web/src/iaAdapter.ts`, `web/src/FeatureDetailPanel.tsx`, `web/src/App.tsx`(`selectScreenInIa`), `web/src/styles.css`(`.feature-detail-screen`)

## review criteria brief (in-session)
- **changeTypes**: `frontend`(`.tsx`·`styles.css`·gstack 실픽셀·`prototype.html` 존재) + `backend`(server 파서 `planningIaBuilder.ts`+Jest). infra/doc 없음.
- **ruleSets**: resolvedFrom `~/.claude/rules/` — selected: `10-coding-style`(소스 변경), `20-testing`·`30-security`(backend), `60-design`·`70-adversarial-review`(frontend). absent: 없음.
- **criteria in/out**: 1·2·3·5·8·9·10 = in-scope. 4(UX/UI)·7(반응형) = in-scope(화면 칩 버튼화 = frontend). 6(보안) = in-scope but 저위험(순수 조회 `.find`, 서버 신규 노출 없음).
- **designYardsticks (design.md Decisions)**: D-1 매칭=server 원본 id 문자열 동치(slug 복제 금지) / D-2 이동=기존 상태 전이 재사용(신규 라우팅 없음) / D-3 실패=조용한 강등(탭 전환 없이 안내만) / D-4 iaAdapter 파생 전달. **Non-Goals**: 유저플로우/와이어 딥링크, IA→기능명세 역방향, slug 로직 공유화 — 구현이 전부 준수(오지적 방지).
- **specsVerifyFocus**: verify.json PASS 3/3, edge-case "충분". 단 "동시성: na" 근거가 *이미 로드된 빈 레지스트리* 케이스만 다루고 *fetch in-flight 창*은 미검증 → 아래 M-1 로 승격.
- **adversarialScope**: full change scope (NOT narrowed by this brief)

## 반드시 수정해야 할 항목
- 없음

## 수정하면 좋은 항목

- **M-1 (동시성 race) — IA fetch in-flight 창에서 거짓 "찾지 못했습니다".** `openProject`(App.tsx:429~505)에서 `fetchDocsPlanningIa`(→`planningIaRoot`, App.tsx:496-505)와 기능명세 fetch 가 **독립·비대기 병렬**이다. 기능명세 패널은 `planningFeatures` 도착 즉시 열리지만 `planningIaNodes`(초기 `[]`, App.tsx:148)는 IA fetch 가 늦으면 아직 빈 배열이다. 이 짧은 창에 사용자가 칩을 클릭하면 `selectScreenInIa`(App.tsx:351)가 빈 `planningIaNodes.find`로 무매칭 → **실제 존재하는 화면인데도** "IA에서 화면을 찾지 못했습니다"(App.tsx:354) 오안내. design.md Risk 에 "실사용 창 짧음"으로 감수된 항목이나, **verify.json 이 이 창을 실검증하지 않았다**(edgeCase.classes 의 "동시성: na" 근거는 *이미 로드된 빈 레지스트리* 케이스만 다룸 — in-flight fetch 창과 다름). 성능 낮은 서버·큰 `features.md`·콜드 캐시에서 재현 폭 넓어짐. 자가치유(재클릭 시 정상)라 배포는 막지 않으나, 권장: `planningIaRoot === null`(로드 전) 가드를 두어 "아직 로딩 중" 과 "정말 없음(레지스트리↔IA 불일치)"을 구분하거나, 최소한 accepted-limitation 으로 트래킹. (증거: App.tsx:496-505 병렬 fetch, :351 빈 find, :148 초기 [], verify.json edgeCase 동시성 na)

- **M-2 (UX) — 무매칭 안내 상태바가 자동 소멸하지 않음 + 성공 경로가 클리어 안 함.** `setStatus`(App.tsx:96, 렌더 App.tsx:857)는 auto-dismiss 가 없어 다음 `setStatus` 호출까지 헤더에 잔존한다. 무매칭 안내(App.tsx:354) 후 사용자가 무관한 동작(IA 탭 수동 탐색 등)을 해도 "찾지 못했습니다"가 계속 보인다. 또 성공 경로 `selectScreenInIa`(App.tsx:356-359)가 `setStatus("")`로 이전 오안내를 지우지 않아, *같은 패널에서 다른 칩이 성공*해도 직전 실패 메시지가 남을 수 있다. 앱 전역의 기존 status UX 패턴과 동일(신규 안티패턴 아님)이라 LOW~MEDIUM. 권장: 성공 분기에 `setStatus("")` 한 줄. (증거: App.tsx:96·354·857, 성공 분기 356-359에 클리어 부재)

## 현재 상태로 유지해도 되는 항목

- **매칭 원천의 타입 무결성(D-1).** chip 의 `s.id`(ScreenNode.id, screen-types.ts:14)와 `screenId`(planningIaBuilder.ts:57 `screenId: screen.id`)가 **동일 registry 원본**에서 파생 → 문자열 동치가 정확히 성립. slug 복제 없음, 거짓 연결 0 규약 계승. verify 서버 테스트 3케이스(화면 노드 세팅·자식/루트 미세팅)로 이중검증. 유지.
- **shared `IANode.screenId?: string` additive 옵션(ia-types.ts:24-27).** 기존 소비자(change IA 뷰) 무영향 — 옵션이라 빌드로 검증됨(verify server 336 PASS, 회귀 0). 유지.
- **뷰 격리.** `selectScreenInIa`가 `planningIaNodes`만 검색하고 change IA(`iaNodes`)는 건드리지 않음(App.tsx:351) — Non-Goal(IA→기능명세 역방향) 준수. 유지.
- **실패=조용한 강등(D-3).** 무매칭 시 `setPlanTab` 미도달·early return(App.tsx:352-355)으로 탭 전환 없이 안내만 — 저작 오류(레지스트리↔IA 불일치)를 숨기지 않되 화면 안 깨짐. 유지.
- **span→button UA 회귀 없음(criteria 4·7 근거).** 전역 `select, button {...}` 리셋(styles.css:14-22) + 부모 `.feature-detail-badges { display:flex }`(styles.css:707)로 UA 기본(line-height/baseline) 무해화. `font-family: inherit`(styles.css:709) 명시 보정. 기존 `.feature-detail-childitem` 버튼과 동일 패턴(선례). 3-2 디자인 리뷰: verify.json 실픽셀 3시나리오(s1 딥링크·s2 무매칭·s3 무링크 회귀 없음)로 관찰됨 — hover(청록 강조)·cursor·간격 정상. 정적+실픽셀 검토 병합, 이슈 없음.

## 리팩토링 추천 항목

- **R-1 `disabled={!onSelectScreen}` 분기는 App 경로에서 도달 불가(dead).** `<FeatureDetailPanel>`은 전 코드베이스에서 App.tsx:1085 한 곳만 사용하며 `onSelectScreen={selectScreenInIa}`(안정 useCallback)를 항상 전달 → `disabled`(FeatureDetailPanel.tsx:189)·`.feature-detail-screen:disabled`(styles.css:720)는 현재 실행 경로에서 절대 트리거 안 됨. 해롭진 않은 방어적 옵셔널 코딩. 향후 non-App 소비자를 위한 API 유연성이면 그 의도를 주석 한 줄로 남기거나, 계획 없으면 옵셔널 제거로 diff 축소 가능(형제 `onSelectById`도 동일 상황이나 이 change 소관 아님). 낮은 우선순위.

## 적대적 검토 (4 페르소나)
- **파괴자**: IA fetch in-flight 창에서 칩 클릭 → 존재하는 화면인데 거짓 "찾지 못했습니다"(M-1). 병렬·비대기 fetch 라 로딩 가드 없음. verify 가 이 타이밍 창을 실검증 안 함(edgeCase 동시성 na 근거가 다른 케이스). 자가치유(재클릭)라 치명은 아니나 실재 race.
- **신입 개발자**: 코드는 명확 — `selectScreenInIa` 주석(App.tsx:346-348)이 매칭 원천·실패 강등 의도를 설명, `screenId` 필드 주석(ia-types.ts:24-27, planningIaBuilder.ts:56)이 slug 죽는 이유까지 명시. 매직 넘버 없음. 다만 `disabled={!onSelectScreen}`(R-1)가 왜 있는지 주석 없어 "이 분기 언제 타나?" 의문 남김 — 6개월 뒤 dead 인지 의도인지 불명. 주석 권장.
- **보안 감사자**: 신규 공격면 없음 — 순수 클라이언트 조회(`planningIaNodes.find`), 서버 신규 엔드포인트·쿼리·입력 파싱 없음. `screenId`는 파서 정규식 `[A-Za-z0-9_-]`(RE_SCREEN)로 제한돼 특수문자·인젝션 id 진입 불가(verify naReasons 특수문자 근거). 상태바 메시지에 `chip?.label`(사용자 저작 텍스트) 표시하나 React 자동 이스케이프 경로(`{status}` 텍스트 노드, App.tsx:857) — XSS 없음. 민감정보 로그 노출 없음. 깨끗함.
- **게으른 시니어**: diff 가 최소다 — screenId 옵션 필드 additive(1줄)+빌더 세팅(1줄)+어댑터 통과(1줄)+칩 span→button+핸들러 1개+CSS 3줄. 신규 라우팅 인프라·래퍼·의존성 없음(D-2 기존 상태 전이 재사용). 자식 노드 `onSelectById` 딥링크 패턴을 그대로 계승 — 새로 안 짜고 있던 걸 재활용. "안 짜도 될 코드"는 R-1 dead 분기뿐(방어적, 무해). 과잉구현 없음.
- **2+ 페르소나 중복 발견(심각도 상승)**: 파괴자·(verify 교차검증)이 M-1(fetch race)을 공통 지적 → 다만 자가치유·narrow 라 MEDIUM 유지(치명 승격 없음). 신입·게으른 시니어가 R-1(dead 분기 주석 부재)를 공통 지적 → LOW 유지.

## 최종 배포 가능 여부
**배포 가능** (치명 0건). M-1(fetch race 오안내)·M-2(status 미소멸)는 자가치유·기존 패턴 범주라 배포를 막지 않으나, M-1 은 verify 가 실검증하지 않은 타이밍 창이므로 accepted-limitation 으로 트래킹하거나 로딩 가드로 다음 이터레이션에 보강 권장.

## 개선 우선순위 (제안)
1. **M-1 (IA fetch race 오안내)** — 실사용 오해 유발 가능(존재하는 화면을 "없음"으로). `planningIaRoot === null` 로딩 가드로 "로딩 중"과 "정말 없음" 분리, 또는 accepted-limitation 명문화. verify 미검증 창이라 우선.
2. **M-2 (성공 경로 status 클리어)** — `selectScreenInIa` 성공 분기에 `setStatus("")` 한 줄. 잔존 오안내 제거, 저비용 UX 개선.
3. **R-1 (dead disabled 분기 주석/제거)** — 6개월 뒤 혼란 방지. 의도면 주석, 아니면 diff 축소. 낮은 우선순위.
