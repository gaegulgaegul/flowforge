# 배포 전 최종 검토 — planning-wireframe-device-frame
검토일: 2026-07-08 / 검토 범위: 이 change의 diff·직접 영향 파일만 (앱 전체 아님)
- `web/src/WireframeDeviceFrame.tsx` (신규 206줄, 핵심 렌더러)
- `shared/src/wire-screen2-types.ts` (신규 타입), `shared/src/index.ts`·`screen-types.ts` (element 제거)
- `server/src/parser/planningWireframeFixture.ts` (신규 픽스처), `planningWireframeBuilder.ts` (삭제)
- `server/src/parser/screenRegistry.ts` (element 파싱 제거), `server/src/routes/docs.ts` (planning-wireframe 라우트)
- `web/src/App.tsx`·`api.ts`·`styles.css` (planning 와이어 배선)
- `server/src/parser/__tests__/planningWireframeFixture.test.ts` (테스트)

검토 방식: **정적 코드 검토 + 목업 실파일 대조**(코드 리뷰·보안 리뷰 서브에이전트 위임 + 본체 4페르소나 적대 패스 + 목업 index.html 대조). 라이브 실픽셀은 openspec-verify가 이미 수행(verify.json: 5/5 PASS). 본 리뷰는 재실행이 아니라 **판단**이다.

verify 입력: `verify.json` finalJudgment=**PASS** (pass 5 / fail 0 / 검증안함 0 / skipped 0), archiveGate.open=true. android/ios=SKIPPED(웹 전용, 정당). element 제거 요구는 본체 독립 grep 재검증으로 0 hit 확인(RE_ELEMENT·ScreenElement·planningWireframeBuilder src·features.md element 주석 전부 0).

---

## 반드시 수정해야 할 항목

- 없음.

CRITICAL 티어(하드코딩 시크릿·인젝션·인증우회·경로탈출·XSS·배포 차단 버그)에 해당하는 사항 없음. 근거:
- **경로 탈출/인젝션 불가**: `docs.ts:196`의 planning-wireframe 라우트는 다른 planning 라우트와 동일하게 `resolveDocsDir(project)`(`server/src/lib/docs.ts:81-89`)를 재사용한다. 화이트리스트 정규식 `^[A-Za-z0-9_-]+$`가 `..`·슬래시·dotfile·유니코드를 전부 거부(단일 구현, drift 없음). 게다가 `buildDocsPlanningWireframe2(dir)`는 `dir`을 `void`로 버리고 고정 픽스처만 반환 — 이 엔드포인트는 파일시스템을 읽지 않는다(이중 방어).
- **XSS 불가**: `WireframeDeviceFrame.tsx`의 `{el.label}`(36·43줄)·`title` 속성(34줄)·`data-goto`(32줄) 모두 React 기본 이스케이프 경로. `dangerouslySetInnerHTML` 사용 0건.
- **골든·change 경로 무저촉**: verify server layer 399/399 PASS, golden 3/3 회귀 0. `WireframePanel`은 change 경로(`App.tsx:1141`)에서 그대로 병존(D-4 준수).

---

## 수정하면 좋은 항목

### M-1. [적대 2+ 페르소나 중복 → 심각도 상승] 모바일 화면 요소의 goto가 데스크탑 화면을 가리켜, 모바일에서 클릭하면 데스크탑으로 프레임이 튄다
- **위치**: `server/src/parser/planningWireframeFixture.ts:128-131`(모바일 `grid-m`의 input·card가 `goto: "skeleton"`) + `WireframeDeviceFrame.tsx:142-148`(goto가 다른 디바이스 대상이면 `setDevice(target.device)`로 전환)
- **실패 시나리오**: 모바일 토글 상태에서 "🔍 프로젝트 검색" 또는 카드("쏙쏙 육아 앱" 등)를 클릭하면 `skeleton`(device=desktop)으로 이동 → goto()가 `setDevice("desktop")`을 호출 → **폰 프레임이 사라지고 브라우저 크롬 데스크탑 화면으로 튄다**. 목업 원본은 이 요소들이 `data-goto="prd-m"`(모바일 기획뷰)로 가 모바일 흐름을 유지하지만, 구현 픽스처엔 `prd-m` 모바일 화면이 없어 desktop `skeleton`으로 매핑됐다. 디바이스 프레임 렌더러의 핵심 가치(디바이스별 흐름 유지)가 이 지점에서 깨진다.
- **판단**: 렌더러 로직(goto 방어)은 정상이고 문제는 **픽스처 데이터 매핑**이다. D-2/D-6대로 이 픽스처는 곧 AI 생성물로 대체될 임시 데이터라 "치명"은 아니나, 지금 사용자가 모바일 흐름을 실증하려 하면 목업과 어긋난 체험을 한다. 파괴자(모바일에서 프레임이 튄다)와 신입(모바일 카드가 왜 데스크탑으로 가는지 코드만 봐선 모름 — 목업엔 있던 `prd-m`이 픽스처엔 없다는 암묵 가정)이 같은 지점을 지적 → 심각도 상승.
- **verify 공백**: verify evidence 03은 **데스크탑 카드 클릭**(grid→skeleton)과 데스크탑 2차 홉(skeleton→features)만 실측했다. spec 시나리오 "요소 클릭 → 화면 이동"은 desktop 홉으로만 PASS 처리됐고, **모바일 요소 클릭 → 디바이스 튐 경로는 검증되지 않았다**(verify: 예외 미검증 성격의 공백).
- **권장 수정**: 픽스처에 모바일 기획뷰 화면(`skeleton-m` 등)을 추가하고 `grid-m` 요소 goto를 그쪽으로 돌리거나, 최소한 모바일 화면 요소의 goto를 같은 디바이스 화면으로 제한한다. 어렵다면 이 change 범위에선 모바일 요소 goto를 아예 빼(non-clickable) 데스크탑 튐을 막고, cross-device 이동은 후속 AI 생성 change에서 다룬다고 명시.

### M-2. 픽스처가 프로젝트 무관 고정값 — 어느 프로젝트를 조회해도 같은 "쏙쏙 육아 앱" 목업이 보인다
- **위치**: `planningWireframeFixture.ts:158-161`(`void docsDir` — 프로젝트 인자 무시), `docs.ts:196-207`
- **실패 시나리오**: 프로젝트 B의 기획 와이어 탭을 열어도 프로젝트 A(쏙쏙 육아 앱)의 카드가 그대로 보인다. `resolveDocsDir`는 "프로젝트 존재"만 확인하고 데이터는 고정.
- **판단**: 커밋·코드 주석·design D-6에 "이 change에선 픽스처가 원천, AI 생성물이 후속 change에서 대체"로 **명시된 의도적 임시 상태**. 오지적 아님. 다만 `wf-df-caption`(`WireframeDeviceFrame.tsx:201-203`)이 "최종 디자인 아님"만 알릴 뿐 "이 프로젝트의 실제 데이터가 아님(예시 공통)"은 알리지 않아, 실사용 중 사용자가 데이터 정합성 버그로 오인할 소지가 있다.
- **권장**: 캡션에 "예시 데이터(모든 프로젝트 공통)" 한 줄 추가(선택). 없어도 배포는 가능.

### M-3. [게으른 시니어] stack layout 요소의 `span` 필드가 무효 — 데드 데이터
- **위치**: `planningWireframeFixture.ts:71-75`(skeleton의 placeholder 5개가 `span: 2`) + `styles.css:933`(`.wf-df-main--stack { display: flex; flex-direction: column }`)
- **실패 시나리오**: `Element`(`WireframeDeviceFrame.tsx:23`)는 `span > 1`이면 `gridColumn: span N`을 건다. 그러나 stack layout은 flex column이라 `gridColumn`이 무시된다 → skeleton placeholder의 `span: 2`는 렌더에 아무 영향 없는 데드 데이터. 잘못 그려지진 않지만, 나중에 stack에서 span을 기대하고 값을 넣는 사람을 오도한다(신입도 걸릴 함정).
- **권장**: skeleton placeholder에서 `span: 2` 제거(stack에선 의미 없음), 또는 span을 grid/form/tree에서만 유효하다고 타입 주석에 명시.

### M-4. Element 리스트 key가 배열 인덱스(`key={i}`) — 확장 시 리렌더 오염 위험
- **위치**: `WireframeDeviceFrame.tsx:69·77·83·106·110·116`
- **실패 시나리오**: 현재 픽스처는 정적이라 안전. 후속 AI 생성물이 요소를 삽입·삭제·재정렬하면 React가 인덱스 key로 컴포넌트 identity를 잘못 재사용, 클릭 핸들러/DOM 상태가 엉뚱한 요소에 붙을 수 있다. `WireElement`에 안정 id가 없는 것이 구조적 뿌리.
- **권장**: 지금 당장은 아님(스코프 정당). 후속 AI 생성 change 착수 전 `WireElement`에 `id?: string` 추가 → `key={el.id ?? i}`로 전환(M-1과 함께 후속 설계에 반영).

---

## 현재 상태로 유지해도 되는 항목

- **goto() 방어 로직 (`WireframeDeviceFrame.tsx:139-150`)**: 존재하지 않는 id 클릭 → 두 `some()` 모두 false → 완전 no-op(안전). 같은 디바이스 이동은 `setActiveId`만. cross-device는 `setDevice`+`setActiveId`를 같은 동기 핸들러에서 순차 호출 → React 18 자동 배칭으로 한 리렌더에 합쳐지고, `deviceScreens`(useMemo, dep=[screens,device])가 새 device로 재계산된 뒤 `active`도 같은 렌더에서 일관 계산 → 중간 상태 노출 race 없음. **로직은 올바르다**(M-1은 로직이 아니라 픽스처 데이터 문제).
- **element 파싱 제거 + screen-id/N:M 링크 유지 (`screenRegistry.ts`)**: `RE_ELEMENT`류와 요소 버퍼만 제거, `RE_SCREEN`/`RE_SCREENS`(N:M 링크)·상태머신은 온전. IA·features 등 다른 소비자 계약 무저촉(정적 검토 + golden 3/3 PASS).
- **에러/로딩 처리 (`App.tsx:537-548`)**: fetch 실패 시 `.catch(() => setPlanningWireScreens(null))`로 탭을 숨기는 패턴이 다른 planning fetch(IA 등)와 동일 — 일관성 있음. 빈 화면(`screens.length===0`)도 탭 미표시로 처리(빈 프레임 방지). 응답 스키마 `{project, screens}` 서버·클라 일치.
- **민감정보 노출**: 에러 응답 고정 문자열(`docs_not_found`), `safe()` 래퍼가 스택트레이스를 클라에 안 흘림. 픽스처에 시크릿·PII·내부 경로 없음.
- **목업 충실도(데스크탑)**: 목업 index.html 대조 — 목업 탭들도 전부 `data-goto="spec"`(=구현 `features`), 프로젝트 카드 `data-goto="prd"`(=구현 `skeleton`). 데스크탑 3화면(grid/skeleton/features)의 goto 매핑·영역 구성이 목업과 일치. "세로 목록 아님·화면 배치 맞음"(방향 재발 방지 게이트) 충족.

---

## 리팩토링 추천 항목

- **과잉구현 없음**: `WireframeDeviceFrame.tsx` 206줄은 Element/DesktopScreen/MobileScreen/컨트롤+상태 4책임을 담되 각 함수 짧고(최대 ~30줄) 단일 책임. 새 의존성·불필요 래퍼 없음. 기존 `WireframePanel` 병존은 스코프를 좁게 유지한 판단(D-4). diff 크기(6파일·약 336줄)는 "새 데이터 모델+렌더러+라우트 배선" 범위에 비례.
- **경계선(격상 안 함)**: `WireframeDeviceFrame` 컴포넌트 본체(126-206줄, ~80줄)가 "함수 50줄" 가이드를 넘지만 JSX 반환 비중이 크고 로직은 단순 — 분리가 오히려 가독성을 해칠 수 있어 유지 권장.
- **후속 부채(트리 충실도, 이 change 범위 아님)**: 목업의 기능명세는 SVG 연결선이 있는 3단 트리(`tree-svg`/`tree-col` 7회)지만, 구현 `tree` layout은 3열 grid에 tree-node를 flat 나열(계층/연결선 없음). 렌더 방향은 맞으나 "트리"의 시각 위계는 로우피델리티로 단순화됨. AI 생성 change에서 트리 렌더를 고도화할 때 다룰 부채(현 spec의 THEN "배치되어 그려진다"는 충족).

---

## 적대적 검토 (4 페르소나)

- **파괴자**: 모바일 `grid-m` 요소 클릭 → `goto: "skeleton"`(desktop) → `setDevice("desktop")`으로 **폰 프레임이 데스크탑으로 튄다**(M-1). 목업의 `prd-m` 모바일 화면이 픽스처에 없어 desktop으로 매핑된 결과. verify는 데스크탑 홉만 검증(모바일 클릭 경로 미검증). / 그 외 런타임 터짐: goto no-op 방어·빈 화면 폴백·useMemo 일관성으로 커버됨(유지 항목 참조).
- **신입 개발자**: (1) 모바일 카드가 왜 데스크탑으로 가는지 코드만 봐선 불명 — 목업엔 있던 `prd-m`이 픽스처엔 빠졌다는 암묵 가정(M-1). (2) skeleton placeholder의 `span: 2`가 stack에선 무효인데 값이 있어 "여기선 span이 먹는다"고 오해할 함정(M-3). 6개월 뒤 stack에 span 넣는 사람 나온다.
- **보안 감사자**: 실취약점 없음(근거: resolveDocsDir 화이트리스트 단일 구현 재사용 → 경로탈출 불가, React 자동 이스케이프 → XSS 불가, `void docsDir`로 FS 미접근 이중방어, onClick goto는 state setter만 호출 → open-redirect sink 없음, 에러 응답 고정 문자열). **조건부 권고(후속 change용)**: `goto`·`label` 타입이 free-form string이라, AI 생성물(신뢰 경계 밖)이 이 자리에 들어오는 후속 change에서는 ①goto를 href/location sink로 확장 시 화면 id 화이트리스트 재검토, ②label 길이/제어문자 제한(UI 스푸핑 방지, XSS는 아님)이 필요.
- **게으른 시니어**: 안 짜도 될 코드 관점 — 렌더러 자체는 부풀지 않음(과잉구현 없음, 위 리팩토링 항목). 다만 **데드 데이터**: stack layout 요소의 `span` 필드(M-3)는 렌더에 영향 없이 픽스처에만 존재 — 안 넣어도 됐다.
- **2+ 페르소나 중복(심각도 상승)**: **M-1(모바일 goto 디바이스 튐)** = 파괴자(프레임 튐) + 신입(암묵 가정) 동시 지적 → 심각도 한 단계 상승, "수정하면 좋은" 최상위에 배치. M-3(span 데드 데이터) = 신입 + 게으른 시니어 중복이나 영향 경미(오작동 없음)라 LOW 유지.

---

## 최종 배포 가능 여부

**배포 가능** (치명 0건).

CRITICAL 없음, 보안 취약점 없음, verify 5/5 PASS·golden 회귀 0. 배포를 막을 사유는 없다. 다만 **M-1(모바일 요소 클릭 시 데스크탑으로 프레임이 튀는 문제)은 디바이스 프레임 렌더러의 핵심 가치와 직접 충돌**하고 verify가 이 경로를 검증하지 않았으므로, 이 change의 실증 완결성을 위해 M-1을 배포 전에 손보길 강권한다(픽스처 데이터 수정 = 저비용). M-1이 곧 대체될 임시 픽스처의 오매핑이라는 점(D-2/D-6)을 받아들이면 현 상태로도 배포 가능하나, 그 경우 "모바일 흐름 실증은 이 change에서 미완, 후속 AI 생성 change로 이월"임을 명시해야 한다.

---

## 개선 우선순위 (제안)

1. **M-1 — 모바일 goto 디바이스 튐** (영향: 디바이스 프레임 핵심 가치 훼손 + verify 공백. 픽스처 데이터 수정으로 저비용. 모바일 요소 goto를 같은 디바이스 화면으로 돌리거나 모바일 기획뷰 화면 추가) — **배포 전 강권**
2. **M-3 — stack의 span 데드 데이터** (영향: 오작동 없으나 신입 오도 함정. skeleton placeholder에서 span 제거 = 1줄) — 저비용, 함께 처리 권장
3. **M-2 — 픽스처 프로젝트 무관 고정** (영향: 사용자 혼란 소지. 의도된 임시 상태라 캡션 문구 1줄로 완화) — 선택
4. **M-4 — 인덱스 key** (영향: 현재 안전, 후속 AI 생성 change에서 리렌더 오염 위험. `WireElement.id` 추가) — 후속 설계에 반영
5. **트리 충실도 고도화** (영향: 로우피델리티 단순화, 현 spec 충족. AI 생성 change에서 SVG 트리 렌더) — 후속 부채
