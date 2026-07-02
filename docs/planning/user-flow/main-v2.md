# 유저 플로우: flowforge 기획 대시보드 메인 흐름 (v2 — 에지케이스 자동 분기)

> v1의 happy path 메인 흐름을 보존한 채, 결정3(userflow-edgecase-branches)을 반영한 버전.
> happy path = 실선(`-->`), spec 근거로 자동 생성된 에지케이스 경로 = 점선(`-.->`)으로 시각 구분한다.
> 노드 모양: 시작 stadium / 페이지 box / 행동·분기 diamond. flowforge가 파싱해 그래프로 렌더한다.

```mermaid
flowchart TD
  Start(["앱 진입"]) --> Grid["프로젝트 카드 그리드"]
  Grid -->|카드 클릭| Skeleton["프로젝트 기획 뷰"]
  Skeleton --> HasDocs{"기획 산출물 있나"}
  HasDocs -->|PRD| Prd["기획 PRD 5섹션"]
  HasDocs -->|기능명세| Features["기능명세 트리"]
  HasDocs -->|유저플로우| Flow["유저플로우 그래프"]
  HasDocs -->|없음| Empty["빈 안내"]
  Flow -->|노드 드래그| Save{"좌표 저장"}
  Save --> Flow
  Skeleton -->|charter 있으면| Views["change 5종 뷰"]
  Views --> Back["프로젝트로 복귀"]
  Back --> Grid

  Skeleton -.->|spec safe-4xx: 로드 실패| LoadErr["기획 로드 에러 안내"]
  Save -.->|spec safe-4xx: 저장 실패| SaveErr["좌표 저장 실패 재시도"]
  SaveErr -.->|재시도| Flow
```
