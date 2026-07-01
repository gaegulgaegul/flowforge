# 배포 전 최종 검토 — planning-approval-edit-ui-prd (6a PRD 승인/반려 편집 UI)
검토일: 2026-07-01 / 검토 범위: 이 change diff(shared 2 · server 4 · web 4)
- shared/src/prd-suggestion-types.ts, shared/src/index.ts
- server/src/lib/docs.ts, server/src/routes/docs.ts, server/src/lib/__tests__·routes/__tests__/docsPrdApproval.test.ts
- web/src/PrdApprovalPanel.tsx, web/src/App.tsx, web/src/api.ts, web/src/styles.css

검토 방식: verify.json(final=PASS, 13 scenario) 입력 + code-reviewer 에이전트 적대 리뷰(다른 세션, self-review 함정 회피) + 본체 직접 실측(역직렬화 무결성·XSS·프로토타입오염·state-sync). 4페르소나 적대 패스는 change 전체 스코프.

## review criteria brief
- changeTypes: [backend, frontend] (server lib/routes + web 컴포넌트/App.tsx, prototype.html 존재)
- ruleSets: backend→20-testing/30-security, frontend→60-design/70-adversarial-review, 소스변경→10-coding-style
- designYardsticks(지킴 확인): 사이드카 제안 큐+개별/일괄 승인반려, 승인분만 prd.md 반영·반려 원본불변, SSOT="승인 통해서만 변경", H1 서문 보존, writeFailed(422)와 미실재 id(skipped) 구분. Non-Goals(오지적 안 함): features/유저플로우 승인=6b, LLM 호출 없음, 동시성/대량=개인용 범위 밖.

## 반드시 수정해야 할 항목
- **[HIGH · 해결됨] proposedBody의 줄 시작 `## `가 재파싱 시 가짜 섹션으로 오분리 → prd.md 데이터 손상.**
  - 위치: `server/src/lib/docs.ts` writeDocsPlanningPrd (조립 결과 소비처), 근인 `server/src/parser/markdown.ts:14` RE_H2.
  - 재현(실측): proposedBody에 `## 가짜헤더` 포함 승인 → 1차 반영됨 → 재파싱 시 6섹션 오분리 → **2차 승인 시 개요 본문의 가짜헤더 이하 텍스트 통째 소실**. verify 13 scenario 미커버.
  - 수정: writeDocsPlanningPrd가 조립한 out을 **write 전 self-roundtrip 재파싱**해 정확히 원래 5섹션 키로만 갈리는지 검증 → 아니면 안 쓰고 false(원본 보호) → 라우트 422로 표면화. 커밋: fix(server) proposedBody '## ' 오분리 차단.
  - 재검증(전후): 수정 전 데이터 소실 재현 → 수정 후 1차 승인 자체가 false로 거부·원본 5섹션 그대로. 회귀 테스트 3개 추가(lib 2 + 라우트 1), 서버 179/179 PASS.

## 수정하면 좋은 항목
- **[MEDIUM · 해결됨] writeFailed(422) 원인이 사용자에게 불투명** (2페르소나 중복 발견=심각도 상승).
  - `web/src/api.ts` applyDocsPrdSuggestions가 422를 `prd-apply 422`로만 던져 "원본 형식 문제·큐 보존"이 사용자에게 안 보였음. → 422를 "prd.md 형식이 예상과 달라 반영하지 못했습니다(원본·큐는 보존됨)."로 명확화. 커밋 포함.

## 현재 상태로 유지해도 되는 항목
- **XSS 없음**: PrdApprovalPanel이 proposedBody/현재본문을 `<pre>{...}` JSX 텍스트 노드로 렌더(자동 이스케이프), dangerouslySetInnerHTML 미사용. (본체 실측 확인)
- **프로토타입 오염 없음**: readDocsPrdSuggestions→Map 사용, `__proto__` id 승인 시도해도 Object.prototype 오염 false. (본체 실측)
- **경로안전**: resolveDocsDir(화이트리스트 `^[A-Za-z0-9_-]+$`) 재사용, 쓰기는 안전한 docsDir 위 join만. docs 루트 밖 유출 없음.
- **state-sync 견고**: applyPrd는 낙관업데이트 없이 POST 후 재조회 + dashReqToken race 가드(다른 카드 이동 시 폐기). busy 가드로 중복 클릭 차단.
- **역직렬화 무결성**: 실제 flowforge prd.md(리스트·굵게·서문 포함)로 실측 — 미교체 섹션 리스트 11항목·H1 서문 전부 보존.
- **op:'replace'만 지원**: design.md·타입 주석에 "예광탄 스코프"로 명시된 의도적 축소. 확장 시 op union 자연 확대.
- **동시성 미보장**: 개인용 단일 사용자로 design.md 명시. (LOW: 주석 한 줄 있으면 더 좋음 — 6b에서 반영 고려)

## 리팩토링 추천 항목
- **[LOW] PRD_SECTION_ORDER 리터럴이 prdBuilder.ts의 한국어 섹션 제목과 두 파일에 중복** — 하나 바뀌면 조용히 어긋남. 공통 상수 추출 후보(단 예광탄에선 감점 아님, 6b 확장 시 정리).
- **[LOW] proposedBody/approve 배열 길이 제한 없음** — 개인용 로컬이라 무해하나, 다중사용자 전환 시 DoS 방지 위해 길이 상한 추가 필요.

## 적대적 검토 (4 페르소나)
- **파괴자**: HIGH(proposedBody `## ` 오분리 데이터손상) 발견 → 재현·수정·회귀테스트 완료. race condition은 design.md 명시(개인용)라 LOW.
- **신입 개발자**: writeFailed 의미가 프론트에서 반쪽만 노출(MEDIUM) → 수정. PRD_SECTION_ORDER 중복(LOW). 함수명·의도·주석 전반 명확.
- **보안 감사자**: XSS·프로토타입오염·경로조작·에러노출 전부 깨끗함(실측). proposedBody 길이 무제한만 LOW(개인용 무해).
- **게으른 시니어**: 과잉구현 없음. PrdApprovalPanel(112줄)=카드형 승인 UI로 적정, 새 의존성 0, splitSections·isLayoutOverlay 패턴 재사용(중복 아닌 컨벤션 준수).
- 2+ 페르소나 중복(심각도 상승): writeFailed 불투명(파괴자→신입/UX 공통) = MEDIUM으로 상승 → 해결됨.

## 최종 배포 가능 여부
**배포 가능** — HIGH 1건(데이터 손상)·MEDIUM 1건(에러 메시지) 모두 이번 검토에서 수정·재검증 완료. 남은 LOW 2건(상수 중복·길이 제한)은 예광탄 스코프에서 비치명, 6b 확장 시 처리. verify 13 scenario 무손상 + HIGH 방어 회귀 테스트 3개 추가로 179/179 PASS.

## 개선 우선순위 (제안)
1. ~~[HIGH] proposedBody `## ` 오분리 데이터손상~~ → **해결됨**(self-roundtrip 방어 + 회귀 3).
2. ~~[MEDIUM] writeFailed 사용자 메시지 불투명~~ → **해결됨**.
3. [LOW] PRD_SECTION_ORDER 공통 상수화 — 6b features/유저플로우 확장 시 함께 정리(매핑 drift 방지).
4. [LOW] proposedBody/approve 길이 상한 — 다중사용자 전환 시 필수(현재 개인용 무해).
