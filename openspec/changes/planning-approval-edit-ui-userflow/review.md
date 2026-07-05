# 배포 전 최종 검토 — planning-approval-edit-ui-userflow
검토일: 2026-07-05 (3차 재검토 — 2차·1차 원문 하단 보존) / 검토 범위: 2차 리뷰 이후 diff 한정 — `web/src/App.tsx` switchPlanningFlow dashReqToken 가드(e6c8189, +16/-3) + 2차 치명 항목 해소 판정 + 재verify PASS 반영. 앱 전체 아님.

## review criteria brief (3차)
- changeTypes: **frontend** (신규 diff = web/src/App.tsx 단일 파일 로직 fix — 시각 표면 무변)
- criteria: 신규 diff 19줄 기준 1·2·5·9 집중 / 3·6·8·10 = 신규 표면 없음(서버 무접촉·GET 표시 경로만) / 4·7 = verify 실픽셀 r3 인용
- ruleSets: resolvedFrom `~/.claude/rules/` / selected: 10-coding-style·60-design·70-adversarial-review / absent: 없음
- designYardsticks: design.md D-1~D-7 무변(서버 코드 무접촉) + tasks 4.1 "dashReqToken race 가드 기존 패턴" 조항
- specsVerifyFocus: verify.json(2026-07-05 19:24) = **PASS** — 15/15 PASS·FAIL 0·검증안함 0·archiveGate **open**. P3 동일 절차 재현 0/6(직전 2/2) + 2차 홀 프로브 PASS + mutation red 6/green 41 재실측 + 서버 283/283.
- adversarialScope: full change scope (NOT narrowed by this brief)

## 2차 치명 항목 추적

- **[해결됨] `switchPlanningFlow` dashReqToken race 가드 부재(verify P3 FAIL)** — fix e6c8189. 본 리뷰 코드 직접 재확인(`web/src/App.tsx:364-386`): 권고(then 2곳 ~4줄)보다 넓게 **4개 비동기 지점 전부**(then/catch × 그래프·큐 fetch) 가드 — 형제 핸들러 catch 가드 관례와 정합. grep 실측으로 App.tsx 내 dashReqToken 소비 핸들러 전원 가드 참여 확인(불참 함수 0). 재verify 실측: 동일 재현 절차 6트라이얼 발현 0(직전 2/2), 2차 홀(in-flight apply 응답이 전환 화면 덮기)도 UI stale 폐기·서버 정상 착지(md append+큐 갱신 파일 재조회) 확인. 의도 주석 2줄 포함(2차 신입 지적 해소).
- **[해결됨-부수] tasks.md 4.1 완료 주장-코드 불일치** — 코드가 주장을 따라와 정합(별도 문서 수정 불요).

## 반드시 수정해야 할 항목

- 없음

## 수정하면 좋은 항목

- **2차 잔존 항목 전부 유지**(이번 diff 무접촉 — 재검토 대상 아님, 이월만): mermaid 블록 판별 이중화+`label-not-parse-safe` 오도 사유(중간), O(n²) 트라이얼+apply 배치 상한 부재(중간), 대량 큐 카드 캡/bulk 버튼 위치(중간), skipped 인라인 피드백·낙관적 큐 클리어 플래시·CRLF 전변환·큐 clobber·중복 id·라벨 길이 상한·`String(e)` 노출(낮음). 전부 non-blocking — 상당수 패널/큐 패밀리 공통 부채로 별도 change 적합.

## 현재 상태로 유지해도 되는 항목

- **공유 토큰 의미론(최신 상호작용 승리)**: switchPlanningFlow가 토큰을 올리면 in-flight 형제 응답(진행 중 apply의 에러 status 포함)이 폐기됨 — 형제 전체가 같은 규약이고 서버측 쓰기는 레이스 전에 완결되므로 표시 한정. 의도적 일관으로 수용.
- **suggestions fetch catch의 토큰 가드**(App.tsx:386): 동기 클리어(:380)가 선행해 근사-중복이나 형제 catch 관례와 일관, 무해 — 삭제 비권장.

## 리팩토링 추천 항목

- 2차 항목 유지: ApprovalPanel 골격 추출(rule of three)·`useUserFlowApproval` 훅 분리(이번 같은 가드 불참이 격리 단위에서 더 잘 보임)·`|라벨|` 의도 주석. 이번 fix로 시급성 변화 없음 — 별도 change.

## 적대적 검토 (4 페르소나)

- **파괴자**: 신규 diff에서 미가드 비동기 지점 0 — then/catch 4/4 가드, grep 실측으로 전 핸들러 가드 정합(불참 0). 발견 = stem 전환이 진행 중 apply의 *에러 표시*까지 조용히 폐기(서버 착지는 정상 — verify 2차 홀 프로브로 실측) → 의미론상 의도로 판정, 유지 티어 기록. 잔존 이월: O(n²)·큐 clobber.
- **신입 개발자**: 2차 지적 "왜 이 함수만 가드 없나 설명 부재"가 의도 주석 2줄(App.tsx:357-358)로 해소. 잔여 발견 = 로딩 인디케이터·셀렉트 비활성화 부재는 여전(2차 이월, 낮음).
- **보안 감사자**: 신규 공격 표면 0 — GET 표시 경로만, 쓰기·인젝션·민감정보 벡터 무변. 발견 = 2차 이월 O(n²) 배치 상한(중간, 서버측 — 이번 diff 밖).
- **게으른 시니어**: 16줄로 권고 4줄보다 크지만 catch 가드 2곳 추가는 형제 관례 정합이라 부풀림 아님. 발견 = suggestions catch의 가드는 엄밀히 생략 가능(동기 클리어 선행)이나 일관성 가치가 더 커 유지가 옳음 — "덜 짤 여지"는 있었으되 비권장.
- 2+ 페르소나 중복 발견(심각도 상승): 신규 diff 한정 없음. 2차 상승분(O(n²), 파괴자+보안)은 이월 유지.

## 디자인 리뷰 (조건부 게이트)

frontend fix이나 시각 표면 무변(로직만) — verify r3 실픽셀 6장(W1·W2·P1·P2·P3·2차홀)이 시각 회귀 0을 재실측. 신규 디자인 리뷰 불요, 2차 판정(프로토타입 충실 PASS·모바일 실뷰포트/터치 타깃 미검증) 유지.

## 최종 배포 가능 여부

**배포 가능** — 1차 배포 불가 2축(web 미구현·배치 독살)과 2차 치명 1건(P3 레이스) 전부 해결 실측 확인. verify 최종 **PASS**(15/15, FAIL 0, archiveGate open). 잔존 발견은 전부 non-blocking(패밀리 공통 부채 위주). → `openspec-archive` 진행 가능.

## 개선 우선순위 (제안)

1. (별도 change) mermaid 블록 판별 단일화 + skipped 사유 정확화 — 잔존 중 오진 유도로 실사용 영향 최대.
2. (별도 change) apply 배치 크기 캡 — O(n²) 가용성 벡터 봉쇄(라우트 1곳).
3. (별도 change) CRLF 보존·중복 id 필터·큐 clobber 완화 — featureDocs 공통 저비용 묶음.
4. (별도 change) 패널 패밀리 UX 묶음(대량 캡·bulk 위치·skipped 인라인·로딩 표시) + ApprovalPanel 골격/훅 추출 — rule of three 부채 일괄 해소.

---

# 배포 전 최종 검토 — planning-approval-edit-ui-userflow
검토일: 2026-07-05 (2차 재검토 — 1차 검토 원문은 하단 보존) / 검토 범위: 1차 리뷰 이후 diff 한정 — `server/src/lib/userFlowDocs.ts`+단위 테스트(631b993 fix), `web/src/App.tsx`(유저플로우 배선 +78줄)·`web/src/UserFlowApprovalPanel.tsx`(신규 132줄)·`web/src/api.ts`(함수 2개)·`web/src/styles.css`(+13줄)(8cea01c). 앱 전체 아님.

## review criteria brief (2차)
- changeTypes: **backend + frontend** (server lib fix + web 패널·배선·CSS — 파일 증거: `.tsx`·`styles.css` diff 존재, tasks 3.1~4.1 완료)
- criteria: **1~10 전부 in-scope** (1차에서 out이던 4·7은 frontend 구현으로 in 전환)
- ruleSets: resolvedFrom `~/.claude/rules/` (repo `.claude/rules/` 부재 재확인) / selected: 10-coding-style·20-testing·30-security·60-design·70-adversarial-review / absent: 없음
- designYardsticks: design.md D-1~D-7 + Non-Goals(삭제·수정 op, 라벨 편집, 제안 생산기, 와이어프레임, 비화면 newNode — 오지적 금지) + 화면 구성("6b-features 패널과 동일 자리·스타일")
- specsVerifyFocus: verify.json(2026-07-05 18:58) = **FAIL** — 서버 10/10 PASS(무력화 프로브 실측)·web 4/5 PASS(W1·W2·P1·P2 실픽셀), **P3 동시성 FAIL(재현 2/2)** → archiveGate closed. 이 FAIL이 본 리뷰 판정의 1차 근거.
- adversarialScope: full change scope (NOT narrowed by this brief)

## 1차 치명 항목 추적

- **[해결됨] D-4 밖 문자(`[` `]` 백틱) 배치 독살 → 사유 없는 422** — fix 631b993(제안별 시험 append→재파싱 사전검사, `userFlowDocs.ts:216-223`). 본 리뷰에서 독립 실측 재검증: `[foo]` 라벨·백틱 펜스·펜스 열고/닫는 페어 프로브 전부 해당 제안만 `label-not-parse-safe` skipped, 유효 형제 정상 반영, 문서 불변. 시험은 누적 lines 대상이라 같은 배치 내 선행 승인 newNode를 참조하는 후속 제안도 올바르게 통과(실측). 트라이얼과 최종 배치 검사가 동일 상태·동일 expected를 보므로 "개별 통과·배치 실패" 우회 경로 미발견.
- **[해결됨] web 미구현(spec Requirement 4 미충족)** — 8cea01c로 tasks 3.1·3.2·4.1·5.1 완료, verify 실픽셀 W1(승인→그래프·md 반영)·W2(빈 큐 미렌더)·P1(skipped 표면화)·P2(100건) PASS.

## 반드시 수정해야 할 항목

- **[치명] `switchPlanningFlow` dashReqToken race 가드 부재 — verify P3 FAIL(재현 2/2)·archive 게이트 차단.** `web/src/App.tsx:358-378`(본 리뷰에서 코드 직접 재확인): 그래프 fetch·큐 fetch 두 비동기 체인이 토큰 증가도 검사도 없이 setState — 같은 파일의 형제 핸들러 전부(openProject :385-518, openCapability :630-652, applyPrd :522-549, applyFeature :553-586, applyUserFlow :591-626)가 지키는 가드 체계에서 유일하게 이 함수만 불참. 발현 2형: ① 크로스-stem 불일치(셀렉트·그래프=v2, 패널=v1 큐 카드 — 실측 스크린샷 web-p3-race.png) ② stale 응답 last-write-wins로 사용자 최종 선택 소실. 셀렉트 onChange 2연타면 창이 열리므로 사람 손 속도(키보드 화살표·빠른 재선택)에서도 발현 가능(정적 추론 — verify 재현은 프로그래매틱 7연타). **2차 홀(본 리뷰 신규 발견)**: 이 함수가 토큰을 안 올리므로 in-flight `applyUserFlow` 응답이 stem 전환 후에도 자기 가드를 통과해 전환된 화면을 이전 stem 결과로 덮어씀 — 같은 1줄 수정으로 함께 닫힘. 영향은 표시 한정(GET만 — 서버 문서 훼손 없음, apply의 서버측 쓰기는 레이스 전에 정상 완결). 최소 수정: `const token = ++dashReqToken.current;` + 두 `.then`에 `if (token !== dashReqToken.current) return;` — 바로 아래 applyUserFlow(:596-609) 패턴 복사, 약 4줄. **부수 정정 필요**: tasks.md 4.1이 "dashReqToken race 가드 기존 패턴" 적용을 완료 주장하나 switchPlanningFlow에는 미적용 — 완료 주장과 코드 불일치.

## 수정하면 좋은 항목

- **[중간] fix가 도입한 O(n²) 트라이얼 비용 + apply 배치 상한 부재.** 제안별 시험이 매번 전체 문서 재파싱(`userFlowDocs.ts:216-223`→`userFlowInvariantHolds` 전량 비교). 실측: N=50→32ms, 100→79ms, 200→227ms, 400→866ms(초선형). Node 단일 스레드 동기 블록이라 무상한 배치는 가용성 리스크(파괴자+보안 중복 발견 → 낮음→중간 상향). 라우트 배치 크기 캡 권장. 현 사용 규모(100건 79ms)에선 실해 없음.
- **[중간] "label-not-parse-safe" 사유가 원인을 오도하는 경로.** 1차 지적 4a(mermaid 블록 판별 이중화 — `userFlowDocs.ts:90-101` startsWith는 ```` ```mermaid-example ````도 매칭, `planningUserFlowBuilder.ts:22-25` 정규식은 정확 매칭)는 **여전히 존재**하나, fix 덕에 배치 독살→개별 skipped로 강등(실측: example 블록 선행 문서에서 `applied:0, skipped:["s1: label-not-parse-safe"]`, 문서 불변). 단 실제 원인은 라벨이 아니라 블록 타게팅 어긋남이라 사유 문자열이 오진 유도 — 블록 판별 단일화가 근본 수정.
- **[중간] 대량 큐 UI: 100건 카드가 캡 없이 전부 나열, [모두 승인/반려]가 최하단.** `feature-approval`에 max-height/overflow 없음(정적 CSS) — 카드당 ~134px, 100건이면 ~13,000px 스크롤 끝에 일괄 버튼(스크린샷 web-p2-bulk.png 근거). 대량일수록 일괄 처리가 가장 멀어지는 역설 + 그래프가 폴드 밖으로. FeatureApprovalPanel 공통 부채 — 캡+overflow-y 또는 bulk 바 상단 이동 권장.
- **[낮음] skipped 피드백이 화면 구석 status 텍스트 + 원문 코드 노출.** `sug-bad-from: from-not-in-doc`가 헤더 옆 작은 텍스트로만(스크린샷 web-p1-skipped.png) — 승인 버튼(화면 중앙)과 시선 단절, 비개발자에게 난해. 카드 인근 인라인 배너 권장.
- **[낮음] stem 전환 시 낙관적 큐 클리어 플래시 + 로딩 인디케이터·셀렉트 비활성화 없음.** `App.tsx:372` 동기 `setUflowSuggestions([])` — 정상 전환에도 패널이 잠깐 소멸, "반려됨"으로 오독 여지. 기존 openProject 관례 답습이라 낮음.
- **[낮음] 1차 잔존 항목(이번 커밋 범위 밖, 재확인됨)**: CRLF→LF 전변환(실측 재확인, `userFlowDocs.ts:268/:278`), 프로세스 간 큐 clobber(정적, :253→:295), 중복 id 이중 append(실측 재확인, :254/:260 — approve 1개에 2줄), 라벨 길이 상한 부재(grep 0건). 별도 정리 change 후보.
- **[낮음] 에러 메시지에 `String(e)` 원문 노출**(`App.tsx:619` 등) — applyPrd/applyFeature 기존 패턴 답습, 로컬 단일 사용자라 실위험 낮음.

## 현재 상태로 유지해도 되는 항목

- **서버 fix 품질**: 배치 독살 해소 실측, 무력화 프로브 존치(재verify에서 mutation red 6/green 41 실측), 경로 이탈 가드 무손상, 트라이얼-배치 이중 검사 정합.
- **web 보안 클린(증거 있음)**: React 텍스트 보간만·`dangerouslySetInnerHTML` 0·라벨/rationale XSS 벡터 없음, `encodeURIComponent` 적용(api.ts:311/:329), console.log·`any` 0(grep 실측), `import type` 준수, `npx tsc --noEmit` 0(실측).
- **디자인 충실도 PASS(정적+verify 실픽셀 인용)**: 프로토타입 골격 요구 전 항목 구현 — 카드·from→▶to·실선/점선(색+뱃지 이중 인코딩+aria-label)·신규 화면 뱃지·rationale·개별/일괄 버튼·빈 큐 미렌더. FeatureApprovalPanel CSS 재사용으로 스타일 이탈 0(신규 CSS 13줄은 에지 표기 전용), 기존 다크 팔레트 정합. AI-slop 없음. DESIGN.md 미정의(프로토타입도 와이어프레임 모드) — 토큰 검사는 불가였음을 명시.
- **`targetIdOf` 방어 폴백**(UserFlowApprovalPanel.tsx:12-14): 서버 필터가 이미 막는 계약 위반 대비 — 죽은코드 인접이나 무해, 유지.
- **`.catch(() => setUflowSuggestions([]))`**(App.tsx:375): 큐 없음/오류를 빈 큐로 강등 — 주석으로 의도 명시된 설계 선택. 네트워크 장애와 "제안 없음"이 동일하게 보이는 트레이드오프는 인지하되 수용.
- App.tsx 986줄(400줄 규칙 초과)은 기존 위반(커밋 전 910줄)의 연장 — 이 change에서 안 고쳐도 되나 부채 누적 중(아래 리팩토링).

## 리팩토링 추천 항목

- **승인 패널 3벌째 — rule of three 도달.** Prd/Feature/UserFlow 패널이 배너+카드 리스트+일괄 푸터 골격을 각자 소유(~40줄/벌 중복, CSS는 이미 공유). 4번째 전에 공유 `<ApprovalPanel>`(카드 본문 슬롯) 추출 권장. 1차의 큐 IO 3벌 복제(`readSuggestionQueue` 제네릭)와 같은 축.
- App.tsx 유저플로우 배선(fetch effect·applyUserFlow·switchPlanningFlow)을 훅(`useUserFlowApproval`)으로 추출 — 이번 레이스 누락 같은 가드 불참이 격리 단위에서 더 잘 보임.
- `|{sug.label}|` 파이프 표기(UserFlowApprovalPanel.tsx:83)에 의도 주석 1줄(Mermaid 라벨 표기 관습) — 잔재로 오독 여지.

## 적대적 검토 (4 페르소나)

- **파괴자**: 치명 1(P3 레이스 실측 2/2 + 2차 홀 — apply in-flight 응답이 stem 전환을 덮음)·중간 1(O(n²) 866ms@400 실측, 배치 상한 없음)·낮음(silent catch로 네트워크 장애=빈 큐 구분 불가, CRLF·중복 id 실측 잔존). 서버 문서 손상 벡터는 이번에도 못 뚫음 — 독살 fix 우회 프로브(펜스 페어·mermaid 키워드 라벨) 전부 개별 skipped·문서 불변 실측.
- **신입 개발자**: switchPlanningFlow만 가드 없는 이유가 코드·주석 어디에도 없음(형제 함수 대조로만 발견 가능), 로딩 인디케이터·셀렉트 비활성화 부재, `|라벨|` 무주석 관습, tasks.md 4.1 완료 주장-코드 불일치, "label-not-parse-safe" 오도 사유. 반면 패널 헤더 docblock·에지 표기 접근성 처리는 평균 이상.
- **보안 감사자**: XSS·인젝션·경로이탈 클린(증거: 텍스트 보간만·encodeURIComponent·stem 화이트리스트 무손상). 발견 = 무상한 배치 O(n²) 자원소진 벡터(가용성, 로컬 단일 사용자라 중간), `String(e)` 에러 원문 노출(기존 답습, 낮음).
- **게으른 시니어**: 과잉구현 발견 = 승인 패널 골격 3벌째 복제(추출 시점 도과), targetIdOf 계약-위반 방어(죽은코드 인접). 반면 EdgeMark는 적절히 미니멀, CSS 신규 13줄뿐(재사용 우선), 죽은 export 0, 신규 추상화 0 — 부풀림 없음.
- 2+ 페르소나 중복 발견(심각도 상승): **① O(n²)+배치 상한 부재**(파괴자+보안, 낮음→중간) **② 로딩 상태 부재·레이스 가시성**(파괴자+신입 — 치명 P3의 구성 요소로 병합)

## 디자인 리뷰 (조건부 게이트 — 수행됨)

frontend 변경 존재 → 수행. 방식 = **정적 검토 + verify 실픽셀 증거(스크린샷 6장) 인용** (라이브 재기동 없이). 판정: 프로토타입 충실도 PASS·패밀리 스타일 일관·차단급 시각 문제 없음. 발견은 위 항목에 병합 — criteria 4(UX/UI): skipped 피드백 위치·대량 큐 일괄 버튼 역설·플래시, criteria 7(반응형): 신규 CSS에 미디어쿼리 없음(`.uflow-approval-title` flex-wrap으로 좁은 폭 생존, 상위 max-width 920px 캡) — **모바일 실뷰포트·터치 타깃(버튼 padding 5px 14px)은 미검증**(스크린샷 전부 1280px).

## 최종 배포 가능 여부

**조건부 가능 (치명 1건 수정 후)** — 1차의 배포 불가 2축(web 미구현·배치 독살)은 해결 실측 확인. 잔여 차단은 P3 레이스 1건: verify FAIL로 archiveGate closed 상태이며, 수정은 기존 패턴 복사 ~4줄. 수정 → 재verify P3 PASS 확인 → archive 진행 가능. 그 외 발견은 전부 non-blocking(중간 3·낮음 다수, 상당수가 패밀리 공통 부채로 별도 change 적합).

## 개선 우선순위 (제안)

1. **치명: switchPlanningFlow에 dashReqToken 가드 4줄**(+tasks.md 4.1 주장 정정) → 재verify로 P3 PASS 실측 — archive 게이트를 여는 유일한 차단 항목.
2. **mermaid 블록 판별 단일화 + skipped 사유 정확화** — "무언 422"는 사라졌지만 오진 사유가 그 자리를 이음.
3. **apply 배치 크기 캡** — O(n²) 가용성 벡터 봉쇄(라우트 1곳).
4. CRLF 보존·중복 id 필터 — 실측 확인된 저비용 수정, featureDocs 공통.
5. 대량 큐 캡/bulk 버튼 위치 + skipped 인라인 피드백 + 로딩 표시 — UX 개선 묶음(패널 패밀리 공통).
6. (별도 change) ApprovalPanel 골격 추출·큐 IO 제네릭·App.tsx 훅 분리 — rule of three 부채 일괄 해소.

---

# 배포 전 최종 검토 — planning-approval-edit-ui-userflow
검토일: 2026-07-05 / 검토 범위: 이 change의 diff 한정 (앱 전체 아님) — `shared/src/user-flow-suggestion-types.ts`(신규)·`shared/src/index.ts`(배럴), `server/src/lib/userFlowDocs.ts`(신규)+단위 테스트, `server/src/routes/docs.ts`(라우트 2개 추가)+통합 테스트, `server/src/parser/planningUserFlowBuilder.ts`(리팩토링), `server/src/lib/docs.ts`(1줄)

## review criteria brief
- changeTypes: **backend** (server lib·routes·shared 타입 — 구현된 diff 기준). frontend 신호(prototype.html 존재, tasks 3.1·3.2·4.1 `[parallel]` web 태스크)는 있으나 **web 코드 미구현** — diff에 화면 파일 0건.
- criteria: 1·2·3·5·6·8·9·10 in-scope / **4·7 out-of-scope** (사유: frontend 변경분이 diff에 없음 — web 태스크 자체가 미착수)
- ruleSets: resolvedFrom `~/.claude/rules/` (repo `.claude/rules/` 없음) / selected: 10-coding-style·20-testing·30-security / absent: 없음
- designYardsticks: design.md Decisions D-1(append-only)~D-7(계약 재사용) / Non-Goals: 삭제·수정 op, 라벨 편집, 제안 생산기, 와이어프레임, 비화면 newNode — **오지적 금지 대상**
- specsVerifyFocus: verify.json(2026-07-05 18:08) = **조건부**, server 10/10 PASS(무력화 프로브 실측 포함)·edge 4/4 충분, **web 2건 "검증 안 함"(기능 미구현 — 환경 SKIP 아님)**, archiveGate closed
- adversarialScope: **full change scope (NOT narrowed by this brief)**

## 반드시 수정해야 할 항목

- **[치명] D-4 게이트 밖 문자(`[` `]` `` ` ``) 라벨이 배치 전체를 "사유 없는 422"로 독살 — spec 계약 위반.** `server/src/lib/userFlowDocs.ts:30`(게이트가 `"`·`|`·개행만 금지) + `:267`(roundtrip 실패 시 배치 통째 롤백). **실측 재현**: `label: "see [foo]"` 제안 + 유효 제안 1건을 같은 approve 배치로 → `{applied:0, skipped:[], writeFailed:true}` — 유효한 형제 제안까지 롤백되고 skipped가 빈 배열이라 원인 표시가 전혀 없다. 근원: 라벨 속 `[foo]`를 파서 `stripNodeShapes`(planningUserFlowBuilder.ts:36)가 벗겨 재파싱 라벨이 달라짐 → D-5 멀티셋 불일치. 백틱 3개는 `extractMermaid`(:23) 비탐욕 매칭이 블록을 라벨 중간에서 절단. spec.md:50 "같은 apply의 다른 유효 제안은 정상 반영" + design D-7 "skipped 사유 표면화"를 이 문자 클래스에서 위반. 사용자 영향: AI가 "선택지 [예/아니오]" 같은 자연스러운 라벨을 제안하면 그 제안을 반려하기 전까지 **일괄 승인이 영구 불가**. 수정 방향: 검증 단계에서 렌더→재파싱 pre-check로 개별 skipped 처리(또는 D-4 금지문자 확장), 최소한 roundtrip 실패 시 원인 제안 식별을 시도해 사유를 표면화. (파괴자+보안 감사자 중복 발견 → 상향. 문서 손상은 없음 — 가드가 막는 것 자체는 실측 확인)
- **[스코프 미완성] web 미구현 — spec 4번째 Requirement("유저플로우 탭에 승인 패널을 표시한다") 전체 미충족.** tasks 3.1(`web/src/api.ts` fetch/apply)·3.2(`UserFlowApprovalPanel.tsx`)·4.1(App 배선)·5.1(VERIFY 게이트) 미체크, `web/src` grep 0건(verify.json 실측). 코드 결함이 아니라 **change가 아직 끝나지 않은 상태** — 이대로는 승인 루프의 소비자 UI가 없어 기능이 사용자에게 도달하지 않는다. archive 불가.

## 수정하면 좋은 항목

- **[중간] "첫 mermaid 블록" 정의가 두 벌로 어긋남 → 영구 422.** `userFlowDocs.ts:90-101`(trim+`startsWith("\`\`\`mermaid")`) vs `planningUserFlowBuilder.ts:23`(정규식, 라인 앵커 없음). 실측: `\`\`\`mermaid-example` 블록이 진짜 블록보다 앞에 있으면 append 위치와 파싱 대상이 갈려 모든 유효 제안이 사유 없는 422. 블록 판별 함수를 한 곳으로 통일 권장. (파괴자+신입 중복 발견 → 상향)
- **[중간] CRLF 문서가 apply 한 번에 전체 LF로 조용히 변환.** `userFlowDocs.ts:259`(`split(/\r?\n/)`)→`:269`(`join("\n")`). 실측 확인 — "한 줄만 append" 계약이 바이트 수준에서 깨져 git diff 전 라인 변경. featureDocs.ts:248 동일 패턴(선례 답습)이라 공통 수정 권장.
- **[중간] 프로세스 간 큐 clobber 레이스.** `userFlowDocs.ts:244`(read)→`:286`(스냅샷 통째 재작성). 큐 생산자(AI 스킬)는 별도 프로세스가 정상 워크플로 — apply 사이에 추가된 신규 제안이 흔적 없이 삭제될 수 있다(silent drop). 정적 검토(미실행 추론).
- **[낮음] 큐 중복 id 미검증** — 같은 id 2건 + approve 1개 → 에지 2줄 append(실측). `userFlowDocs.ts:76`에서 id 유일성 필터 권장.
- **[낮음] 라벨·rationale 길이 상한 부재** — 사이드카 큐 경유라 express body limit 우회, 수 MB 라벨이 문서에 append 가능(`userFlowDocs.ts:124-137`). 로컬 단일 사용자 전제로 실위험 낮음.
- **[낮음] apply POST 배열 크기 상한 부재** — `routes/docs.ts:328-357`. 기존 prd/features apply와 동일 패턴이라 별도 change에서 일괄 처리 권장.

## 현재 상태로 유지해도 되는 항목

- **D-1~D-7 전부 구현 준수** (10기준 패스 검증): D-1 append-only(`splice` 삽입만, 기존 줄 무수정), D-2 첫 블록 닫는 펜스 직전+블록 부재 시 skipped, D-3 to측 신규만+id 화이트리스트+대소문자 무시 충돌, D-4 금지문자 개별 skip, D-5 완전 비교 roundtrip+**무력화 프로브 실존**(userFlowDocs.test.ts:334-336 — 6b-features 교훈 반영), D-6 per-stem 큐+isSafeFlowToken 이중 게이트(라우트+lib), D-7 PrdApplyRequest/Result 재사용.
- **경로 이탈 방어 견고**: `^[A-Za-z0-9_-]+$` 화이트리스트(점 자체 불허), 인코딩 우회(`..%2f`)까지 통합 테스트 실측 커버(docsUserFlowApproval.test.ts:116,207).
- **프로토타입 오염·에러 누설 클린**: bracket 접근만·merge 없음, 에러 응답은 고정 토큰(내부 상세 stderr만).
- **파서 리팩토링 회귀 0**: buildUserFlowFromLines 추출은 순수 기계적, 281 테스트 PASS.
- 비원자적 write(temp+rename 없음)는 코드베이스 전반 패턴 + 로컬 단일 사용자 도구 전제 — 이 change에서 안 고쳐도 됨.
- GET 라우트의 flow 미지정 폴백(routes/docs.ts:318)은 spec 밖 추가지만 기존 GET과 대칭+테스트 있음 — 수용.

## 리팩토링 추천 항목

- **"안전 큐 읽기/쓰기" 스켈레톤 3벌째 복제 — rule of three 도달.** `docs.ts:195-209`(PRD)≡`featureDocs.ts:57-70`≡`userFlowDocs.ts:66-80`. design이 apply 로직 공통화 금지를 결정한 건 타당하나 read/write는 문서 구조와 무관한 순수 IO — 4번째 큐가 나오기 전에 `readSuggestionQueue(path, validator)` 제네릭으로 접기 권장.
- 주석-코드 불일치 정리: `userFlowDocs.ts:116` 주석은 `\0` 구분자, `:120` 구현은 `join(" ")` — 안전한 이유(id 문자집합에 공백 불가)를 주석으로 명시.
- `version: 1` 필드는 읽을 때 무시·쓸 때 항상 1 — 소비자 없는 의식(ceremony) 필드. 유지한다면 "미래 마이그레이션용, 현재 미검사" 주석 한 줄.

## 적대적 검토 (4 페르소나)

- **파괴자**: 치명 1(S-1 배치 독살 — 실측)·중간 2(CRLF 변환 실측, 큐 clobber 레이스)·낮음 2(중복 id 실측, 비원자 write). 단 **문서 손상 벡터는 못 뚫음** — 브래킷·백틱·펜스 불일치 프로브 3종 전부에서 원본 바이트 불변 실측, D-5 가드는 진짜다.
- **신입 개발자**: "첫 mermaid 블록" 정의 이중화(N-1, 상향), edgeKey 주석-코드 불일치, writeFailed 시 remaining 의미 경로별 상이(`userFlowDocs.ts:242` vs `:230`), skipped 문자열 프로토콜이 관례로만 존재.
- **보안 감사자**: 경로 이탈·프로토타입 오염·에러 누설 **클린(증거 있음)**. 발견 = D-4 밖 문자로 apply-DoS(A-2=S-1), 사이드카 경유 거대 문자열의 body limit 우회(낮음), 서드파티 mermaid 렌더러(GitHub/VS Code)에서 HTML 라벨 생존 가능(낮음/추정 — flowforge web 자체는 텍스트 렌더로 XSS 안전 실증 이력).
- **게으른 시니어**: 과잉구현 발견 = 큐 IO 3벌 복제(L-1)·ceremony version 필드(L-2)·spec 밖 GET 폴백(L-3, 수용 가능). 죽은 코드 0 — `userFlowInvariantHolds` export는 spec 의무 프로브의 테스트 표면, 신규 타입 2개뿐·계약 재사용(D-7) — 과잉 발명 없음.
- 2+ 페르소나 중복 발견(심각도 상승): **① D-4 밖 문자 배치 422 독살**(파괴자+보안, 중간→치명) **② 첫 mermaid 블록 정의 이중화**(파괴자+신입, 낮음→중간)

## 디자인 리뷰 (조건부 게이트)

frontend 신호는 존재(prototype.html·web 태스크 3.1/3.2/4.1)하나 **화면 코드가 아직 없어 디자인 리뷰 수행 불가** — 구현 후 재리뷰 시 gstack로 실픽셀 점검 필요. criteria 4·7 = 해당 없음(구현된 frontend 변경 없음).

## 최종 배포 가능 여부

**배포 불가** — 사유 2축:
1. **스코프 미완성**: spec Requirement 4/4 중 1개(web 승인 패널) 전체 미구현, tasks 3.1·3.2·4.1·5.1 미완, verify 판정 "조건부"·archiveGate closed. 서버만으로는 기능이 사용자에게 도달하지 않는다.
2. **치명 1건**: D-4 밖 문자 라벨의 사유 없는 배치 422(spec.md:50 계약 위반, 실측 재현).

단, **구현된 서버 부분의 품질 자체는 높다** — D-1~D-7 전 결정 준수, 무력화 프로브 실존, 문서 손상 벡터 실측 0, 경로 이탈 방어 견고. verify의 정직한 "검증 안 함" 보고와 일치.

## 개선 우선순위 (제안)

1. **web 3.1→3.2→4.1→5.1 구현 완료** — change의 존재 이유(승인 UI)가 없으면 나머지가 무의미.
2. **치명: D-4 밖 문자 개별 skipped 처리**(렌더→재파싱 pre-check 또는 금지문자 확장 + roundtrip 실패 사유 표면화) — spec 계약 회복, 일괄 승인 영구 불가 해소.
3. **첫 mermaid 블록 판별 단일화** — 같은 "무언 422" 클래스의 두 번째 진입로 봉쇄.
4. CRLF 보존(EOL 감지 후 join) — featureDocs와 공통 수정.
5. 큐 중복 id 필터 + 프로세스 간 큐 clobber 완화(문서화만이라도).
6. (별도 change) 큐 IO 제네릭 추출·apply 배열 상한 — 3벌 복제 해소.
