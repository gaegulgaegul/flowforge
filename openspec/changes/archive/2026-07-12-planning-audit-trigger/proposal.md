# planning-audit-trigger

## Why

flowforge 카드/패널의 audit 상태가 "미확인(unknown)"일 때, 사용자가 감사를 **직접 실행할 방법이 없다**. 현재 audit.json은 외부(agentic-harness openspec-audit 스킬)에서 수동 생성돼야만 갱신되고, flowforge는 그 저장본을 읽어 표시만 한다. "미감사 → 버튼 → 감사 실행 → 판정 갱신"의 닫힌 루프가 없어, 사용자가 매번 별도 세션에서 감사를 돌려야 한다.

## What Changes

flowforge에 "감사 진행" 버튼을 붙여, 클릭 시 그 프로젝트의 openspec-audit을 실행하고 결과를 UI에 반영한다. **단 flowforge 컨테이너는 홈을 읽기전용(RO)으로 마운트하고 python3·git이 없어 audit을 직접 실행할 수 없다.** 그래서 실행은 기존 openspec-reports 호스트 워커(systemd, 샌드박스)에 위임한다.

- **flowforge = 얇은 인증 프록시**: `POST /api/docs/:project/audit-run`(requireWriteAuth 게이트 + 프로젝트 키 화이트리스트) → openspec-reports 큐에 `{project, action:"audit"}` 잡 enqueue(서비스 토큰). 컨테이너는 큐에 넣기만 한다.
- **호스트 워커 = 결정적 실행**: 기존 openspec-worker에 `audit` action 분기 신설. `claude`가 아니라 결정적 파이썬 3-step(audit_scan → audit_match → generate_report)을 shell=False subprocess로 직접 실행 → `<project>/docs/audit.json` 갱신(RO 마운트 우회 = 호스트가 씀).
- **web**: audit 상태가 unknown/warn일 때 버튼 노출 → 202 후 폴링으로 재조회 → 판정 갱신 표시.

## Non-Goals

- audit 결과의 실시간 스트리밍(진행률 %) — MVP는 "감사 중… → 완료 후 재조회".
- flowforge 외 프로젝트의 감사(이 change는 flowforge 자체 도그푸딩 + 화이트리스트 등록분만).
- 노드 단위 부분 감사 — audit은 프로젝트 단위(spec.md 전체 vs 코드). 버튼도 "이 프로젝트 전체 감사"로 라벨.
- CF Access 3중 인증 엣지 설정(인프라 후속). 이 change는 코드측 게이트(requireWriteAuth + 서비스 토큰)까지.

## 🔴 비가역·보안 민감 게이트 (구현 전 사용자 승인 필수)

이 change는 프로덕션 인프라·RCE 코어를 건드린다. 아래 5지점은 **각각 사용자 승인 없이 진행 금지**:

1. **systemd 유닛 수정 + 워커 재시작** — `openspec-worker.service`에 `ReadWritePaths=/home/gaegul/flowforge` 추가, `daemon-reload`, 재시작. 프로덕션 워커를 건드림.
2. **projects.json에 flowforge 등록** — 등록 순간 flowforge가 호스트 스크립트 실행 대상이 됨(공격 표면 확대). 화이트리스트가 곧 스위치.
3. **worker.py(RCE 코어) 수정** — 과거 보안 사고 5건을 거쳐 굳은 코드에 audit 실행 분기 추가. adversarial review(3페르소나) 대상.
4. **`.env` 서비스 토큰 주입** — `OPENSPEC_CONSOLE_TOKEN`/`FLOWFORGE_WRITE_TOKEN`. 민감값, 사용자가 직접 주입(하드코딩·커밋 금지).
5. **프로덕션 인증 강제 확인** — audit-run 라우트를 열기 전 CF Access 또는 WRITE_TOKEN이 반드시 활성인지 검증. **인증 없이 노출하면 공개 RCE 트리거**가 된다.

## Impact

- flowforge repo: server/routes/docs.ts(라우트 1개), server/lib/auditTrigger.ts(신설), web(버튼). ⚠️ App.tsx·docs.ts는 도로로 wireframe change와 HOT — **도로로 랜딩 후 착수**.
- openspec-reports repo(분리): worker.py·console.py 수정, projects.json·systemd. flowforge와 무충돌 — 먼저 진행 가능.
- 되돌리기: systemd/projects.json/env 변경은 역순 복원 쉬움. audit.json 갱신은 재실행 가능(비파괴).
