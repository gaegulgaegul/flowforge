## Why

openspec-propose 스킬은 change 완료 시 문서 확인 링크로 **`https://openspec.gaegul.house/<change-name>/`**(리포트 서버 = verify·prototype 발행과 동일 인프라)를 노출한다. 이 URL은 md 산출물을 읽을 수 있는 정적 뷰어일 뿐, flowforge 웹앱의 해당 change 뷰(5종 탭: PRD·기능명세·유저플로우·IA·와이어)를 가리키지 못한다. 사용자는 propose가 끝났을 때 곧바로 **flowforge에서 그 change를 열어** 5종 탭을 클릭해 보고 싶어 한다.

현재 구조(파일경로로 확인):
- `plugins/agentic-harness/skills/openspec-propose/publish_docs.py:20` 의 docstring/서버 응답이 `https://openspec.gaegul.house/<name>/` 를 돌려준다.
- `plugins/agentic-harness/skills/openspec-propose/SKILL.md:166-178`(§5-2 md 발행)과 `:197`(Output 요약)이 그 openspec.gaegul.house URL 을 최종 요약에 노출하라고 모델에게 지시한다. 즉 링크를 요약에 박는 주체는 **모델(SKILL.md 지시)** 이지 스크립트가 아니다.

따라서 링크를 flowforge change URL 로 바꾸는 데 필요한 변경 지점은 **SKILL.md 의 안내 문구 한 곳**이다.

## What Changes

- `SKILL.md`(§5-1-c `:159`, §5-2 `:166-178`, Output `:197`)의 완료 링크 안내를, flowforge change URL — **`https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=prd`** — 을 최종 요약에 조립·노출하도록 문구를 수정한다. URL 조립 재료는 이미 스킬 문맥에 존재한다: change name(kebab, `SKILL.md:30,39`)과 project(`VERIFY_PROJECT` env → `publish_docs.py:78` `--project`).
- **openspec.gaegul.house 원문/verify/review 발행은 유지한다.** 발행 인프라(`publish_docs.py`, 리포트 서버)는 건드리지 않는다. flowforge URL 은 요약 안내에 **추가/교체**되는 링크일 뿐이다(사용자 결정 G4 — 최소 변경).
- 발행이 스킵된 경우(env 없음)에도 로컬 경로와 함께 flowforge URL **형식**을 안내하되, 살아있지 않은 openspec.gaegul.house URL 을 지어내지 않는다(현행 `SKILL.md:159,178` 정책 유지·확장).
- **BREAKING 아님**: 스킬 문서(안내 문구)만 바뀐다. 산출물 생성·발행·apply/verify 흐름은 불변. 사용자에게 보이는 완료 링크의 목적지만 확장된다.

## Capabilities

### New Capabilities
- `propose-flowforge-link`: openspec-propose 완료 시 최종 요약에 flowforge change 뷰 딥링크(`?project=&change=&tab=prd`)를 조립·노출한다. openspec.gaegul.house 원문 링크는 발행 시 병기하고, 발행 스킵 시에는 flowforge URL 형식과 로컬 경로만 안내한다(존재하지 않는 URL 을 지어내지 않는다).

### Modified Capabilities
(없음 — 기존 발행 capability 는 불변, 안내 문구만 추가)

## Impact

- **agentic-harness 스킬 문서(소스)**: `plugins/agentic-harness/skills/openspec-propose/SKILL.md` — §5-1-c(`:159`)·§5-2(`:166-178`)·Output(`:197`) 링크 안내 문구 수정. 스크립트(`publish_docs.py`)는 무변경.
- **agentic-harness 캐시 동기화**: `~/.claude/plugins/cache/agentic-harness/agentic-harness/1.1.8/skills/openspec-propose/SKILL.md` — 소스와 동일하게 반영(현재 최신 캐시 = 1.1.8). 캐시가 실제로 로드되는 스킬이므로 소스만 고치면 런타임에 반영 안 됨(버전 bump 시 캐시 재적용 교훈).
- **flowforge 딥링크 선행 의존**: 이 링크가 실제로 열리려면 flowforge 프론트가 `?project=&change=&tab=` URL 을 읽어 해당 change 뷰로 복원해야 한다. 이 라우팅은 **별도 change `flowforge-deeplink-url`**(capability `flowforge-deeplink-routing`)이 만든다. 그 change 가 배포되기 전에는 링크를 눌러도 flowforge 랜딩(grid)으로 떨어진다. 본 change 의 spec/design 은 이 선행 의존을 명시한다.
- **서버/DB/배포**: agentic-harness 리포트 서버·flowforge 서버 코드 무변경. 발행 인프라 그대로.
