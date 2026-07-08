/**
 * 격리 검증 픽스처 — 기능명세 트리 + FeatureDetailPanel을 mock 데이터로 마운트해
 * when/then 저작(planning-when-then-authoring)의 실픽셀·인터랙션 검증.
 * VERIFY 2.2 전용(프로덕션 번들 아님). 실제 서버/프로젝트 파일 무접촉.
 *
 * App.tsx의 features 트리 배선을 충실히 재현한다:
 *   - toFeatureTreeFlow(root) → ReactFlow(nodeTypes={featureTree: FeatureNode})
 *   - onNodeClick → setSelectedFeature(node.data) → <FeatureDetailPanel node={...}>
 * 검증 대상 4케이스: when+then 양쪽 / when만 / then만 / 부재(기존 노드 회귀 0).
 */
import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { ReactFlow, Background, type Node, type NodeTypes } from "@xyflow/react";
import type { FeatureTreeNode } from "@flowforge/shared";
import { toFeatureTreeFlow, type FeatureNodeData } from "../src/featureTreeAdapter.js";
import { FeatureNode } from "../src/FeatureNode.js";
import { FeatureDetailPanel } from "../src/FeatureDetailPanel.js";
import "@xyflow/react/dist/style.css";
import "../src/styles.css";

const nodeTypes: NodeTypes = { featureTree: FeatureNode };

// 서버 featureTreeBuilder가 만드는 형태의 트리(가상 루트 children=요구사항).
// when/then은 저작된 노드에만 필드가 실린다(비파괴 옵셔널 — freeze와 동일한 형태).
const ROOT: FeatureTreeNode = {
  id: "feat-root",
  kind: "requirement",
  label: "root",
  capability: "",
  priority: "",
  status: "",
  children: [
    {
      id: "req-view",
      kind: "requirement",
      label: "기획 기능명세 뷰",
      capability: "planning-features-view",
      priority: "높음",
      status: "진행중",
      children: [
        {
          id: "feat-render",
          kind: "feature",
          label: "기능명세 트리 렌더",
          capability: "",
          priority: "높음",
          status: "진행중",
          children: [
            {
              // 케이스 1: when+then 양쪽 저작 → ⚡ 시나리오 섹션에 WHEN·THEN 둘 다.
              id: "det-both",
              kind: "detail",
              label: "planning-features 라우트 조회",
              capability: "",
              priority: "높음",
              status: "완료",
              when: "기획 탭 클릭",
              then: "그 프로젝트 openspec에서 5종 뷰 로드",
              children: [],
            },
            {
              // 케이스 2: when만 → WHEN 행만 렌더.
              id: "det-when-only",
              kind: "detail",
              label: "when만 저작된 상세기능",
              capability: "",
              priority: "중간",
              status: "진행중",
              when: "검색어 입력",
              children: [],
            },
            {
              // 케이스 3: then만 → THEN 행만 렌더.
              id: "det-then-only",
              kind: "detail",
              label: "then만 저작된 상세기능",
              capability: "",
              priority: "낮음",
              status: "시작전",
              then: "결과 목록 갱신",
              children: [],
            },
            {
              // 케이스 4: 부재 → ⚡ 시나리오 섹션 자체가 없어야 한다(기존 노드 회귀 0).
              id: "det-none",
              kind: "detail",
              label: "when/then 없는 기존 상세기능",
              capability: "",
              priority: "중간",
              status: "완료",
              memo: "메모만 있는 기존 노드",
              children: [],
            },
          ],
        },
      ],
    },
  ],
};

function Fixture(): JSX.Element {
  const { nodes, edges } = toFeatureTreeFlow(ROOT);
  const [selected, setSelected] = useState<FeatureNodeData | null>(null);

  const onNodeClick = useCallback((_e: React.MouseEvent, node: Node): void => {
    if (node.type !== "featureTree") return;
    setSelected(node.data as FeatureNodeData);
  }, []);

  const selectById = useCallback(
    (id: string): void => {
      const found = nodes.find((n) => n.id === id);
      if (found) setSelected(found.data as FeatureNodeData);
    },
    [nodes],
  );

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#0d1117" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        onNodeClick={onNodeClick}
        fitView
      >
        <Background />
      </ReactFlow>
      <FeatureDetailPanel node={selected} onClose={() => setSelected(null)} onSelectById={selectById} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
