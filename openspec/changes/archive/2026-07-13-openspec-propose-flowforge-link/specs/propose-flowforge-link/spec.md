# propose-flowforge-link

openspec-propose 스킬이 change 완료 시 최종 요약에 flowforge change 뷰 딥링크를 조립·노출하는 방식을 규정한다. 발행 인프라(openspec.gaegul.house)는 변경하지 않고, 완료 안내 링크만 flowforge 로 확장한다.

## ADDED Requirements

### Requirement: 완료 요약에 flowforge change 딥링크 노출

openspec-propose 가 모든 아티팩트를 완성하면, 최종 요약에 flowforge change 뷰를 여는 딥링크 URL 을 SHALL 노출한다. URL 형식은 `https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=prd` 이며, `<change>` 는 kebab-case change name, `<project>` 는 발행 프로젝트명이다.

#### Scenario: 발행 성공 시 flowforge 링크와 openspec 원문 병기

- **WHEN** openspec-propose 가 아티팩트를 완성하고 `publish_docs.py` 발행이 성공하면(`published:true`)
- **THEN** 최종 요약에 flowforge change URL(`https://flowforge.gaegul.house/?project=<project>&change=<change>&tab=prd`)을 노출한다
- **AND** openspec.gaegul.house 원문 링크(`https://openspec.gaegul.house/<change>/`)도 함께 병기한다(발행 유지 — 발행 인프라는 변경하지 않는다)

#### Scenario: 발행 스킵 시 flowforge URL 형식과 로컬 경로 안내

- **WHEN** `VERIFY_UPLOAD_URL`/`VERIFY_UPLOAD_TOKEN` env 가 없어 `publish_docs.py` 가 발행을 스킵하면(`skipped:true`)
- **THEN** 최종 요약에 로컬 산출물 경로(`openspec/changes/<change>/`)와 함께 flowforge change URL 형식을 안내한다
- **AND** 살아있지 않은 openspec.gaegul.house 원문 URL 을 지어내지 않는다(발행되지 않았으므로 그 링크는 유효하지 않다)

#### Scenario: project env 부재 시 change-only 링크로 폴백

- **WHEN** `VERIFY_PROJECT` env 가 설정되지 않아 project 값을 얻을 수 없으면
- **THEN** `project` 파라미터를 생략한 flowforge URL(`https://flowforge.gaegul.house/?change=<change>&tab=prd`)을 노출한다(flowforge 는 project 없으면 전역 root 하위호환으로 해석 — `web/src/api.ts:76-78`)
- **AND** 빈 `project=` 값이나 리터럴 `<project>` 플레이스홀더를 URL 에 남기지 않는다

#### Scenario: 선행 의존(flowforge 딥링크 라우팅) 미배포 시 안내

- **WHEN** flowforge 프론트에 `?project=&change=&tab=` URL 읽기·복원 라우팅(별도 change `flowforge-deeplink-url`, capability `flowforge-deeplink-routing`)이 아직 배포되지 않았으면
- **THEN** 이 링크는 flowforge 랜딩(grid)으로 폴백하며 change 뷰로 바로 열리지 않는다(선행 의존이 충족돼야 동작한다)
- **AND** 이 선행 의존은 design.md 에 리스크로 명시되어 있어야 한다(링크 형식 자체는 유효하나 소비자 라우팅이 필요함)

## TDD Plan

이 change 는 코드가 아니라 **스킬 문서(SKILL.md)** 를 수정한다. 실행 테스트 대신 문서 수정 결과를 검증한다(검증 게이트 적용 범위 §5-1 — 객관적으로 확인 가능한 산출물만).

- **Red(확인)**: 수정 전 `SKILL.md:159,178,197` 이 flowforge URL 안내 없이 openspec.gaegul.house 만 노출함을 grep 으로 확인한다.
- **Green(수정)**: §5-1-c / §5-2 / Output 문구에 flowforge URL 조립·병기·스킵 폴백 지시를 추가한다. 소스 + 캐시(1.1.8) 양쪽에 동일 반영.
- **검증(링크 형식)**:
  - `grep -n "flowforge.gaegul.house/?project=" SKILL.md` 로 URL 템플릿이 소스·캐시 양쪽에 존재하는지 확인.
  - openspec.gaegul.house 병기 지시(발행 성공 시)와 "지어내지 않는다" 스킵 지시(발행 스킵 시)가 모두 남아 있는지 확인.
  - 소스 SKILL.md 와 캐시 1.1.8 SKILL.md 의 해당 문구가 `diff` 로 일치하는지 확인.
- **Mock**: 없음(외부 의존성 없는 문서 변경).
