/**
 * capabilityIndex 단위 테스트 (task 2.2 RED → 3.2 GREEN).
 *
 * charter의 `## capability: <키>`(docs/spec.md) 집합과 change 측
 * `specs/<디렉토리명>/`을 **글자단위 정확 비교**로 연결한다.
 * - (a) 디렉토리명 == capability 키 → 연결(linked=true)
 * - (b) 유사하지만 다른 이름 → 비연결(거짓연결 0)
 * - (c) 미연결 change는 "미연결"로 분류(silent drop 금지)
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseCharterCapabilities,
  buildCapabilityIndex,
} from "../capabilityIndex.js";

/** openspec/changes/<change>/specs/<cap>/spec.md 픽스처. */
function makeChange(changesRoot: string, change: string, caps: string[]): void {
  for (const cap of caps) {
    const dir = join(changesRoot, change, "specs", cap);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.md"), `## capability: ${cap}\n`);
  }
}

describe("parseCharterCapabilities — charter 측 capability 키 집합", () => {
  it("docs/spec.md의 `## capability:` 키를 모두 뽑는다(병기는 키만)", () => {
    const md = "## capability: project-card-grid — 프로젝트 카드 그리드\n## capability: korean-display-labels\n";
    const set = parseCharterCapabilities(md);
    expect(set.has("project-card-grid")).toBe(true);
    expect(set.has("korean-display-labels")).toBe(true);
    expect(set.size).toBe(2);
  });
});

describe("buildCapabilityIndex — specs 디렉토리명 ↔ capability 키 연결", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "capidx-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("(a) 디렉토리명과 capability 키가 글자단위 일치하면 연결한다", () => {
    const charter = new Set(["project-card-grid", "korean-display-labels"]);
    makeChange(root, "hierarchical-project-dashboard", ["project-card-grid"]);
    const idx = buildCapabilityIndex(charter, root);
    expect(idx.byCapability.get("project-card-grid")).toEqual(["hierarchical-project-dashboard"]);
    const link = idx.links.find((l) => l.changeKey === "hierarchical-project-dashboard");
    expect(link?.linked).toBe(true);
  });

  it("(b) 유사하지만 다른 이름은 연결하지 않는다(거짓연결 0)", () => {
    const charter = new Set(["project-card-grid"]);
    // 'project_card_grid'(underscore)·'project-card-grids'(복수)는 글자 다름 → 비연결.
    makeChange(root, "ch1", ["project_card_grid"]);
    makeChange(root, "ch2", ["project-card-grids"]);
    const idx = buildCapabilityIndex(charter, root);
    expect(idx.byCapability.get("project-card-grid") ?? []).toEqual([]);
    expect(idx.links.every((l) => l.linked === false)).toBe(true);
  });

  it("(c) 미연결 change는 unlinked로 분류하고 절대 누락시키지 않는다", () => {
    const charter = new Set(["project-card-grid"]);
    makeChange(root, "linked-change", ["project-card-grid"]);
    makeChange(root, "orphan-change", ["nonexistent-cap"]);
    const idx = buildCapabilityIndex(charter, root);
    expect(idx.unlinked).toContainEqual({ changeKey: "orphan-change", capabilityKey: "nonexistent-cap" });
    // 모든 change가 links에 반드시 1줄 이상 존재(누락 0).
    const changeKeys = new Set(idx.links.map((l) => l.changeKey));
    expect(changeKeys.has("linked-change")).toBe(true);
    expect(changeKeys.has("orphan-change")).toBe(true);
  });

  it("한 change가 여러 capability에 걸리면 각각 연결한다", () => {
    const charter = new Set(["cap-a", "cap-b"]);
    makeChange(root, "multi", ["cap-a", "cap-b"]);
    const idx = buildCapabilityIndex(charter, root);
    expect(idx.byCapability.get("cap-a")).toContain("multi");
    expect(idx.byCapability.get("cap-b")).toContain("multi");
  });
});
