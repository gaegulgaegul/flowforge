# Design — flowforge-change-node-mapping

## Context

flowforge는 두 계보를 가진다(조사 2026-07-11 확정):
- **기획 계보**: `FeatureTree`(`docs/planning/features.md`) — 요구사항→기능→상세기능 3단. 요구사항 노드에만 `<!-- capability: 키 -->`가 붙는다(`featureTreeBuilder.ts:136`). 상세기능 노드는 `<!-- screens: a,b -->`로 화면과 N:M 링크(`featureTreeAdapter.ts:152` `screensForDetail`).
- **change 계보**: `openspec/changes/<c>/specs/<capability키>/spec.md`. change는 자기 `specs/` 하위 디렉토리명(=capability 키)으로 기획 capability에 묶인다.

두 계보를 잇는 **유일한 조인키 = capability 키**. `capabilityIndex.ts`의 `byCapability: Map<capabilityKey, changeKey[]>`(`:53,95-99`)가 이미 "요구사항 capability ↔ 연관 change" 매핑을 보유한다. 화면 id는 기획 산출물끼리(상세기능·유저플로우·IA·와이어)만 조인하며 **change와 직접 조인하는 데이터는 없다**.

현재 UI는 이 매핑을 노드 옆이 아니라 skeleton 하단 **전역 목록**으로 나열한다(방금 아카이브한 `flowforge-change-entry`의 `dash-changes-section`). 사용자는 이를 "연관 없이 모든 change를 통째로 보여준다"고 지적했다.

## Goals / Non-Goals

**Goals:**
- 기획 노드/화면 각각에 **그 노드와 연관된 change만** in-place로 표시한다("항상 연관된 것만").
- 전역 change 목록 나열(`dash-changes-section`)을 제거한다.
- change 항목 클릭 시 기존 `openChangeViews`로 5종 뷰 진입(읽기 전용).
- 새 원천 데이터 없이 **기존 조인키(capability 키 + 상세기능↔화면 링크)만 조합**해 매핑을 파생한다.

**Non-Goals:**
- **change spec 내부 Requirement/Scenario ↔ 기획 상세기능의 세밀 매핑**: 데이터가 없다. 상세기능/화면 매핑은 "상위 요구사항 capability 상속·역경유"로 근사할 뿐, 개별 시나리오 단위 정합은 하지 않는다. (더 세밀히 원하면 별도 원천 데이터 신설 — 후속.)
- **화면 id ↔ change 직접 조인 데이터 신설**: 이번엔 파생(화면→상세기능→요구사항 capability→change)으로만 처리.
- **change를 노드에서 편집/추가**: 읽기 전용 매핑만.
- **planning 5종 뷰·유저플로우 좌표·승인 위저드·핀 피드백 계보 변경**: 노드에 change 표시를 얹을 뿐 기존 렌더/편집은 불변.
- **`flowforge-screen-crosslink`가 다루는 기획 계보 내부 상호참조(노드↔와이어/기능)**: 그건 별개 change 소관. 여기선 노드↔change만.

## Decisions

### D1. 노드 판별·매핑 규칙 (이 change의 심장)
사용자 표현("노드가 기획 기능인지 change인지 판별")을 데이터 현실로 번역하면: **모든 기획 트리 노드는 "기획의 기능"이다**(change는 별개 트리라 노드로 섞여 있지 않다). 따라서 판별이 아니라 **"이 기획 노드에 연관된 change가 있는가"를 조인**하는 것이 핵심이다.

- **요구사항 노드**: `node.capability` → `byCapability.get(capability)` → 연관 changeKeys. 있으면 노드에 in-place 표시, 없으면 미표시.
- **기능 노드(3단)**: 자체 capability 없음 → **상위 요구사항의 capability 상속** → 동일 조회.
- **상세기능 노드(4단)**: (a) 상위 요구사항 capability 상속 조회 + (b) 자신의 `screens` 링크가 가리키는 화면들의 연관 change도 합집합(중복 제거)해 표시.
- **화면 노드(IA/와이어/유저플로우 화면)**: 그 화면 id를 `screens` 링크로 가진 상세기능들 → 각 상세기능의 상위 요구사항 capability 집합 → 그 capability들의 change 합집합을 화면 자리에 표시.
- **빈 매핑 = 미표시**: 연관 change 0개인 노드/화면엔 아무 배지/블록도 붙이지 않는다(사용자 요구 "연관된 정보만").

### D2. 파생 위치 — 서버 파생 우선
`byCapability`는 서버(`capabilityIndex.ts`)에 있다. 노드 트리에 `linkedChanges: string[]`를 실어주는 파생은 **서버에서** 하는 게 자연스럽다(요구사항 노드에 부여 → web adapter가 하위/화면 상속·역경유). 대안(web adapter에서 전부 파생)은 web이 byCapability를 별도 fetch해야 해 배선이 늘어난다. **서버 파생 + web 상속/역경유**로 택1.

### D3. 전역 목록 제거 방식
`dash-changes-section`(App.tsx skeleton 하단)을 제거한다. capability→change 진입은 이제 노드 in-place 배지 클릭으로 대체된다. `CapabilityChangeList.tsx`는 노드 펼침 UI로 재사용하거나 대체.

### D4. 표시 UI (최소)
노드 라벨 옆에 연관 change 개수 배지(예: "change 2") + 클릭/호버 시 그 change 목록 펼침 → 항목 클릭 시 `openChangeViews`. 새 CSS 컴포넌트 최소화, 기존 `dash-cap`/배지 스타일 재사용.

### D5. 탭 UI 불일치 (부수 — 사용자 지적)
skeleton 단계 탭 바(중앙 상단)와 views 단계 탭 바(좌측+브레드크럼)의 위치·정렬이 다르다. 이 change의 본질은 아니나, 노드 매핑으로 skeleton 구조를 손대는 김에 **탭 바 정렬 통일**을 tasks에 선택 항목으로 둔다(범위 과확장 시 별도 change로 분리).

## Risks / Trade-offs

- **매핑 입도 한계**: capability(요구사항) 단위라, 한 요구사항에 여러 상세기능이 있으면 그 change가 어느 상세기능과 관련됐는지까지는 구분 못 한다 → 상세기능/화면엔 "상위 capability의 change 전부"가 상속돼 다소 넓게 보일 수 있다. 사용자가 더 좁은 정합을 원하면 원천 데이터(시나리오↔상세기능) 신설 필요(후속). 이 트레이드오프를 명시하고 진행.
- **화면 역경유 비용**: 화면→상세기능→요구사항 역인덱스를 매 렌더 파생하면 큰 트리에서 비용. 파생을 1회 계산 후 캐시(맵)해 노드 렌더에서 O(1) 조회.
- **회귀**: 전역 목록 제거로 "기존에 목록으로만 접근하던 경로"가 사라진다 → 노드 매핑이 그 접근성을 완전히 대체하는지 Playwright로 확인(연관 change가 있는 노드에서 반드시 진입 가능해야).
- **screen-crosslink와의 경계**: 두 change가 모두 노드 상세 패널을 건드릴 수 있어 파일 충돌 가능 → screen-crosslink 미착수분과 스코프를 겹치지 않게(노드↔change만) 격리.

## 화면 구성 / UI
- 화면 구조·흐름·이동(딥링크)의 명세는 `prototype.html`을 단일 출처로 한다. (DESIGN.md가 없어 와이어프레임 골격으로 그려졌다 — 실제 디자인은 `/design-consultation`으로 DESIGN.md 정의 시 반영.) **이 HTML은 명세이지 구현물이 아니다 — 그대로 쓰지 말고**, flowforge 웹(React)에서 같은 화면·흐름을 번역해 구현한다. 특히 노드에 붙는 change 배지→펼침→5종 뷰 진입의 이동은 spec THEN의 openChangeViews 재사용으로 구현한다.
