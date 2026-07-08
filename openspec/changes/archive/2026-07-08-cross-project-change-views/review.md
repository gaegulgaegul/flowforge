# 배포 전 최종 검토 — cross-project-change-views

---

## 검토일: 2026-07-07 (2차 — C-1·R-1 수정 후 재검토)

검토 범위: 이 change의 diff만 (전체 앱 아님) — `server/src/{lib/projects.ts,lib/changes.ts,routes/graph.ts,routes/projects.ts}`, `web/src/{App.tsx,api.ts,main.tsx}`, `shared/src/dashboard-types.ts`, 신규 테스트 2종.

**재검토 계기:** 1차 검토(아래)가 **C-1(lib resolveProjectDir dotfile/유니코드 통과)**·**R-1(validator 이중화)**를 배포 차단으로 지적 → `d81f33f fix(server): resolveProjectDir 화이트리스트 통합` 커밋으로 수정됨. 본 2차는 그 수정의 완결성과 신규 회귀를 판단한다. 1차 이후 M-1·M-2 web 항목은 미수정.

**리뷰 시점 검증(실측):** server tsc `--noEmit` EXIT 0 · web tsc EXIT 0 · `npm test` **347/347 PASS**(32 스위트). 적대 재검토는 별도 세션(code-reviewer 서브에이전트)이 프로덕션 마운트 실디렉토리(`/home/gaegul` 하위 `.ssh`·`.adal` 등)와 쿼리 인젝션 페이로드로 화이트리스트를 실측 대조. verify.json(2026-07-07 15:00, PASS 5/5) 그대로 유효.

### 1차 치명·주요 항목의 현재 상태

| 1차 항목 | 상태 | 근거(file:line) |
|---|---|---|
| **C-1** lib resolveProjectDir dotfile/유니코드 통과 | ✅ **해결됨** | `server/src/lib/projects.ts:38` — `!/^[A-Za-z0-9_-]+$/.test(name)` 화이트리스트로 교체, docstring도 실제 동작과 일치하게 수정. 카드 스캔(`listProjectCards`)도 이 게이트 공유(숨김 디렉토리 제외). 실측: `.ssh`·유니코드·공백·경로구분자 전부 거부. |
| **R-1** resolveProjectDir 이중 validator | ✅ **해결됨** | `server/src/routes/projects.ts:14,55` — 사본 정규식 제거, `resolveProjectDirLib`(lib 단일 구현)에 위임 + 라우터 전용 `openspec/changes` 존재 확인만 추가. 프로젝트명 검증 정규식은 이제 `lib/projects.ts:38` 한 곳뿐(change-id·capability-key 정규식은 별개 도메인이라 정당). |
| **M-3** dotfile·cross-root 회귀 테스트 부재 | ✅ **대부분 해결** | dotfile 거부: `graphCrossProject.test.ts:92-102`(`.hidden`·`.ssh`·공백 → 404, 실제 openspec 구조 픽스처). cross-root 누출 차단: `changes.test.ts:51-54`(다른 루트의 동명 change에 안 샘). ⚠️ 잔여: **통합 레벨** cross-root 누출 단언(`feature-b?project=wowa-app → 404`)은 여전히 부재 — 아래 M-3′. |
| **M-1** drag-save 부작용 in setState updater | ❌ **미해결** | `web/src/App.tsx:297-303` — `saveLayout()`을 `setFlowNodes` updater 안에서 호출, StrictMode(`main.tsx:10` 확인) dev에서 2회 발화. 적대 재검토 CONFIRMED. |
| **M-2** 5 fetcher .catch(setStatus) 클로버 | ❌ **미해결** | `web/src/App.tsx:206-227` — race 토큰 없음(`openCapability:764-783`은 `dashReqToken`으로 stale 드롭하나 뷰 로딩 effect는 무가드). 이 change의 크로스프로젝트 지연 편차로 도달성 소폭↑. |

### 반드시 수정해야 할 항목 (2차)

- **없음.** 1차의 유일한 배포 차단 C-1이 해결됐고, 적대 재검토(4 페르소나)에서 신규 BLOCK/CRITICAL·2+ 페르소나 수렴 없음. cross-root 누출·화이트리스트·쿼리 인젝션·traversal 전부 실측 CLEARED.

### 수정하면 좋은 항목 (2차 — 전부 비차단)

- **M-1 (미해결 유지)** — `web/src/App.tsx:297-303` drag-save 부작용을 `setFlowNodes` updater 밖으로. StrictMode dev 이중 PUT(프로덕션 무영향·idempotent·데이터 무손상). 순수성 위반 패턴 자체가 다른 stateful/non-idempotent write로 복붙되면 위험해지므로 정리 권장.
- **M-2 (미해결 유지)** — `web/src/App.tsx:206-227` 5 fetcher 공통 실패 클로버. `openCapability`가 이미 쓰는 `dashReqToken` 패턴을 뷰 로딩 effect에도 적용하면 rapid 전환 시 stale 응답 드롭. 데이터 교차오염 없음(각 setter 독립 슬롯) — 상태바 메시지 오표시만.
- **M-3′ (verify 사각 잔여)** — `graphCrossProject.test.ts`에 **통합 레벨** cross-root 누출 단언 추가(`GET /api/changes/feature-b/graph?project=wowa-app → 404`). 단위(`changes.test.ts:51-54`)로 기전은 잠겼으나 라우트 경유 회귀는 미고정. (신입 개발자 페르소나 LOW: `graph.ts`가 `routes/projects.ts`와 달리 `openspec/changes` 존재 확인을 생략한 비대칭 — 이유는 downstream `resolveChangeDir`의 `existsSync+hasSpecs` 중복이라 정당하나 주석 부재. 이 테스트 추가 시 함께 기록 권장.)

### 적대적 검토 (4 페르소나 — 2차, 별도 세션)

- **파괴자:** ①(CONCERNS) StrictMode dev 이중 PUT(M-1, CONFIRMED — `App.tsx:297-303`+`main.tsx:10`). ②(CONCERNS) 5 fetcher 무가드 race(M-2, `App.tsx:206-227`). `selected`/`selectedProject` 원자 세팅(`openChangeViews:793-794`)은 CLEAN(단일 핸들러 배칭).
- **신입 개발자:** (LOW) `graph.ts:41`(raw resolveProjectDir)과 `routes/projects.ts:55`(+openspec/changes 확인)의 비대칭이 `graph.ts` 쪽엔 미설명 — 실혼란 낮음(JSDoc `graph.ts:29-35` 명료), M-3′에 병합.
- **보안 감사자:** C-1 화이트리스트 **airtight 확인**(실디렉토리·유니코드·경로구분자·%00·배열/객체 쿼리 전부 거부, `graph.ts:38-40`+`lib/projects.ts:38`). R-1 단일화 확인(정규식 사본 0). cross-root 누출 **구조적 차단**(`graph.ts:43` 해석된 프로젝트 루트만 전달, `resolveChangeDir` 독립 재검증). CORS 전체허용·무인증·무 rate-limit은 **이 diff가 신설·확대한 게 아님**(기존 `routes/projects.ts`가 이미 동일 charset 열거 프리미티브 노출, RO 마운트라 최악=디렉토리 존재 노출) → 이 change엔 CLEAN, 앱 전반 하드닝은 별도.
- **게으른 시니어:** 수정 자체가 **최소**(정규식 1줄 교체 + 위임 3줄, 신규 파일·추상화 0). `withProject`(4줄)·`resolveChangeFromReq`(9줄)는 필요·최소. `api.ts` 428줄은 이 diff 이전부터의 기존 부채(이 change 순증 ~15줄) — 스코프 밖. 안 짜도 될 코드 없음.
- **2+ 페르소나 중복(심각도 상승):** 없음 — 파괴자 2건은 단독, 나머지 페르소나와 중첩 없음. 1차의 3인 수렴(C-1)은 수정으로 소멸.

### 3-2 디자인 리뷰 게이트 (2차)

- 화면 diff(App.tsx·api.ts) 있으나 **신규 화면 0**(1차와 동일 — 기존 5종 뷰 재사용, 시각 토큰·레이아웃 변경 없음). `/design-review` 생략, criteria 4·7 = 해당 없음.

### 최종 배포 가능 여부 (2차)

**배포 가능**

- 1차 유일 차단 **C-1 해결됨**(화이트리스트 + dotfile 회귀 테스트 + 실디렉토리 실측), **R-1 해결됨**(단일 validator). verify PASS 5/5 유효, tsc·347 테스트 재현 PASS.
- 잔여 M-1·M-2·M-3′는 전부 **비차단**(dev-only·비손상·기존 패턴, 이 change가 소폭 도달성만 증가). 배포 후 후속 정리 권장.

### 개선 우선순위 (2차 제안)

1. **M-3′** — 통합 테스트에 라우트 경유 cross-root 누출 단언 추가 + `graph.ts` 비대칭 주석. *(저비용, 회귀 고정)*
2. **M-1** — drag-save 부작용을 updater 밖으로. *(dev 이중 PUT 제거, 순수성 위반 확산 차단)*
3. **M-2** — 뷰 로딩 effect에 `dashReqToken` 가드 적용. *(rapid 전환 stale 메시지 제거)*

> 아래는 1차 검토(2026-07-07, C-1 수정 전) 원문 — 이력 보존.

---

## 검토일: 2026-07-07 (1차 — C-1 수정 전)
검토 범위: 이 change의 diff만 (전체 앱 아님)

**검토 범위 파일:**
- `server/src/routes/graph.ts` — `resolveChangeFromReq()` 프롤로그 신설, 6 GET + 1 PUT에 optional `?project=`
- `server/src/lib/changes.ts` — `resolveChangeDir(id, rootDir=changesRoot())` 시그니처 확장
- `server/src/lib/projects.ts:33` — `resolveProjectDir(name)` (graph.ts가 import하는 validator)
- `server/src/routes/projects.ts:52` — `resolveProjectDir(project)` (기존 로컬 복제본, 검증 규칙 상이) + capability detail 응답에 `project` 세팅
- `web/src/api.ts` — `withProject()` 헬퍼 + 5 fetcher·saveLayout에 optional project
- `web/src/App.tsx` — `onFlowNodeDragStop`(드래그 저장), `openChangeViews` project 캡처, 뷰 로딩 effect deps, skeleton change 목록 조건부 복구(3.3)
- `shared/src/dashboard-types.ts` — `CapabilityChangeRef.project?`

**실증 검증 입력(verify.json, 2026-07-07 23:32):** finalJudgment **PASS** (5/5 시나리오, FAIL·검증안함·SKIP 0). server 346/346, web 2/2 실브라우저. android/ios SKIPPED(산출물 없음, 적법). 본 리뷰는 재실행이 아니라 **정적 판단** + verify를 입력으로 소비. 리뷰 시점 재확인: server tsc EXIT 0, web/shared tsc EXIT 0, 테스트 346/346 재현.

**review criteria brief (in-session):**
- changeTypes: `backend`(graph.ts·changes.ts·projects.ts — 라우트/경로해석/보안), `frontend`(api.ts·App.tsx — .tsx)
- 게이트: backend → 20-testing·30-security·10-coding-style / frontend → 60-design·70-adversarial·10-coding-style
- ruleSets.resolvedFrom: `~/.claude/rules/` · absent: `<repo>/.claude/rules/`(없음 — home로 폴백)
- designYardsticks: D-1(쿼리파라미터, nested 라우트 아님) / D-2(**resolveProjectDir 재사용, 새 검증코드 금지**) / D-3(resolveChangeDir 루트 파생) / D-4(web 컨텍스트만 전달) / D-5(RO 저장 실패=정직 안내). Non-Goals: RO 마운트 RW화·라우트 URL 재설계·change 목록 UI 변경
- criteria 4(UX)·7(반응형): frontend 있으나 **신규 화면 0**(기존 5종 뷰 재사용) — 시각 변경 미미. 아래 3-2 게이트 참조.

---

## 반드시 수정해야 할 항목

### C-1 (보안 · 방어심층) — lib `resolveProjectDir`이 dotfile/유니코드 프로젝트명을 통과시킨다 (D-2 위반, 3 페르소나 수렴)
- **위치:** `server/src/lib/projects.ts:35`
  ```js
  if (!name || name.includes("..") || name.includes("/") || name.includes("\\")) return null;
  ```
- **문제:** graph.ts:41이 import하는 이 lib validator는 **정규식 화이트리스트가 없다**(블록리스트만). 그래서 `.ssh`·`.aws`·`.git`·`.config`·유니코드·공백 이름이 전부 통과한다. 반면 자매 복제본 `server/src/routes/projects.ts:53`은 `^[A-Za-z0-9_-]+$` 정규식으로 선행 dot·특수문자를 거부하고 `openspec/changes` 존재까지 확인한다. graph.ts는 **둘 중 약한 쪽**을 골랐다.
- **배포 컨텍스트(확정):** `docker-compose.yml:22 PROJECTS_ROOT: /data/docs-root` + `:29 - /home/gaegul:/data/docs-root:ro` → 프로덕션에서 `projectsRoot()`가 **호스트 홈 디렉토리 전체(RO)**. `server/src/index.ts:12 app.use(cors())`(오리진 전체 허용), 인증 미들웨어 전무, rate-limit 전무. 즉 미인증 원격 클라이언트가 `?project=<임의 단일세그먼트>`로 홈 하위 어느 디렉토리를 프로빙할지 직접 지정할 수 있다.
- **왜 "반드시 수정"인가:** 실제 파일 노출은 downstream `resolveChangeDir`의 `existsSync + hasSpecs` 게이트(`changes.ts:67`)가 우연히 막는다(`.ssh`엔 `openspec/changes/*/specs/*/spec.md` 구조가 없으므로 404). 그러나 (a) **validator 자체가 `.ssh`/`.aws`를 "프로젝트"로 해석**하는 것은 명백한 신뢰경계 결함이고 자기 docstring("화이트리스트 검증")과 모순이며, (b) 코드 경로 비대칭(존재하는 dir는 `resolveChangeDir`까지 진행, 없는 dir는 즉시 null)이 **디렉토리 존재 오라클**(타이밍 측면)을 만든다. 이 change가 새 노출을 만든 건 아니지만, 이 change가 "원격이 프로빙 대상을 직접 지정"하는 표면을 열었으므로 배포 전 validator를 닫아야 한다.
- **수정:** lib `resolveProjectDir`을 `routes/projects.ts:53`과 동일한 `^[A-Za-z0-9_-]+$` 화이트리스트로 교체(선행 dot·유니코드·공백을 문 앞에서 차단). D-2의 원래 지시대로 **두 복제본을 하나로 통합**하고(아래 R-1) 통합본에 `openspec/changes` 존재 확인을 포함할지 결정. 추가: `PROJECTS_ROOT` 픽스처에 `.hidden` 디렉토리를 두고 거부를 잠그는 회귀 테스트(현재 `graphCrossProject.test.ts`에 dotfile 케이스 없음).

> **심각도 근거:** 파괴자(FINDING 2)·보안감사자(HIGH)·게으른시니어(FINDING 1) **3 페르소나가 동일 이슈에 수렴** → 룰 원문대로 심각도 한 단계 상승. verify.json의 "경로 조작 차단" 시나리오는 `../..`(traversal)만 실측했고 **dotfile 통과는 검증 범위 밖**이었다(verify 시나리오의 사각).

---

## 수정하면 좋은 항목

### M-1 (correctness/UX) — 드래그 저장이 부작용을 state updater 안에서 실행 → StrictMode 이중 PUT
- **위치:** `web/src/App.tsx:295-305` `onFlowNodeDragStop`, StrictMode 활성(`web/src/main.tsx:10`)
- **문제:** `saveLayout()`을 `setFlowNodes((nds) => {...})` **업데이터 콜백 안에서** 호출한다. React state updater는 순수해야 하며 StrictMode/concurrent에서 dev 빌드 시 의도적으로 2회 호출된다 → 드래그 1회에 동일 `PUT`이 2번, 실패 시 `setStatus`도 2번 발화.
- **왜 치명 아님:** payload 동일 + 전체파일 덮어쓰기(idempotent, last-writer-wins)라 데이터 손상 없음. 프로덕션 빌드에선 미발생. 하지만 dev 관측 혼란 + 불필요한 쓰기 트래픽.
- **수정:** `saveLayout` 호출을 updater 밖으로 빼고 `flowNodes`(또는 ref)에서 좌표를 읽는다. `onNodesChange`(289)가 이미 좌표를 반영하므로 updater는 `nds`를 읽을 필요조차 없다.

### M-2 (UX/진단명료성) — 5개 fetcher의 독립 `.catch(setStatus)`가 서로 덮어씀
- **위치:** `web/src/App.tsx:207-226` (뷰 로딩 effect)
- **문제:** 5개 fetcher가 각자 `.catch`로 `setStatus`를 호출한다. 공통 실패(예: `(change, project)` 쌍이 404, 또는 RO 프로젝트) 시 5개가 경쟁적으로 setStatus → last-writer-wins로 사용자는 임의의 한 메시지("기능명세서 로드 실패…")만 보고 나머지 4개도 실패했음을 모른다. 기존 패턴이지만 이 change가 추가한 `?project=` 실패 모드(RO/미지 프로젝트)가 all-five-fail 경로를 더 도달 가능하게 만든다.
- **수정(선택):** 공통 실패를 한 번만 요약하거나(예: 첫 실패 후 나머지 억제), 뷰별 실패를 개별 영역에 표기.

### M-3 (edge-case 테스트 보강 — verify 사각) — cross-root 누출·dotfile 회귀 테스트 부재
- **근거:** `verify.json`은 "feature-b via wowa-app(누출)=404"와 dotfile 거부를 **실서버 실측으로만** 확인했고 `graphCrossProject.test.ts`(통합 테스트)에는 이 케이스가 없다. 실측은 스냅샷이라 회귀를 못 잠근다.
- **수정:** 통합 테스트에 (a) cross-root 누출(A 프로젝트 change id를 B 프로젝트로 요청 → 404), (b) dotfile 프로젝트명 거부(C-1 픽스처)를 추가.

---

## 현재 상태로 유지해도 되는 항목

- **`resolveChangeDir` id traversal 방어** — `id.includes("..")`가 정규식보다 **먼저** 검사되고(`changes.ts:65`), 슬래시 허용 정규식은 `archive/`용이나 `..`가 선차단되어 `join`으로 탈출 불가. `existsSync + hasSpecs` 이중 게이트. 안전(파괴자 #6 CLEARED).
- **Express 쿼리 엣지케이스** — `?project=a&project=b`(배열)·`?project[]=x`(qs 객체) → `typeof project !== "string"` 가드로 404. `?project=`(빈 문자열) → lib `!name` 가드로 404. `%00`·`%2e%2e%2f`(URL 인코딩 traversal) → qs 선디코드 후 `..` 문자열 검사/`stat` throw로 전부 404. 안전(파괴자·보안감사자 CLEARED, 통합 테스트가 `..%2f..` 커버).
- **뷰 로딩 effect race** — `openChangeViews`가 `setSelected`·`setSelectedProject`를 동일 동기 이벤트 핸들러에서 호출 → React 18 배칭으로 effect 1회, `(신 change, 구 project)` 미스매치 없음. 안전(파괴자 #4 CLEARED).
- **하위호환(D-1)** — `?project=` 부재 시 `resolveChangeDir(id)` 기본값=글로벌 루트, `withProject`가 URL 원본 반환 → 기존 소비자 byte-동일. 통합 테스트 "미지정=기존 동작 불변" 커버.
- **skeleton change 목록 복구(3.3)** — `{planTabsAvail.length===0 && ...}` 조건은 기획문서 없는 프로젝트(wowa-app)의 **유일한 change 진입로**. 없으면 이 change의 주 시나리오(`spec.md:30` "wowa-app 카드에서 change 클릭")가 UI 도달 불가. flowforge(기획 그래프 보유)는 계속 숨김 → 2026-07-03 결정 취지 존중. 정당한 스코프 내 발견.

## 리팩토링 추천 항목

### R-1 (D-2 근본 원인 제거) — 두 `resolveProjectDir`을 하나로 통합
- **위치:** `server/src/lib/projects.ts:33` vs `server/src/routes/projects.ts:52` (검증 규칙 상이: 정규식·심링크·`openspec/changes` 확인 3개 축 모두 불일치)
- D-2/task 1.2가 "로직 이동만, 재사용, 새 검증코드 금지"를 명시했으나 실제로는 **두 번째 validator를 신설**하고 첫 번째를 divergent twin으로 남겼다. C-1의 근본 원인. 통합 시 두 버전의 `openspec/changes` 존재 확인 차이를 **의도적으로 결정**해야 한다(blind merge 금지 — D-2가 요구했으나 생략된 설계 작업).

## 적대적 검토 (4 페르소나)

- **파괴자:** ①(MEDIUM) StrictMode 이중 PUT — 부작용을 setFlowNodes updater 안에서 실행(App.tsx:295-305) → M-1. ②(LOW) lib resolveProjectDir이 dotfile/유니코드 통과 → C-1. ③(LOW) 5 catch setStatus 클로버 → M-2. Express 쿼리·effect race·id traversal은 추적 후 CLEARED(근거 상기).
- **신입 개발자:** graph.ts 각 GET 라우트가 `const id = String(req.params.id)`를 여전히 유지(78·93·108…)하는데 이제 `resolveChangeFromReq(req)`가 내부에서 id를 **다시 추출**한다 — 이중 추출(응답 JSON `{id,...}`용이라 필요하나 New Hire엔 혼란). 더 큰 트랩: **두 resolveProjectDir이 이름은 같고 규칙이 다르다**(R-1) — 6개월 뒤 어느 걸 고쳐야 하는지 오판 위험. docstring "화이트리스트 검증"이 실제 코드(블록리스트)와 불일치(C-1).
- **보안 감사자:** (HIGH→C-1) dotfile validator 통과 + 프로덕션 `PROJECTS_ROOT=/home/gaegul`(홈 전체 RO, docker-compose.yml:22·29) + `cors()` 전체허용 + 무인증 + 무 rate-limit. 실파일 노출은 `hasSpecs` 게이트가 우연히 막지만 존재 오라클·신뢰경계 결함은 실재. URL인코딩 traversal·null byte·절대경로·`~`는 CLEARED. 심링크 탈출(프로젝트 내부 dir가 심링크)은 PLAUSIBLE이나 사전 파일쓰기 권한 필요 → 위협모델 밖(하드닝 갭으로만 기록). **부수 권고(스코프 밖, 이 change 발생 아님):** CORS 오리진 제한·rate-limit·인증은 앱 전반 이슈로 별도 처리.
- **게으른 시니어:** (STRONGEST) `lib/projects.ts:33` 두 번째 validator 신설이 D-2("새 검증코드 금지·재사용")를 직접 위반 → R-1/C-1. `resolveChangeFromReq`(15줄)·`withProject`(3줄, 6회 사용)·drag-save handler·skeleton 복구는 전부 (a)필요·최소로 판정 — drag-save는 `spec.md:26·33` THEN이 명시 요구(Non-Goal "RO RW화"와 무모순: 핸들러 배선≠RW 활성화). 안 짜도 될 코드는 두 번째 validator뿐.
- **2+ 페르소나 중복 발견(심각도 상승):** **divergent `resolveProjectDir` / dotfile 통과** = 파괴자·보안감사자·게으른시니어 **3인 수렴** → LOW/HIGH를 **반드시 수정(C-1)**으로 격상. (M-1 StrictMode 이중 PUT은 파괴자 단독 → M 유지.)

## 3-2 디자인 리뷰 게이트
- **화면 작업 감지:** frontend 파일(api.ts·App.tsx) 변경 있으나 **신규 화면 0** — 기존 5종 뷰가 타 프로젝트 change에서도 열리는 것뿐, prototype.html은 propose 산출물(신규 UI 아님), 시각 토큰·레이아웃 변경 없음. skeleton 복구(3.3)는 라벨 텍스트 정직화 + 조건부 표시(기존 컴포넌트 재사용).
- **판정:** 실질적 시각 변경 없음 → 별도 `/design-review`(gstack) 생략. criteria **4(UX)·7(반응형)=해당 없음(신규 화면 없음)**. 단 M-2(에러 메시지 클로버)는 UX 진단명료성 이슈로 criteria 5(예외/오류/로딩)에 병합. DESIGN.md 미정의(repo에 없음) — 이 change엔 무관.

## 최종 배포 가능 여부

**조건부 가능 (치명 1건 수정 후)**

- 기능 자체는 verify PASS(5/5)로 실증됐고 하위호환·경로 traversal(`..`)·race는 클린이다.
- 단 **C-1(lib resolveProjectDir dotfile 통과)**은 프로덕션 배포 컨텍스트(홈 전체 RO 마운트 + 무인증 + CORS 전체허용)에서 신뢰경계 결함이며 3 페르소나가 수렴했고 D-2 설계 결정을 위반했다. downstream `hasSpecs`가 실파일 노출을 우연히 막지만, validator를 닫는 것은 **한 줄 정규식 교체 + 회귀 테스트**로 끝나는 저비용 수정이므로 배포 전 반드시 처리한다.
- C-1 수정(=R-1 통합과 함께) 후 재검증(통합 테스트에 dotfile·cross-root 케이스 추가)하면 **배포 가능**.

## 개선 우선순위 (제안)

1. **C-1** — lib `resolveProjectDir` 화이트리스트 정규식 교체(선행 dot 차단) + dotfile 거부 회귀 테스트. *(배포 차단 · 저비용 · 3페르소나 수렴 · D-2 위반)*
2. **R-1** — 두 `resolveProjectDir` 통합(C-1과 함께 수행 권장, 근본 원인 제거). *(중복 유지보수 · New Hire 트랩 제거)*
3. **M-3** — 통합 테스트에 cross-root 누출·dotfile 케이스 추가(verify 실측을 회귀로 고정). *(C-1 수정 검증에 필요)*
4. **M-1** — drag-save 부작용을 setFlowNodes updater 밖으로. *(dev 이중 PUT · 프로덕션 무영향 · idempotent)*
5. **M-2** — 5 fetcher 공통 실패 메시지 클로버 정리. *(진단 명료성 · 기존 패턴이나 신규 실패모드로 도달성↑)*
