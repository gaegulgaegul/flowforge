## Tasks

> 비가역(charter 폐기)이 끼어있어 순서 의존성이 강하다(design.md D4). 이관·SKILL 작성은 병렬 가능하나, 폐기는 검증 PASS 후에만, 백업 태그는 폐기 직전에.

### Parallel Group 1 (독립 - 동시 실행 가능: 서로 다른 파일)
- [x] charter_status.py를 `skills/openspec-plan/charter_status.py`로 이관(복사, 원본 유지) [parallel] — 커밋 b9be71e, 이관본 588줄 확인
- [x] openspec-plan SKILL.md에 "spec.md 변환" 단계 추가 — features.md 요구사항 → `## capability: <영문키> — <한글>` + assert:endpoint(METHOD 화이트리스트)/assert:symbol/invariant(kind 화이트리스트)/metric(MANDATORY·placeholder 금지)/not-fabricated/idempotency 규약, 게이트 호출(charter_status.py validate/detect --audit-skill) 명문화 [parallel] — grep 11건 명문화 확인
- [x] openspec-plan SKILL.md frontmatter 갱신("PRD+features+user-flow+spec변환 구현")·"전체 설계(미구현)" 섹션에서 spec.md 변환 항목 제거(구현됨) [parallel] — 커밋 b9be71e

### Sequential: 이관본 동작 검증 (폐기 전 필수 게이트)
- [x] 이관한 charter_status.py에 8 mode 실행 — 최소 detect/validate를 flowforge 대상으로 `--audit-skill <openspec-audit>`와 함께 실행해 audit_match import 성공·JSON 출력 확인(import 경로 유지 입증) — validate(capabilityCount:10, fallbackParser:false)·detect(charterAction:revise)·discovery-coverage·prd-trace 실행 확인

### Sequential: 도그푸딩 변환 (검증 1차)
- [x] flowforge `docs/planning/features.md`의 4 요구사항을 `docs/spec.md` capability 블록으로 변환(영문키 보존·코드 실재 endpoint/symbol만 assert·실제 metric). 단 기존 10 capability 무수정 — 변환은 features.md 기준 재생성/갱신이되 거짓연결 0 원칙 — planning-prd-view/features-view/only-recognition/userflow-view 변환·영문키 보존·metric 보유 확인
- [x] 변환 결과 audit 재검증 — audit_match.parse_spec으로 거짓연결 0, charter_status.py `--mode validate`로 capability별 feature≥1+non-placeholder metric≥1 통과 확인 — audit_match counts PASS46/FAIL0/UNVERIFIABLE65 (거짓연결 0), 변환 4 capability validate 통과

### Parallel Group 2 (변환 검증 PASS 후 - 서술 갱신, 서로 다른 파일)
- [x] openspec-archive/SKILL.md의 "charter가 docs/ 생성" 서술을 plan 기준으로 갱신 [parallel] — "openspec-plan authors via features.md → docs/spec.md conversion", charter는 now-retired 역사주석
- [x] charter 폐기 전 git tag `pre-charter-retire` 백업(이관·SKILL·변환검증 PASS 상태에서) [parallel] — 태그→b9be71e(폐기 d66bd91 직전) 확인

### Sequential: charter 폐기 (비가역 — 백업 태그 확인 후)
- [x] git tag `pre-charter-retire` 존재 확인 후 charter 폐기 — `skills/openspec-charter/`의 SKILL.md·charter_scaffold.py·charter_wireframe.py·charter-schema.md·templates/ + 원본 charter_status.py 제거(이동본이 대체). charter_status.py 이동본은 보존 확인 — 커밋 d66bd91(1318줄 삭제), 폐기 대상 5종 부재·이동본 잔존 확인

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)
- [x] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → 폐기 후 audit 재검증(charter_status.py 이동본으로 flowforge validate/discovery-coverage 거짓연결 0) 전부 PASS. 깨지면 `pre-charter-retire` 태그 복구 롤백 — server/web tsc exit0·lint exit0·테스트 142/142·audit FAIL0. verify.html final=PASS gate_open=True
