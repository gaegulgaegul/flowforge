import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
  Wireframe,
  WireDoc,
  Prd,
  SpecTreeNode as SpecTreeNodeT,
  FeatureTreeNode as FeatureTreeNodeT,
  PrdSuggestion,
  FeatureSuggestion,
  UserFlowSuggestion,
  WireSuggestion,
  CapabilityAuditSummary,
  ScreenRegistry,
} from "@flowforge/shared";
import {
  fetchGraph,
  fetchWireframe,
  fetchPrd,
  fetchSpecTree,
  fetchProjects,
  fetchDocsPlanningPrd,
  fetchDocsPlanningFeatures,
  fetchDocsPlanningWireframe,
  fetchDocsPlanningUserFlow,
  saveDocsPlanningUserFlowLayout,
  saveLayout,
  fetchDocsPrdSuggestions,
  applyDocsPrdSuggestions,
  fetchDocsFeatureSuggestions,
  applyDocsFeatureSuggestions,
  fetchUserFlowSuggestions,
  applyUserFlowSuggestions,
  fetchDocsWireframeSuggestions,
  applyDocsWireframeSuggestions,
  fetchAuditCapabilities,
  runAudit,
  fetchPlanningScreens,
  type ChangeSummary,
  applyInChunks,
} from "./api.js";
import type { ProjectCard } from "@flowforge/shared";
import { ProjectGrid } from "./ProjectGrid.js";
import { toFlowNodes, toFlowEdges, danglingCount, type SpecNodeData } from "./graphAdapter.js";
import { toSpecTreeFlow } from "./specTreeAdapter.js";
import { toFeatureTreeList, type FeatureNodeData, type FeatureListItemFlat } from "./featureTreeAdapter.js";
import { SpecNode } from "./SpecNode.js";
import { SpecTreeNode } from "./SpecTreeNode.js";
import { FeatureListView } from "./FeatureListView.js";
import { WireframePanel } from "./WireframePanel.js";
import { WireframeApprovalWizard } from "./WireframeApprovalWizard.js";
import { WireframePinFeedback } from "./WireframePinFeedback.js";
import { PrdPanel } from "./PrdPanel.js";
import { PrdApprovalWizard } from "./PrdApprovalWizard.js";
import { FeatureApprovalWizard } from "./FeatureApprovalWizard.js";
import { UserFlowApprovalWizard } from "./UserFlowApprovalWizard.js";
import { FeatureDetailPanel } from "./FeatureDetailPanel.js";
import { FlowDetailPanel, type ScreenCrosslinkData } from "./FlowDetailPanel.js";
import { UnchartedChangeList } from "./UnchartedChangeList.js";
import {
  buildScreenToDetailLabels,
  detailLabelsForScreen,
  buildWireById,
  wireForScreen,
} from "./screenCrosslink.js";
import { parseDeepLink, serializeDeepLink, type Tab } from "./deeplink.js";

// 커스텀 노드 타입 매핑 — 컴포넌트 밖 상수로 두어 재마운트 방지.
// featureTree는 리스트 렌더로 전환(flowforge-artifact-restructure) — RF 노드 타입에서 빠짐.
// IA 뷰 제거(flowforge-ia-removal) — ia 노드 타입 제거.
const nodeTypes: NodeTypes = { spec: SpecNode, specTree: SpecTreeNode };

// skipped 대량 나열 절단 상한 — 상위 N건만 상태바에 미리보기(수백 건이 상태바를 뒤덮지 않게).
// 매직 넘버 인라인 이중 정의를 상수 1곳으로 단일화(드리프트 방지).
const SKIPPED_PREVIEW_CAP = 5;

// Tab(5종 뷰 화이트리스트)은 deeplink.ts 단일 정의를 소비 — URL 스킴과 드리프트 방지.
// manyfast 파이프라인 순서: PRD → 기능명세서 → 유저플로우 → IA → 와이어프레임
// 계층 대시보드 드릴다운(hierarchical-project-dashboard):
//   grid(카드) → skeleton(뼈대) → views(5종 뷰)
// charter 없는 프로젝트는 skeleton에서 빈 안내를 보여준다.
// (2026-06-25) 진입로를 이 대시보드 단일로 통합. change/docs 직접 진입 토글은 제거됐고,
// change 5종 산출물은 드릴다운(프로젝트→skeleton→views)으로만 도달한다.
// (flowforge-change-node-mapping) change 전역 목록(capChanges 단계)은 제거됨 — change는
// 기능명세 노드/화면에 in-place로 매핑돼 표시된다.
type DashStage = "grid" | "skeleton" | "views";

export function App(): JSX.Element {
  // views 단계에서 선택된 change 키. 클릭으로 세팅되며 5종 산출물 로딩 effect의 트리거.
  const [selected, setSelected] = useState<string>("");
  // 선택된 change가 속한 프로젝트(타 프로젝트 드릴다운이면 값, 전역 진입이면 undefined).
  // 5종 뷰 fetch·배치 저장에 ?project=로 실려 해당 프로젝트 openspec 하위에서 해석된다.
  const [selectedProject, setSelectedProject] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("prd");
  // skeleton(기획 뼈대) 단계 전용 탭. views 단계의 tab(4종)과 완전히 분리 — 충돌 방지.
  // IA 뷰 제거(flowforge-ia-removal) — "ia" 제거, 산출물 4종.
  const [planTab, setPlanTab] = useState<"prd" | "features" | "wire" | "flow">("prd");
  const [status, setStatus] = useState("");

  // 유저플로우 상태
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [dangling, setDangling] = useState(0);

  // 와이어프레임 상태
  const [wireframe, setWireframe] = useState<Wireframe | null>(null);

  // PRD 상태(5섹션) — change 단위(views의 fetchPrd)
  const [prd, setPrd] = useState<Prd | null>(null);
  // 기획 단계 PRD(docs/planning/prd.md) — 프로젝트 단위(skeleton에서 표시). change PRD와 분리.
  const [planningPrd, setPlanningPrd] = useState<Prd | null>(null);
  // PRD 제안 큐(docs/planning/prd.suggestions.json) — 승인/반려 편집 UI(6a). 큐 비면 순수 읽기 뷰.
  const [prdSuggestions, setPrdSuggestions] = useState<readonly PrdSuggestion[]>([]);
  const [prdApplyBusy, setPrdApplyBusy] = useState(false);
  // PRD 위저드 반영 성공 카운터 — 성공 시에만 증가시켜 위저드 결정 맵을 리셋(실패=보존).
  const [prdAppliedTick, setPrdAppliedTick] = useState(0);
  // 기획 단계 기능명세서(docs/planning/features.md) — 프로젝트 단위(skeleton에서 표시).
  // 가상 루트 노드(children=요구사항들)를 보관, adapter로 RF nodes/edges로 변환해 렌더.
  const [planningFeatures, setPlanningFeatures] = useState<FeatureTreeNodeT | null>(null);
  // 기능명세 계층 리스트 항목(flowforge-artifact-restructure) — 다이어그램 nodes/edges 대체.
  // 어댑터(toFeatureTreeList)가 트리를 평탄화하고 파생 필드(audit·연결화면·연관 change)를 실어준다.
  const [featureItems, setFeatureItems] = useState<FeatureListItemFlat[]>([]);
  // capability별 audit 요약(docs/audit.json) — 요구사항 노드 배지용. null=미로드/실패(배지 없음, D-6).
  const [featureAudit, setFeatureAudit] = useState<Record<string, CapabilityAuditSummary> | null>(null);
  // "감사 진행" 실행 상태(planning-audit-trigger). idle→running(큐잉+폴링 대기)→idle. 에러는 status 라인에.
  const [auditRunning, setAuditRunning] = useState(false);
  // 화면 레지스트리(features.md 화면목록 + N:M 링크) — 상세 패널 연결화면 섹션용. null=미로드/실패(섹션 없음, D-4).
  const [planningScreens, setPlanningScreens] = useState<ScreenRegistry | null>(null);
  // 기능명세 속성 제안 큐(docs/planning/features.suggestions.json) — 승인/반려 편집 UI(6b).
  // 6a prdSuggestions와 대칭. 큐 비면 순수 읽기 트리 뷰.
  const [featureSuggestions, setFeatureSuggestions] = useState<readonly FeatureSuggestion[]>([]);
  const [featureApplyBusy, setFeatureApplyBusy] = useState(false);
  // 기능명세 위저드 반영 성공 카운터 — PRD와 대칭(성공 시에만 증가 → 결정 맵 리셋, 실패=보존).
  const [featAppliedTick, setFeatAppliedTick] = useState(0);
  // 기능명세 노드 클릭 → 상세 패널(데스크탑 우측 슬라이드 / 모바일 하단 시트). null이면 닫힘.
  // 노드 data(FeatureNodeData)를 그대로 보관 — 어댑터가 상세 필드(원본위치·자식)를 실어준다.
  const [selectedFeature, setSelectedFeature] = useState<FeatureNodeData | null>(null);
  // 유저플로우 노드 클릭 → 상세 패널(FlowDetailPanel). null이면 닫힘.
  // 노드 data(SpecNodeData)를 보관 — 어댑터가 상세 필드(incoming/outgoing 흐름)를 실어준다.
  const [selectedFlow, setSelectedFlow] = useState<SpecNodeData | null>(null);

  // 기획 단계 와이어 = 화면별 HTML 문서(WireDoc[]) — 프로젝트 단위(skeleton에서 표시).
  // change 와이어(wireframe)와 분리. 데스크탑/모바일 프레임 안 배치. WireframeDeviceFrame이 렌더(세로 목록 아님).
  const [planningWireScreens, setPlanningWireScreens] = useState<WireDoc[] | null>(null);
  // 와이어 레이아웃 제안 큐(docs/planning/wireframe.suggestions.json) — 승인/반려 위저드(Parallel Group 3).
  // features 제안 큐와 대칭. 큐 비면 순수 읽기(디바이스 프레임 뷰만).
  const [wireSuggestions, setWireSuggestions] = useState<readonly WireSuggestion[]>([]);
  const [wireApplyBusy, setWireApplyBusy] = useState(false);
  // 와이어 위저드 반영 성공 카운터 — features/PRD와 대칭(성공 시에만 증가 → 결정 맵 리셋, 실패=보존).
  const [wireAppliedTick, setWireAppliedTick] = useState(0);

  // 기획 단계 유저플로우(docs/planning/user-flow/<flow>.md → 공용 SpecGraph) — 프로젝트 단위(skeleton에서 표시).
  // change 유저플로우(flowNodes/flowEdges)와 분리. 드래그 좌표는 overlay로 저장(saveDocsPlanningUserFlowLayout).
  const [planningUserFlow, setPlanningUserFlow] = useState<SpecGraph | null>(null);
  const [planningFlowNodes, setPlanningFlowNodes] = useState<Node[]>([]);
  const [planningFlowEdges, setPlanningFlowEdges] = useState<Edge[]>([]);
  const [planningFlowName, setPlanningFlowName] = useState<string>(""); // 현재 flow stem(저장 시 사용)
  const [planningFlowVersions, setPlanningFlowVersions] = useState<string[]>([]);
  // 유저플로우 에지 제안 큐(user-flow/<stem>.suggestions.json) — 승인/반려 편집 UI(6b-userflow).
  // per-stem 사이드카라 항상 "현재 stem(planningFlowName)"의 큐만 보관 — stem 전환 시 함께 갱신.
  // 큐 fetch 실패는 빈 큐 강등(탭 렌더 유지, 순수 읽기 그래프 뷰).
  const [uflowSuggestions, setUflowSuggestions] = useState<readonly UserFlowSuggestion[]>([]);
  const [uflowApplyBusy, setUflowApplyBusy] = useState(false);
  // 유저플로우 위저드 반영 성공 카운터 — PRD와 대칭. stem 전환 시에도 리셋(D-4).
  const [uflowAppliedTick, setUflowAppliedTick] = useState(0);

  // 기능명세서 3단 트리 상태
  const [specRoot, setSpecRoot] = useState<SpecTreeNodeT | null>(null);
  const [specNodes, setSpecNodes] = useState<Node[]>([]);
  const [specEdges, setSpecEdges] = useState<Edge[]>([]);

  // ── 계층 대시보드 상태 ──
  const [dashStage, setDashStage] = useState<DashStage>("grid");
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [dashProject, setDashProject] = useState<ProjectCard | null>(null);
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
    fetchGraph(selected, selectedProject)
      .then((r) => {
        setFlowNodes(toFlowNodes(r.graph, r.layout));
        setFlowEdges(toFlowEdges(r.graph));
        setDangling(danglingCount(r.graph));
        setStatus("");
      })
      .catch((e: unknown) => setStatus(`그래프 로드 실패: ${String(e)}`));
    fetchWireframe(selected, selectedProject)
      .then((r) => setWireframe(r.wireframe))
      .catch((e: unknown) => setStatus(`와이어 로드 실패: ${String(e)}`));
    fetchPrd(selected, selectedProject)
      .then((r) => setPrd(r.prd))
      .catch((e: unknown) => setStatus(`PRD 로드 실패: ${String(e)}`));
    fetchSpecTree(selected, selectedProject)
      .then((r) => setSpecRoot(r.tree))
      .catch((e: unknown) => setStatus(`기능명세서 로드 실패: ${String(e)}`));
  }, [selected, selectedProject]);

  // 마운트 복원(1회): URL에 딥링크 파라미터가 있으면 그 change의 5종 뷰로 복원한다.
  // setSelected가 위 [selected, selectedProject] effect를 트리거해 5종 데이터가 로드된다(신규 fetch 없음).
  // 파라미터가 없으면 그대로 반환 → 기존 grid 랜딩 유지(하위호환).
  useEffect(() => {
    const dl = parseDeepLink(window.location.search);
    if (!dl) return;
    setSelectedProject(dl.project);
    setSelected(dl.change);
    setTab(dl.tab);
    setDashStage("views");
  }, []);

  // 뒤로/앞으로(popstate): URL을 다시 파싱해 상태를 재동기화한다.
  // 딥링크 있으면 그 뷰로, 없으면(파라미터 비워진 URL) grid로 복귀. 복원 로직은 마운트와 동형.
  useEffect(() => {
    const onPop = (): void => {
      const dl = parseDeepLink(window.location.search);
      if (dl) {
        setSelectedProject(dl.project);
        setSelected(dl.change);
        setTab(dl.tab);
        setDashStage("views");
      } else {
        setDashStage("grid");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // 기능명세서 트리 바뀌면 레이아웃 재계산
  useEffect(() => {
    if (!specRoot) return;
    const { nodes, edges } = toSpecTreeFlow(specRoot);
    setSpecNodes(nodes);
    setSpecEdges(edges);
  }, [specRoot]);

  // 기획 기능명세서(planningFeatures) 바뀌면 계층 리스트 항목 재계산. null이면 비운다.
  // featureAudit(null=미로드/실패)은 undefined로 넘겨 배지 없음(D-6) — 리스트 렌더는 무영향.
  // planningScreens(null=미로드/실패)도 undefined로 넘겨 연결화면 없음(D-4) — 리스트 렌더는 무영향.
  // (flowforge-artifact-restructure) 다이어그램(nodes/edges) → 들여쓴 리스트 항목으로 전환.
  useEffect(() => {
    if (!planningFeatures) {
      setFeatureItems([]);
      return;
    }
    setFeatureItems(
      toFeatureTreeList(planningFeatures, featureAudit ?? undefined, planningScreens ?? undefined),
    );
  }, [planningFeatures, featureAudit, planningScreens]);

  const onFlowNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // change 유저플로우 드래그 종료 → 현재 좌표를 LayoutOverlay로 저장(명세 .md는 안 건드림 — overlay JSON만).
  // selectedProject가 있으면 ?project=로 실려 그 프로젝트 openspec 하위에 저장된다(전역이면 root).
  // 읽기전용 프로젝트(화이트리스트 밖 등)면 서버가 거부 → 무해 실패로 상태바 안내만(화면은 안 깨짐).
  const onFlowNodeDragStop = useCallback(() => {
    if (!selected) return;
    setFlowNodes((nds) => {
      const layout: LayoutOverlay = {};
      for (const n of nds) layout[n.id] = { x: n.position.x, y: n.position.y };
      void saveLayout(selected, layout, selectedProject).catch((e: unknown) =>
        setStatus(`이 프로젝트는 읽기전용이라 배치 저장이 안 됩니다: ${String(e)}`),
      );
      return nds; // 좌표 자체는 onNodesChange가 이미 반영 — 그대로 둔다.
    });
  }, [selected, selectedProject]);

  // 기능명세 리스트 항목 클릭 → 상세 패널 열기. 리스트가 노드 data(FeatureNodeData)를 직접 넘긴다
  // (다이어그램 onNodeClick 대체 — flowforge-artifact-restructure).
  const openFeature = useCallback((data: FeatureNodeData) => {
    setSelectedFeature(data);
    // 한 번에 한 패널만 열리도록 다른 뷰 선택은 닫는다(패널은 같은 고정 위치 공유).
    setSelectedFlow(null);
  }, []);

  // 상세 패널 안 자식 노드 클릭 → 그 id의 항목 data로 전환. 현재 렌더 중인 features 리스트에서 찾는다.
  const selectFeatureById = useCallback(
    (id: string) => {
      const found = featureItems.find((it) => it.id === id);
      if (found) setSelectedFeature(found.data);
    },
    [featureItems],
  );

  // 유저플로우 노드 클릭 → 상세 패널 열기. spec 타입 노드만 대상(다른 뷰 노드는 무시).
  // 기획 유저플로우(planningFlowNodes)와 change 유저플로우(flowNodes)가 같은 핸들러를 공유한다.
  const onFlowNodeClick = useCallback((_e: ReactMouseEvent, node: Node) => {
    if (node.type !== "spec") return;
    setSelectedFlow(node.data as SpecNodeData);
    setSelectedFeature(null);
  }, []);

  // 상세 패널 안 연결 노드 클릭 → 그 id의 노드 data로 전환. 현재 렌더 중인 유저플로우 노드 집합에서 찾는다.
  const selectFlowById = useCallback(
    (id: string) => {
      const pool = [...planningFlowNodes, ...flowNodes];
      const found = pool.find((n) => n.id === id);
      if (found) setSelectedFlow(found.data as SpecNodeData);
    },
    [planningFlowNodes, flowNodes],
  );

  // 기능명세 상세 패널 화면 칩 클릭 처리(flowforge-ia-removal D4).
  // IA 뷰가 제거돼 딥링크 *타깃*이 사라졌으므로, 칩 자체는 유지하되 클릭은 상태바 안내로 안전 처리한다
  // (칩 라벨은 화면 레지스트리에서 오므로 정보 손실 0 — 런타임 에러 없이 no-op+안내).
  // 유저플로우↔화면 크로스링크의 새 타깃은 별도 change(flowforge-screen-crosslink)에서 배선한다.
  const selectScreenChip = useCallback(
    (screenId: string) => {
      const chip = selectedFeature?.screens?.find((s) => s.id === screenId);
      setStatus(`연결 화면: ${chip?.label ?? screenId} (유저플로우 탭의 해당 화면 노드에서 상호참조를 볼 수 있습니다)`);
    },
    [selectedFeature],
  );

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
  // 에지 제안 큐는 per-stem — 전환한 stem의 큐로 함께 갱신(실패는 빈 큐 강등).
  // 토큰 가드: 빠른 연속 전환 시 stale 응답이 최종 선택을 덮어쓰거나(그래프=v2·패널=v1
  // 크로스-stem 불일치), in-flight apply 응답이 전환 후 화면을 덮는 레이스 차단(P3).
  const switchPlanningFlow = useCallback(
    (flow: string) => {
      if (!dashProject) return;
      const project = dashProject.name;
      const token = ++dashReqToken.current;
      fetchDocsPlanningUserFlow(project, flow)
        .then((r) => {
          if (token !== dashReqToken.current) return;
          setPlanningUserFlow(r.graph);
          setPlanningFlowNodes(toFlowNodes(r.graph, r.layout));
          setPlanningFlowEdges(toFlowEdges(r.graph));
          setPlanningFlowName(r.flow);
          setPlanningFlowVersions(r.versions);
          setStatus("");
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`기획 유저플로우 로드 실패: ${String(e)}`);
        });
      // stem 전환 시 반영 tick 리셋(D-4) — key 리마운트와 별개로 tick 격리(cross-stem 소실 방지).
      setUflowAppliedTick(0);
      setUflowSuggestions([]);
      fetchUserFlowSuggestions(project, flow)
        .then((q) => {
          if (token !== dashReqToken.current) return;
          setUflowSuggestions(q.queue.suggestions);
        })
        .catch(() => {
          if (token !== dashReqToken.current) return;
          setUflowSuggestions([]); // 제안 큐 없음/오류 — 순수 읽기 그래프 뷰
        });
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
    // 프로젝트 전환 시 반영 tick 격리 — A에서 올라간 tick이 B 위저드 마운트에서
    // 체크포인트를 지우는 cross-project 결정 소실(review C-2) 방지. 세 위저드 모두(D-4).
    setPrdAppliedTick(0);
    setFeatAppliedTick(0);
    setWireAppliedTick(0);
    setUflowAppliedTick(0);
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
    // capability별 audit 요약(docs/audit.json) 로드 — 실패해도 배지만 없이 그래프는 정상(D-6).
    setFeatureAudit(null);
    fetchAuditCapabilities(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setFeatureAudit(r.capabilities);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setFeatureAudit(null); // audit 조회 실패 — 배지 없음(그래프 렌더는 무영향)
      });
    // 화면 레지스트리(features.md 화면목록 + N:M 링크) 로드 — 실패 시 연결화면 섹션만 생략(D-4).
    setPlanningScreens(null);
    fetchPlanningScreens(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setPlanningScreens(r);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPlanningScreens(null); // 조회 실패 — 연결화면 섹션만 생략(그래프·패널 무영향, D-4)
      });
    // 기획 단계 와이어(디바이스 프레임 레이아웃) 로드 — 없으면(404) null로 비움(에러 아님).
    setPlanningWireScreens(null);
    fetchDocsPlanningWireframe(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        // 화면이 하나도 없으면 렌더할 게 없으니 탭에 안 띄운다(빈 프레임만 뜨는 것 방지).
        setPlanningWireScreens(r.screens.length > 0 ? r.screens : null);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPlanningWireScreens(null); // 화면 미작성 — 정상(미표시)
      });
    // 와이어 레이아웃 제안 큐(docs/planning/wireframe.suggestions.json) 로드 — 없으면 빈 큐(순수 읽기 뷰).
    setWireSuggestions([]);
    fetchDocsWireframeSuggestions(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setWireSuggestions(r.queue.suggestions);
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setWireSuggestions([]); // 제안 큐 없음/오류 — 순수 읽기 뷰
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
    setUflowSuggestions([]);
    fetchDocsPlanningUserFlow(card.name)
      .then((r) => {
        if (token !== dashReqToken.current) return;
        setPlanningUserFlow(r.graph);
        setPlanningFlowNodes(toFlowNodes(r.graph, r.layout));
        setPlanningFlowEdges(toFlowEdges(r.graph));
        setPlanningFlowName(r.flow);
        setPlanningFlowVersions(r.versions);
        // 해석된 stem(r.flow)의 에지 제안 큐 로드 — per-stem이라 stem 확정 후에만 가능.
        // 실패/부재는 빈 큐 강등(그래프 렌더 유지, 순수 읽기 뷰).
        void fetchUserFlowSuggestions(card.name, r.flow)
          .then((q) => {
            if (token !== dashReqToken.current) return;
            setUflowSuggestions(q.queue.suggestions);
          })
          .catch(() => {
            if (token !== dashReqToken.current) return;
            setUflowSuggestions([]); // 제안 큐 없음/오류 — 순수 읽기 그래프 뷰
          });
      })
      .catch(() => {
        if (token !== dashReqToken.current) return;
        setPlanningUserFlow(null); // 기획 유저플로우 미작성 — 정상(미표시)
      });
    if (card.hasCharter) {
      setDashStage("skeleton");
      setStatus("");
    } else {
      setDashStage("skeleton");
      setStatus("이 프로젝트는 기획 문서가 없습니다(아래 change 목록에서 진입).");
    }
  }, []);

  /**
   * "감사 진행"(planning-audit-trigger) — 그 프로젝트의 openspec-audit을 큐잉하고,
   * 202 후 폴링으로 fetchAuditCapabilities를 재조회해 판정을 갱신한다(호스트 워커가
   * 결정적으로 실행 → audit.json 갱신, 실시간 스트리밍은 non-goal). race 가드(dashReqToken):
   * 감사 중 다른 카드로 이동하면 폴링 결과를 폐기한다.
   */
  const runProjectAudit = useCallback(() => {
    if (!dashProject || auditRunning) return;
    const project = dashProject.name;
    const token = dashReqToken.current; // 이 시점의 프로젝트 요청 토큰(이동 시 무효화됨)
    setAuditRunning(true);
    setStatus("감사 실행 중… (완료 후 자동 재조회)");
    void runAudit(project)
      .then(() => {
        // 202 = 큐잉됨. 워커가 audit.json을 갱신할 때까지 몇 초 간격으로 재조회(최대 N회).
        const MAX_POLLS = 20;
        const POLL_MS = 3000;
        let polls = 0;
        const poll = (): void => {
          if (token !== dashReqToken.current) return; // 다른 카드로 이동 — 폐기
          polls += 1;
          void fetchAuditCapabilities(project)
            .then((r) => {
              if (token !== dashReqToken.current) return;
              const caps = r.capabilities;
              const hasData = Object.keys(caps).length > 0;
              if (hasData || polls >= MAX_POLLS) {
                setFeatureAudit(caps);
                setAuditRunning(false);
                setStatus(hasData ? "감사 완료 — 판정을 갱신했습니다." : "감사 큐잉됨 — 아직 결과가 없습니다(나중에 새로고침).");
                return;
              }
              window.setTimeout(poll, POLL_MS);
            })
            .catch(() => {
              if (token !== dashReqToken.current) return;
              if (polls >= MAX_POLLS) {
                setAuditRunning(false);
                setStatus("감사 결과 조회 실패(나중에 새로고침).");
                return;
              }
              window.setTimeout(poll, POLL_MS);
            });
        };
        window.setTimeout(poll, POLL_MS);
      })
      .catch((e: unknown) => {
        if (token !== dashReqToken.current) return;
        setAuditRunning(false);
        setStatus(`감사 실행 실패: ${String(e instanceof Error ? e.message : e)}`);
      });
  }, [dashProject, auditRunning]);

  // PRD 제안 승인/반려 적용 — POST apply 후 PRD·제안 큐 재조회(반영·큐 갱신을 화면에 반사).
  // race 가드: 제출 시점의 프로젝트로 재조회하고, 그 사이 다른 카드로 이동했으면 폐기.
  // skipped 대량 나열 절단(3차 review): 상위 SKIPPED_PREVIEW_CAP건 + "외 M건" — 상태바 범람 방지.
  const skippedSummary = (skipped: readonly string[]): string => {
    const head = skipped.slice(0, SKIPPED_PREVIEW_CAP).join(", ");
    return skipped.length > SKIPPED_PREVIEW_CAP
      ? `${head} 외 ${skipped.length - SKIPPED_PREVIEW_CAP}건`
      : head;
  };

  const applyPrd = useCallback(
    (approve: string[], reject: string[]) => {
      const project = dashProject?.name;
      if (!project || prdApplyBusy) return;
      // 반영 대상 0(전부 건너뛰기 등) = 서버 무접촉 — 유령 성공으로 tick을 올려
      // 결정을 지우지 않는다(review M-1). 안내만 하고 종료.
      if (approve.length === 0 && reject.length === 0) {
        setStatus("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
        return;
      }
      const token = ++dashReqToken.current;
      setPrdApplyBusy(true);
      applyInChunks((r) => applyDocsPrdSuggestions(project, r), { approve, reject })
        .then((res) => {
          if (res.queuePruneFailed) {
            setStatus("문서에는 반영됐지만 큐 정리에 실패했습니다 — 같은 제안이 다시 보이면 반려로 정리하세요.");
          } else if (res.skipped.length > 0) {
            setStatus(`일부 제안을 처리하지 못했습니다(skipped: ${skippedSummary(res.skipped)}).`);
          }
          return Promise.all([fetchDocsPlanningPrd(project), fetchDocsPrdSuggestions(project)]);
        })
        .then(([prdRes, sugRes]) => {
          if (token !== dashReqToken.current) return; // 그 사이 다른 클릭 → 폐기
          setPlanningPrd(prdRes.prd);
          setPrdSuggestions(sugRes.queue.suggestions);
          // 반영 성공 신호 → 위저드 결정 리셋(skip 잔존 큐가 요약에 갇히지 않게).
          setPrdAppliedTick((t) => t + 1);
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          // 청크 도중 실패면 앞 청크는 이미 반영됨 — 화면을 서버에서 다시 불러와 실제 상태로 맞춘다(아래 재조회).
          // tick은 안 올린다 — 결정 보존(재시도 가능)이 실패 경로의 계약.
          setStatus(`PRD 승인/반려 실패(일부는 반영됐을 수 있음 — 화면을 다시 불러옵니다): ${String(e)}`);
          void Promise.all([fetchDocsPlanningPrd(project), fetchDocsPrdSuggestions(project)])
            .then(([prdRes, sugRes]) => {
              if (token !== dashReqToken.current) return;
              setPlanningPrd(prdRes.prd);
              setPrdSuggestions(sugRes.queue.suggestions);
            })
            .catch(() => undefined);
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
      // 반영 대상 0(전부 건너뛰기 등) = 서버 무접촉 — 유령 성공으로 tick을 올려
      // 결정을 지우지 않는다(M-1 계승). 안내만 하고 종료.
      if (approve.length === 0 && reject.length === 0) {
        setStatus("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
        return;
      }
      const token = ++dashReqToken.current;
      setFeatureApplyBusy(true);
      applyInChunks((r) => applyDocsFeatureSuggestions(project, r), { approve, reject })
        .then((res) => {
          if (res.queuePruneFailed) {
            setStatus("문서에는 반영됐지만 큐 정리에 실패했습니다 — 같은 제안이 다시 보이면 반려로 정리하세요.");
          } else if (res.skipped.length > 0) {
            setStatus(`일부 제안을 처리하지 못했습니다(skipped: ${skippedSummary(res.skipped)}).`);
          }
          return Promise.all([
            fetchDocsPlanningFeatures(project),
            fetchDocsFeatureSuggestions(project),
            // 화면 링크도 features.md에서 파생 — 함께 재조회해 stale 방지. 실패는 개별 흡수(D-4: 섹션만 생략).
            fetchPlanningScreens(project).catch(() => null),
          ]);
        })
        .then(([featRes, sugRes, screensRes]) => {
          if (token !== dashReqToken.current) return; // 그 사이 다른 클릭 → 폐기
          setPlanningFeatures(featRes.tree.root);
          setFeatureSuggestions(sugRes.queue.suggestions);
          setPlanningScreens(screensRes);
          // 반영 성공 신호 → 위저드 결정 리셋(skip 잔존 큐가 요약에 갇히지 않게).
          setFeatAppliedTick((t) => t + 1);
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`기능명세 승인/반려 실패(일부는 반영됐을 수 있음 — 화면을 다시 불러옵니다): ${String(e)}`);
          void Promise.all([fetchDocsPlanningFeatures(project), fetchDocsFeatureSuggestions(project)])
            .then(([featRes, sugRes]) => {
              if (token !== dashReqToken.current) return;
              setPlanningFeatures(featRes.tree.root);
              setFeatureSuggestions(sugRes.queue.suggestions);
            })
            .catch(() => undefined);
        })
        .finally(() => {
          setFeatureApplyBusy(false);
        });
    },
    [dashProject, featureApplyBusy],
  );

  // 와이어 레이아웃 제안 승인/반려 적용 — POST apply 후 화면(디바이스 프레임)·제안 큐 재조회.
  // applyFeature와 대칭. D6: 승인분만 원천 교체 → 화면 전체 재조회하면 승인된 화면만 갱신 반영,
  // 나머지 승인분은 서버에서 불변(화면 id 집합 보존)이라 그대로 온다. race 가드: 그 사이 다른 카드로 이동했으면 폐기.
  const applyWire = useCallback(
    (approve: string[], reject: string[]) => {
      const project = dashProject?.name;
      if (!project || wireApplyBusy) return;
      // 반영 대상 0(전부 건너뛰기 등) = 서버 무접촉 — 유령 성공으로 tick을 올려 결정을 지우지 않는다(M-1 계승).
      if (approve.length === 0 && reject.length === 0) {
        setStatus("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
        return;
      }
      const token = ++dashReqToken.current;
      setWireApplyBusy(true);
      applyInChunks((r) => applyDocsWireframeSuggestions(project, r), { approve, reject })
        .then((res) => {
          if (res.queuePruneFailed) {
            setStatus("문서에는 반영됐지만 큐 정리에 실패했습니다 — 같은 제안이 다시 보이면 반려로 정리하세요.");
          } else if (res.skipped.length > 0) {
            setStatus(`일부 제안을 처리하지 못했습니다(skipped: ${skippedSummary(res.skipped)}).`);
          }
          return Promise.all([
            fetchDocsPlanningWireframe(project),
            fetchDocsWireframeSuggestions(project),
          ]);
        })
        .then(([wireRes, sugRes]) => {
          if (token !== dashReqToken.current) return; // 그 사이 다른 클릭 → 폐기
          setPlanningWireScreens(wireRes.screens.length > 0 ? wireRes.screens : null);
          setWireSuggestions(sugRes.queue.suggestions);
          // 반영 성공 신호 → 위저드 결정 리셋(skip 잔존 큐가 요약에 갇히지 않게).
          setWireAppliedTick((t) => t + 1);
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`와이어 승인/반려 실패(일부는 반영됐을 수 있음 — 화면을 다시 불러옵니다): ${String(e)}`);
          void Promise.all([
            fetchDocsPlanningWireframe(project),
            fetchDocsWireframeSuggestions(project),
          ])
            .then(([wireRes, sugRes]) => {
              if (token !== dashReqToken.current) return;
              setPlanningWireScreens(wireRes.screens.length > 0 ? wireRes.screens : null);
              setWireSuggestions(sugRes.queue.suggestions);
            })
            .catch(() => undefined);
        })
        .finally(() => {
          setWireApplyBusy(false);
        });
    },
    [dashProject, wireApplyBusy],
  );

  // 유저플로우 에지 제안 승인/반려 적용 — POST apply 후 그래프·제안 큐 재조회(append 에지·큐 갱신을 화면에 반사).
  // 6b applyFeature와 대칭. per-stem: 제출 시점의 stem(planningFlowName)으로 적용·재조회.
  // race 가드: 그 사이 다른 카드/버전으로 이동했으면 폐기. 큐 재조회 실패는 빈 큐 강등(그래프는 유지).
  const applyUserFlow = useCallback(
    (approve: string[], reject: string[]) => {
      const project = dashProject?.name;
      const flow = planningFlowName;
      if (!project || !flow || uflowApplyBusy) return;
      // 반영 대상 0(전부 건너뛰기 등) = 서버 무접촉 — 유령 성공으로 tick을 올려
      // 결정을 지우지 않는다(M-1 계승). 안내만 하고 종료.
      if (approve.length === 0 && reject.length === 0) {
        setStatus("반영할 승인/반려 결정이 없습니다 — 건너뛴 제안은 큐에 남습니다.");
        return;
      }
      const token = ++dashReqToken.current;
      setUflowApplyBusy(true);
      applyInChunks((r) => applyUserFlowSuggestions(project, flow, r), { approve, reject })
        .then((res) => {
          if (res.queuePruneFailed) {
            setStatus("문서에는 반영됐지만 큐 정리에 실패했습니다 — 같은 제안이 다시 보이면 반려로 정리하세요.");
          } else if (res.skipped.length > 0) {
            setStatus(`일부 제안을 처리하지 못했습니다(skipped: ${skippedSummary(res.skipped)}).`);
          }
          return Promise.all([
            fetchDocsPlanningUserFlow(project, flow),
            fetchUserFlowSuggestions(project, flow).catch(() => null),
          ]);
        })
        .then(([flowRes, sugRes]) => {
          if (token !== dashReqToken.current) return; // 그 사이 다른 클릭 → 폐기
          setPlanningUserFlow(flowRes.graph);
          setPlanningFlowNodes(toFlowNodes(flowRes.graph, flowRes.layout));
          setPlanningFlowEdges(toFlowEdges(flowRes.graph));
          setPlanningFlowName(flowRes.flow);
          setPlanningFlowVersions(flowRes.versions);
          setUflowSuggestions(sugRes ? sugRes.queue.suggestions : []);
          // 반영 성공 신호 → 위저드 결정 리셋(skip 잔존 큐가 요약에 갇히지 않게).
          setUflowAppliedTick((t) => t + 1);
        })
        .catch((e: unknown) => {
          if (token !== dashReqToken.current) return;
          setStatus(`유저플로우 승인/반려 실패(일부는 반영됐을 수 있음 — 화면을 다시 불러옵니다): ${String(e)}`);
          void Promise.all([
            fetchDocsPlanningUserFlow(project, flow),
            fetchUserFlowSuggestions(project, flow).catch(() => null),
          ])
            .then(([flowRes, sugRes]) => {
              if (token !== dashReqToken.current) return;
              setPlanningUserFlow(flowRes.graph);
              setPlanningFlowNodes(toFlowNodes(flowRes.graph, flowRes.layout));
              setPlanningFlowEdges(toFlowEdges(flowRes.graph));
              // 큐도 재동기화 — 처리된 카드가 남아 재시도 시 오경보(skipped 나열)를 만드는 것 방지.
              setUflowSuggestions(sugRes ? sugRes.queue.suggestions : []);
            })
            .catch(() => undefined);
        })
        .finally(() => {
          setUflowApplyBusy(false);
        });
    },
    [dashProject, planningFlowName, uflowApplyBusy],
  );

  // change 클릭: 5종 뷰로 진입 — selected를 그 change로 세팅하면 로딩 effect가 동작.
  // change.project(서버가 드릴다운에서 실어줌)를 함께 캡처 — 5종 fetch·배치 저장이 그 프로젝트
  // openspec 하위에서 해석되게 한다. 전역 진입이면 undefined라 기존 동작(전역 root) 그대로.
  const openChangeViews = useCallback((change: ChangeSummary) => {
    setSelected(change.key);
    setSelectedProject(change.project);
    setTab("prd");
    setDashStage("views");
    setStatus("");
    // 진입 시 열려있던 노드 상세 패널(기능명세·유저플로우)을 닫는다 — 안 닫으면 z-index 고정
    // 패널이 방금 진입한 change 4종 뷰를 계속 가린다(다른 전환 경로의 패널 상호배타와 동일 규칙).
    setSelectedFeature(null);
    setSelectedFlow(null);
    // 딥링크 URL 기록. change.project가 있을 때만 — ?project= 없이는 왕복 복원이 안 되는
    // 전역 진입 change는 URL을 남기지 않는다(마운트 복원이 project·change 둘 다 요구하는 것과 일관).
    if (change.project) {
      history.pushState(
        null,
        "",
        serializeDeepLink({ project: change.project, change: change.key, tab: "prd" }),
      );
    }
  }, []);

  // 브레드크럼/뒤로가기: 지정 단계로 복귀(상위 선택은 유지).
  const goToStage = useCallback((stage: DashStage) => {
    setDashStage(stage);
    setStatus("");
    // views를 떠나면(grid/skeleton 복귀) URL의 딥링크 파라미터를 비운다 —
    // URL이 "뷰를 벗어났다"를 반영하게. views로 가는 전환에는 손대지 않는다(그건 openChangeViews가 기록).
    if (stage !== "views") {
      history.pushState(null, "", window.location.pathname);
    }
  }, []);

  const tabBtn = (key: Tab, label: string) => (
    <button
      onClick={() => {
        setTab(key);
        // 탭 전환 시 URL의 tab만 갱신. project·change 둘 다 있을 때만(딥링크 왕복 가능한 경우).
        if (selectedProject && selected) {
          history.pushState(
            null,
            "",
            serializeDeepLink({ project: selectedProject, change: selected, tab: key }),
          );
        }
      }}
      aria-pressed={tab === key}
      data-testid={`tab-${key}`}
      style={{ borderColor: tab === key ? "#b6e65a" : undefined }}
    >
      {label}
    </button>
  );

  // skeleton 뷰 탭: 있는 뷰만 노출, 활성 탭이 없는 뷰를 가리키면 첫 유효 탭으로 폴백.
  // IA 뷰 제거(flowforge-ia-removal) — 4종(prd·features·wire·flow).
  const planTabsAvail: Array<"prd" | "features" | "wire" | "flow"> = [];
  if (planningPrd) planTabsAvail.push("prd");
  if (planningFeatures) planTabsAvail.push("features");
  if (planningWireScreens) planTabsAvail.push("wire");
  if (planningUserFlow) planTabsAvail.push("flow");
  const activePlanTab: "prd" | "features" | "wire" | "flow" = planTabsAvail.includes(planTab)
    ? planTab
    : (planTabsAvail[0] ?? "prd");
  const planTabBtn = (key: "prd" | "features" | "wire" | "flow", label: string): JSX.Element => (
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

  // 화면 id 조인 인덱스(flowforge-screen-crosslink) — 로드된 화면목록·와이어에서 파생.
  // 데이터가 바뀔 때만 재계산(선택된 노드와 무관 — 인덱스는 프로젝트 단위).
  const screenToDetails = useMemo(
    () => buildScreenToDetailLabels(planningScreens),
    [planningScreens],
  );
  const wireById = useMemo(() => buildWireById(planningWireScreens), [planningWireScreens]);

  // 선택된 유저플로우 노드가 화면(page)이면 그 화면 id로 와이어·연관 기능을 조인해 패널에 넘긴다.
  // 화면 아님/조인 데이터 없음이면 undefined(패널이 상호참조 섹션을 안 그림 — 기존 흐름 섹션만).
  const flowCrosslink: ScreenCrosslinkData | undefined = useMemo(() => {
    if (!selectedFlow || selectedFlow.kind !== "screen") return undefined;
    const sid = selectedFlow.screenId;
    return {
      wire: wireForScreen(wireById, sid),
      featureLabels: detailLabelsForScreen(screenToDetails, sid),
    };
  }, [selectedFlow, wireById, screenToDetails]);

  // "와이어 탭에서 열기"(D.1) — 딥링크 유틸이 planning 탭엔 없으므로 인앱 탭 전환으로 폴백.
  // planning skeleton 단계에선 planTab="wire"로 전환(화면 프레임 목록에서 해당 화면을 볼 수 있게).
  const openWireForScreen = useCallback((_screenId: string) => {
    setPlanTab("wire");
    setSelectedFlow(null); // 패널 상호배타(탭 전환 시 상세 패널 닫기)
  }, []);

  // 연관 기능명세 상세기능 라벨 클릭(D.2) — 상태바 식별 표시(기획 기능명세 탭에서 찾을 수 있게 안내).
  // features 노드 id는 feat-...라 라벨 문자열 딥링크가 취약하므로, 라벨 식별만 필수로 제공한다.
  const selectFeatureLabelFromFlow = useCallback((label: string) => {
    setStatus(`연관 기능명세 상세기능: ${label} (기획 기능명세 탭에서 확인)`);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "10px 16px", borderBottom: "1px solid #2a2e38", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>flowforge</strong>
        {/* 5종 탭: 대시보드 views 단계(change 선택 후)에서만 노출. */}
        {dashStage === "views" && (
          <div style={{ display: "flex", gap: 4 }}>
            {tabBtn("prd", "PRD")}
            {tabBtn("spec", "명세(change)")}
            {tabBtn("flow", "유저플로우")}
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
          {dashStage === "views" && selected && (
            <>
              <span className="dash-sep" aria-hidden="true">›</span>
              <span className="dash-crumb dash-crumb--current">{selected}</span>
            </>
          )}
        </nav>
        {/* 감사 진행(planning-audit-trigger): auditStatus가 unknown/warn일 때만 노출(정합/불합엔 강제 노출 안 함).
            클릭 → 큐잉(202) → 폴링 재조회 → 판정 갱신. 실행 중엔 비활성+라벨 전환. */}
        {dashProject && (dashProject.auditStatus === "unknown" || dashProject.auditStatus === "warn") && (
          <button
            type="button"
            className="dash-audit-run"
            data-testid="audit-run-btn"
            onClick={runProjectAudit}
            disabled={auditRunning}
            title="이 프로젝트 전체를 감사(spec.md ↔ 코드 정합)합니다"
          >
            {auditRunning ? "감사 중…" : "🔍 감사 진행"}
          </button>
        )}
        {dashStage === "views" && tab === "flow" && dangling > 0 && (
          <span style={{ color: "#f0a05a" }}>⚠ dangling {dangling}</span>
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
          <div className={`dash-body${["features", "flow", "wire"].includes(activePlanTab) ? " dash-body--wide" : ""}`}>
            {planTabsAvail.length > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 12 }} data-testid="plan-tabs">
                {planningPrd && planTabBtn("prd", "PRD")}
                {planningFeatures && planTabBtn("features", "기획 기능명세")}
                {planningWireScreens && planTabBtn("wire", "와이어프레임")}
                {planningUserFlow && planTabBtn("flow", "유저플로우")}
              </div>
            )}
            {/* 기획 단계 PRD(docs/planning/prd.md) — 있으면 프로젝트 기획을 PrdPanel로 렌더 */}
            {planningPrd && activePlanTab === "prd" && (
              <section className="dash-planning-prd" data-testid="planning-prd">
                <h3 className="dash-h">{dashProject?.displayName} — 기획 PRD</h3>
                {/* 제안 큐가 있으면 승인 위저드(한 건씩+진행+요약 일괄 반영), 큐 비면 렌더 안 함(순수 읽기 뷰). */}
                <PrdApprovalWizard
                  key={dashProject?.name ?? ""}
                  project={dashProject?.name ?? ""}
                  prd={planningPrd}
                  suggestions={prdSuggestions}
                  busy={prdApplyBusy}
                  onApply={(approve, reject) => applyPrd(approve, reject)}
                  appliedTick={prdAppliedTick}
                />
                <PrdPanel prd={planningPrd} />
              </section>
            )}
            {/* 기획 단계 기능명세(docs/planning/features.md) — 계층 리스트(들여쓴 아웃라인)로 렌더
                (flowforge-artifact-restructure): 다이어그램(ReactFlow FeatureNode) → 리스트 전환. */}
            {planningFeatures && activePlanTab === "features" && (
              <section className="dash-planning-features" data-testid="planning-features">
                <h3 className="dash-h">{dashProject?.displayName} — 기획 기능명세</h3>
                {/* 제안 큐가 있으면 노드 속성 승인/반려 위저드(6b), 큐 비면 렌더 안 함(순수 읽기 리스트 뷰). */}
                <FeatureApprovalWizard
                  key={dashProject?.name ?? ""}
                  project={dashProject?.name ?? ""}
                  root={planningFeatures}
                  suggestions={featureSuggestions}
                  busy={featureApplyBusy}
                  onApply={(approve, reject) => applyFeature(approve, reject)}
                  appliedTick={featAppliedTick}
                />
                <div className="dash-plan-flow">
                  <FeatureListView items={featureItems} onSelect={openFeature} />
                </div>
              </section>
            )}
            {/* 기획 단계 와이어 — 디바이스 프레임 안에 화면 레이아웃 배치(WireframeDeviceFrame, 세로 목록 아님) */}
            {planningWireScreens && activePlanTab === "wire" && (
              <section className="dash-planning-wire" data-testid="planning-wireframe">
                <h3 className="dash-h">{dashProject?.displayName} — 와이어프레임</h3>
                {/* 제안 큐가 있으면 레이아웃 승인/반려 위저드(Parallel Group 3), 큐 비면 렌더 안 함(순수 읽기 뷰). */}
                <WireframeApprovalWizard
                  key={dashProject?.name ?? ""}
                  project={dashProject?.name ?? ""}
                  suggestions={wireSuggestions}
                  busy={wireApplyBusy}
                  onApply={(approve, reject) => applyWire(approve, reject)}
                  appliedTick={wireAppliedTick}
                />
                {/* 인플레이스 핀 피드백(D2 정정 — Figma 코멘트식). 디바이스 프레임 + 핀 레이어 + 목록.
                    와이어 위 ⌘+클릭/핀모드 클릭 → 그 좌표에 팝오버 → 저장하면 핀. feedback write(D8 별도 경로). */}
                <WireframePinFeedback
                  project={dashProject?.name ?? ""}
                  screens={planningWireScreens}
                />
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
                {/* 제안 큐가 있으면 에지 추가 승인/반려 위저드(6b-userflow), 큐 비면 렌더 안 함(순수 읽기 그래프 뷰). */}
                {/* stem별 key 리마운트(D-3) — cross-stem 결정 소실 방지. */}
                <UserFlowApprovalWizard
                  key={`${dashProject?.name ?? ""}:${planningFlowName}`}
                  project={dashProject?.name ?? ""}
                  stem={planningFlowName}
                  suggestions={uflowSuggestions}
                  busy={uflowApplyBusy}
                  onApply={(approve, reject) => applyUserFlow(approve, reject)}
                  appliedTick={uflowAppliedTick}
                />
                <div className="dash-plan-flow">
                  <ReactFlow
                    key="d-planning-user-flow"
                    nodes={planningFlowNodes}
                    edges={planningFlowEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onPlanningFlowNodesChange}
                    onNodeDragStop={onPlanningFlowNodeDragStop}
                    onNodeClick={onFlowNodeClick}
                    fitView
                    fitViewOptions={{ minZoom: 0.7, maxZoom: 1 }}
                  >
                    <Background />
                    <Controls />
                  </ReactFlow>
                </div>
              </section>
            )}
            {/* 전역 change 목록(capability별 통짜 나열)은 제거됨
                (flowforge-change-node-mapping): change는 이제 기능명세 노드/화면에
                연관된 것만 in-place로 매핑돼 표시된다(FeatureNode 배지 + 상세 패널 진입).
                "모든 change를 한 번에" 나열하지 않고 "항상 연관된 것만" 보여준다. */}
            {/* 기획 문서가 없는 프로젝트는 위 기능명세 노드 경유 진입로 자체가 없다
                (uncharted-project-change-list) — activeChangeNames를 재사용해 change
                목록 진입로를 보충한다. hasCharter 게이팅은 컴포넌트 내부에서 처리(회귀 가드
                테스트를 그 컴포넌트 하나로 고정하기 위함). */}
            <UnchartedChangeList
              hasCharter={dashProject?.hasCharter ?? true}
              changeNames={dashProject?.activeChangeNames ?? []}
              onOpenChange={(name) =>
                openChangeViews({
                  key: name,
                  displayName: name,
                  ...(dashProject?.name ? { project: dashProject.name } : {}),
                })
              }
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
              <ReactFlow key="d-flow" nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodesChange={onFlowNodesChange} onNodeDragStop={onFlowNodeDragStop} onNodeClick={onFlowNodeClick} fitView>
                <Background />
                <Controls />
              </ReactFlow>
            )}
            {tab === "wire" && wireframe && <WireframePanel wireframe={wireframe} />}
          </>
        )}
      </div>
      {/* 기능명세 노드 상세 패널(데스크탑 우측 슬라이드 / 모바일 하단 시트). 항상 마운트하고 open으로 슬라이드. */}
      <FeatureDetailPanel
        node={selectedFeature}
        onClose={() => setSelectedFeature(null)}
        onSelectById={selectFeatureById}
        onSelectScreen={selectScreenChip}
        onOpenChange={(changeKey) =>
          openChangeViews({
            key: changeKey,
            displayName: changeKey,
            ...(dashProject?.name ? { project: dashProject.name } : {}),
          })
        }
      />
      {/* 유저플로우 노드 상세 패널 — 같은 UX/CSS 재사용. incoming/outgoing 흐름 표시.
          화면(page) 노드면 화면 허브 상호참조(연관 와이어·연관 기능명세)를 추가로 표시
          (flowforge-screen-crosslink). crosslink는 화면 노드일 때만 정의됨(그 외 undefined → 섹션 미노출). */}
      <FlowDetailPanel
        node={selectedFlow}
        project={dashProject?.name ?? ""}
        onClose={() => setSelectedFlow(null)}
        onSelectById={selectFlowById}
        {...(flowCrosslink ? { crosslink: flowCrosslink } : {})}
        onOpenWire={openWireForScreen}
        onSelectFeatureLabel={selectFeatureLabelFromFlow}
      />
    </div>
  );
}
