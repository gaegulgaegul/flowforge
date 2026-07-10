# 배포 전 최종 검토 — planning-wireframe-generation-feedback
검토일: 2026-07-10 / 검토 범위: 이 change의 diff만 (전체 앱 아님) — server(`wireDocs.ts`·`routes/docs.ts` 와이어 라우트·`planningWireframeFixture.ts`+테스트), shared(`wire-suggestion-types.ts`·`index.ts`), web(`WireframePinFeedback.tsx`·`WireframeApprovalWizard.tsx`·`WireframeDeviceFrame.tsx`·`api.ts`·`App.tsx` 와이어탭·`styles.css`), infra(`docker-compose.yml`)

## verify 입력 (역할 분리: verify=실증, review=판단)
verify.json: **조건부** (PASS 25·FAIL 0·검증 안 함 1·SKIPPED 0). 검증 안 함 1건 = generation "순차 게이트 — 선행 문서 없으면 생성 안 함" → 생성 로직이 flowforge **밖 스킬** 계약이라 flowforge에서 실행·검증 불가. design D3/생성주체 결정에 따른 **구조적 조건부**이며 이 change의 결함이 아니다. hard FAIL 0.

## 반드시 수정해야 할 항목
- 없음 (CRITICAL/HIGH 0). 우선 지목한 두 리스크가 적대 검증에서 모두 클린:
  - **path traversal (project·screenId)**: `resolveDocsDir`(`server/src/lib/docs.ts:81-89`)의 `..` 체크 + `/^[A-Za-z0-9_-]+$/` 화이트리스트가 라우트 진입에서 차단, null이면 404로 lib 호출 자체 차단(`routes/docs.ts:474-478`). `screenId`는 파일 경로 조합에 전혀 안 쓰이고 화이트리스트 멤버십만 검사(`wireDocs.ts:329-330`). → 실사용 불가.
  - **feedback 동시 append race (TOCTOU)**: `appendWireframeFeedback`(`wireDocs.ts:341-344`)이 read→push→`writeFileSync` 전 동기 코드 + 단일 컨테이너/프로세스(docker-compose에 replica 없음) → 이벤트루프가 원자적 처리, 인터리빙 불가.

## 수정하면 좋은 항목
- **feedback text 크기 상한 부재** (`wireDocs.ts:317-346`, `server/src/index.ts` express.json 기본 100kb): 명시적 text max length 없음. `requireWriteAuth`로 익명 DoS는 막히나, 인증 사용자의 폭주(재시도 루프·더블클릭)로 사이드카 파일이 부풀 수 있음. 텍스트 길이 캡(예 2000자) 권장. 블로커 아님.
- **단일 프로세스 가정 미문서화** (`wireDocs.ts:317-346`): read-modify-write가 단일 Node 프로세스 전제. 향후 cluster/replica 스케일 시 조용히 데이터 유실 위험. 함수 docstring에 "single-process 가정(멀티워커 시 레이스)" 한 줄 권장.
- **좌표 검증 중복** (`routes/docs.ts:448-450` `isPctInRange` vs `wireDocs.ts:307-309` `isValidPct`): 동일 프레디케이트 2곳. 계층 분리 의도는 이해되나 손으로 맞춰 유지하는 부담. 하나 export/공유 고려. 기존 프로젝트도 유사 패턴이라 이 change 특이사항 아님.

## 현재 상태로 유지해도 되는 항목
- **feedback GET readback 없음 → 새로고침 시 핀 사라짐** (`WireframePinFeedback.tsx:260` pins state): design D3 A안("flowforge는 write만, 재생성은 밖 스킬")과 정확히 일치하는 **의도된 범위 제한**. 결함 아님. (사용자에게 별도 고지 완료 — 과거 핀 재표시 필요하면 feedback read 계약을 별도 change로.)
- **인증 게이트**: 쓰기 라우트(apply·feedback) 둘 다 `requireWriteAuth` 부착 확인(`docs.ts:289,471`). GET 큐 조회는 미부착 = 기존 관례(GET 공개·POST 게이트)와 일치.
- **내부 에러 비노출**: `safe()` 래퍼가 500을 `{error:"internal_error"}`로만, 상세는 stderr(30-security 준수).
- **엣지케이스 방어**: 빈 텍스트·좌표 범위밖·NaN/Infinity·미존재 화면id 전부 테스트 커버(`wireDocs.test.ts:352-386`) + 라이브 400 거부 확인.
- **재사용 우수(과잉구현 없음)**: `WireframeDeviceFrame`을 새로 안 만들고 prop 3개(hideControls/renderOverlay/focusTarget)로 확장(design D7 최소해법 그대로), `ApprovalWizard` 셸·`PrdApplyRequest/Result`·`applyInChunks`·`APPLY_BATCH_CAP` 전부 재사용, 신규 배치로직 0.
- **region 임계값(20/82/22)**: 매직넘버지만 docstring에 "목업 regionAt 로직" 출처 명시, 재사용처 1곳이라 상수화 이득 적음.

## 리팩토링 추천 항목
- `writeFileSync` 비원자성(temp+rename 아님): `wireDocs.ts:344,181`. 단 featureDocs/userFlowDocs/docs(PRD·overlay) 전역 기존 패턴이라 이 change 회귀 아님 → **별도 change로 전역 처리** 권장(원자적 쓰기 헬퍼 도입).
- 좌표 검증 프레디케이트 공유(위 [수정하면좋음]과 동일).

## 적대적 검토 (4 페르소나)
- **파괴자**: feedback 동시 append race를 정밀 추적 → 단일 프로세스·전 동기라 현재 트리거 불가(클린), 단 멀티워커 확장 시 재발 잠재. writeFileSync 부분파일 위험은 전역 기존 패턴. text 크기 무제한(디스크 소모 잠재).
- **신입 개발자**: 네이밍·문서화 전반 우수(함수/타입마다 design D-번호 참조 주석). 단일 프로세스 가정만 미문서화 → 6개월 뒤 cluster 전환 시 함정.
- **보안 감사자**: path traversal(project·screenId) 두 벡터 정밀 확인 → **클린**(화이트리스트+screenId 비경로). 인증 게이트 적용, 에러 비노출 확인. text 크기 상한만 보강 권장.
- **게으른 시니어**: 과잉구현 없음 — 프레임/위저드/apply타입/배치상수 전부 재사용, prop 최소 확장. GET readback 미구현은 의도된 범위(오지적 아님). 좌표검증 중복만 사소 지적.
- 2+ 페르소나 중복 발견(심각도 상승): text 크기 상한(파괴자+보안), 단일프로세스 가정(파괴자+신입) — 둘 다 [수정하면 좋음] 유지(중복됐으나 배포 블로커 수준 아님).

## 디자인 리뷰 (화면 작업 있음 — web 핀 UI)
라이브 실픽셀 확인(gstack, flowforge 8812): 와이어 탭 디바이스 프레임(데스크탑 브라우저크롬+사이드+카드그리드, 모바일 폰+하단바) 목업과 정합, 회색조 로우피델리티. 인플레이스 핀 e2e(⌘+클릭→팝오버 "본문·50%,55%"→핀 마커→목록 반영) 동작. 다크모드·데스크탑/모바일 토글 정상. DESIGN.md 부재(와이어는 의도적 로우피델리티라 디자인 토큰 미적용이 정상 — "최종 디자인 아님" 안내 있음). criteria 4(UX)·7(반응형) 충족.

## 최종 배포 가능 여부
**배포 가능** — CRITICAL/HIGH 0. verify 조건부는 구조적(생성이 flowforge 밖)이라 결함 아님. [수정하면 좋음] 4건은 후속 커밋/change로 처리 무방.

## 개선 우선순위 (제안)
1. feedback text 길이 상한(2000자류) — 파괴자+보안 중복, 인증사용자 폭주 완충. 작은 수정.
2. 단일 프로세스 가정 docstring 1줄 — 미래 cluster 전환 함정 방지. 문서만.
3. 좌표 검증 프레디케이트 공유 — 유지보수 부담 경감. 리팩토링.
4. writeFileSync 원자적 쓰기 — 전역 패턴이라 별도 change. 프로젝트 전반 개선.
