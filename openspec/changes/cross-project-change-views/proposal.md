# cross-project-change-views

## Why

프로젝트 카드는 PROJECTS_ROOT를 스캔해 여러 프로젝트(wowa-app·ssoksok 등)를 보여주는데, change를 클릭하면 5종 뷰 API(`/api/changes/:id/*`)가 **단일 글로벌 OPENSPEC_ROOT만 봐서** flowforge 자체 change 외엔 전부 404 dead-end다. "인식·목록은 프로젝트별인데 뷰 열기는 글로벌"이라는 구조 불일치 — 타 프로젝트의 openspec 산출물을 flowforge에서 볼 수 없다.

## What Changes

- 5종 뷰 GET(graph·ia·wireframe·prd·spec-tree)과 layout PUT에 **선택적 `?project=` 쿼리**를 추가: 있으면 해당 프로젝트의 `openspec/changes/`에서 change를 해석(기존 프로젝트 화이트리스트 검증 재사용), 없으면 기존 글로벌 루트 그대로 — **하위호환 100%, 기존 소비자 무영향**.
- web: `ChangeSummary`에 `project` 필드 추가(additive), change 클릭 시 현재 프로젝트 컨텍스트를 5종 fetcher와 layout 저장에 전달.
- 타 프로젝트는 라이브에서 읽기전용 마운트일 수 있음 — layout 드래그 저장 실패는 기존 실패 경로(상태바 안내)로 무해 처리(문서·데이터 불변).

## Capabilities

### New Capabilities

- `cross-project-change-views`: 프로젝트 컨텍스트로 change 5종 뷰를 해석하는 능력(경로 안전·하위호환 포함)

### Modified Capabilities

(없음 — 기존 요구는 변경 없이 유지, 신규 능력으로 추가)

## Impact

- server: `lib/changes.ts`에 프로젝트 기준 change 해석(기존 `resolveChangeDir` 확장 또는 병렬 함수), `routes/graph.ts` 6개 라우트에 `?project=` 처리(+화이트리스트 검증 — projects.ts `resolveProjectDir` 재사용)
- web: `api.ts` 5 fetcher+layout 저장에 project 인자(옵션), `App.tsx` openChangeViews가 dashProject 전달, `ChangeSummary.project`
- 보안: project 값은 기존 화이트리스트(디렉토리 실재+`..` 차단) 검증 필수 — 임의 경로 열람 금지
- Non-Goal: 타 프로젝트 문서(planning/*) 뷰의 추가 개편 / RO 마운트 RW화 / change 목록 UI 변경
