# flowforge 방향성 (DIRECTION.md)

> 작성일: 2026-06-24 · 상태: **방향성 합의, 구현 전**
> 사람이 읽고 다음 세션이 이어가기 좋은 서술형 한 장. charter 게이트 대상 아님(읽기용).
> 상세 결정은 [PRD.md](./PRD.md)(결정 이력), 버린 가설은 [discovery-log.md](./discovery-log.md)(가설 로그) 참조. 이 문서는 **전체 그림을 서술로 읽는** 보완 문서다.

---

## 1. 한 줄 정의

**flowforge = "홈서버에서 굴리는 프로젝트들을 한눈에 보는 계층형 기획 대시보드".**

- 이전: openspec change의 spec.md를 유저플로우 그래프로 시각화·편집하던 개인용 도구.
- 오늘(2026-06-24): 정체성을 확장 — 한 프로젝트 안만 보던 도구에서, **홈서버 프로젝트 전체를 계층으로 파고드는 대시보드**로.

---

## 2. 계층 모델

```
홈서버 프로젝트들
  └ 프로젝트 (카드)
     └ charter 상주문서 docs/ = 큰 기획(뼈대) = capability들
        └ openspec change = 세부 기획(가지)
           └ change 안 = 기존 5종 뷰 (유저플로우·IA·와이어프레임·PRD·기능명세)
```

핵심: **A(change 시각화)와 B(charter docs 뷰어)는 경쟁이 아니라 포함관계.**
→ `charter ⊃ change`. 큰 기획(뼈대)이 세부 기획(가지)을 품는다. 기존 5종 뷰는 그 가지의 맨 안쪽에 그대로 살아있다.

---

## 3. 확정된 결정 6개 (✅) — 상세는 [PRD.md](./PRD.md)

| # | 결정 (decision ID) | 요약 |
|---|---|---|
| 1 | `identity-hierarchical-dashboard` | 정체성 = 계층형 기획 대시보드 (프로젝트→뼈대→세부) |
| 2 | `project-card-grid-landing` | 랜딩 = 홈서버 프로젝트 카드 그리드 (카드마다 charter유무/change수/audit상태 배지) |
| 3 | `show-all-projects-even-without-charter` | (1-a) charter 없는 프로젝트도 노출 — "뼈대 없음"도 정보 |
| 4 | `capability-change-link-via-specs-dir` | (A-2) `specs/<capability>/` 디렉토리명 = `## capability: <키>` 글자단위 비교로 연결. 새 태그·자동추측 금지 |
| 5 | `korean-labels-source-priority` | 표시명만 한글 (출처1 spec 병기 + 출처3 proposal 제목, 출처2 키→한글맵은 폴백). 연결 키는 영문 유지 |
| 6 | `tracer-bullet-first` | 예광탄 우선 — 프로젝트 1개로 [카드→뼈대→capability→change] 세로 한 줄 관통부터 |

---

## 4. 화면 흐름 (텍스트 와이어)

```
[홈 카드 그리드]
   │  프로젝트 클릭
   ▼
[charter 뼈대 그래프 (한글 표시)]
   │  capability 노드 클릭
   ▼
[그 capability에 속한 change들]
   │  change 클릭
   ▼
[기존 5종 뷰 (유저플로우·IA·와이어프레임·PRD·기능명세) 탭 전환]  ← ✅2-a 확정 (2026-06-24)
```

---

## 5. 🔲 미정 (아직 안 정함 — 이 문서의 핵심 가치)

> 확정인 척하지 않는다. 아래는 합의되지 않았고 다음 세션이 정해야 할 것들.

- **✅ 노드 클릭 종착지 = 2-a (기존 5종 뷰 그대로)** — 확정 2026-06-24 (목업 3안 비교 후 사용자 선택).
  change 클릭 시 기존 5종 뷰(유저플로우·IA·와이어프레임·PRD·기능명세)를 탭으로 연다.
  → 종착 깊이 최대·정보량 최대. flowforge 기존 뷰를 그대로 재사용하므로 신규 뷰 설계 0. ([discovery-log.md](./discovery-log.md) `node-click-destination` = resolved)
- **🔲 카드의 audit 상태 배지**: 넣을지 / 넣는다면 실시간 vs 저장본 중 무엇.
- **🔲 데이터 신선도**: 매 요청마다 스캔 vs 캐시.
- **🔲 편집 vs 읽기전용**: 원래 flowforge는 드래그·레이아웃 저장이 되는 편집형. 새 방향은 읽기 중심으로 기운다.
  → 방향만 "**읽기 중심, 편집은 추후 판단**"으로 표기. 확정 아님.
- **🔲 도그푸딩**: flowforge 자신도 카드에 나오나.

---

## 6. 구현 갈래 (두 레포)

### agentic-harness (검증된 charter 시스템)
- `spec.md`에 `## capability: 키 — 한글` 한글 병기를 허용하도록 **RE_CAP 정규식 보강**.
- 흡수(absorb) 시 `specs/` 디렉토리명을 기존 키와 정확히 맞추라는 **SKILL 명문화**.
- ⚠️ 소스 경로 = `/home/gaegul/agentic-harness/`. **캐시 1.1.0엔 charter 스킬이 아직 미반영** — 작업 시 소스 경로를 보고, 캐시 동기화 필요 메모를 남길 것.

### flowforge (이 도구 — 작업 대부분 여기)
- 멀티프로젝트 스캔 + 카드 그리드.
- capability↔change **역방향 인덱스** (디렉토리명 비교).
- 한글 label 3출처 로직.
- drill-down 라우트 · UI.
- ⚠️ **`specParser`/`flowBinder`는 골든테스트로 고정돼 있다 — 건드리지 말고 그 위 레이어로 얹을 것.**

---

## 7. 다음 한 걸음

**예광탄: 프로젝트 1개로 [카드 → 뼈대 그래프(한글) → capability 클릭 → change drill-down → 기존 5종 뷰(2-a)] 세로 한 줄 관통.**

✅ 노드클릭 종착지(2-a)가 확정됐으므로 change drill-down의 끝(기존 5종 뷰 재사용)이 정해졌다 — 예광탄 착수 가능.

---

> 관련: 입력 모드/스키마 갭 탐색은 [EXPLORE_charter_docs_ingest.md](./EXPLORE_charter_docs_ingest.md), 현재 기능 명세는 [spec.md](./spec.md) 참조.
