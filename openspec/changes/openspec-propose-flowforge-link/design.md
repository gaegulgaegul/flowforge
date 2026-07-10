# Design — propose-flowforge-link

## 목표

openspec-propose 완료 요약의 문서 확인 링크를, 리포트 뷰어(openspec.gaegul.house)만이 아니라 **flowforge change 뷰 딥링크**로 확장한다. 발행 인프라는 손대지 않고 **SKILL.md 안내 문구만** 바꾼다(사용자 결정 G4 — 최소 변경).

## 현재 구조 (파일경로로 확정)

- 완료 링크의 출처는 **모델**이다. `publish_docs.py:118-120` 은 서버 응답의 `url`(=`https://openspec.gaegul.house/<name>/`)을 JSON 으로 stdout 에 뱉을 뿐이고, 그 URL 을 사용자 요약에 **박으라고 지시하는 주체는 SKILL.md** 다:
  - `SKILL.md:159` — §5-1-c: 프로토타입 발행 URL(`.../prototype.html`)을 요약에 노출하라.
  - `SKILL.md:166-178` — §5-2: md 발행 후 `published:true` 면 `url`(`https://openspec.gaegul.house/<name>/`)을 요약에 노출하라.
  - `SKILL.md:197` — Output: 최종 요약 목록에 그 URL 을 포함하라.
- URL 조립 재료가 이미 스킬 문맥에 있다:
  - **change name**(kebab): `SKILL.md:30`(Input 규칙)·`:39`(파생 규칙)에서 스킬이 `<name>` 을 이미 보유.
  - **project**: `publish_docs.py:78` 이 `VERIFY_PROJECT` env → `--project`(X-Project 헤더)로 사용. 같은 env 를 flowforge URL 의 `?project=` 에 재사용.
- flowforge URL 형식은 선행 change `flowforge-deeplink-url` 의 proposal 에서 확정됨: `https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=<tab>` (`tab ∈ prd|spec|flow|ia|wire`). 본 change 는 완료 랜딩으로 **`tab=prd`**(PRD 탭)을 기본 지정한다.

## HOW — SKILL.md 문구 수정 (구현물 아님, 이 change 는 문서 산출물만)

1. **§5-2 (`:166-178`) md 발행 안내 확장**:
   - `published:true` 분기: 기존 openspec.gaegul.house URL 노출 지시 **뒤에**, flowforge change URL 을 조립해 병기하라는 지시를 추가한다.
     - 조립: `https://flowforge.gaegul.house/?project=${VERIFY_PROJECT}&change=<name>&tab=prd`. `VERIFY_PROJECT` 미설정이면 `?project=` 를 생략하고 `?change=<name>&tab=prd` 로 조립(빈 값·플레이스홀더 금지).
   - `skipped:true` 분기: 로컬 경로와 함께 flowforge URL **형식**을 안내하되, openspec.gaegul.house 원문 URL 은 발행 안 됐으므로 지어내지 않는다(기존 `:178` 정책 유지).
2. **Output (`:197`) 요약 목록 확장**: "문서 확인" 항목에 flowforge change URL 을 1차 링크로, openspec.gaegul.house 원문을 병기 링크로 나열하도록 문구를 조정한다.
3. **§5-1-c (`:159`) 프로토타입 URL**: 프로토타입 발행 URL 은 그대로 두되(발행 인프라 불변), 화면 작업이 있는 change 면 프로토타입 링크와 flowforge change 딥링크가 둘 다 요약에 나오도록 정합성 문구만 다듬는다.

## URL 조립 재료

| 재료 | 출처 | 비고 |
|------|------|------|
| `<change>` (kebab) | `SKILL.md:30,39` 스킬 보유 `<name>` | 필수 |
| `<project>` | `VERIFY_PROJECT` env(`publish_docs.py:78`) | 없으면 `?project=` 생략(하위호환) |
| `tab` | 고정 `prd` | 완료 랜딩 기본 탭 |
| host | 고정 `flowforge.gaegul.house` | — |

## 소스 + 캐시 동기화 절차 (필수)

- 소스: `plugins/agentic-harness/skills/openspec-propose/SKILL.md` 수정.
- 캐시: `~/.claude/plugins/cache/agentic-harness/agentic-harness/1.1.8/skills/openspec-propose/SKILL.md` 에 동일 반영. **실제 런타임에 로드되는 건 캐시**이므로 소스만 고치면 반영 안 됨(메모리 교훈: 캐시 1.1.x 재적용). 플러그인 버전 bump 시 새 캐시 디렉토리에 다시 반영 필요.
- 검증: 소스·캐시 두 SKILL.md 의 해당 문구가 `diff` 로 일치.

## openspec.gaegul.house 병기 정책

- 발행 **성공** 시: flowforge URL(1차) + openspec.gaegul.house 원문(병기). 원문 발행은 유지되므로 두 링크 모두 유효.
- 발행 **스킵** 시: flowforge URL 형식 + 로컬 경로만. openspec.gaegul.house URL 은 지어내지 않음(그 서버에 아무것도 안 올라갔으므로 404).

## 의도적 제외 (Out of Scope)

- **발행 인프라 자체는 변경하지 않는다**: `publish_docs.py`, 리포트 서버(openspec-reports/server.py), verify/prototype 발행 경로 모두 불변. 이 change 는 완료 요약의 링크 문구만 바꾼다.
- **flowforge 프론트 라우팅은 이 change 가 만들지 않는다**: `?project=&change=&tab=` 를 읽어 change 뷰로 복원하는 라우팅은 별도 change `flowforge-deeplink-url`(capability `flowforge-deeplink-routing`)의 몫이다.
- **flowforge 서버 API 변경 없음**: `?project=` 크로스프로젝트 해석은 이미 존재(`server/src/routes/graph.ts:32-34`, `web/src/api.ts:76-78`).

## 선행 의존 (Prerequisite)

- **`flowforge-deeplink-url`** (capability `flowforge-deeplink-routing`) — flowforge 프론트가 URL 쿼리(`?project=&change=&tab=`)를 마운트/popstate 시 파싱해 change 뷰(5종 탭)로 복원하는 라우팅을 신설한다. 현재 flowforge 웹앱은 순수 in-memory SPA 로 URL 라우팅이 전혀 없어(그 proposal 확인: `location.search`/`useSearchParams` grep 0건) 어떤 URL 로 와도 랜딩(grid)에서 시작한다. **이 선행 change 가 배포되기 전에는 본 change 가 내놓는 링크를 눌러도 change 뷰로 열리지 않고 랜딩으로 폴백한다.** 링크 형식 자체는 유효하므로, 선행 change 배포 후 자동으로 동작한다.

## ⚠️ 리스크 (미확인 — 배포 전 확인 필요)

- **flowforge 서빙 범위 미확인**: flowforge 가 `?project=<project>` 로 지목된 프로젝트의 **propose 로 갓 생성된 change 디렉토리**까지 실제로 읽어 서빙하는지 미확인. 크로스프로젝트 `?project=` 지원(`graph.ts:32-34`)과 화이트리스트·루트밖 접근 차단(`graphCrossProject.test.ts`)은 있으나, propose 직후(아직 archive 전) change 가 flowforge 의 `openspec/changes` 스캔 대상 루트에 포함되는지, project 이름 매핑(`VERIFY_PROJECT` 값 ↔ flowforge 가 아는 프로젝트 키)이 일치하는지는 별도 확인해야 한다. 링크가 404/폴백하면 이 매핑을 먼저 점검한다.
- **tab enum 정합**: 선행 change 는 `tab ∈ prd|spec|flow|ia|wire` 를 정의한다. 본 change 는 `tab=prd` 고정. 선행 change 가 다른 탭 키를 쓰면 링크 랜딩 탭이 어긋날 수 있으므로 배포 시 탭 키 일치 확인.
