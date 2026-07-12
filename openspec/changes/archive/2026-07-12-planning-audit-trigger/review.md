# 배포 전 최종 검토 — planning-audit-trigger

검토일: 2026-07-12 / 검토 범위: **두 레포 걸침** (flowforge git repo + openspec-reports 비-git 호스트 코드)

- **flowforge측(git, feat/flowforge-feedback-changes)**:
  `server/src/lib/auditTrigger.ts`(큐 프록시·Bearer·화이트리스트·디바운스),
  `server/src/routes/docs.ts`(`POST /api/docs/:project/audit-run` + requireWriteAuth, :676~),
  `server/src/lib/requireWriteAuth.ts`(게이트),
  `server/src/lib/projects.ts`(resolveProjectDir·mapFinalJudgment·readAuditStatus),
  `web/src/App.tsx`(감사 버튼 :970, runProjectAudit 폴링 :551),
  테스트 `auditRun.test.ts`·`auditTrigger.test.ts`(jest 15).
- **openspec-reports측(`/home/gaegul/openspec-reports/`, git 아님 — RCE 코어)**:
  `worker.py`(audit 분기·claude wrapper), `server.py`(ALLOWED_ACTIONS·_console_authorized·_handle_create_task),
  `console.py`(validate_project_audit), `/etc/systemd/system/openspec-worker.service`(샌드박스),
  `~/.config/openspec-reports/projects.json`(flowforge 등록).

검증 입력: `verify.json` = **finalJudgment PASS (7/7, fail 0, skipped 0), archiveGate.open=true, edge 3/3 "충분"**.
본 review는 재실증하지 않고 그 위에서 판단한다. 정적검토와 실행검증을 구분해 표기했고, 이번 세션에서 직접 라이브 재확인한 항목은 명시한다.

> **task 4.3(worker.py 3페르소나 미수행)를 이 review의 적대 패스로 통합 수행함.** worker.py=RCE 코어라 보안 감사자 페르소나를 특히 철저히 적용했다.

---

## 반드시 수정해야 할 항목

- **없음** (배포 차단급 신규 취약점 없음)

세 보안 게이트를 이번 세션에서 라이브로 재확인해 verify.json 실증분과 일치함을 확인했다:
- 경로조작 `..%2f..%2fetc` → `HTTP 400 {"error":"invalid_project"}` (라이브 8812)
- 미등록 프로젝트 → `HTTP 400` (라이브 8812)
- 큐 무인증 트리거 → `HTTP 401 {"error":"unauthorized"}` (라이브 127.0.0.1:8810)
- 라이브 버튼 렌더: ssoksok(unknown) 상세 진입 → `[data-testid=audit-run-btn]` "🔍 감사 진행" 노출 확인(browse 8812)

아래 두 항목은 **코드 결함이 아니므로 반드시-수정이 아니다.** 배포 시 고지(config·문서 정합)로 다룬다.

## 수정하면 좋은 항목

1. **[배포 config 고지 — 코드 결함 아님] 프로덕션 인증 강제 미완 (tasks 3.4 보류)**
   `requireWriteAuth.ts:24 gateEnabled()` = CF Access env 또는 `FLOWFORGE_WRITE_TOKEN` 중 하나라도 있어야 게이트 활성. 둘 다 없으면 `:57` 개발 모드 passthrough → **audit-run이 무인증 공개 RCE 트리거**가 된다. 현재 flowforge localhost(dev, 8812)가 바로 이 상태다(verify.json scenario "무인증→401"도 dev-mode passthrough라 라이브 401 대신 jest 게이트 활성으로 실증한 사실을 명시하고 있음).
   → **flowforge를 공개(gaegul.house)로 노출하기 전, compose env에 `FLOWFORGE_WRITE_TOKEN` 또는 CF Access AUD/TEAM_DOMAIN 주입이 강제**여야 한다. 사용자가 "나중"으로 명시 보류한 결정이므로 archive를 막지는 않되, **배포 릴리스 노트에 반드시 명시**한다(design 게이트 5, proposal §5). 가능하면 프로덕션 부팅 시 게이트 미활성이면 로그 경고 또는 라우트 비활성으로 fail-safe 승격 권장.

2. **[문서 드리프트] proposal.md:12가 실제 구현과 불일치**
   `proposal.md:12`은 여전히 "`claude`가 아니라 결정적 파이썬 3-step(audit_scan → audit_match → generate_report)을 shell=False subprocess로 **직접 실행**"이라고 쓴다. 그러나 실제 채택안은 `worker.py:48 ACTION_PROMPTS["audit"]="/openspec-audit"` → `claude -p /openspec-audit --dangerously-skip-permissions`(스킬 경유)다. design.md:18·tasks.md:7~13은 이 divergence를 정직하게 재조정(af0d6c3)했으나 **proposal.md만 원안 문구가 남았다.** archive되면 이 모순된 proposal이 영구 보존된다.
   → proposal.md:12를 design/tasks와 같은 "claude+openspec-audit 스킬 경유(판정은 스킬 내부 결정론 3-step)" 문구로 정합화 권장(archive 전 1줄 수정).

3. **[design 체크리스트 미이행] worker.py subprocess에 timeout 부재 (design.md:80 자기 주장 위반)**
   design.md:80 "견고성" 항목이 **"subprocess timeout 추가(기존 워커 갭)"**를 명시적 체크리스트로 걸었으나, `worker.py:120 _subprocess_runner`는 `return proc.wait()`로 **무한 대기**한다. `--dangerously-skip-permissions` claude가 audit 중 프롬프트·네트워크·무한루프로 hang-off하면 워커가 그 잡에 영구 점착되어 **큐 전체가 정지**한다(직렬 pop이라 후속 잡 전부 블록). systemd `Restart=always`는 워커 크래시만 복구할 뿐 hang은 복구 못 한다.
   → design이 스스로 요구한 방어라 이행 권장. 최소한 `run_one` 레벨의 wall-clock deadline(예: 스트림 무진전 N분 → SIGTERM) 또는 claude `--max-turns`/타임아웃 래핑. 단 verify e2e에서 audit이 정상 종료(task done, audit.json 갱신)를 실관찰했으므로 정상 경로는 동작하며, 이는 *비정상 경로 견고성*의 미완이다.

## 현재 상태로 유지해도 되는 항목

- **얇은 프록시 아키텍처(auditTrigger.ts)**: flowforge 컨테이너가 audit을 직접 안 돌리고 큐에 enqueue만 하는 설계는 RO 마운트·python3 부재 제약에 정확히 대응. 큐 호출은 loopback 고정(`queueUrl():20`), shell 미경유(fetch JSON), project는 문자열 필드로만 전달 — 인젝션 표면 없음. 유지.
- **다층 화이트리스트**: 정규식 `^[A-Za-z0-9_-]+$`(auditTrigger.ts:29) + `resolveProjectDir`(projects.ts:33, 심링크·비디렉토리·부재 거부) + 워커측 `validate_project_audit`→`_validate_project`(console.py:184, 등록 대조 + realpath) — 4겹 방어. 라이브 400으로 실증. 유지.
- **디바운스(auditTrigger.ts:41~73)**: 프로세스 로컬 맵 + 5초 창. 버튼 연타 큐 폭주 방지 적정. 라우트는 debounced를 202 관용 처리(docs.ts)로 UX 매끄러움. 유지.
- **claude wrapper 2겹 방어(DISALLOWED_TOOLS + systemd)**: 아래 "적대적 검토·보안 감사자" 참조 — **유효 판정**. 유지.
- **runProjectAudit race 가드(App.tsx:551, dashReqToken)**: 감사 중 다른 카드 이동 시 폴링 결과 폐기. 정확. 유지.
- **audit 템플릿의 change 미유출**: `ACTION_PROMPTS["audit"]="/openspec-audit"`엔 `{change}` 자리가 없어 sentinel `change="-"`나 악성 change 문자열이 프롬프트로 새지 않음(test_worker.py test_audit_injection_change_does_not_leak_to_prompt로 실증). `.format(change=...)`도 audit엔 무영향. 유지.

## 리팩토링 추천 항목

- **없음** (diff가 작고 응집도 높음. auditTrigger.ts는 단일 책임, 과잉추상화 없음)
- (경미) `readAuditStatus`(projects.ts:129)와 워커 audit.json 생성이 서로 다른 레포·언어에 있어 finalJudgment enum(`PASS`/`FAIL`/`조건부`/`UNVERIFIABLE`)이 두 곳에서 하드코딩된다. 지금은 4값뿐이라 문제없으나, 향후 판정값이 늘면 두 레포 동시 수정 필요(암묵 결합). 기술부채 후보로만 기록 — 지금 조치 불필요.

## 적대적 검토 (4 페르소나) — worker.py 포함 전체 scope

- **파괴자 (Saboteur)**: **worker.py:120 subprocess timeout 부재** — claude hang-off 시 직렬 큐 전체 정지(위 "수정하면 좋은" 3). systemd Restart는 crash만 복구, hang 미복구. → 실제 견고성 갭(BLOCK 아님: 정상경로는 verify e2e로 done 실증, systemd `TimeoutStopSec=15`+`KillMode=control-group`이 워커 재시작 시엔 자식 회수). 부차: 큐 경쟁은 `pop_next` 직렬(test_pop_serial)이라 race 없음.
- **신입 개발자 (New Hire)**: **proposal.md:12 원안 문구가 실제 구현(claude 스킬 경유)과 반대로 남아있음**(위 2) — 6개월 뒤 proposal만 읽으면 "파이썬 직접 실행"으로 오해. design/tasks는 각주로 정직하나 proposal이 함정. 코드 자체는 주석이 충실(auditTrigger.ts 헤더, worker.py:36~49 ACTION_PROMPTS 설명, systemd 유닛 인라인 주석)해 의도 추적 양호.
- **보안 감사자 (Security Auditor) — RCE 코어**: **claude wrapper 2겹 방어 = 유효 판정.**
  - ① **DISALLOWED_TOOLS(worker.py:63)**: git push/fetch/pull/remote·rm·sudo·curl·wget·ssh·scp·nc·WebFetch deny. 워커 주석 스스로 "**2차(약한) 방어**"로 정직하게 격하(prefix 매칭 우회면 존재 — 절대경로 `/usr/bin/git` 등). 이 자기평가가 정확하다.
  - ② **systemd 샌드박스(openspec-worker.service) = 진짜 경계, 강함**: `ProtectSystem=strict`+`ProtectHome=read-only`+`ReadWritePaths` 화이트리스트(openspec-reports·등록 프로젝트 4개·.claude·config만) → **audit이 임의 경로 쓰기 불가**. `IPAddressDeny=any`+`IPAddressAllow`(localhost·Anthropic 160.79.104.0/24만)+`RestrictAddressFamilies` → **임의 호스트 egress 차단**(credential 만에 하나 읽어도 유출 불가). `.credentials.json`·`.claude.json` `ReadOnlyPaths`로 **git push용 토큰 변조 차단**. `NoNewPrivileges`·`RestrictNamespaces`·`LockPersonality` 등 하드닝. → claude가 audit 중 **임의 쓰기·네트워크·git push 전부 OS 레벨에서 봉쇄**. 2겹 방어 유효.
  - **인젝션**: project는 `_handle_create_task`(server.py:634)에서 str 강제 → ALLOWED_ACTIONS 화이트리스트(:639) → validate_project_audit 등록 대조. worker `build_command`(worker.py:79)는 argv 리스트 반환, `subprocess.Popen(shell=False, worker.py:109)`. shell 미경유 실증(test_injection_change_stays_single_arg). 화이트리스트 정규식 우회 불가(`/`·`\`·`\x00`·`..` 전부 `_safe_name`·`resolveProjectDir`에서 거부, 라이브 400).
  - **경로조작**: resolveProjectDir(lstatSync 심링크 거부) + validate_project_audit→_validate_project(등록 화이트리스트, 등록 안 된 건 애초에 거부라 realpath 트래버설 표면 최소). 라이브 400 실증.
  - **인증우회/토큰유출**: 큐 `_console_authorized`(server.py:181)가 **CF Access는 email claim 있는 사람만**(service token=common_name만 → 거부)으로 발행 토큰의 워커 트리거 권한확대 차단. Bearer=CONSOLE_TOKEN 상수시간(secrets.compare_digest). flowforge측 Bearer도 constantTimeEqual(requireWriteAuth.ts:29). 401 응답은 내부사유 미노출(`{error:"unauthorized"}`). 토큰 하드코딩 없음(env, tasks 3.3 f423730). → **우회 벡터 없음.**
  - **잔여(고지)**: 개발 모드 passthrough(위 "수정하면 좋은" 1) = 프로덕션 노출 전 env 강제 필수. 이건 코드가 아니라 배포 config.
- **게으른 시니어 (Lazy Senior)**: 과잉구현 **없음**. auditTrigger.ts는 최소 프록시(래퍼·추상화·새 의존성 0, stdlib fetch만). 워커는 기존 verify 인프라 재사용(design C안 — 큐·샌드박스·orphan reaping 재구현 회피 = "안 짠 코드"). audit 분기는 `ACTION_PROMPTS`에 1줄·`ALLOWED_ACTIONS`에 1항목·`validate_project_audit`(기존 `_validate_project` 재사용) 추가 = 최소 diff. YAGNI 위반 없음.
- **2+ 페르소나 중복 발견 (심각도 상승)**: **worker.py:120 timeout 부재** — 파괴자(큐 정지) + (간접) 보안 감사자(hang한 `--dangerously-skip-permissions` 프로세스 장기 잔존)가 같은 지점 지목 → 심각도 한 단계 상승. 단 정상경로 e2e done 실증 + systemd 재시작 시 control-group 회수가 있어 **"수정하면 좋은"의 최상위**로 유지(BLOCK까지는 아님 — file:line은 있으나 신규 exploit이 아닌 견고성 갭).

## 최종 배포 가능 여부

**배포 가능** (반드시-수정 0건).

단 **archive 및 프로덕션 노출 전 3가지 고지·조치를 릴리스 노트에 명시**:
1. 🔴 **프로덕션 인증 강제(tasks 3.4)**: 공개 노출 전 `FLOWFORGE_WRITE_TOKEN` 또는 CF Access env 주입 필수 — 미주입 시 무인증 RCE 트리거. (사용자 보류 결정 존중, 그러나 노출 게이트로 명시)
2. proposal.md:12 문서 드리프트 1줄 정합화(선택, archive 전 권장).
3. worker.py subprocess timeout(design.md:80 자기 요구 사항) — 후속 착수 권장.

verify.json이 PASS(7/7)이고 archiveGate.open=true이며, 본 review에서 세 보안 게이트·버튼 렌더를 라이브 재확인했다. claude wrapper 2겹 방어(DISALLOWED_TOOLS + systemd 샌드박스)는 **유효**하다 — audit이 임의 쓰기·네트워크·git push를 OS 레벨에서 못 한다. **RCE 관점의 배포 차단 사유 없음.**

## 개선 우선순위 (제안)

1. **[배포 고지, 최우선] 프로덕션 인증 강제(tasks 3.4)** — 미이행 시 공개 RCE. 코드 결함은 아니나 노출 전 반드시 env 주입. 영향: 치명(노출 시)·조치: config 1회.
2. **[견고성] worker.py subprocess timeout(worker.py:120)** — design.md:80 자기 요구. claude hang 시 큐 정지. 영향: 가용성·조치: run_one deadline 추가.
3. **[문서 정합] proposal.md:12 divergence 1줄 수정** — archive 시 모순 영구 보존 방지. 영향: 유지보수·조치: 1줄.
4. **[기술부채, 감시만] finalJudgment enum 두 레포 하드코딩** — 판정값 확장 시 동시수정 필요. 지금 조치 불필요.
