# Tasks — planning-audit-trigger

## Phase 1: 워커측 (openspec-reports, 도로로 무충돌 — 먼저)

- [ ] 1.1 worker.py에 `action=="audit"` 분기 신설 — 파이썬 3-step subprocess(shell=False), run-id KST 생성, 각 step exit code 명시 검사, subprocess timeout
- [ ] 1.2 console.py `ALLOWED_ACTIONS`에 `"audit"` 추가, validate_project_change realpath 가드 재사용
- [ ] 1.3 워커 단위 테스트: audit 분기(정상·경로조작 거부·step 실패 전파), 파이프 EXIT 가림 방지 검증
- [ ] 🔴 1.4 [승인 게이트] projects.json에 flowforge 등록 — 사용자 승인 후
- [ ] 🔴 1.5 [승인 게이트] systemd ReadWritePaths=/home/gaegul/flowforge 추가 + daemon-reload + 워커 재시작 — 사용자 승인 후

## Phase 2: flowforge 프록시 (도로로 wireframe-device-frame 랜딩 후)

- [ ] 2.1 server/lib/auditTrigger.ts 신설 — 127.0.0.1:8810/api/tasks 호출, 서비스 토큰 Bearer, 프로젝트 키 화이트리스트
- [ ] 2.2 server/routes/docs.ts에 POST /api/docs/:project/audit-run + requireWriteAuth (도로로 랜딩 후)
- [ ] 2.3 중복 enqueue 디바운스(버튼 연타 방지)
- [ ] 2.4 라우트 통합 테스트: 무인증 401, 경로조작 4xx, 정상 202

## Phase 3: web 버튼 (도로로 랜딩 후)

- [ ] 3.1 감사 진행 버튼 — auditStatus unknown/warn일 때 노출(FeatureDetailPanel 우선, App.tsx 충돌 회피)
- [ ] 3.2 클릭→202→폴링 재조회(fetchAuditCapabilities)→판정 갱신
- [ ] 🔴 3.3 [승인 게이트] .env 서비스 토큰 주입 안내(사용자 직접, 하드코딩 금지)
- [ ] 🔴 3.4 [승인 게이트] 프로덕션 인증 강제 확인 — CF Access/WRITE_TOKEN 활성 검증 후 라우트 오픈

## Phase 4: 검증

- [ ] 4.1 RCE 방어 체크리스트 실증(경로조작·명령주입·인증우회 각 케이스)
- [ ] 4.2 e2e: 버튼→큐→워커→audit.json 갱신→UI 반영 실관찰
- [ ] 4.3 adversarial review 3페르소나(worker.py=RCE 코어 필수)
