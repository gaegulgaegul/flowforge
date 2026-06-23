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
import type { LayoutOverlay, SpecGraph } from "@flowforge/shared";
import { fetchChanges, fetchGraph, saveLayout } from "./api.js";
import { toFlowNodes, toFlowEdges, danglingCount, autoLayout } from "./graphAdapter.js";
import { SpecNode } from "./SpecNode.js";

// 커스텀 노드 타입 매핑 — 컴포넌트 밖 상수로 두어 재마운트 방지
const nodeTypes: NodeTypes = { spec: SpecNode };

export function App(): JSX.Element {
  const [changes, setChanges] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [graph, setGraph] = useState<SpecGraph | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [dangling, setDangling] = useState(0);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchChanges()
      .then((cs) => {
        setChanges(cs);
        if (cs.length > 0) setSelected(cs[0]!);
      })
      .catch((e: unknown) => setStatus(`목록 로드 실패: ${String(e)}`));
  }, []);

  useEffect(() => {
    if (!selected) return;
    fetchGraph(selected)
      .then((r) => {
        setGraph(r.graph);
        setNodes(toFlowNodes(r.graph, r.layout));
        setEdges(toFlowEdges(r.graph));
        setDangling(danglingCount(r.graph));
        setStatus("");
      })
      .catch((e: unknown) => setStatus(`그래프 로드 실패: ${String(e)}`));
  }, [selected]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // dagre 자동정렬 다시 적용 — 저장된 오버레이 무시하고 위계 배치로 리셋
  const relayout = useCallback(() => {
    if (!graph) return;
    const fresh = autoLayout(graph);
    setNodes((nds) => nds.map((n) => ({ ...n, position: fresh[n.id] ?? n.position })));
    setStatus("자동정렬 적용됨 — '위치 저장'으로 영속화하세요");
  }, [graph]);

  const persist = useCallback(() => {
    if (!selected) return;
    const layout: LayoutOverlay = {};
    for (const n of nodes) layout[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y) };
    saveLayout(selected, layout)
      .then(() => setStatus(`위치 저장됨 (${Object.keys(layout).length}개)`))
      .catch((e: unknown) => setStatus(`저장 실패: ${String(e)}`));
  }, [selected, nodes]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "10px 16px", borderBottom: "1px solid #2a2e38", display: "flex", gap: 12, alignItems: "center" }}>
        <strong>flowforge · 유저플로우</strong>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} data-testid="change-select">
          {changes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={relayout} data-testid="relayout-btn">자동정렬</button>
        <button onClick={persist} data-testid="save-btn">위치 저장</button>
        {dangling > 0 && <span style={{ color: "#f0a05a" }}>⚠ dangling {dangling}</span>}
        <span style={{ color: "#9aa0ad", fontSize: 13 }}>{status}</span>
      </header>
      <div style={{ flex: 1 }}>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
