# Tasks — planning-audit-trigger

## Phase 1: 워커측 (openspec-reports, 도로로 무충돌 — 먼저)

> ✅ 완료. worker.py/console.py/server.py/projects.json/systemd 는 `/home/gaegul/openspec-reports`·
> `/etc/systemd` 소재라 이 worktree 밖이었으나, 사용자 승인 게이트를 거쳐 호스트에서 직접 구현·검증됨.
> **실제 구현 방식 각주**: 원안(tasks 1.1)은 "워커에 파이썬 3-step subprocess 직접 분기"였으나,
> 구현 단계에서 `claude -p /openspec-audit`(openspec-audit 스킬 경유)로 뒤집었다. 스킬이 이미 그
> 3-step(audit_scan/audit_match/generate_report, stdlib-only)을 정본 실행체로 감싸고 있어 DRY·단일진실.
> **판정(PASS/FAIL/UNVERIFIABLE)은 스킬 내부 결정론 3-step이 route/symbol 문자열 매칭으로 산출**하고
> LLM은 UNVERIFIABLE 상한에 묶여 PASS를 못 만든다(design.md·spec.md af0d6c3 재조정 반영).

- [x] 1.1 worker.py 에 `action=="audit"` 분기 신설 — `ACTION_PROMPTS["audit"]="/openspec-audit"`(worker.py:48), run-id KST 생성, exit code 명시 검사. ⚠️각주: 실제 구현=claude+openspec-audit 스킬 경유(파이썬 3-step 직접 subprocess 아님). 판정 자체는 스킬 내부 결정론 3-step이 산출(spec af0d6c3 재조정 정합).
- [x] 1.2 console.py + server.py 화이트리스트 — server.py `ALLOWED_ACTIONS={"verify","audit"}`(server.py:90), console.py `validate_project_audit`(console.py:224, `_validate_project` realpath 가드 재사용).
- [x] 1.3 워커 단위 테스트 — audit 분기(정상 cwd·미등록 프로젝트 거부·명령주입 change 프롬프트 미유출·zero/nonzero exit) test_worker.py 19건 PASS, console 25건 PASS.
- [x] 🔴 1.4 projects.json 에 flowforge 등록 — `{"name":"flowforge","path":"/home/gaegul/flowforge"}`(사용자 승인 후 등록됨).
- [x] 🔴 1.5 systemd `ReadWritePaths=/home/gaegul/flowforge` 추가 + daemon-reload + 워커 재시작 — 설치본 유닛 34행 확인. ⚠️각주: 네트워크 격리 해소(OPENSPEC_BIND=0.0.0.0 + OPENSPEC_QUEUE_URL 게이트웨이)와 CONSOLE_TOKEN 주입(3.3)도 실제로 필요했다(커밋 f423730).

## Phase 2: flowforge 프록시 (도로로 wireframe-device-frame 랜딩 후)

- [x] 2.1 server/lib/auditTrigger.ts 신설 — 127.0.0.1:8810/api/tasks 호출, 서비스 토큰 Bearer, 프로젝트 키 화이트리스트
- [x] 2.2 server/routes/docs.ts 에 POST /api/docs/:project/audit-run + requireWriteAuth (docs.ts:676)
- [x] 2.3 중복 enqueue 디바운스(버튼 연타 방지) — DEBOUNCE_MS 창 + 프로세스 로컬 맵
- [x] 2.4 라우트 통합 테스트: 무인증 401, 경로조작 4xx, 정상 202(auditRun.test.ts + auditTrigger.test.ts, jest 15건 PASS)

## Phase 3: web 버튼 (도로로 랜딩 후)

- [x] 3.1 감사 진행 버튼 — auditStatus unknown/warn 일 때 노출(App.tsx:970, dashProject 스코프 격리, data-testid=audit-run-btn)
- [x] 3.2 클릭→202→폴링 재조회(fetchAuditCapabilities)→판정 갱신(runProjectAudit, race 가드 dashReqToken)
- [x] 🔴 3.3 .env 서비스 토큰 주입 — CONSOLE_TOKEN/OPENSPEC_QUEUE_URL 게이트웨이 매핑 주입됨(커밋 f423730, 사용자 승인 후). 하드코딩 없음.
- [~] 🔴 3.4 [보류: 사용자 결정] 프로덕션 인증 강제 — CF Access/WRITE_TOKEN 활성 검증 후 라우트 오픈. 사용자가 나중으로 보류 결정. 현재 flowforge localhost(dev)는 requireWriteAuth 게이트 미활성(gateEnabled()=false)=passthrough. 프로덕션 노출 전 env 강제 필요(design 게이트 5, 미완).

## Phase 4: 검증

- [x] 4.1 RCE 방어 실증 — flowforge측: 경로조작(auditRun/auditTrigger 테스트)·인증우회(requireWriteAuth 401 테스트)·shell 미경유. 워커측: audit 분기 명령주입 change 프롬프트 미유출(test_worker.py)·미등록 프로젝트 거부·subprocess argv(shell=False)·ALLOWED_ACTIONS 화이트리스트 실증. 승격 근거=워커 테스트 통과로 워커측도 이제 실증됨.
- [x] 4.2 e2e: 버튼→큐→워커→audit.json 갱신 실관찰 — 큐 task 2(project=flowforge, action=audit) **status=done**, `flowforge/docs/audit.json`(192KB, runId=run-20260712-1224, finalJudgment=FAIL) 생성. FAIL 은 audit 이 정상 판정을 낸 것(코드↔spec 대조 결과)이지 audit 실행 실패 아님.
- [ ] 4.3 [보류: 별도 착수] worker.py adversarial review 3페르소나 — 워커코드는 완료·테스트 통과했으나 이 change 범위에서 3페르소나 정식 리뷰는 미수행. worker.py=RCE 코어라 archive 전 별도 리뷰 권장(사유: worktree 밖 작업으로 정식 리뷰 세션 미실시).
