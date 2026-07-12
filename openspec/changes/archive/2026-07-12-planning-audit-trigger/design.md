# Design — planning-audit-trigger

## 결정: 후보 C 변형 (openspec-reports 워커 재사용 + 결정적 audit 분기)

3후보 중 "기존 openspec-reports 큐/워커/systemd 샌드박스를 재사용하되, 워커에 `claude`가 아닌 결정적 파이썬 audit 실행 분기를 신설"로 확정.

| 기준 | A. 전용 호스트 워커 신설 | B. 컨테이너 직접 실행 | **C. 워커 확장(채택)** |
|---|---|---|---|
| RCE 격리 | 강 | 매우 약(컨테이너 탈출) | 강(기존 샌드박스) |
| 인프라 재사용 | 패턴만 | 없음 | 큐·워커·CF Access·orphan reaping 전부 |
| 결정적 실행 | 최적 | — | 새 파이썬 분기 추가 필요 |
| 블라스트 반경 | flowforge 국소 | 전체 호스트 | verify 파이프 인접(주의) |

- **B 탈락**: 컨테이너가 호스트 명령 실행 = RCE 방어 무의미.
- **A vs C**: A는 큐 db·orphan reaping·stale reclaim·CF Access를 재구현 → 5건 방어를 다시 밟을 위험. C는 굳은 코어 재사용.
- **C의 함정(원안)**: 현 워커는 `claude -p "/openspec-verify {change}"`만 실행. audit의 판정은 LLM 불필요한 결정적 파이썬이라, claude로 감싸면 오케스트레이션이 비결정적·토큰소비·느림. → 원안은 "워커에 claude 안 거치고 파이썬 3-step 직접 실행하는 분기 신설"이었다(결정론·토큰절약·속도·보안표면 축소 목적).

- **실행 단계 재조정(실제 채택) — claude+openspec-audit 스킬 경유(A/C 방향)**: 구현 단계에서 원안(워커에 3-step 직접 분기)을 뒤집고, 워커가 `claude -p /openspec-audit`로 스킬을 실행하는 방식을 채택했다. 정직하게 그 이유와 트레이드오프를 기록한다.
  - **채택 이유(DRY·단일진실)**: openspec-audit 스킬이 **이미 그 3개 스크립트(audit_scan/audit_match/generate_report, stdlib-only, subprocess/network 0건)를 정본 실행체로 감싸고 있다.** 워커에 3-step을 다시 구현하면 스킬과 중복 유지보수가 되고 두 실행경로가 갈라질 위험이 있다. 스킬 재사용이 DRY이자 단일진실.
  - **판정 결정론은 유지된다**: claude는 스크립트 실행을 오케스트레이션하고 behavior 라인에 주석만 달 수 있을 뿐, **판정(PASS/FAIL/UNVERIFIABLE) 자체는 스킬 내부 결정론 스크립트가 route/symbol 문자열 매칭으로 산출**한다. PASS는 스크립트 산출물에만 근거하고, LLM 판단은 UNVERIFIABLE 상한에 묶여 **LLM이 PASS를 만들 수 없다.** 따라서 결과 신뢰성은 원안과 동등하게 담보된다.
  - **수용한 비용(트레이드오프)**: claude 오케스트레이션 경유로 (a) 토큰 소비, (b) 실행 시간 증가·변동, (c) 오케스트레이션 비결정(같은 코드라도 claude 실행경로는 매번 다를 수 있음)이 발생한다. **이를 감수 트레이드오프로 수용**한다 — 판정 값 자체는 동일하므로 신뢰성 손실은 없고, 스킬 재사용이 얻는 단일진실이 이 비용을 상쇄한다고 판단.
  - **보안표면**: claude 실행은 `--dangerously-skip-permissions`를 쓰므로 표면이 넓어진다. 이는 워커의 기존 **DISALLOWED_TOOLS** 제한 + **systemd 샌드박스**(ProtectSystem=strict, ReadWritePaths 최소, egress 차단, 자격증명 RO)의 2겹 방어에 의존해 억제한다.
  - **잔여 리스크(정직 명시)**: 토큰 소비·실행시간 변동은 상시 존재한다. 오케스트레이션 자체는 비결정적이다(실행경로 재현 불가). 단 **판정 값은 결정론 스크립트가 산출하므로 동일**하다 — 비결정성은 경로에 있고 결과에는 없다.

## 데이터 흐름

```
[web] "감사 진행" 버튼 (auditStatus unknown/warn일 때만)
  │ POST /api/docs/:project/audit-run  (requireWriteAuth)
  ▼
[flowforge server] 프로젝트 키 화이트리스트(^[A-Za-z0-9_-]+$ + resolveProjectDir) 재검증
  │ POST http://127.0.0.1:8810/api/tasks {project, change:"-", action:"audit"}
  │   Authorization: Bearer OPENSPEC_CONSOLE_TOKEN (서비스 토큰, 사용자 토큰 아님)
  ▼
[openspec-reports queue.db] status=queued
  ▼
[systemd 워커(호스트, 샌드박스)] action=="audit" 분기:
  python3 audit_scan.py  --root <proj> --out <tmp>/scan.json
  python3 audit_match.py --spec <proj>/docs/spec.md --scan <tmp>/scan.json --out <tmp>/match.json
  python3 generate_report.py (match → <proj>/docs/audit.json, run-id=KST 타임스탬프)
  → 호스트가 RW로 audit.json 씀(컨테이너 RO 우회)
  ▼
[web] 202 후 폴링 → fetchAuditCapabilities 재조회 → 판정 갱신
```

## 신설/수정 파일

**openspec-reports측(도로로 무충돌 — 먼저 진행 가능):**
- `worker.py`: `build_command`/`run_one`에 `action=="audit"` 분기. project만 받아 파이썬 3-step subprocess(shell=False). run-id=워커가 KST 생성. 각 step exit code 명시 검사(파이프 EXIT 가림 방지).
- `console.py`: `ALLOWED_ACTIONS`에 `"audit"` 추가. `validate_project_change` realpath 가드 재사용.
- `~/.config/openspec-reports/projects.json`: flowforge 등록.
- `/etc/systemd/system/openspec-worker.service`: `ReadWritePaths=/home/gaegul/flowforge` 추가 + daemon-reload + 재시작.

**flowforge측(도로로 HOT — 랜딩 후 착수):**
- `server/src/lib/auditTrigger.ts`(신설): 127.0.0.1:8810/api/tasks 호출, 서비스 토큰 Bearer, 프로젝트 키 화이트리스트.
- `server/src/routes/docs.ts`: `POST /api/docs/:project(*)/audit-run` + requireWriteAuth. 🔴 도로로 HOT.
- `web/src/App.tsx` + 버튼: auditStatus unknown/warn일 때 노출, 클릭→202→폴링 재조회. 🔴 도로로 HOT(FeatureDetailPanel에 두면 회피 가능).

## RCE 방어 체크리스트 (verify에서 각 항목 실증)

**경로 조작:**
- project 키 정규식 화이트리스트(`^[A-Za-z0-9_-]+$`) — `..`·`/`·절대경로 차단
- 워커 realpath 트래버설 가드 재사용
- projects.json 등록분만 실행(미등록=워커가 mark_failed 거부) — 등록이 곧 스위치
- audit_scan `--root`·audit_match `--spec`은 등록 path에서 파생(사용자 입력을 경로로 직접 안 씀)

**명령 주입:**
- subprocess shell=False + argv 리스트(문자열 셸 금지)
- action ALLOWED={verify, audit} 화이트리스트
- audit은 고정된 3개 파이썬 스크립트 절대경로만 실행(상수)
- 파이프 EXIT 가림 방지: step 파일 경유 분리 + returncode 명시 검사

**인증 우회:**
- /audit-run에 requireWriteAuth(dev-mode=env 없으면 public임을 인지 → 프로덕션 env 필수)
- 워커 큐=OPENSPEC_CONSOLE_TOKEN(발행/업로드 토큰과 분리)
- CF Access email claim 필수(서비스 토큰 escalation 차단)
- systemd 샌드박스가 진짜 경계: ProtectSystem=strict, ReadWritePaths 최소, egress 차단, 자격증명 RO

**견고성:**
- subprocess timeout 추가(기존 워커 갭)
- 동일 프로젝트 중복 enqueue 디바운스(버튼 연타 큐 폭주 방지)

## 구현 순서 (사용자 결정 반영)

1. **워커측 먼저**(도로로 무충돌): worker.py audit 분기 + console ALLOWED + projects.json + systemd. 각 비가역 지점 승인 게이트.
2. **도로로 wireframe-device-frame 랜딩 대기.**
3. **flowforge측**: auditTrigger.ts → docs.ts 라우트 → web 버튼.
4. verify: RCE 체크리스트 실증 + 실제 감사 1회 e2e(버튼→큐→워커→audit.json 갱신→UI 반영).
5. adversarial review(3페르소나) — worker.py 수정이 RCE 코어라 필수.
