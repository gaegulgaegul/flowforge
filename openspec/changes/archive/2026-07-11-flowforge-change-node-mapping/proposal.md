# flowforge-change-node-mapping

## Why

flowforge는 change를 skeleton 하단에 **capability별 목록으로 한꺼번에 나열**한다(방금 아카이브된 `flowforge-change-entry-unified`). 사용자 피드백(2026-07-11): **이 방향이 틀렸다.**

- 사용자가 원하는 것: 기능명세 트리의 각 노드(요구사항/기능/상세기능)와 각 화면을 볼 때, **그 노드/화면에 연관된 change만** 그 자리(in-place)에 붙어 보여야 한다. "항상 연관된 정보를 보여준다."
- 지금은 정반대다 — 모든 change를 노드와 무관하게 별도 블록에 통째로 나열한다. 어떤 기능이 어떤 change와 관련됐는지 노드 옆에서 알 수 없다.

근본 원인(조사 2026-07-11): flowforge의 "기획 기능명세 트리"(`FeatureTree`, `docs/planning/features.md` 출신)와 "change"(`SpecTree`, `openspec/changes/` 출신)는 **완전히 분리된 두 계보**다(다른 파일·타입·파서·라우트). 둘을 잇는 유일한 조인키는 **요구사항 노드의 `<!-- capability: 키 -->`**(`featureTreeBuilder.ts:136`) ↔ change의 `specs/<capability키>/` 디렉토리명이며, 이 매핑은 이미 `capabilityIndex.byCapability`(`server/src/lib/capabilityIndex.ts:95-99`)에 존재한다. 즉 **요구사항 노드 ↔ 연관 change 매핑 데이터는 이미 있는데, 그걸 노드 옆에 in-place로 표시하는 UI가 없어서** 목록 나열로 때웠던 것이다.

관련 change와의 경계: `flowforge-screen-crosslink`(활성)는 유저플로우 노드 ↔ **와이어/기능명세** 상호참조를 다루지만 **전부 기획 계보 내부**이고 **change와는 무관**하다. 이 change는 그 "화면 id 허브" 패턴을 **change까지 확장**하는 별개 작업이다(중복 아님).

## What Changes

- **skeleton 하단의 "change 목록(capability별)" 통짜 나열을 제거**하고, 대신 change를 **연관된 기획 노드/화면에 in-place로 매핑**해 표시한다.
- **노드 판별·매핑 규칙**(이 change의 심장 — 조사 기반 설계안, design.md에서 확정):
  1. **요구사항 노드**: 그 노드의 `capability` 키로 `byCapability`를 조회해 **연관 change가 있으면** 그 노드에 change 배지/펼침(연관 change만)을 in-place로 붙인다. 연관 change가 0개면 아무것도 안 붙인다(빈 노출 금지 — "항상 연관된 것만").
  2. **기능·상세기능 노드**: 이들은 자체 capability 필드가 없으므로(요구사항 노드만 가짐), 자신이 속한 **상위 요구사항의 capability**를 상속해 연관 change를 조회한다. 상세기능은 추가로 **연결 화면(`screens` 링크)**을 타고, 그 화면과 연관된 change도 함께 표면화한다(아래 3).
  3. **화면 노드(IA·와이어·유저플로우 화면)**: 그 화면 id에 연결된 상세기능들의 상위 요구사항 capability를 모아, 그 capability들의 연관 change를 그 화면 자리에 in-place로 매핑한다. 화면↔change 직접 조인 데이터는 현재 없으므로(조사 확정), **화면 → 상세기능 → 요구사항 capability → change** 경로로 파생한다.
- **"모든 change 한 번에" 금지**: 어떤 노드/화면에서든 그 자리에 연관된 change만 보인다. 전역 목록 뷰는 없앤다.
- **읽기 전용 + 진입**: 노드에 붙은 change 배지/항목을 클릭하면 그 change의 5종 뷰로 진입(기존 `openChangeViews` 재사용). change를 노드에서 편집하는 기능은 범위 밖.

## Capabilities

### New Capabilities
- `flowforge-change-node-mapping`: 기획 기능명세 트리의 노드(요구사항/기능/상세기능)와 화면 노드 각각에, 그 노드와 연관된 change만 in-place로 매핑해 표시한다. 매핑은 요구사항 노드의 capability 키를 기점으로 `byCapability`를 조회하고, 하위 노드는 상위 capability 상속, 화면은 상세기능↔화면 링크를 역경유해 파생한다. 연관 change가 없는 노드에는 아무것도 붙이지 않으며, 전역 change 목록 나열은 제거한다. change 항목 클릭 시 5종 뷰 진입(읽기 전용).

### Modified Capabilities
- `flowforge-change-entry`: 방금 도입된 "기획문서 유무 무관 change 목록 항상 노출"의 **전역 목록 나열 부분을 제거/대체**한다. change 진입 경로(capability→change→5종 뷰)는 노드 in-place 매핑을 통해 재구성한다. (skeleton 하단 통짜 목록 → 노드별 연관 매핑으로 전환.)

## Impact

- **웹(프론트 주로)**: `web/src/App.tsx` — skeleton 하단 "change 목록(capability별)" 블록(방금 추가한 `dash-changes-section`) 제거, 대신 기능명세 트리 노드 렌더에 연관 change 배지/펼침 주입. 기능명세 노드 컴포넌트(`featureTreeAdapter.ts`/노드 렌더)에 change 매핑 파생·표시 추가. `web/src/CapabilityChangeList.tsx`는 노드 in-place 표시로 대체되거나 재사용.
- **서버/파생**: `server/src/lib/capabilityIndex.ts`의 `byCapability`(요구사항 capability↔change)를 재사용. 노드↔change 매핑을 노드 트리에 실어주는 파생 로직 신설 가능(요구사항 노드에 연관 changeKeys 부여, 하위/화면 상속·역경유). 화면↔change는 상세기능↔화면 링크(`screenRegistry`)를 역인덱싱해 파생 — **새 원천 데이터 없이 기존 조인키만 조합**.
- **shared**: 노드 타입(`FeatureTreeNode`)에 옵셔널 `linkedChanges?: string[]` 파생 필드 추가 가능(비파괴). 화면 노드도 동일.
- **데이터 한계(정직)**: change↔기획 매핑의 최소 입도는 **capability 키(요구사항 단위)**다. change spec 내부의 개별 Requirement/Scenario를 기획의 특정 상세기능에 잇는 데이터는 없다 — 상세기능/화면 매핑은 "상위 요구사항 capability 상속·역경유"로 근사한다. 더 세밀한 매핑을 원하면 별도 원천 데이터 신설이 필요(이 change 범위 밖, design.md 의도적 제외에 명시).
- **되돌리기**: 노드 매핑 UI 제거 + 전역 목록 복원이면 원복. 서버 파생은 옵셔널 필드라 비파괴.
- **검증**: flowforge는 커밋≠라이브 — `docker compose up -d --build` 재빌드 후 Playwright 실픽셀로 (1) 노드에 연관 change만 in-place 표시, (2) 연관 없는 노드엔 미표시, (3) 화면 노드 역경유 매핑, (4) change 클릭 시 5종 뷰 진입을 실관찰. 특히 skeleton·views 단계 탭 UI 불일치(사용자 지적)도 이 기회에 점검.
