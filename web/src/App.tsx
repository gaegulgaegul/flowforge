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
import type { LayoutOverlay, SpecGraph, IANode as IANodeT } from "@flowforge/shared";
import { fetchChanges, fetchGraph, fetchIA, saveLayout } from "./api.js";
import { toFlowNodes, toFlowEdges, danglingCount, autoLayout } from "./graphAdapter.js";
import { toIAFlow } from "./iaAdapter.js";
import { SpecNode } from "./SpecNode.js";
import { IANode } from "./IANode.js";

// 커스텀 노드 타입 매핑 — 컴포넌트 밖 상수로 두어 재마운트 방지
const nodeTypes: NodeTypes = { spec: SpecNode, ia: IANode };

type Tab = "flow" | "ia";

export function App(): JSX.Element {
  const [changes, setChanges] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
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

  useEffect(() => {
    fetchChanges()
      .then((cs) => {
        setChanges(cs);
        if (cs.length > 0) setSelected(cs[0]!);
      })
      .catch((e: unknown) => setStatus(`목록 로드 실패: ${String(e)}`));
  }, []);

  // change 선택 시 유저플로우 로드
  useEffect(() => {
    if (!selected) return;
    fetchGraph(selected)
      .then((r) => {
        setGraph(r.graph);
        setFlowNodes(toFlowNodes(r.graph, r.layout));
        setFlowEdges(toFlowEdges(r.graph));
        setDangling(danglingCount(r.graph));
        setStatus("");
      })
      .catch((e: unknown) => setStatus(`그래프 로드 실패: ${String(e)}`));
  }, [selected]);

  // change 선택 시 IA 트리 로드
  useEffect(() => {
    if (!selected) return;
    fetchIA(selected)
      .then((r) => setIaRoot(r.tree))
      .catch((e: unknown) => setStatus(`IA 로드 실패: ${String(e)}`));
  }, [selected]);

  // IA 트리/뷰모드 바뀌면 레이아웃 재계산
  useEffect(() => {
    if (!iaRoot) return;
    const { nodes, edges } = toIAFlow(iaRoot, iaVerbose);
    setIaNodes(nodes);
    setIaEdges(edges);
  }, [iaRoot, iaVerbose]);

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

  const isFlow = tab === "flow";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "10px 16px", borderBottom: "1px solid #2a2e38", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <strong>flowforge</strong>
        {/* 탭 토글: 유저플로우 / IA 트리 */}
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setTab("flow")} aria-pressed={isFlow} data-testid="tab-flow"
            style={{ borderColor: isFlow ? "#b6e65a" : undefined }}>유저플로우</button>
          <button onClick={() => setTab("ia")} aria-pressed={!isFlow} data-testid="tab-ia"
            style={{ borderColor: !isFlow ? "#b6e65a" : undefined }}>IA 트리</button>
        </div>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} data-testid="change-select">
          {changes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isFlow ? (
          <>
            <button onClick={relayout} data-testid="relayout-btn">자동정렬</button>
            <button onClick={persist} data-testid="save-btn">위치 저장</button>
            {dangling > 0 && <span style={{ color: "#f0a05a" }}>⚠ dangling {dangling}</span>}
          </>
        ) : (
          <button onClick={() => setIaVerbose((v) => !v)} data-testid="ia-view-btn">
            {iaVerbose ? "간단히 보기" : "자세히 보기"}
          </button>
        )}
        <span style={{ color: "#9aa0ad", fontSize: 13 }}>{status}</span>
      </header>
      <div style={{ flex: 1 }}>
        {isFlow ? (
          <ReactFlow key="flow" nodes={flowNodes} edges={flowEdges} nodeTypes={nodeTypes} onNodesChange={onFlowNodesChange} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        ) : (
          <ReactFlow key="ia" nodes={iaNodes} edges={iaEdges} nodeTypes={nodeTypes} nodesDraggable={false} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        )}
      </div>
    </div>
  );
}
