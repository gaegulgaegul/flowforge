# Tasks — flowforge-mapping-basis-shift

> capability↔change 매핑의 **데이터 조인 기준**을 charter(docs/spec.md)+활성전용에서
> features.md capability + (활성+archive) change로 전환한다. UI(node-mapping 산출물)는 불변.
> ✅ 정식화 완료 — design.md에서 D1~D4 확정(소스·라이브 데이터 실측 근거).

## 선행: 설계 결정 (design.md 참조 — 실측 근거로 확정)

- [x] D1. 조인 원천: **features.md 단독**으로 전환(charter 필터 제거). `buildCapabilityIndex` 시그니처는
      불변 유지, `docs.ts`가 주입하는 집합만 `parseCharterCapabilities`→`parseFeatureCapabilities`로 교체.
- [x] D2. archive 스캔: **항상 포함**(`archive/` 1단계 재귀). 옵션 게이트 없음. `CapabilityChangeLink.archived?`
      옵셔널 플래그를 additive로 실어 후속 시각 구분 여지만 둠(배지 UI는 불변).
- [x] D3. specs/dir 네이밍: **별도 조인 테이블 없음**. 글자단위 정확 비교(거짓연결 0) 유지, 컨벤션 문서화만.
- [x] D4. 회귀 방어: `buildCapabilityIndex` 시그니처·동작 불변 → projects.ts 무손상. 원천 전환은 docs.ts
      한 곳 국소화. graph/koreanLabels/changes는 capabilityIndex 미import. 파일 없는 프로젝트=빈 Set=배지0(비회귀).

## Group A: features.md capability 파서 (서버, 선행)

- [x] A.1 (RED) `capabilityIndex.test.ts`에 features.md 기반 capability 추출 테스트 — features.md `<!-- capability: K -->` 집합을 조인 원천으로 쓰는 파생
- [x] A.2 (GREEN) `parseFeatureCapabilities`(featureTreeBuilder RE_CAPABILITY 동일 정규식) 신설 + `buildCapabilityIndex` 입력 원천 전환(docs.ts)

## Group B: archive 제외 완화 (서버)

- [x] B.1 (RED) archive change도 `byCapability`에 포함되는지 + `archived=true` 플래그 테스트(D2)
- [x] B.2 (GREEN) `capabilityIndex.ts`의 `changeKey === "archive"` 제외 → `archive/` 1단계 재귀로 완화 + `archived` 구분 필드

## Group C: 배선 + 회귀 (서버·web)

- [x] C.1 `docs.ts` attachLinkedChanges 배선의 원천 인자 교체(charter→features.md)
- [x] C.2 [회귀] docs/spec.md 다른 소비자(graph/koreanLabels/changes/projects) 무저촉 테스트 + wowa-app 파일없음=배지0 회귀 방어

## Sequential: 검증 게이트

- [x] BUILD/TEST/TYPECHECK: `npm run build` + `npm run test --workspace server` + `npm run typecheck` 전부 PASS
- [ ] D.1 `docker compose up -d --build` 라이브 반영 — **격리 worktree라 미실행(검증 안 함)**
- [ ] VERIFY: 실데이터 Playwright 실픽셀 배지 확인 — **배포 권한 필요, 이 worktree에서 미검증(design.md 불확실성 항)**
