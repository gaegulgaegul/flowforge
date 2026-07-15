# REVIEW — change-list-for-uncharted-projects

- **최종 배포 가능 여부: 배포 가능**
- 실행: 2026-07-15, code-reviewer 에이전트 위임(적대적 3페르소나, `rules/70-adversarial-review.md`)
- 리뷰 대상: `e3115f8..HEAD` 중 `web/`·`shared/`·`server/`
- 반드시수정(BLOCK) 잔여: **0건**

## 라운드 1 — 배포 불가 (BLOCK 1건)

### [BLOCK] 진입로가 잘린 change 목록을 사용 — spec 위반

- 위치: `server/src/lib/projects.ts:180` `activeChangeNames: scan.active.slice(0, 2)`
- 내용: 진입로(`UnchartedChangeList`)의 데이터 소스인 `activeChangeNames`가 카드 칩 표시용으로 2개까지 잘려 있어, **활성 change 3개 이상 프로젝트는 3번째부터 여전히 도달 불가**. spec `specs/uncharted-project-change-list/spec.md:14` *"그 프로젝트의 활성 change 각각이 클릭 가능한 목록 항목으로 렌더된다"* 위반.
- 심각도 근거: 이 change가 고치겠다고 선언한 문제("진입로가 끊겨 change 도달 불가")를 **절반만** 해결. proposal이 스스로 실측한 고아 프로젝트 4개 중 3개가 영향.
- 본체 교차검증(실측): 디스크 활성 change vs API 반환 — agentic-harness 3→2, wowa-wt-dashboard 4→2, wowa-wt-ios 4→2. **리뷰 지적 타당함 확인**.
- design.md의 Risks/Trade-offs에 이 케이스 언급 없음 = 수용된 트레이드오프가 아니라 **누락된 케이스**.

### 그 외 라운드 1 지적

| 심각도 | 내용 | 처리 |
|---|---|---|
| CONCERNS | `hasCharter` 이중 가드(`App.tsx:1121` `?? true` + `UnchartedChangeList.tsx:19` 내부 가드)로 향후 드리프트 위험 | 유지(의도적 설계 — 회귀 가드 테스트를 컴포넌트 하나로 고정). 라운드 2에서 악화 없음 확인 |
| NIT | `key={name}` 사용 | change 이름은 디렉토리명이라 프로젝트 내 유일(확인됨). 실질 무해 |
| — | 빈 배열/undefined 폴백, 특수문자 URL 인코딩(`deeplink.ts:47-51` `encodeURIComponent`), XSS(React 자동 이스케이프), 인젝션(서버 화이트리스트 재검증) | 전부 안전 확인 |

## 수정 (커밋 `762915e`)

리뷰가 제시한 옵션 (1) 채택 — 카드 칩용과 진입로용 데이터 분리:

- `shared/src/dashboard-types.ts:37` — `allActiveChangeNames?: string[]`(전체, 미절단) 추가. `activeChangeNames`는 "card chip display only"로 주석 명확화.
- `server/src/lib/projects.ts:180-183` — `activeChangeNames: scan.active.slice(0,2)`(칩용 유지) + `allActiveChangeNames: scan.active`(전체) 병렬 반환.
- `web/src/App.tsx:1122` — 진입로 데이터 소스를 `allActiveChangeNames`로 교체.
- `server/src/lib/__tests__/projects.test.ts:151-176` — 신규 3케이스(slice 초과/이하/빈 목록).

## 라운드 2 — 배포 가능 (재검증)

리뷰어가 **직접 실행**해 확인(본체 진술 신뢰 아님):

1. **BLOCK 해소** — 코드·테스트·라이브 3중 확인
   - `npm run typecheck` 0 에러 / server 548 PASS(신규 3 포함) / web 16/16 PASS.
   - **무력화 프로브 직접 재현**: `allActiveChangeNames`를 `slice(0,2)`로 되돌리니 `projects.test.ts:164`가 red(1 failed, 547 passed) → 원복 시 548 green. 방어가 실제 결함을 잡음을 리뷰어가 독립 실증.
   - **라이브 직접 curl**: `wowa-wt-dashboard.allActiveChangeNames`=4개 전량, `activeChangeNames`=앞 2개 유지. 이전 도달 불가였던 `implement-ios-app`의 PRD가 `HTTP 200`. 컨테이너 `web/dist` 번들에 `allActiveChangeNames` 문자열 포함 확인(배포 반영 실증).
2. **새 결함 없음**
   - ProjectGrid 칩 레이아웃 회귀 없음 — `ProjectGrid.tsx:32`는 여전히 칩용 필드 참조, 이번 커밋 diff에 해당 파일 없음.
   - optional 폴백 안전 — `App.tsx:1122` `?? []`, `UnchartedChangeList.tsx:19-24` 빈 배열 분기 존재. 서버 `scanChanges`가 항상 배열 반환(undefined 불가).
3. **기존 CONCERNS 악화 없음** — 이중 가드 라인 미변경, 데이터 소스 라인만 교체.

## 최종 배포 가능 여부

**배포 가능** — 반드시수정 0건. 라운드 1 BLOCK은 실측 확인 후 수정·재검증 완료.

미해결 CONCERNS(hasCharter 이중 가드)는 배포 블로커 아니며 의도적 설계로 유지한다.
