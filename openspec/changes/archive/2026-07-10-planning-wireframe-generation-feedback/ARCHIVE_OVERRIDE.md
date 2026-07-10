# Archive Gate Override 기록

- change: planning-wireframe-generation-feedback
- archive_gate_check.py exit = 4 (archiveGate 닫힘: 검증 안 함 1건 / SKIPPED 0건)
- 사유(구조적 조건부): verify "검증 안 함 1건" = generation "순차 게이트 — 선행 문서 없으면 생성 안 함". 생성 로직이 flowforge **밖 스킬** 계약이라 flowforge 내부에서 실행·검증 불가. hard FAIL 0, review.md도 "구조적 조건부, 이 change 결함 아님, 배포 가능(치명 0)"으로 판정.
- STALE(exit 5)·dirty(exit 6)는 아님: verify 리포트를 현재 HEAD(afff9d3)로 재바인딩, 빌드/타입체크/서버테스트 455건 실측 재통과 완료.
- 표준 spec 흡수(sync_specs, step 6): 하네스가 조건부 delta 병합 **거부**(REFUSE, override 플래그 없음) → 설계대로 **스킵**. openspec/specs/ 오염 방지 불변식 준수. change 디렉토리 archive만 진행.

## 사람 override (verbatim)
- 사용자(lim_myeongseop) 디스코드 지시: "여기서 작업하고 1부터 전부 진행해줘." (2026-07-10)
- 게이트 충돌 재보고 후 선택지 응답: "1" = 하네스 설계대로 spec 흡수 스킵 + archive만 완결(override 기록).
- 모델 자체 override 아님 — 사람의 명시적 지시로 exit 4를 넘어 archive 진행.
