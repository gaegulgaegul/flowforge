# 배포 전 최종 검토 — flowforge-change-node-mapping
검토일: 2026-07-11 / 검토 범위: 이 change의 diff·직접 영향 파일만(전체 앱 아님)
- backend: `server/src/lib/capabilityIndex.ts`, `server/src/routes/docs.ts`, `server/src/lib/__tests__/capabilityIndex.test.ts`, `shared/src/feature-tree-types.ts`
- frontend: `web/src/{featureTreeAdapter.ts, iaAdapter.ts, FeatureNode.tsx, FeatureDetailPanel.tsx, App.tsx, styles.css}`, 삭제 `web/src/CapabilityChangeList.tsx`
- 입력: `verify.json`(finalJudgment=통과, gstack 13장), D그룹 정적검증(D.1·D.2·D.3 PASS)

> 리뷰 방식: 10기준 backend/frontend 병렬(code-reviewer) + 4페르소나 적대 패스(apply와 분리) + 본체 직접 file:line 교차검증. 확정 Non-Goal(capability 단위 매핑·실데이터 배지 0=후속 change [[flowforge-mapping-basis-shift]])은 오지적 제외.

## review criteria brief (in-session)
- changeTypes: [backend, frontend] — server 파생 로직 + React 렌더/삭제
- ruleSets: resolvedFrom `~/.claude/rules/`, selected [10-coding-style, 20-testing, 30-security, 60-design, 70-adversarial-review]
- designYardsticks:
  - Decisions: D0 매핑 입도=capability 단위; 노드=배지 신호·진입=상세패널(nodeTypes 외부상수 우회); "빈 매핑=미표시"(design:43)
  - Non-Goals: change↔상세기능 정밀 매핑(후속), 유저플로우 그래프 노드 제외(화면 id 없음, 후속), 실데이터 배지 기준 전환(후속 change 분리)
- adversarialScope: full change scope (NOT narrowed by this brief)

## 반드시 수정해야 할 항목

### 1. [파괴자+게으른시니어 중복 → 심각도 상승] IA 화면 노드 역경유(B.2)의 렌더·진입 표면이 0 — spec Requirement 3 THEN 미구현
- **근거(본체 직접 확인)**:
  - `web/src/iaAdapter.ts:89-105,143-178` — 화면별 change 합집합(`linkedChanges`)을 계산해 IA 화면(capability) 노드 data에 싣고, `App.tsx:311` `toIAFlow(..., changeMapping)`로 **실제 배선됨**(죽은 계산 아님, 데이터는 노드까지 흐름).
  - **그러나 렌더 표면이 없음**: `web/src/IANode.tsx`(36줄 전체) — `linkedChanges`를 구조분해도 렌더도 안 함(`:26` `ia-node-badge`는 kind 태그 "변경/화면/상세기능"일 뿐, change 배지 아님). `web/src/IADetailPanel.tsx` — props가 `node/onClose/onSelectById`뿐, **`onOpenChange` 없음·연관 change 섹션 없음**. `web/src/App.tsx:1185-1189` — IADetailPanel에 `onOpenChange` 미배선.
- **왜 치명**: spec `## specs/flowforge-change-node-mapping/spec.md` Requirement "화면 노드는 상세기능↔화면 링크를 역경유해 …그 change 합집합이 해당 화면 노드 자리에 in-place로 SHALL 표시된다"의 THEN이 미구현. **verify.json이 이 시나리오를 "PASS(안전한 빈 처리 실증, 표시 경로는 후속)"으로 표기하며 표시 경로 미실증을 스스로 자백하면서 PASS 처리** — §1(완료=계약) 위반. FeatureTree 쪽(B.1)은 `FeatureNode.tsx:77` 배지 + `FeatureDetailPanel.tsx:211` 진입이 정상 작동해 대조적(그쪽 Requirement 1·2·4는 실제 PASS).
- **검토자 정직 고지**: 본 검토 세션이 verify 캡처 때 "IA 배지 0 = fixture 미연결 탓 정상 빈 처리(H1)"로 판정한 것은 **오판**. 실제 원인은 렌더 코드 자체 부재(H2) — fixture를 IA 화면과 연결했어도 배지는 안 떴을 것. 적대 패스가 이를 교정.
- **실패 시나리오**: 사용자가 IA(화면 구조) 뷰에서 화면 노드를 봐도 그 화면에 연관된 change가 절대 표시되지 않음. spec이 약속한 "화면 자리 in-place 매핑"이 IA 계층에서 전무.
- **처방(택1 — 명섭님 결정)**:
  - **(a) 렌더 구현**: IANode에 change 배지 + IADetailPanel에 연관 change 섹션 + App.tsx onOpenChange 배선 추가(FeatureNode/FeatureDetailPanel과 동형 — 패턴 이미 있음). Requirement 3 THEN 충족. 스코프 소폭 확대.
  - **(b) 계산 제거 + spec 조정**: iaAdapter의 화면 역경유(B.2, 3함수+changeMapping 옵션) 제거하고 spec의 화면 매핑 Requirement를 후속 change로 이월. 스코프 축소, "계산만 하고 안 씀" 상태 해소.

### 2. [게으른시니어] 고아 서버 라우트 3종 + `buildCapabilityDetail` — 후속 정리 대상
- **근거(본체 확인)**: C.3(4ea69b2)가 web의 `fetchCapabilities`/`fetchCapabilityDetail`/`CapabilityChangeList.tsx`를 제거. 서버 `server/src/routes/projects.ts:109,128,152`(`/api/projects/:project/capabilities`·`/capabilities/:cap/changes`·`/capabilities/:cap`)와 `capabilityIndex.ts:135` `buildCapabilityDetail`은 남음. **web 호출자 0건**(grep 확인 — web은 별개 라우트 `/api/docs/:project/audit-capabilities`만 사용).
- **왜 문제**: 소비자 0 API는 죽은 표면. `buildCapabilityDetail` 유닛테스트 5개(`capabilityIndex.test.ts:120-179`)가 아무도 안 부르는 코드를 초록 위장 → "459 passed" 신뢰도 희석.
- **완화 정황**: 이 라우트들의 원 소유주는 아카이브된 별개 change라, 삭제가 이번 change 스코프 밖 회귀를 건드릴 수 있음 → **이번 change에서 삭제하지 말고 별도 정리 change로 분리 권장**. 이번 change가 고아를 만든 인과는 명확하므로 후속 티켓은 강제.

## 수정하면 좋은 항목

- **[frontend] change 진입 시 상세 패널이 안 닫힘**(`App.tsx:1171-1177` onOpenChange → `openChangeViews`, 본문 `:863-878`에 `setSelectedFeature(null)` 없음). 같은 컴포넌트의 다른 전환 경로(`App.tsx:365,384,411`은 명시적 `setSelectedFeature(null)`, :411 주석 "패널 상호배타 유지")와 달리 이 경로만 누락 → z-index 50 고정 패널(45vw)이 방금 진입한 change 5종 뷰를 계속 가림, 사용자가 X 한 번 더 눌러야 함. **한 줄 수정**(`setSelectedFeature(null)` 추가)으로 해소. 본체 직접 확인.
- **[파괴자] iaAdapter 라벨 문자열 조인 false-positive**(`iaAdapter.ts:64-80`): 서로 다른 요구사항 아래 우연히 같은 라벨의 상세기능이 있으면 두 요구사항 change가 한 화면에 섞임. "거짓연결 0"이 성공기준인데 라벨 조인이 약화. 단 위 반드시수정 1이 렌더 미구현이라 현재 사용자 미노출 — 1을 (a)로 해결 시 함께 처리 필요.
- **[신입] `App.tsx:1173` `displayName: changeKey` 무주석**: 다른 곳은 한글/영문 분리를 지키는데 이 호출부만 key를 displayName에 넣음. 실제로 `openChangeViews`가 displayName을 안 읽어 안전하나(본체 확인), 무주석이라 "한글 제목 유실"로 오인 위험. 한 줄 주석 권장.
- **[backend] 라우트 레벨 통합 테스트 부재**(`docs.ts:147-153`): `attachLinkedChanges`·`buildCapabilityIndex`는 유닛테스트 있으나 배선(`dirname(dir)`·`join` 경로 조립)이 end-to-end로 안 걸림. `dirname(dir)`→`dir` 같은 실수가 조용히 배지 0을 만들어도 CI 초록(fixture `planonly`는 매칭 capability 없어 무관). fixture 1개+assert 1개로 닫을 수 있는 silent-regression 갭.

## 현재 상태로 유지해도 되는 항목
- **[보안] path traversal 클린** — `resolveDocsDir`(`docs.ts:85`)가 `..` 금지 + `^[A-Za-z0-9_-]+$` 화이트리스트로 changesRoot 조립 전 차단.
- **[보안] changeKey injection/XSS 클린** — 원천=디스크 디렉토리명, React 자동 이스케이프(`dangerouslySetInnerHTML` 0건), `serializeDeepLink` encodeURIComponent.
- **[보안] 에러노출 클린** — `safe()`가 클라이언트엔 제네릭 500, 상세는 stderr만.
- **[예외] null 트리·빈 capability·changesRoot 부재·readdirSync 실패** — 전부 early return/try-catch로 크래시 없음(D.2 5/5 PASS, capabilityIndex.test.ts 14 PASS).
- **[유지보수] `attachLinkedChanges`** — 16줄 순수 재귀, byCapability 재사용, 기존 buildCapabilityDetail 패턴과 일관. 과잉추상화 없음.
- **[frontend 상속] `featureTreeAdapter.ts:143-153`·`iaAdapter.ts:47-105`** — O(n) Map/Set 기반, useEffect+setState(프로젝트 관례), undefined/빈배열 옵셔널 체이닝 안전.
- **[frontend 반응형] 배지** — 기존 `flex-wrap: wrap` 컨테이너(`styles.css:286,724`)에 얹혀 오버플로우 없음.
- **[뮤테이션] byCapability 공유 배열** — 소비자가 `[...]` 복사로 방어(`iaAdapter.ts:72`), `attachLinkedChanges`는 `{...node}` 재생성. 현재 안전(단 readonly 규약 의존).

## 리팩토링 추천 항목
- **buildCapabilityIndex 매 요청 재스캔**(`docs.ts:149-151`, readdirSync per request): 현 단일유저·58파일·15MB 스케일에선 비이슈(측정 확인). 다중 동시 사용자/10~100배 성장 시 mtime 캐시 후보. 지금 조치 불필요.
- **charter(docs/spec.md) 의존**: 이 change의 매핑 기준이 charter라 실데이터 배지 0. 후속 change [[flowforge-mapping-basis-shift]]로 이미 분리됨(신규 부채 아님).

## 적대적 검토 (4 페르소나)
- **파괴자**: ①IA 역경유 렌더 갭(필수 동작 누락+데이터가 노드까지 흐르나 화면에 안 뜸) → 반드시수정 1. ②iaAdapter 라벨 조인 false-positive → 수정하면좋은. 순환/무한루프·뮤테이션 aliasing은 무해(입력=순수 트리, `{...node}` 재생성).
- **신입 개발자**: `displayName:changeKey` 무주석, 배지=비클릭 span인데 클릭 핸들러는 다른 파일(FeatureDetailPanel), IIFE 조건부 spread만 튐 → 전부 수정하면좋은(가독성).
- **보안 감사자**: path traversal·changeKey injection/XSS·에러노출 전부 클린(본체 확인). planning-features GET 비인증은 앱 전역 패턴이지 이 change 구멍 아님.
- **게으른 시니어**: ①IA B.2 계산이 활성 소비처 없는 40줄 선제 인프라(렌더 미구현) → 반드시수정 1과 병합. ②C.3가 만든 고아 서버 라우트 3종+buildCapabilityDetail → 반드시수정 2(후속 분리).
- **2+ 페르소나 중복(심각도 상승)**: IA 역경유 렌더 갭 = 파괴자(THEN 미구현) + 게으른시니어(죽은 40줄) 중복 → **반드시수정으로 상승 확정**.

## 최종 배포 가능 여부
**조건부 가능 (치명 1건 처리 후)**

- 빌드·타입체크(3ws)·린트·테스트(Jest 459)·gstack 13장은 실제 PASS. FeatureTree 계층(spec Requirement 1·2·4)은 실픽셀로 실증 완료 — 이 부분만 보면 배포 가능.
- **그러나 spec Requirement 3(화면 노드 역경유 in-place 표시)의 THEN이 IA 계층에서 미구현인 채 verify가 PASS로 통과**된 것이 배포를 막는 치명 갭. archive 전에 반드시수정 1을 (a)렌더 구현 또는 (b)계산 제거+spec 조정 중 하나로 처리해야 §1(완료=계약)을 만족한다.
- 반드시수정 2(고아 라우트)는 후속 정리 change로 분리 가능 — 이번 archive를 막지는 않음(단 후속 티켓 강제).

## 개선 우선순위 (제안)
1. **[치명] IA 역경유 렌더 갭(반드시수정 1)** — spec Requirement 미충족. (a)렌더 구현 or (b)계산제거+spec조정. 명섭님 스코프 결정 필요.
2. **[UX] change 진입 시 패널 안 닫힘** — 한 줄(`setSelectedFeature(null)`), 사용자 매번 체감. 1을 손대는 김에 함께 처리 권장.
3. **[정합] iaAdapter 라벨 조인 false-positive** — 1을 (a)로 갈 때 렌더되면 노출되므로 동반 수정.
4. **[정리] 고아 서버 라우트 3종(반드시수정 2)** — 별도 정리 change로 분리.
5. **[테스트] 라우트 레벨 통합 테스트** — silent-regression 방어, fast follow.
6. **[가독성] displayName 무주석** — 한 줄 주석.
