# 배포 전 최종 검토 — flowforge-pin-feedback-lifecycle
검토일: 2026-07-12 / 검토 범위: PIN change diff만(commit `19f20e9` feat + `f6ceb00` test). 파일: `shared/src/wire-suggestion-types.ts`·`shared/src/index.ts`(스키마 id/status), `server/src/lib/wireDocs.ts`(normalizeFeedback·readWireframeFeedback·updateWireframeFeedback·append 확장), `server/src/routes/docs.ts`(GET/PATCH 신설·isWireframeFeedbackPatch), `web/src/api.ts`(fetch/update 클라이언트), `web/src/WireframePinFeedback.tsx`(마운트 시딩·resolve 토글·저장 분기), `web/src/styles.css`(resolved 스타일). 전체 앱이 아니라 이 change의 diff만 검토.

> 역할 분리: **verify=실증(머신 경험적), review=판단.** 이 검토는 재실행하지 않고 `verify.json`(finalJudgment=PASS, 15 scenario·6 requirement·edge 전부 "충분", archiveGate.open=true)을 판단 입력으로 삼는다. 라이브(`localhost:8812`) GET/UI 관찰은 verify 결과 교차확인 목적의 **정적+라이브 확인**이지 재검증이 아니다.

## review criteria brief (in-session)
- **changeTypes**: `frontend`(WireframePinFeedback.tsx·styles.css·api.ts, prototype.html 존재) + `backend`(wireDocs.ts 생애주기 lib·docs.ts GET/POST/PATCH 라우트). → criteria 4·7 in-scope.
- **ruleSets**: resolvedFrom `~/.claude/rules/`. selected: 10-coding-style(소스 변경)·20-testing·30-security(PATCH/write auth)·60-design+70-adversarial(frontend). absent: `<repo>/.claude/rules/`(없음, 폴백 아님 — home dir로 해소).
- **designYardsticks**: D1 스키마(id/status only, author 제외) · D2 lazy 하위호환 결정적 id · D3 PATCH 겸용 라우트(옵션 A 채택) · D4 web 시딩/토글/in-place · D5 단일프로세스 sync write=락 불필요. Non-Goals: author/멀티유저·hard delete UI·AI 재생성·change/spec 자동반영 = **의도적 제외**(누락으로 오지적 금지).
- **specsVerifyFocus**: verify.json에 FAIL/검증안함/예외미검증/SKIPPED **0건** → focus는 "verify가 실측 못 한 런타임 경계"로 이동 → 3-1 적대 패스가 담당(serverId 재조회 매칭·write auth config).
- **adversarialScope**: full change scope (NOT narrowed by this brief).

## 반드시 수정해야 할 항목
- 없음 (치명 `file:line` 근거를 가진 배포 차단 결함 없음. verify PASS·라우트/lib 테스트 97건 커버·라이브 GET 실동작 확인. write auth dev-mode는 **이 change 코드 결함이 아니라 인프라 config 사항** — 아래 "배포 전 고지" 참조).

## 배포 전 고지 (config/인프라 — 이 change 코드 결함 아님)
- **프로덕션 write 토큰 env 미주입 상태**: `server/src/lib/requireWriteAuth.ts:56-60` — CF Access env도 `FLOWFORGE_WRITE_TOKEN`도 없으면 게이트를 무조건 통과시킨다(design **D-3의 의도된 dev 동작**, 주석 `:8-10`에 명시). verify가 라이브 컨테이너에서 두 env가 빈값이라 PATCH가 무인증 통과함을 관측(verify.json `layers[server].basis`: "PATCH auth-off dev모드"). PATCH 라우트는 `docs.ts:542`에서 `requireWriteAuth`를 **정상 부착**했다(POST append와 동일 정책) — 코드는 옳다. **배포 config에서 `FLOWFORGE_WRITE_TOKEN` 또는 CF Access(AUD+TEAM_DOMAIN)를 compose env로 주입**해야 프로덕션에서 write 게이트가 강제된다. 인증 강제 자체는 별도 change 소관(이 change는 게이트를 붙였을 뿐 env 주입은 인프라).

## 수정하면 좋은 항목
- **[criteria 3·10] 신규 핀 serverId 재조회 매칭이 값 기반이라 취약** — `web/src/WireframePinFeedback.tsx:410-415`: 새 핀 append 후 `screenId·text·xPct·yPct`가 모두 일치하는 레코드를 `.pop()`으로 골라 serverId를 확보한다. **완전히 동일한 좌표·텍스트로 2개를 남기면** 두 핀이 같은(마지막) serverId에 묶여, 하나를 resolve/수정하면 다른 하나가 유령처럼 안 바뀌거나 잘못된 레코드를 건드릴 수 있다. 서버가 이미 append 응답에 부여한 id를 반환하면 이 추측 매칭이 불필요해진다(게으른 시니어 항목과 병합). 개인용·저빈도라 치명은 아니나 기술부채. **개선안**: POST append 응답 body에 생성된 `id`를 포함(서버 `appendWireframeFeedback`가 이미 `genId()`로 만든 값)해 재조회 없이 serverId 확보.
- **[criteria 5] resolve/수정 PATCH 실패가 조용히 삼켜질 여지** — `WireframePinFeedback.tsx:381-386`(toggleResolve)·`:394-395`(수정): `await updateWireframeFeedback(...)`가 reject(404/네트워크)하면 예외가 상위로 전파되지만, `PinList`의 `onToggleResolve={(p) => void toggleResolve(p)}`(`:462`)가 `void`로 처리해 **rejected promise가 unhandled**가 된다(로컬 상태는 이미 갱신됨 → UI와 서버 불일치 가능). `api.ts:updateWireframeFeedback`는 404/400에 친화적 에러 메시지를 던지는데 그 메시지가 사용자에게 도달하지 않는다. 저장(`onSaved`)은 팝오버가 throw를 표면화하지만 resolve 토글은 표면화 경로가 없다. **개선안**: toggleResolve에 try/catch로 실패 시 로컬 status 롤백 + 토스트/인라인 에러.
- **[criteria 5] 마운트 GET 로드 실패가 완전 무음** — `WireframePinFeedback.tsx:344-346`: `.catch(() => {})`로 빈 상태 유지. 읽기 실패(서버 5xx·네트워크)와 "정말 피드백 없음"이 화면상 구분 불가 → 사용자가 남긴 피드백이 안 보여도 알 수 없다. 개인용 저위험이나, 최소 console 경고나 재시도 힌트 권장(현재 주석은 "조용히 빈 상태 유지"로 의도 명시 — 의도적 트레이드오프임은 인정).

## 현재 상태로 유지해도 되는 항목
- **D5 동시성 방어(락 없음)** — `wireDocs.ts:354·376` read-modify-write + `writeFileSync`(sync). 단일 프로세스·이벤트루프 순차·sync write 블록이라 append 직후 resolve에도 타 레코드 유실 없음(verify "append 직후 resolve" scenario PASS). 파일 락 도입은 과잉(design D5 근거 타당).
- **하위호환 lazy 정규화** — `normalizeFeedback`(`wireDocs.ts:284-303`) 결정적 legacy id(`legacy-<i>-<ts>-<x>-<y>`)를 읽을 때만 주입, 파일 미변경. 라이브 flowforge 실 레코드에서 `legacy-0-2026-07-10T...` 부여 확인(GET 실측). read마다 같은 id → resolve 대상 안정. 설계 의도 정확히 구현.
- **입력 검증 화이트리스트** — `isWireframeFeedbackPatch`(`docs.ts:522-534`): status enum 화이트리스트·빈 text 거부·최소 1필드 강제. 빈 text를 라우트에서 400으로 걸러 lib의 `ok:false`가 순수 "미존재 id" 404 신호가 되게 한 분리(주석 `:518-521`)는 깔끔.
- **traversal 방어 재사용** — GET/PATCH 모두 `resolveDocsDir`(`lib/docs.ts:81-89`) 경유. `..`·비영숫자 거부 → 404. `:id`는 파일경로가 아니라 배열 `findIndex` 키라 별도 traversal 벡터 아님. 테스트 `..%2f` 404 커버.
- **스키마 최소주의** — id·status 2필드만 추가, author 미추가(단독 사용 환경). Non-Goal 준수(과잉 스키마 회피).

## 리팩토링 추천 항목
- **POST append 응답에 id 반영** — 위 "serverId 재조회" 개선의 근본. 서버가 append 시 생성한 id를 응답에 실으면 web의 값기반 재조회 매칭(`:410-415`)·POST후 GET 왕복(`:407`)을 제거 가능(게으른 시니어: "안 짜도 될 왕복"). 다만 POST 라우트를 건드리므로 별도 작은 change로 분리 권장(이 change는 "POST 불변" 계약을 지킴 — 지금 안 바꾼 건 옳은 판단).
- **로컬 `Pin.id`(표시번호) vs `serverId`(영속) 이원 관리** — `seqRef`+`serverId` 병행은 필요하지만(마운트 재시딩 때 번호 재발급) 이해 비용이 있다. 6개월 뒤를 위해 두 id의 역할 주석은 이미 `:34-36`에 있어 충분.

## 적대적 검토 (4 페르소나)
- **파괴자**: (1) 동일 좌표·동일 텍스트 핀 2개 → serverId 값기반 매칭(`:413 .pop()`)이 둘을 같은 serverId에 묶음 → resolve 오작동 가능(위 "수정하면 좋은" 1번). (2) resolve PATCH가 404/네트워크로 실패해도 `void toggleResolve`(`:462`)라 로컬 status는 이미 바뀐 채 롤백 없음 → UI↔파일 불일치(위 항목). (3) read-modify-write race는 sync write로 방어됨 확인(verify PASS) — 여기는 깨끗.
- **신입 개발자**: `normalizeFeedback`의 legacy id 포맷 `legacy-<i>-<ts>-<x>-<y>`(`:296`)에서 **index `i`가 배열 위치**라, 만약 앞 레코드가 (미래에) 삭제되면 뒤 레코드의 legacy id가 바뀔 수 있다 — 현재 hard delete UI가 없어(Non-Goal) 실현 안 되지만, 삭제 기능이 생기면 index 기반 파생 id가 깨진다. 주석에 "index 파생 id는 삭제 미도입 전제"를 한 줄 남기면 미래 개발자가 안전. (경미)
- **보안 감사자**: (1) write auth dev-mode(`requireWriteAuth.ts:57-60`) — 프로덕션 env 미주입 시 PATCH 무인증. **이 change 코드가 아니라 config 사항**이나 배포 전 반드시 env 주입 고지(위 "배포 전 고지"). (2) traversal: `resolveDocsDir` 화이트리스트로 GET/PATCH 방어됨, `:id`는 파일경로 아님 — 인젝션 벡터 없음. (3) 에러 메시지: 401은 내부사유 미노출(`unauthorized`), 404/400은 일반 문구 — 민감정보 노출 없음. (4) PATCH body는 `isWireframeFeedbackPatch` 화이트리스트로 status/text만 허용 — 임의 필드 주입 불가.
- **게으른 시니어**: 신규 핀 serverId 확보를 위한 **POST후 GET 재조회 왕복 + 값기반 매칭**(`:403-415`)은 서버가 append 응답에 id를 실었다면 **통째로 불필요**했다("가장 좋은 코드는 안 짠 코드"). 단 이 change가 "POST append 라우트 불변"을 계약으로 지킨 결과이므로, 지금 diff 안에서는 정당한 우회다 — 근본 해소는 별도 change(리팩토링 항목). 그 외 lib 3함수(read/append/update)는 각각 spec THEN에 1:1 대응, 과잉 추상화 없음. resolve 겸용 PATCH 1라우트(옵션 A)는 라우트 분리보다 적게 짠 게으름 위계 준수.
- **2+ 페르소나 중복 발견(심각도 상승)**: **serverId 값기반 매칭**을 파괴자+게으른 시니어 2명이 지적 → 심각도 한 단계 상승(원래 minor → "수정하면 좋은" 상단·리팩토링 추천으로 승격). 단 개인용·동일좌표 중복 입력이 드물어 배포 차단(치명)까지는 아님. **write auth dev-mode**를 보안 감사자가 지적하나 config 사항이라 코드 치명과 분리.

## 최종 배포 가능 여부
**배포 가능** (치명 0건). verify.json PASS(scenario 15/15·edge 전부 충분·archiveGate.open=true), 라우트/lib 테스트 97건이 미존재 id·빈 text·화이트리스트·traversal·in-place·하위호환·동시성을 커버, 라이브 GET/UI 실동작 확인. 단 **배포 전 config 조치 1건 필수**: 프로덕션 컨테이너에 `FLOWFORGE_WRITE_TOKEN`(또는 CF Access AUD+TEAM_DOMAIN) env 주입 — 없으면 PATCH가 무인증 통과(design D-3 dev-mode). 이는 이 change 코드 결함이 아니라 인프라 설정이므로 archive는 진행 가능하되, 라이브 프로덕션 노출 전 env 주입을 체크리스트로 남긴다.

## 개선 우선순위 (제안)
1. **(배포 전 config) 프로덕션 write 토큰 env 주입** — 미주입 시 PATCH 무인증. 코드 무결하나 인프라 조치 필수. 영향: 무단 피드백 변조 가능성(개인 서버라 실위험 낮으나 원칙).
2. **(수정하면 좋음) POST append 응답에 id 반영 → serverId 재조회 제거** — 동일좌표 중복 핀의 resolve 오작동 근본 해소 + 왕복 제거. 2 페르소나 중복 지적. 별도 작은 change 권장(POST 계약 변경이므로).
3. **(수정하면 좋음) resolve 토글 실패 롤백/표면화** — `void toggleResolve` unhandled rejection + UI↔파일 불일치. try/catch + 롤백.
4. **(경미) 마운트 GET 로드 실패 무음 완화** — 읽기 실패와 빈 목록 구분(console 경고/재시도 힌트).
5. **(경미) legacy id index 파생에 "삭제 미도입 전제" 주석** — 미래 hard delete 도입 시 id 안정성 깨짐 예방.
