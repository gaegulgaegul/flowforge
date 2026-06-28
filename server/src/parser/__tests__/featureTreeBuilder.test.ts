/**
 * featureTreeBuilder 단위 테스트 — docs/planning/features.md → FeatureTree(3단 트리).
 * 임시 DOCS 디렉토리에 픽스처를 만들어 파싱 결과를 검증한다(읽기전용).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocsPlanningFeatures } from "../featureTreeBuilder.js";

/** <root>/docs/planning/features.md 픽스처를 만들고 docsDir(<root>/docs)를 반환. */
function makeFeatures(content: string): { docsDir: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "feat-"));
  const planningDir = join(root, "docs", "planning");
  mkdirSync(planningDir, { recursive: true });
  writeFileSync(join(planningDir, "features.md"), content);
  return { docsDir: join(root, "docs"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const FEATURES = [
  "# 기능명세서",
  "",
  "## 사진 업로드",
  "<!-- capability: photo-upload -->",
  "(중요도: 높음, 상태: 진행중)",
  "",
  "### 단일 업로드",
  "(중요도: 중간, 상태: 시작전)",
  "",
  "#### 파일 선택",
  "(중요도: 낮음, 상태: 시작전)",
  "",
  "#### 업로드 진행률 표시",
  "",
  "### 다중 업로드",
  "(중요도: 높음, 상태: 시작전)",
  "",
  "## 앨범 관리",
  "<!-- capability: album -->",
  "(중요도: 중간, 상태: 완료)",
  "",
  "### 앨범 생성",
].join("\n");

describe("featureTreeBuilder", () => {
  it("features.md를 3단 트리(요구사항→기능→상세기능)로 파싱한다", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir);
      expect(tree).not.toBeNull();
      const reqs = tree!.root.children;
      // 요구사항 2개
      expect(reqs.map((r) => r.label)).toEqual(["사진 업로드", "앨범 관리"]);
      expect(reqs.every((r) => r.kind === "requirement")).toBe(true);
      // 첫 요구사항의 기능 2개
      const upload = reqs[0]!;
      expect(upload.children.map((f) => f.label)).toEqual(["단일 업로드", "다중 업로드"]);
      expect(upload.children.every((f) => f.kind === "feature")).toBe(true);
      // 첫 기능의 상세기능 2개
      const single = upload.children[0]!;
      expect(single.children.map((d) => d.label)).toEqual(["파일 선택", "업로드 진행률 표시"]);
      expect(single.children.every((d) => d.kind === "detail")).toBe(true);
    } finally {
      cleanup();
    }
  });

  it("요구사항 노드에 capability 키를 파싱한다(기능/상세기능은 빈 문자열)", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const reqs = tree.root.children;
      expect(reqs[0]!.capability).toBe("photo-upload");
      expect(reqs[1]!.capability).toBe("album");
      // 기능·상세기능은 capability 없음
      expect(reqs[0]!.children[0]!.capability).toBe("");
      expect(reqs[0]!.children[0]!.children[0]!.capability).toBe("");
    } finally {
      cleanup();
    }
  });

  it("노드 속성(중요도·상태)을 파싱한다", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const upload = tree.root.children[0]!;
      expect(upload.priority).toBe("높음");
      expect(upload.status).toBe("진행중");
      const single = upload.children[0]!;
      expect(single.priority).toBe("중간");
      expect(single.status).toBe("시작전");
    } finally {
      cleanup();
    }
  });

  it("속성 표기가 없는 노드는 priority/status가 빈 문자열", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      // "업로드 진행률 표시"는 속성 줄 없음
      const detail = tree.root.children[0]!.children[0]!.children[1]!;
      expect(detail.label).toBe("업로드 진행률 표시");
      expect(detail.priority).toBe("");
      expect(detail.status).toBe("");
    } finally {
      cleanup();
    }
  });

  it("노드마다 안정적인 고유 id를 부여한다", () => {
    const { docsDir, cleanup } = makeFeatures(FEATURES);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const ids: string[] = [];
      const walk = (n: { id: string; children: readonly { id: string; children: readonly unknown[] }[] }) => {
        ids.push(n.id);
        n.children.forEach((c) => walk(c as never));
      };
      walk(tree.root as never);
      // 모든 id 고유
      expect(new Set(ids).size).toBe(ids.length);
    } finally {
      cleanup();
    }
  });

  it("본문 산문 중간의 (중요도:…, 상태:…) 패턴은 속성으로 오매칭하지 않는다", () => {
    const md = [
      "# 기능명세서",
      "## 결제",
      "<!-- capability: payment -->",
      "이 기능은 (중요도: 높음, 상태: 진행중) 수준의 본문 산문이다.",
    ].join("\n");
    const { docsDir, cleanup } = makeFeatures(md);
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      const req = tree.root.children[0]!;
      // 속성 줄이 아닌 본문에 들어간 패턴 → priority/status는 빈 문자열이어야 한다.
      expect(req.priority).toBe("");
      expect(req.status).toBe("");
      // capability 주석은 줄 단독이므로 정상 파싱.
      expect(req.capability).toBe("payment");
    } finally {
      cleanup();
    }
  });

  it("features.md가 없으면 null", () => {
    const root = mkdtempSync(join(tmpdir(), "feat-none-"));
    try {
      mkdirSync(join(root, "docs"), { recursive: true });
      expect(buildDocsPlanningFeatures(join(root, "docs"))).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("요구사항이 없는(빈) features.md는 빈 children 루트", () => {
    const { docsDir, cleanup } = makeFeatures("# 기능명세서\n\n초안.");
    try {
      const tree = buildDocsPlanningFeatures(docsDir)!;
      expect(tree.root.children).toEqual([]);
    } finally {
      cleanup();
    }
  });
});
