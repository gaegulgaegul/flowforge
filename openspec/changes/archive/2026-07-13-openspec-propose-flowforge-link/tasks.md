## Tasks

이 change 는 agentic-harness 의 openspec-propose 스킬 문서(SKILL.md)를 수정한다. 코드 빌드/테스트 대신 문서 수정과 링크 형식을 검증한다(검증 게이트 §5-1 — 객관적으로 확인 가능한 산출물 한정).

### Sequential: SKILL.md 소스 수정 (선행 필수)

- [x] §5-2 (`SKILL.md:166-178`) `published:true` 분기에 flowforge change URL(`https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=prd`) 조립·병기 지시 추가 (spec: "발행 성공 시 flowforge 링크와 openspec 원문 병기")
- [x] §5-2 (`SKILL.md:178`) `skipped:true` 분기에 로컬 경로 + flowforge URL 형식 안내, openspec.gaegul.house URL 지어내기 금지 지시 추가 (spec: "발행 스킵 시 flowforge URL 형식과 로컬 경로 안내")
- [x] §5-2 조립 지시에 `VERIFY_PROJECT` 미설정 시 `?project=` 생략(change-only URL) 폴백 명시 (spec: "project env 부재 시 change-only 링크로 폴백")
- [x] Output (`SKILL.md:197`) 요약 목록의 "문서 확인" 항목을 flowforge URL(1차) + openspec.gaegul.house 원문(병기)으로 조정
- [x] §5-1-c (`SKILL.md:159`) 프로토타입 URL 정합성 문구 다듬기(프로토타입 링크와 change 딥링크 공존, 발행 인프라 불변)

### Sequential: 캐시 동기화 (소스 수정 후 필수)

- [x] `~/.claude/plugins/cache/agentic-harness/agentic-harness/1.1.8/skills/openspec-propose/SKILL.md` 에 소스와 동일한 문구 반영(런타임 로드 대상 = 캐시)

### Sequential: 링크 형식·선행 의존 검증

- [x] `grep -n "flowforge.gaegul.house/?project=" SKILL.md` 로 소스·캐시 양쪽에 URL 템플릿 존재 확인 (spec: flowforge 딥링크 노출)
- [x] openspec.gaegul.house 병기 지시(발행 성공)와 "지어내지 않는다" 스킵 지시(발행 스킵)가 둘 다 남아 있는지 grep 확인 (spec: 병기 / 스킵 폴백)
- [x] 소스 SKILL.md 와 캐시 1.1.8 SKILL.md 해당 문구 `diff` 일치 확인
- [x] design.md 에 선행 의존(`flowforge-deeplink-url` / `flowforge-deeplink-routing`)과 flowforge 서빙 범위 미확인 리스크가 기록돼 있는지 확인 (spec: "선행 의존 미배포 시 안내")

### Sequential: 검증 게이트 (마지막 필수 — dev-verify)

- [x] VERIFY: 5단계 게이트 통과 — 빌드 → 타입체크 → 린트 → 테스트 → UI(프론트 변경 시) 전부 PASS. 이 change 는 스킬 문서(SKILL.md) 수정이라 실행 빌드·테스트 대상 코드가 없으므로, 해당 범위에서 문서 수정 검증(위 grep/diff 항목)이 게이트를 대신한다 — SKILL.md 소스·캐시 문구 일치 + URL 템플릿 존재 + 병기/스킵 지시 존재가 전부 확인되면 PASS.
