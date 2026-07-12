# Tasks — planning-audit-trigger

## Phase 1: 워커측 (openspec-reports, 도로로 무충돌 — 먼저)

> ⏸️ 보류(worktree 밖 + 비가역): worker.py/console.py/projects.json/systemd는 모두
> `/home/gaegul/openspec-reports`·`/etc/systemd` 소재로 이 worktree(`/home/gaegul/flowforge-worktrees/4-link-audit`) 경로 밖이다.
> 1.4/1.5는 비가역 사용자 승인 게이트. 이 worktree에서 구현·검증 불가 → 전부 보류.

- [ ] 1.1 [보류: worktree 밖] worker.py에 `action=="audit"` 분기 신설 — 파이썬 3-step subprocess(shell=False), run-id KST 생성, 각 step exit code 명시 검사, subprocess timeout
- [ ] 1.2 [보류: worktree 밖] console.py `ALLOWED_ACTIONS`에 `"audit"` 추가, validate_project_change realpath 가드 재사용
- [ ] 1.3 [보류: worktree 밖] 워커 단위 테스트: audit 분기(정상·경로조작 거부·step 실패 전파), 파이프 EXIT 가림 방지 검증
- [ ] 🔴 1.4 [보류: 비가역 승인 게이트] projects.json에 flowforge 등록 — 사용자 승인 후
- [ ] 🔴 1.5 [보류: 비가역 승인 게이트] systemd ReadWritePaths=/home/gaegul/flowforge 추가 + daemon-reload + 워커 재시작 — 사용자 승인 후

## Phase 2: flowforge 프록시 (도로로 wireframe-device-frame 랜딩 후)

> ⚠️ .blocked-on.md의 착수 조건(활성 wireframe 계열 change 0개)은 이 worktree 브랜치에서
> `.check-ready.sh` = BLOCKED(flowforge-wireframe-iframe 활성). 대기 이유는 순수 머지 충돌 회피이므로
> caller 지시대로 구현하되 docs.ts 배선은 커밋 분리(머지 순서 조율용).

- [x] 2.1 server/lib/auditTrigger.ts 신설 — 127.0.0.1:8810/api/tasks 호출, 서비스 토큰 Bearer, 프로젝트 키 화이트리스트
- [x] 2.2 server/routes/docs.ts에 POST /api/docs/:project/audit-run + requireWriteAuth
- [x] 2.3 중복 enqueue 디바운스(버튼 연타 방지) — DEBOUNCE_MS 창 + 프로세스 로컬 맵
- [x] 2.4 라우트 통합 테스트: 무인증 401, 경로조작 4xx, 정상 202(auditRun.test.ts + auditTrigger.test.ts, 15건 PASS)

## Phase 3: web 버튼 (도로로 랜딩 후)

- [x] 3.1 감사 진행 버튼 — auditStatus unknown/warn일 때 노출(헤더 브레드크럼 옆; spec의 "프로젝트 상세" 단위에 맞춤. dashProject 스코프라 격리)
- [x] 3.2 클릭→202→폴링 재조회(fetchAuditCapabilities)→판정 갱신(runProjectAudit, race 가드 dashReqToken)
- [ ] 🔴 3.3 [보류: 비가역 승인 게이트] .env 서비스 토큰 주입 안내(사용자 직접, 하드코딩 금지)
- [ ] 🔴 3.4 [보류: 비가역 승인 게이트] 프로덕션 인증 강제 확인 — CF Access/WRITE_TOKEN 활성 검증 후 라우트 오픈

## Phase 4: 검증

- [~] 4.1 RCE 방어 체크리스트 부분 실증(flowforge측): 경로조작(auditRun/auditTrigger 테스트 통과)·인증우회(requireWriteAuth 401 테스트 통과)·shell 미경유. 워커측 명령주입/파이프 EXIT는 Phase 1 보류로 미실증.
- [ ] 4.2 [보류: Phase 1 미충족] e2e: 버튼→큐→워커→audit.json 갱신→UI 반영 실관찰 — 워커 audit action·projects.json 등록 부재로 실행 불가
- [ ] 4.3 [보류: worktree 밖] adversarial review 3페르소나(worker.py=RCE 코어 필수)
