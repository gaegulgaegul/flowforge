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
  PrdSuggestion,
  FeatureSuggestion,
} from "@flowforge/shared";
import {
  fetchGraph,
  fetchIA,
  fetchWireframe,
  fetchPrd,
  fetchSpecTree,
  fetchProjects,
  fetchCapabilities,
  fetchCapabilityDetail,
  fetchDocsPlanningPrd,
  fetchDocsPlanningFeatures,
  fetchDocsPlanningUserFlow,
  saveDocsPlanningUserFlowLayout,
  fetchDocsPrdSuggestions,
  applyDocsPrdSuggestions,
  fetchDocsFeatureSuggestions,
  applyDocsFeatureSuggestions,
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
import { PrdApprovalPanel } from "./PrdApprovalPanel.js";
import { FeatureApprovalPanel } from "./FeatureApprovalPanel.js";

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
  // skeleton(기획 뼈대) 단계 전용 탭. views 단계의 tab(5종)과 완전히 분리 — 충돌 방지.
  const [planTab, setPlanTab] = useState<"prd" | "features" | "flow">("prd");
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
  // PRD 제안 큐(docs/planning/prd.suggestions.json) — 승인/반려 편집 UI(6a). 큐 비면 순수 읽기 뷰.
  const [prdSuggestions, setPrdSuggestions] = useState<readonly PrdSuggestion[]>([]);
  const [prdApplyBusy, setPrdApplyBusy] = useState(false);
  // 기획 단계 기능명세서(docs/planning/features.md) — 프로젝트 단위(skeleton에서 표시).
  // 가상 루트 노드(children=요구사항들)를 보관, adapter로 RF nodes/edges로 변환해 렌더.
  const [planningFeatures, setPlanningFeatures] = useState<FeatureTreeNodeT | null>(null);
  const [featureNodes, setFeatureNodes] = useState<Node[]>([]);
  const [featureEdges, setFeatureEdges] = useState<Edge[]>([]);
  // 기능명세 속성 제안 큐(docs/planning/features.suggestions.json) — 승인/반려 편집 UI(6b).
  // 6a prdSuggestions와 대칭. 큐 비면 순수 읽기 트리 뷰.
  const [featureSuggestions, setFeatureSuggestions] = useState<readonly FeatureSuggestion[]>([]);
  const [featureApplyBusy, setFeatureApplyBusy] = useState(false);

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
  // capability 단위 종합 상세(capChanges 단계에서 change 목록 옆에 co-locate).
  // features 서브트리(이 capability 가지만) + 연결 유저플로우 stem 목록.
  const [capFeatures, setCapFeatures] = useState<FeatureTreeNodeT | null>(null);
  const [capFeatureNodes, setCapFeatureNodes] = useState<Node[]>([]);
  const [capFeatureEdges, setCapFeatureEdges] = useState<Edge[]>([]);
  const [capUserFlows, setCapUserFlows] = useState<string[]>([]);
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

  // capability 단위 features 서브트리(capFeatures) 바뀌면 레이아웃 재계산. null이면 비운다.
  useEffect(() => {
    if (!capFeatures) {
      setCapFeatureNodes([]);
      setCapFeatureEdges([]);
      return;
    }
    const { nodes, edges } = toFeatureTreeFlow(capFeatures);
    setCapFeatureNodes(nodes);
    setCapFeatureEdges(edges);
  }, [capFeatures]);

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
    // PRD 제안 큐(docs/planning/prd.suggestions.json) 로드 — 없으면 빈 큐(순수 읽기 뷰).
    setPrdSuggestions([]);
    fetchDocsPrdSuggestions(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setPrdSuggestions(r.queue.suggestions);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPrdSuggestions([]); // 제안 큐 없음/오류 — 순수 읽기 뷰
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
    // 기능명세 속성 제안 큐(docs/planning/features.suggestions.json) 로드 — 없으면 빈 큐(순수 읽기 트리 뷰).
    setFeatureSuggestions([]);
    fetchDocsFeatureSuggestions(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setFeatureSuggestions(r.queue.suggestions);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setFeatureSuggestions([]); // 제안 큐 없음/오류 — 순수 읽기 트리 뷰
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
      setStatus("이 프로젝트는 뼈대(capability)가 없습니다(change는 capability 경유로만 표시).");
    }
  }, []);

  // PRD 제안 승인/반려 적용 — POST apply 후 PRD·제안 큐 재조회(반영·큐 갱신을 화면에 반사).
  // race 가드: 제출 시점의 프로젝트로 재조회하고, 그 사이 다른 카드로 이동했으면 폐기.
  const applyPrd = useCallback(
    (approve: string[], reject: string[]) => {
      const project = dashProject?.name;
      if (!project || prdApplyBusy) return;
      const token = ++dashReqToken.current;
      setPrdApplyBusy(true);
      applyDocsPrdSuggestions(project, { approve, reject })
        .then((res) => {
          if (res.skipped.length > 0) {
            setStatus(`일부 제안을 처리하지 못했습니다(skipped: ${res.skipped.join(", ")}).`);
          }
          return Promise.all([fetchDocsPlanningPrd(project), fetchDocsPrdSuggestions(project)]);
        })
        .then(([prdRes, sugRes]) => {
          if (token !== dashReqToken.current) return; // 그 사이 다른 클릭 → 폐기
          setPlanningPrd(prdRes.prd);
          setPrdSuggestions(sugRes.queue.suggestions);
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`PRD 승인/반려 실패: ${String(e)}`);
        })
        .finally(() => {
          setPrdApplyBusy(false);
        });
    },
    [dashProject, prdApplyBusy],
  );

  // 기능명세 속성 제안 승인/반려 적용 — POST apply 후 features 트리·제안 큐 재조회(속성 뱃지·큐 갱신을 화면에 반사).
  // 6a applyPrd와 대칭. race 가드: 제출 시점의 프로젝트로 재조회하고, 그 사이 다른 카드로 이동했으면 폐기.
  const applyFeature = useCallback(
    (approve: string[], reject: string[]) => {
      const project = dashProject?.name;
      if (!project || featureApplyBusy) return;
      const token = ++dashReqToken.current;
      setFeatureApplyBusy(true);
      applyDocsFeatureSuggestions(project, { approve, reject })
        .then((res) => {
          if (res.skipped.length > 0) {
            setStatus(`일부 제안을 처리하지 못했습니다(skipped: ${res.skipped.join(", ")}).`);
          }
          return Promise.all([
            fetchDocsPlanningFeatures(project),
            fetchDocsFeatureSuggestions(project),
          ]);
        })
        .then(([featRes, sugRes]) => {
          if (token !== dashReqToken.current) return; // 그 사이 다른 클릭 → 폐기
          setPlanningFeatures(featRes.tree.root);
          setFeatureSuggestions(sugRes.queue.suggestions);
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`기능명세 승인/반려 실패: ${String(e)}`);
        })
        .finally(() => {
          setFeatureApplyBusy(false);
        });
    },
    [dashProject, featureApplyBusy],
  );

  // capability 클릭: 그 capability 단위 종합 상세(capChanges)로 — features 서브트리 +
  // 연결 유저플로우 stem + change 목록을 한 화면에 co-locate.
  const openCapability = useCallback((cap: CapabilitySummary) => {
    if (!dashProject) return;
    const token = ++dashReqToken.current;
    setDashCapability(cap);
    // 이전 capability 잔류를 비워 stale 플래시 방지.
    setCapFeatures(null);
    setCapUserFlows([]);
    setCapChanges([]);
    fetchCapabilityDetail(dashProject.name, cap.key)
      .then((d) => {
        if (token !== dashReqToken.current) return; // race 가드
        // 요구사항 가지가 0개면(필터 결과 빈 트리) "없음"으로 표면화 — 빈 ReactFlow 회피.
        setCapFeatures(d.features && d.features.root.children.length > 0 ? d.features.root : null);
        setCapUserFlows(d.userFlows);
        setCapChanges(d.changes);
        setDashStage("capChanges");
        setStatus("");
      })
      .catch((e: unknown) => {
        if (token !== dashReqToken.current) return;
        setStatus(`capability 상세 로드 실패: ${String(e)}`);
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

  // skeleton 3뷰 탭: 있는 뷰만 노출, 활성 탭이 없는 뷰를 가리키면 첫 유효 탭으로 폴백.
  const planTabsAvail: Array<"prd" | "features" | "flow"> = [];
  if (planningPrd) planTabsAvail.push("prd");
  if (planningFeatures) planTabsAvail.push("features");
  if (planningUserFlow) planTabsAvail.push("flow");
  const activePlanTab: "prd" | "features" | "flow" = planTabsAvail.includes(planTab)
    ? planTab
    : (planTabsAvail[0] ?? "prd");
  const planTabBtn = (key: "prd" | "features" | "flow", label: string): JSX.Element => (
    <button
      key={key}
      onClick={() => setPlanTab(key)}
      aria-pressed={activePlanTab === key}
      data-testid={`plan-tab-${key}`}
      style={{ borderColor: activePlanTab === key ? "#b6e65a" : undefined }}
    >
      {label}
    </button>
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
            {planTabsAvail.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 12 }} data-testid="plan-tabs">
                {planningPrd && planTabBtn("prd", "PRD")}
                {planningFeatures && planTabBtn("features", "기능명세서")}
                {planningUserFlow && planTabBtn("flow", "유저플로우")}
              </div>
            )}
            {/* 기획 단계 PRD(docs/planning/prd.md) — 있으면 프로젝트 기획을 PrdPanel로 렌더 */}
            {planningPrd && activePlanTab === "prd" && (
              <section className="dash-planning-prd" data-testid="planning-prd">
                <h3 className="dash-h">{dashProject?.displayName} — 기획 PRD</h3>
                {/* 제안 큐가 있으면 승인/반려 편집 UI(6a), 큐 비면 렌더 안 함(순수 읽기 뷰). */}
                <PrdApprovalPanel
                  prd={planningPrd}
                  suggestions={prdSuggestions}
                  busy={prdApplyBusy}
                  onApprove={(id) => applyPrd([id], [])}
                  onReject={(id) => applyPrd([], [id])}
                  onApproveAll={() => applyPrd(prdSuggestions.map((s) => s.id), [])}
                  onRejectAll={() => applyPrd([], prdSuggestions.map((s) => s.id))}
                />
                <PrdPanel prd={planningPrd} />
              </section>
            )}
            {/* 기획 단계 기능명세서(docs/planning/features.md) — 있으면 3단 트리(FeatureTree)로 렌더 */}
            {planningFeatures && activePlanTab === "features" && (
              <section className="dash-planning-features" data-testid="planning-features">
                <h3 className="dash-h">{dashProject?.displayName} — 기획 기능명세서</h3>
                {/* 제안 큐가 있으면 노드 속성 승인/반려 편집 UI(6b), 큐 비면 렌더 안 함(순수 읽기 트리 뷰). */}
                <FeatureApprovalPanel
                  root={planningFeatures}
                  suggestions={featureSuggestions}
                  busy={featureApplyBusy}
                  onApprove={(id) => applyFeature([id], [])}
                  onReject={(id) => applyFeature([], [id])}
                  onApproveAll={() => applyFeature(featureSuggestions.map((s) => s.id), [])}
                  onRejectAll={() => applyFeature([], featureSuggestions.map((s) => s.id))}
                />
                <div className="dash-plan-flow">
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
            {planningUserFlow && activePlanTab === "flow" && (
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
                <div className="dash-plan-flow">
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
            <h3 className="dash-h">{dashProject?.displayName} — 뼈대(capability)</h3>
            {capabilities.length === 0 ? (
              <p className="dash-empty">표시할 capability가 없습니다(뼈대 없음).</p>
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
          // capability 통합 drill-down: features 서브트리 + 연결 유저플로우 + change 목록을 한 화면에.
          <div className="dash-body" data-testid="cap-detail">
            {/* features 서브트리(이 capability 가지만) */}
            <section className="dash-cap-features" data-testid="cap-detail-features">
              <h3 className="dash-h">{dashCapability?.koreanLabel} — 기능명세(이 capability)</h3>
              {capFeatures ? (
                <div className="dash-feature-flow">
                  <ReactFlow
                    key="d-cap-features"
                    nodes={capFeatureNodes}
                    edges={capFeatureEdges}
                    nodeTypes={nodeTypes}
                    nodesDraggable={false}
                    fitView
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              ) : (
                <p className="dash-empty">연결된 기능명세 없음</p>
              )}
            </section>
            {/* 연결된 유저플로우 stem 목록(`> capability:` 마커로 선언한 flow) */}
            <section className="dash-cap-user-flows" data-testid="cap-detail-user-flows">
              <h3 className="dash-h">{dashCapability?.koreanLabel} — 연결 유저플로우</h3>
              {capUserFlows.length === 0 ? (
                <p className="dash-empty">연결된 유저플로우 없음</p>
              ) : (
                <ul className="dash-flow-list">
                  {capUserFlows.map((stem) => (
                    <li key={stem} className="dash-flow-item">{stem}</li>
                  ))}
                </ul>
              )}
            </section>
            {/* 이 capability를 건드리는 change 목록(기존 컴포넌트 재사용) */}
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
