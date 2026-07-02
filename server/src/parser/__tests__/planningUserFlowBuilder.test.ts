/**
 * planningUserFlowBuilder 단위 테스트 — user-flow/<group>-vN.md의 Mermaid flowchart → SpecGraph.
 * mermaid 라이브러리 없이 flowchart 노드/엣지를 정규식 파싱한다(읽기전용).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocsPlanningUserFlow } from "../planningUserFlowBuilder.js";

/** <root>/docs/planning/user-flow/<stem>.md 픽스처. docsDir(<root>/docs) 반환. */
function makeFlow(stem: string, content: string): { docsDir: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "uflow-"));
  const dir = join(root, "docs", "planning", "user-flow");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${stem}.md`), content);
  return { docsDir: join(root, "docs"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const FLOW = [
  "# 유저 플로우",
  "",
  "```mermaid",
  "flowchart TD",
  '  A(["앱 시작"]) --> B["로그인"]',
  '  B --> C{"인증 확인"}',
  '  C -->|성공| D["홈"]',
  '  C -->|실패| B',
  "```",
].join("\n");

describe("planningUserFlowBuilder", () => {
  it("Mermaid flowchart를 SpecGraph(노드+엣지)로 파싱한다", () => {
    const { docsDir, cleanup } = makeFlow("main-v1", FLOW);
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v1");
      expect(graph).not.toBeNull();
      // 노드 4개(A,B,C,D)
      expect(graph!.nodes).toHaveLength(4);
      const labels = graph!.nodes.map((n) => n.label).sort();
      expect(labels).toEqual(["로그인", "앱 시작", "인증 확인", "홈"]);
    } finally {
      cleanup();
    }
  });

  it("노드 모양을 kind로 매핑한다 (stadium=start, box=screen, diamond=action)", () => {
    const { docsDir, cleanup } = makeFlow("main-v1", FLOW);
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v1")!;
      const byLabel = Object.fromEntries(graph.nodes.map((n) => [n.label, n.kind]));
      expect(byLabel["앱 시작"]).toBe("start"); // (["..."])
      expect(byLabel["로그인"]).toBe("screen"); // ["..."]
      expect(byLabel["인증 확인"]).toBe("action"); // {"..."}
      expect(byLabel["홈"]).toBe("screen");
    } finally {
      cleanup();
    }
  });

  it("엣지를 source/target으로 변환하고 |라벨|을 보존한다", () => {
    const { docsDir, cleanup } = makeFlow("main-v1", FLOW);
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v1")!;
      // A-->B, B-->C, C-->D(성공), C-->B(실패) = 4 엣지
      expect(graph.edges).toHaveLength(4);
      // 모든 엣지 target이 실제 노드 id(명시적 Mermaid라 dangling 없음)
      const ids = new Set(graph.nodes.map((n) => n.id));
      expect(graph.edges.every((e) => e.target !== null && ids.has(e.target))).toBe(true);
      expect(graph.edges.every((e) => e.dangling === false)).toBe(true);
      // 라벨 보존
      const labeled = graph.edges.filter((e) => e.label === "성공" || e.label === "실패");
      expect(labeled).toHaveLength(2);
    } finally {
      cleanup();
    }
  });

  it("점선 엣지(-.->)를 kind:'edgecase'로, 실선(-->)을 kind:'happy'로 파싱한다", () => {
    // main-v2 형태: 실선 happy path + 점선 에지케이스 분기(spec safe-4xx 등).
    const md = [
      "```mermaid",
      "flowchart TD",
      '  Skeleton["기획 뷰"] --> HasDocs{"산출물 있나"}',
      '  HasDocs -->|유저플로우| Flow["유저플로우 그래프"]',
      '  Skeleton -.->|로드 실패| LoadErr["로드 에러 안내"]',
      '  Flow -.->|저장 실패| SaveErr["저장 실패 재시도"]',
      "```",
    ].join("\n");
    const { docsDir, cleanup } = makeFlow("main-v2", md);
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v2")!;
      // 점선 엣지 2개(LoadErr, SaveErr)가 파싱돼 노드가 고아가 아니게 됨.
      const byTargetLabel = (label: string) =>
        graph.edges.find((e) => {
          const target = graph.nodes.find((n) => n.id === e.target);
          return target?.label === label;
        });
      const loadErr = byTargetLabel("로드 에러 안내");
      const saveErr = byTargetLabel("저장 실패 재시도");
      expect(loadErr).toBeDefined();
      expect(loadErr!.kind).toBe("edgecase");
      expect(saveErr).toBeDefined();
      expect(saveErr!.kind).toBe("edgecase");
      // 실선 엣지는 edgecase가 아니어야(회귀 없음).
      const flowEdge = byTargetLabel("유저플로우 그래프");
      expect(flowEdge).toBeDefined();
      expect(flowEdge!.kind).not.toBe("edgecase");
      expect(flowEdge!.kind).toBe("happy");
      // 에러 노드가 실제로 엣지 target으로 연결됨(고아 아님).
      const ids = new Set(graph.nodes.map((n) => n.id));
      expect(graph.edges.every((e) => e.target !== null && ids.has(e.target))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("미지원 라인(subgraph/%%주석/스타일)은 throw 없이 무시한다", () => {
    const md = [
      "```mermaid",
      "flowchart LR",
      "  %% 주석 라인",
      '  X["화면"] --> Y["다음"]',
      "  classDef foo fill:#fff",
      "  subgraph 그룹",
      "  end",
      "```",
    ].join("\n");
    const { docsDir, cleanup } = makeFlow("main-v1", md);
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v1")!;
      expect(graph.nodes.map((n) => n.label).sort()).toEqual(["다음", "화면"]);
      expect(graph.edges).toHaveLength(1);
    } finally {
      cleanup();
    }
  });

  it("노드마다 고유 id를 부여한다", () => {
    const { docsDir, cleanup } = makeFlow("main-v1", FLOW);
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v1")!;
      const ids = graph.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      cleanup();
    }
  });

  it("파일이 없으면 null", () => {
    const { docsDir, cleanup } = makeFlow("main-v1", FLOW);
    try {
      expect(buildDocsPlanningUserFlow(docsDir, "nope-v9")).toBeNull();
    } finally {
      cleanup();
    }
  });

  it("mermaid 코드블록이 없으면 빈 그래프", () => {
    const { docsDir, cleanup } = makeFlow("main-v1", "# 유저 플로우\n\n초안만 있음.");
    try {
      const graph = buildDocsPlanningUserFlow(docsDir, "main-v1")!;
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    } finally {
      cleanup();
    }
  });
});
