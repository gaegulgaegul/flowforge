import { useCallback, useEffect, useState } from "react";
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
  LayoutOverlay,
  SpecGraph,
  IANode as IANodeT,
  Wireframe,
  Prd,
  SpecTreeNode as SpecTreeNodeT,
  DecisionTimeline as DecisionTimelineT,
} from "@flowforge/shared";
import {
  fetchChanges,
  fetchGraph,
  fetchIA,
  fetchWireframe,
  fetchPrd,
  fetchSpecTree,
  saveLayout,
  fetchDocsProjects,
  fetchDocsGraph,
  fetchDocsWireframe,
  fetchDocsPrd,
} from "./api.js";
import { toFlowNodes, toFlowEdges, danglingCount, autoLayout } from "./graphAdapter.js";
import { toIAFlow } from "./iaAdapter.js";
import { toSpecTreeFlow } from "./specTreeAdapter.js";
import { SpecNode } from "./SpecNode.js";
import { IANode } from "./IANode.js";
import { SpecTreeNode } from "./SpecTreeNode.js";
import { WireframePanel } from "./WireframePanel.js";
import { PrdPanel } from "./PrdPanel.js";
import { DecisionTimeline } from "./DecisionTimeline.js";

// 커스텀 노드 타입 매핑 — 컴포넌트 밖 상수로 두어 재마운트 방지
const nodeTypes: NodeTypes = { spec: SpecNode, ia: IANode, specTree: SpecTreeNode };

// manyfast 파이프라인 순서: PRD → 기능명세서 → 유저플로우 → IA → 와이어프레임
type Tab = "prd" | "spec" | "flow" | "ia" | "wire";
// 소스 모드: change(기존 빌더 산출물) | docs(charter 상주 문서)
type Source = "change" | "docs";

export function App(): JSX.Element {
  const [source, setSource] = useState<Source>("change");
  const [changes, setChanges] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [docsProjects, setDocsProjects] = useState<string[]>([]);
  const [docsProject, setDocsProject] = useState<string>("");
  const [tab, setTab] = useState<Tab>("flow");
  const [iaVerbose, setIaVerbose] = useState(false);
  const [status, setStatus] = useState("");

  // 유저플로우 상태
  const [graph, setGraph] = useState<SpecGraph | null>(null);
  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  const [flowEdges, setFlowEdges] = useState<Edge[]>([]);
  const [dangling, setDangling] = useState(0);

  // IA 트리 상태
  const [iaRoot, setIaRoot] = useState<IANodeT | null>(null);
  const [iaNodes, setIaNodes] = useState<Node[]>([]);
  const [iaEdges, setIaEdges] = useState<Edge[]>([]);

  // 와이어프레임 상태
  const [wireframe, setWireframe] = useState<Wireframe | null>(null);

  // PRD 상태(5섹션) — change 모드 prd 탭
  const [prd, setPrd] = useState<Prd | null>(null);

  // decision 타임라인 상태 — docs 모드 prd 탭
  const [timeline, setTimeline] = useState<DecisionTimelineT | null>(null);

  // 기능명세서 3단 트리 상태
  const [specRoot, setSpecRoot] = useState<SpecTreeNodeT | null>(null);
  const [specNodes, setSpecNodes] = useState<Node[]>([]);
  const [specEdges, setSpecEdges] = useState<Edge[]>([]);

  // 소스 모드에 맞는 목록 로드. source 전환 시 이전 모드 선택값을 초기화해 교차 오염 방지.
  useEffect(() => {
    if (source === "change") {
      setDocsProject("");
      setDocsProjects([]);
      fetchChanges()
        .then((cs) => {
          setChanges(cs);
          setSelected(cs.length > 0 ? cs[0]! : "");
        })
        .catch((e: unknown) => setStatus(`목록 로드 실패: ${String(e)}`));
    } else {
      setSelected("");
      setChanges([]);
      fetchDocsProjects()
        .then((ps) => {
          setDocsProjects(ps);
          setDocsProject(ps.length > 0 ? ps[0]! : "");
        })
        .catch((e: unknown) => setStatus(`상주 목록 로드 실패: ${String(e)}`));
    }
  }, [source]);

  // change 선택 시 다섯 산출물 모두 로드 (change 모드 전용)
  useEffect(() => {
    if (source !== "change") return;
    if (!selected) return;
    // 이전 change 데이터를 먼저 비워 새 데이터 도착 전 stale 잔류(플래시)를 막는다
    setPrd(null);
    setSpecRoot(null);
    setSpecNodes([]);
    setSpecEdges([]);
    fetchGraph(selected)
      .then((r) => {
        setGraph(r.graph);
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
  }, [source, selected]);

  // docs 프로젝트 선택 시 graph/wireframe/prd(타임라인) 로드 (docs 모드 전용).
  // IA·기능명세서는 docs 입력이 없으므로 비워 두고, 해당 탭은 미지원 안내를 보여준다.
  useEffect(() => {
    if (source !== "docs") return;
    if (!docsProject) {
      // 프로젝트가 없으면 모든 산출물 상태를 비워 빈 상태가 보이게 한다.
      setGraph(null);
      setFlowNodes([]);
      setFlowEdges([]);
      setDangling(0);
      setWireframe(null);
      setTimeline(null);
      setIaRoot(null);
      setIaNodes([]);
      setIaEdges([]);
      setSpecRoot(null);
      setSpecNodes([]);
      setSpecEdges([]);
      return;
    }
    // stale 플래시 방지: 이전 프로젝트의 그래프/와이어가 새 데이터 도착 전 잠깐 남는 것을 막는다.
    setGraph(null);
    setFlowNodes([]);
    setFlowEdges([]);
    setDangling(0);
    setWireframe(null);
    // docs에 없는 산출물(IA/기능명세서) + 직전 타임라인 비우기
    setTimeline(null);
    setPrd(null);
    setIaRoot(null);
    setIaNodes([]);
    setIaEdges([]);
    setSpecRoot(null);
    setSpecNodes([]);
    setSpecEdges([]);
    fetchDocsGraph(docsProject)
      .then((r) => {
        setGraph(r.graph);
        setFlowNodes(toFlowNodes(r.graph, {}));
        setFlowEdges(toFlowEdges(r.graph));
        setDangling(danglingCount(r.graph));
        setStatus("");
      })
      .catch((e: unknown) => setStatus(`상주 그래프 로드 실패: ${String(e)}`));
    fetchDocsWireframe(docsProject)
      .then((r) => setWireframe(r.wireframe))
      .catch((e: unknown) => setStatus(`상주 와이어 로드 실패: ${String(e)}`));
    fetchDocsPrd(docsProject)
      .then((r) => setTimeline(r.timeline))
      .catch((e: unknown) => setStatus(`상주 PRD 로드 실패: ${String(e)}`));
  }, [source, docsProject]);

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

  const onFlowNodesChange = useCallback((changes: NodeChange[]) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const relayout = useCallback(() => {
    if (!graph) return;
    const fresh = autoLayout(graph);
    setFlowNodes((nds) => nds.map((n) => ({ ...n, position: fresh[n.id] ?? n.position })));
    setStatus("자동정렬 적용됨 — '위치 저장'으로 영속화하세요");
  }, [graph]);

  const persist = useCallback(() => {
    if (!selected) return;
    const layout: LayoutOverlay = {};
    for (const n of flowNodes) layout[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
    saveLayout(selected, layout)
      .then(() => setStatus(`위치 저장됨 (${Object.keys(layout).length}개)`))
      .catch((e: unknown) => setStatus(`저장 실패: ${String(e)}`));
  }, [selected, flowNodes]);

  const tabBtn = (key: Tab, label: string) => (
    <button onClick={() => setTab(key)} aria-pressed={tab === key} data-testid={`tab-${key}`}
      style={{ borderColor: tab === key ? "#b6e65a" : undefined }}>{label}</button>
  );

  const sourceBtn = (key: Source, label: string) => (
    <button onClick={() => setSource(key)} aria-pressed={source === key} data-testid={`source-${key}`}
      style={{ borderColor: source === key ? "#b6e65a" : undefined }}>{label}</button>
  );

  // docs 모드에서 IA/기능명세서 탭은 입력이 없어 미지원. flow/wire/prd만 데이터가 있다.
  const docsUnsupported = (
    <div className="docs-unsupported-note">상주 모드에서는 지원되지 않습니다.</div>
  );
  // docs 모드인데 프로젝트가 하나도 없을 때 본문에 띄울 빈 상태.
  const docsNoProjects = source === "docs" && docsProjects.length === 0;
  const docsEmptyBody = (
    <div className="docs-empty-note">상주 문서를 찾을 수 없음</div>
  );

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "10px 16px", borderBottom: "1px solid #2a2e38", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>flowforge</strong>
        <div style={{ display: "flex", gap: 4 }} data-testid="source-toggle">
          {sourceBtn("change", "변경(change)")}
          {sourceBtn("docs", "상주(docs)")}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabBtn("prd", "PRD")}
          {tabBtn("spec", "기능명세서")}
          {tabBtn("flow", "유저플로우")}
          {tabBtn("ia", "IA 트리")}
          {tabBtn("wire", "와이어프레임")}
        </div>
        {source === "change" ? (
          <select value={selected} onChange={(e) => setSelected(e.target.value)} data-testid="change-select">
            {changes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <select value={docsProject} onChange={(e) => setDocsProject(e.target.value)} data-testid="docs-select">
            {docsProjects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        {tab === "flow" && (
          <>
            {source === "change" && (
              <>
                <button onClick={relayout} data-testid="relayout-btn">자동정렬</button>
                <button onClick={persist} data-testid="save-btn">위치 저장</button>
              </>
            )}
            {dangling > 0 && <span style={{ color: "#f0a05a" }}>⚠ dangling {dangling}</span>}
          </>
        )}
        {tab === "ia" && (
          <button onClick={() => setIaVerbose((v) => !v)} data-testid="ia-view-btn">
            {iaVerbose ? "간단히 보기" : "자세히 보기"}
          </button>
        )}
        <span style={{ color: "#9aa0ad", fontSize: 13 }}>{status}</span>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        {docsNoProjects ? (
          docsEmptyBody
        ) : (
          <>
            {tab === "prd" &&
              (source === "docs" ? (
                <DecisionTimeline timeline={timeline ?? { decisions: [] }} />
              ) : prd ? (
                <PrdPanel prd={prd} />
              ) : (
                <div className="prd-loading">PRD 불러오는 중…</div>
              ))}
            {tab === "spec" &&
              (source === "docs" ? (
                docsUnsupported
              ) : (
                <ReactFlow key="spec" nodes={specNodes} edges={specEdges} nodeTypes={nodeTypes} nodesDraggable={false} fitView>
                  <Background />
                  <Controls />
                </ReactFlow>
              ))}
            {tab === "flow" && (
              <ReactFlow key="flow" nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodesChange={onFlowNodesChange} fitView>
                <Background />
                <Controls />
              </ReactFlow>
            )}
            {tab === "ia" &&
              (source === "docs" ? (
                docsUnsupported
              ) : (
                <ReactFlow key="ia" nodes={iaNodes} edges={iaEdges} nodeTypes={nodeTypes} nodesDraggable={false} fitView>
                  <Background />
                  <Controls />
                </ReactFlow>
              ))}
            {tab === "wire" && wireframe && <WireframePanel wireframe={wireframe} />}
          </>
        )}
      </div>
    </div>
  );
}
