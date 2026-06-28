import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type NodeTypes,
} from "@xyflow/react";
import type {
  SpecGraph,
  LayoutOverlay,
  IANode as IANodeT,
  Wireframe,
  Prd,
  SpecTreeNode as SpecTreeNodeT,
  FeatureTreeNode as FeatureTreeNodeT,
} from "@flowforge/shared";
import {
  fetchGraph,
  fetchIA,
  fetchWireframe,
  fetchPrd,
  fetchSpecTree,
  fetchProjects,
  fetchCapabilities,
  fetchCapabilityChanges,
  fetchDocsPlanningPrd,
  fetchDocsPlanningFeatures,
  fetchDocsPlanningUserFlow,
  saveDocsPlanningUserFlowLayout,
  type CapabilitySummary,
  type ChangeSummary,
} from "./api.js";
import type { ProjectCard } from "@flowforge/shared";
import { ProjectGrid } from "./ProjectGrid.js";
import { CapabilityChangeList } from "./CapabilityChangeList.js";
import { toFlowNodes, toFlowEdges, danglingCount } from "./graphAdapter.js";
import { toIAFlow } from "./iaAdapter.js";
import { toSpecTreeFlow } from "./specTreeAdapter.js";
import { toFeatureTreeFlow } from "./featureTreeAdapter.js";
import { SpecNode } from "./SpecNode.js";
import { IANode } from "./IANode.js";
import { SpecTreeNode } from "./SpecTreeNode.js";
import { FeatureNode } from "./FeatureNode.js";
import { WireframePanel } from "./WireframePanel.js";
import { PrdPanel } from "./PrdPanel.js";

// 커스텀 노드 타입 매핑 — 컴포넌트 밖 상수로 두어 재마운트 방지.
// featureTree는 기획 기능명세서 전용(specTree와 분리, 타입 전략 B).
const nodeTypes: NodeTypes = { spec: SpecNode, ia: IANode, specTree: SpecTreeNode, featureTree: FeatureNode };

// manyfast 파이프라인 순서: PRD → 기능명세서 → 유저플로우 → IA → 와이어프레임
type Tab = "prd" | "spec" | "flow" | "ia" | "wire";
// 계층 대시보드 4단 드릴다운(hierarchical-project-dashboard):
//   grid(카드) → skeleton(뼈대 capability) → capChanges(capability별 change) → views(5종 뷰)
// charter 없는 프로젝트는 skeleton에서 빈 안내를 보여준다.
// (2026-06-25) 진입로를 이 대시보드 단일로 통합. change/docs 직접 진입 토글은 제거됐고,
// change 5종 산출물은 드릴다운(프로젝트→capability→change→views)으로만 도달한다.
type DashStage = "grid" | "skeleton" | "capChanges" | "views";

export function App(): JSX.Element {
  // views 단계에서 선택된 change 키. 클릭으로 세팅되며 5종 산출물 로딩 effect의 트리거.
  const [selected, setSelected] = useState<string>("");
  const [tab, setTab] = useState<Tab>("prd");
  const [iaVerbose, setIaVerbose] = useState(false);
  const [status, setStatus] = useState("");

  // 유저플로우 상태
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [dangling, setDangling] = useState(0);

  // IA 트리 상태
  const [iaRoot, setIaRoot] = useState<IANodeT | null>(null);
  const [iaNodes, setIaNodes] = useState<Node[]>([]);
  const [iaEdges, setIaEdges] = useState<Edge[]>([]);

  // 와이어프레임 상태
  const [wireframe, setWireframe] = useState<Wireframe | null>(null);

  // PRD 상태(5섹션) — change 단위(views의 fetchPrd)
  const [prd, setPrd] = useState<Prd | null>(null);
  // 기획 단계 PRD(docs/planning/prd.md) — 프로젝트 단위(skeleton에서 표시). change PRD와 분리.
  const [planningPrd, setPlanningPrd] = useState<Prd | null>(null);
  // 기획 단계 기능명세서(docs/planning/features.md) — 프로젝트 단위(skeleton에서 표시).
  // 가상 루트 노드(children=요구사항들)를 보관, adapter로 RF nodes/edges로 변환해 렌더.
  const [planningFeatures, setPlanningFeatures] = useState<FeatureTreeNodeT | null>(null);
  const [featureNodes, setFeatureNodes] = useState<Node[]>([]);
  const [featureEdges, setFeatureEdges] = useState<Edge[]>([]);

  // 기획 단계 유저플로우(docs/planning/user-flow/<flow>.md → 공용 SpecGraph) — 프로젝트 단위(skeleton에서 표시).
  // change 유저플로우(flowNodes/flowEdges)와 분리. 드래그 좌표는 overlay로 저장(saveDocsPlanningUserFlowLayout).
  const [planningUserFlow, setPlanningUserFlow] = useState<SpecGraph | null>(null);
  const [planningFlowNodes, setPlanningFlowNodes] = useState<Node[]>([]);
  const [planningFlowEdges, setPlanningFlowEdges] = useState<Edge[]>([]);
  const [planningFlowName, setPlanningFlowName] = useState<string>(""); // 현재 flow stem(저장 시 사용)
  const [planningFlowVersions, setPlanningFlowVersions] = useState<string[]>([]);

  // 기능명세서 3단 트리 상태
  const [specRoot, setSpecRoot] = useState<SpecTreeNodeT | null>(null);
  const [specNodes, setSpecNodes] = useState<Node[]>([]);
  const [specEdges, setSpecEdges] = useState<Edge[]>([]);

  // ── 계층 대시보드 상태 ──
  const [dashStage, setDashStage] = useState<DashStage>("grid");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [dashProject, setDashProject] = useState<ProjectCard | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitySummary[]>([]);
  const [dashCapability, setDashCapability] = useState<CapabilitySummary | null>(null);
  const [capChanges, setCapChanges] = useState<ChangeSummary[]>([]);
  // 드릴다운 비동기 race 가드: 매 클릭마다 증가하는 토큰. 늦게 도착한 응답이
  // 다른 항목을 클릭한 뒤의 상태를 덮어쓰지 않도록, 응답 처리 전 토큰 일치를 확인한다.
  const dashReqToken = useRef(0);

  // 최초 진입: 프로젝트 카드 그리드 로드.
  useEffect(() => {
    fetchProjects()
      .then((ps) => setProjects(ps))
      .catch((e: unknown) => setStatus(`프로젝트 로드 실패: ${String(e)}`));
  }, []);

  // change(views) 선택 시 다섯 산출물 모두 로드.
  useEffect(() => {
    if (!selected) return;
    // 이전 change 데이터를 먼저 비워 새 데이터 도착 전 stale 잔류(플래시)를 막는다
    setPrd(null);
    setSpecRoot(null);
    setSpecNodes([]);
    setSpecEdges([]);
    fetchGraph(selected)
      .then((r) => {
        setFlowNodes(toFlowNodes(r.graph, r.layout));
        setFlowEdges(toFlowEdges(r.graph));
        setDangling(danglingCount(r.graph));
        setStatus("");
      })
      .catch((e: unknown) => setStatus(`그래프 로드 실패: ${String(e)}`));
    fetchIA(selected)
      .then((r) => setIaRoot(r.tree))
      .catch((e: unknown) => setStatus(`IA 로드 실패: ${String(e)}`));
    fetchWireframe(selected)
      .then((r) => setWireframe(r.wireframe))
      .catch((e: unknown) => setStatus(`와이어 로드 실패: ${String(e)}`));
    fetchPrd(selected)
      .then((r) => setPrd(r.prd))
      .catch((e: unknown) => setStatus(`PRD 로드 실패: ${String(e)}`));
    fetchSpecTree(selected)
      .then((r) => setSpecRoot(r.tree))
      .catch((e: unknown) => setStatus(`기능명세서 로드 실패: ${String(e)}`));
  }, [selected]);

  // IA 트리/뷰모드 바뀌면 레이아웃 재계산
  useEffect(() => {
    if (!iaRoot) return;
    const { nodes, edges } = toIAFlow(iaRoot, iaVerbose);
    setIaNodes(nodes);
    setIaEdges(edges);
  }, [iaRoot, iaVerbose]);

  // 기능명세서 트리 바뀌면 레이아웃 재계산
  useEffect(() => {
    if (!specRoot) return;
    const { nodes, edges } = toSpecTreeFlow(specRoot);
    setSpecNodes(nodes);
    setSpecEdges(edges);
  }, [specRoot]);

  // 기획 기능명세서(planningFeatures) 바뀌면 레이아웃 재계산. null이면 비운다.
  useEffect(() => {
    if (!planningFeatures) {
      setFeatureNodes([]);
      setFeatureEdges([]);
      return;
    }
    const { nodes, edges } = toFeatureTreeFlow(planningFeatures);
    setFeatureNodes(nodes);
    setFeatureEdges(edges);
  }, [planningFeatures]);

  const onFlowNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // 기획 유저플로우 드래그: 위치 변경을 state에 반영(저장은 onNodeDragStop에서 한 번).
  const onPlanningFlowNodesChange = useCallback((changes: NodeChange[]) => {
    setPlanningFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // 드래그 종료 시점에만 현재 좌표 전체를 LayoutOverlay로 만들어 overlay JSON 저장.
  // (change쪽 user-flow는 저장을 안 하므로 여기서 onNodeDragStop을 신규 도입.)
  const onPlanningFlowNodeDragStop = useCallback(() => {
    if (!dashProject || !planningFlowName) return;
    const project = dashProject.name;
    const flow = planningFlowName;
    setPlanningFlowNodes((nds) => {
      const layout: LayoutOverlay = {};
      for (const n of nds) layout[n.id] = { x: n.position.x, y: n.position.y };
      void saveDocsPlanningUserFlowLayout(project, flow, layout).catch((e: unknown) =>
        setStatus(`기획 유저플로우 좌표 저장 실패: ${String(e)}`),
      );
      return nds; // 좌표 자체는 onNodesChange가 이미 반영 — 그대로 둔다.
    });
  }, [dashProject, planningFlowName]);

  // 버전(flow) 전환: 선택한 flow로 재조회해 nodes/edges/저장좌표를 다시 세팅.
  const switchPlanningFlow = useCallback(
    (flow: string) => {
      if (!dashProject) return;
      fetchDocsPlanningUserFlow(dashProject.name, flow)
        .then((r) => {
          setPlanningUserFlow(r.graph);
          setPlanningFlowNodes(toFlowNodes(r.graph, r.layout));
          setPlanningFlowEdges(toFlowEdges(r.graph));
          setPlanningFlowName(r.flow);
          setPlanningFlowVersions(r.versions);
          setStatus("");
        })
        .catch((e: unknown) => setStatus(`기획 유저플로우 로드 실패: ${String(e)}`));
    },
    [dashProject],
  );

  // ── dashboard 드릴다운 핸들러 ──
  // deps가 비어도 안전한 이유: set* 함수는 React가 보장하는 stable reference이고,
  // 클로저로 캡처하는 가변값(dashProject 등)은 비동기 콜백에서 race 가드(dashReqToken)로
  // 처리하므로 stale 클로저 위험이 없다.
  // 카드 클릭: charter 있으면 뼈대(skeleton)로, 없으면 빈 안내로 단축(1-a).
  const openProject = useCallback((card: ProjectCard) => {
    const token = ++dashReqToken.current; // 이 클릭의 요청 토큰
    setDashProject(card);
    setDashCapability(null);
    setCapChanges([]);
    // 기획 단계 PRD(docs/planning/prd.md) 로드 — 없으면(404) null로 비움(안내만, 에러 아님).
    setPlanningPrd(null);
    fetchDocsPlanningPrd(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setPlanningPrd(r.prd);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPlanningPrd(null); // 기획 PRD 미작성 — 정상(빈 안내)
      });
    // 기획 단계 기능명세서(docs/planning/features.md) 로드 — 없으면(404) null로 비움(에러 아님).
    setPlanningFeatures(null);
    fetchDocsPlanningFeatures(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setPlanningFeatures(r.tree.root);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPlanningFeatures(null); // 기획 기능명세서 미작성 — 정상(미표시)
      });
    // 기획 단계 유저플로우(docs/planning/user-flow/<flow>.md) 로드 — 없으면(404) null로 비움(에러 아님).
    setPlanningUserFlow(null);
    setPlanningFlowNodes([]);
    setPlanningFlowEdges([]);
    setPlanningFlowName("");
    setPlanningFlowVersions([]);
    fetchDocsPlanningUserFlow(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setPlanningUserFlow(r.graph);
        setPlanningFlowNodes(toFlowNodes(r.graph, r.layout));
        setPlanningFlowEdges(toFlowEdges(r.graph));
        setPlanningFlowName(r.flow);
        setPlanningFlowVersions(r.versions);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPlanningUserFlow(null); // 기획 유저플로우 미작성 — 정상(미표시)
      });
    if (card.hasCharter) {
      fetchCapabilities(card.name)
        .then((caps) => {
          if (token !== dashReqToken.current) return; // 더 최근 클릭이 있었으면 폐기
          setCapabilities(caps);
          setDashStage("skeleton");
          setStatus("");
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`capability 로드 실패: ${String(e)}`);
        });
    } else {
      // 뼈대 없는 프로젝트: 전체 change를 "미연결" 묶음처럼 보여줄 수 있으나, 예광탄은
      // capability 경유 경로를 grounding하므로 빈 capability 목록 + 안내로 단축한다.
      setCapabilities([]);
      setDashStage("skeleton");
      setStatus("이 프로젝트는 charter 뼈대가 없습니다(change는 capability 경유로만 표시).");
    }
  }, []);

  // capability 클릭: 그 capability의 change 목록(capChanges)으로.
  const openCapability = useCallback((cap: CapabilitySummary) => {
    if (!dashProject) return;
    const token = ++dashReqToken.current;
    setDashCapability(cap);
    fetchCapabilityChanges(dashProject.name, cap.key)
      .then((cs) => {
        if (token !== dashReqToken.current) return; // race 가드
        setCapChanges(cs);
        setDashStage("capChanges");
        setStatus("");
      })
      .catch((e: unknown) => {
        if (token !== dashReqToken.current) return;
        setStatus(`change 목록 로드 실패: ${String(e)}`);
      });
  }, [dashProject]);

  // change 클릭: 5종 뷰로 진입 — selected를 그 change로 세팅하면 로딩 effect가 동작.
  const openChangeViews = useCallback((change: ChangeSummary) => {
    setSelected(change.key);
    setTab("prd");
    setDashStage("views");
    setStatus("");
  }, []);

  // 브레드크럼/뒤로가기: 지정 단계로 복귀(상위 선택은 유지).
  const goToStage = useCallback((stage: DashStage) => {
    setDashStage(stage);
    setStatus("");
  }, []);

  const tabBtn = (key: Tab, label: string) => (
    <button onClick={() => setTab(key)} aria-pressed={tab === key} data-testid={`tab-${key}`}
      style={{ borderColor: tab === key ? "#b6e65a" : undefined }}>{label}</button>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "10px 16px", borderBottom: "1px solid #2a2e38", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>flowforge</strong>
        {/* 5종 탭: 대시보드 views 단계(change 선택 후)에서만 노출. */}
        {dashStage === "views" && (
          <div style={{ display: "flex", gap: 4 }}>
            {tabBtn("prd", "PRD")}
            {tabBtn("spec", "기능명세서")}
            {tabBtn("flow", "유저플로우")}
            {tabBtn("ia", "IA 트리")}
            {tabBtn("wire", "와이어프레임")}
          </div>
        )}
        {/* 대시보드 브레드크럼: ⌂ 프로젝트 > 프로젝트명 > capability > change 뷰 */}
        <nav className="dash-breadcrumb" data-testid="dash-breadcrumb" aria-label="브레드크럼">
          <button type="button" className="dash-crumb" onClick={() => goToStage("grid")} data-testid="crumb-home">⌂ 프로젝트</button>
          {dashProject && (
            <>
              <span className="dash-sep" aria-hidden="true">›</span>
              <button type="button" className="dash-crumb" onClick={() => goToStage("skeleton")} disabled={!dashProject.hasCharter}>
                {dashProject.displayName}
              </button>
            </>
          )}
          {dashCapability && (
            <>
              <span className="dash-sep" aria-hidden="true">›</span>
              <button type="button" className="dash-crumb" onClick={() => goToStage("capChanges")}>{dashCapability.koreanLabel}</button>
            </>
          )}
          {dashStage === "views" && selected && (
            <>
              <span className="dash-sep" aria-hidden="true">›</span>
              <span className="dash-crumb dash-crumb--current">{selected}</span>
            </>
          )}
        </nav>
        {dashStage === "views" && tab === "flow" && dangling > 0 && (
          <span style={{ color: "#f0a05a" }}>⚠ dangling {dangling}</span>
        )}
        {dashStage === "views" && tab === "ia" && (
          <button onClick={() => setIaVerbose((v) => !v)} data-testid="ia-view-btn">
            {iaVerbose ? "간단히 보기" : "자세히 보기"}
          </button>
        )}
        <span style={{ color: "#9aa0ad", fontSize: 13 }}>{status}</span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        {/* ── 계층 대시보드 본문(4단). views 단계는 5종 뷰로 폴스루. ── */}
        {dashStage === "grid" ? (
          <div className="dash-body">
            <ProjectGrid projects={projects} onOpenProject={openProject} />
          </div>
        ) : dashStage === "skeleton" ? (
          <div className="dash-body">
            {/* 기획 단계 PRD(docs/planning/prd.md) — 있으면 프로젝트 기획을 PrdPanel로 렌더 */}
            {planningPrd && (
              <section className="dash-planning-prd" data-testid="planning-prd">
                <h3 className="dash-h">{dashProject?.displayName} — 기획 PRD</h3>
                <PrdPanel prd={planningPrd} />
              </section>
            )}
            {/* 기획 단계 기능명세서(docs/planning/features.md) — 있으면 3단 트리(FeatureTree)로 렌더 */}
            {planningFeatures && (
              <section className="dash-planning-features" data-testid="planning-features">
                <h3 className="dash-h">{dashProject?.displayName} — 기획 기능명세서</h3>
                <div className="dash-feature-flow">
                  <ReactFlow
                    key="d-planning-features"
                    nodes={featureNodes}
                    edges={featureEdges}
                    nodeTypes={nodeTypes}
                    nodesDraggable={false}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              </section>
            )}
            {/* 기획 단계 유저플로우(docs/planning/user-flow/<flow>.md) — 있으면 공용 SpecGraph 그래프로 렌더(드래그→좌표 저장) */}
            {planningUserFlow && (
              <section className="dash-planning-user-flow" data-testid="planning-user-flow">
                <h3 className="dash-h">
                  {dashProject?.displayName} — 기획 유저플로우
                  {planningFlowVersions.length > 1 && (
                    <select
                      className="dash-flow-version"
                      data-testid="planning-flow-version"
                      value={planningFlowName}
                      onChange={(e) => switchPlanningFlow(e.target.value)}
                      style={{ marginLeft: 8 }}
                    >
                      {planningFlowVersions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </h3>
                <div className="dash-feature-flow">
                  <ReactFlow
                    key="d-planning-user-flow"
                    nodes={planningFlowNodes}
                    edges={planningFlowEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onPlanningFlowNodesChange}
                    onNodeDragStop={onPlanningFlowNodeDragStop}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              </section>
            )}
            <h3 className="dash-h">{dashProject?.displayName} — charter 뼈대(capability)</h3>
            {capabilities.length === 0 ? (
              <p className="dash-empty">표시할 capability가 없습니다(charter 뼈대 없음).</p>
            ) : (
              <ul className="dash-cap-list">
                {capabilities.map((cap) => (
                  <li key={cap.key}>
                    <button type="button" className="dash-cap" onClick={() => openCapability(cap)}>
                      <span className="dash-cap-label">{cap.koreanLabel}</span>
                      <span className="dash-cap-count">change {cap.changeKeys.length}개</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : dashStage === "capChanges" ? (
          <div className="dash-body">
            <CapabilityChangeList
              capabilityLabel={dashCapability?.koreanLabel ?? ""}
              changes={capChanges}
              onOpenChange={openChangeViews}
            />
          </div>
        ) : (
          // views: 5종 뷰. dashStage==="views"
          <>
            {tab === "prd" && (prd ? <PrdPanel prd={prd} /> : <div className="prd-loading">PRD 불러오는 중…</div>)}
            {tab === "spec" && (
              <ReactFlow key="d-spec" nodes={specNodes} edges={specEdges} nodeTypes={nodeTypes} nodesDraggable={false} fitView>
                <Background />
                <Controls />
              </ReactFlow>
            )}
            {tab === "flow" && (
              <ReactFlow key="d-flow" nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodesChange={onFlowNodesChange} fitView>
                <Background />
                <Controls />
              </ReactFlow>
            )}
            {tab === "ia" && (
              <ReactFlow key="d-ia" nodes={iaNodes} edges={iaEdges} nodeTypes={nodeTypes} nodesDraggable={false} fitView>
                <Background />
                <Controls />
              </ReactFlow>
            )}
            {tab === "wire" && wireframe && <WireframePanel wireframe={wireframe} />}
          </>
        )}
      </div>
    </div>
  );
}
