/**
 * 유저플로우 그래프의 공유 타입.
 * server(파서)와 web(ReactFlow 렌더)이 graph.json 계약으로 공유한다.
 *
 * manyfast 검증 스키마 기준(reference_manyfast_spec): 유저플로우는
 * 노드 4타입(시작/섹션최상위/페이지/행동) + 방향 엣지 + 섹션으로 구성된다.
 * MVP(Phase 1)는 화면 단위 노드 + 화면 전이 엣지만 다룬다.
 */

/** manyfast 노드 타입. MVP는 'screen'(=페이지)만 생성, 나머지는 후속. */
export type NodeKind = 'start' | 'section' | 'screen' | 'action';

/** spec.md에서 파생된 그래프 노드. 위치(x,y)는 레이아웃 오버레이에서 머지된다. */
export interface GraphNode {
  /** 안정 키: spec 디렉토리 slug 기반(spec 텍스트 변경에 불변). 예: "screen-wod-capture" */
  readonly id: string;
  readonly kind: NodeKind;
  readonly label: string;
  /** 이 노드를 파생시킨 spec 디렉토리명. 오버레이 GC·재생성 머지에 사용. */
  readonly specName: string;
  /**
   * charter 상주 docs(user-flow.md)의 SEED(사람검토 전 = 미검증) 마킹 여부.
   * docs 입력에서만 세팅될 수 있는 옵셔널 필드 — change 경로(기존 빌더)는 채우지 않으므로 undefined(비파괴).
   */
  readonly seed?: boolean;
}

/** 화면 간 전이. spec 시나리오의 THEN 문장에서 파생된다. */
export interface GraphEdge {
  readonly id: string;
  readonly source: string;
  /** dangling일 때 null: NAV 동사는 있으나 대상 화면을 찾지 못함(경고 표시). */
  readonly target: string | null;
  readonly label: string;
  /** 이 전이를 만든 시나리오 제목(툴팁·추적용). */
  readonly scenario: string;
  /** NAV 동사 매칭됐으나 대상 미발견이면 true → 캔버스에서 ⚠ 강조. */
  readonly dangling: boolean;
  /**
   * 엣지 성격 구분. planning 유저플로우에서 실선(`-->`)=happy path,
   * 점선(`-.->`)=에지케이스 분기(spec 근거 자동 생성)를 나눈다.
   * docs 입력에서만 세팅될 수 있는 옵셔널 필드 — change/golden 경로(기존 빌더)는 채우지
   * 않으므로 undefined(비파괴). 부재 = 'happy' 간주. 유니온으로 둔 이유 = 2단계 AI 분기에
   * 'ai-suggested' 확장 여지.
   */
  readonly kind?: 'happy' | 'edgecase';
}

/** server가 spec.md를 파싱해 내보내는 그래프(레이아웃 머지 전). */
export interface SpecGraph {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

/** 사용자가 캔버스에서 조정한 노드 위치. graph-overlay.json에 저장된다. */
export interface NodeLayout {
  readonly x: number;
  readonly y: number;
}

/** nodeId → 위치 맵. spec이 바뀌어 사라진 노드의 항목은 머지 시 GC된다. */
export type LayoutOverlay = Record<string, NodeLayout>;
