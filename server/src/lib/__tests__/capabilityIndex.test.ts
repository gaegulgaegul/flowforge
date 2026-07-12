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
  parseFeatureCapabilities,
  buildCapabilityIndex,
  buildCapabilityDetail,
  attachLinkedChanges,
} from "../capabilityIndex.js";
import type { FeatureTree } from "@flowforge/shared";

/** openspec/changes/<change>/specs/<cap>/spec.md 픽스처. */
function makeChange(changesRoot: string, change: string, caps: string[]): void {
  for (const cap of caps) {
    const dir = join(changesRoot, change, "specs", cap);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "spec.md"), `## capability: ${cap}\n`);
  }
}

/** openspec/changes/archive/<dated-change>/specs/<cap>/spec.md 픽스처(archive 완화 검증용). */
function makeArchiveChange(changesRoot: string, datedChange: string, caps: string[]): void {
  for (const cap of caps) {
    const dir = join(changesRoot, "archive", datedChange, "specs", cap);
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

describe("parseFeatureCapabilities — features.md 측 capability 키 집합 (D1 조인 원천)", () => {
  it("features.md의 `<!-- capability: K -->` 키를 모두 뽑는다(featureTreeBuilder RE_CAPABILITY 동형)", () => {
    const md = [
      "## 요구사항A <!-- capability: planning-features-view -->",
      "### 기능",
      "## 요구사항B",
      "<!-- capability: planning-prd-view -->",
    ].join("\n");
    const set = parseFeatureCapabilities(md);
    expect(set.has("planning-features-view")).toBe(true);
    expect(set.has("planning-prd-view")).toBe(true);
    expect(set.size).toBe(2);
  });

  it("charter 문법(`## capability: K`)은 뽑지 않는다(주석 마커만, 원천 분리)", () => {
    // features 파서는 HTML 주석 마커만 본다 — charter의 `## capability:` 헤더에 오매칭하면 안 됨.
    const md = "## capability: charter-only-key\n일반 본문 텍스트\n";
    const set = parseFeatureCapabilities(md);
    expect(set.has("charter-only-key")).toBe(false);
    expect(set.size).toBe(0);
  });

  it("빈 문자열/파일없음 대체 입력이면 빈 Set(비파괴 폴백)", () => {
    expect(parseFeatureCapabilities("").size).toBe(0);
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

  // D2: archive 완화 — archive/ 하위 dated change도 스캔에 포함(활성 전용이던 것을 완화).
  it("(D2) archive/ 하위 dated change도 byCapability에 포함한다", () => {
    const caps = new Set(["planning-features-view"]);
    makeArchiveChange(root, "2026-06-28-planning-features-generation", ["planning-features-view"]);
    const idx = buildCapabilityIndex(caps, root);
    expect(idx.byCapability.get("planning-features-view")).toEqual([
      "2026-06-28-planning-features-generation",
    ]);
  });

  it("(D2) archive change 링크에 archived=true 플래그가 붙는다(활성 구분)", () => {
    const caps = new Set(["cap-a"]);
    makeArchiveChange(root, "2026-01-01-old-change", ["cap-a"]);
    const idx = buildCapabilityIndex(caps, root);
    const link = idx.links.find((l) => l.changeKey === "2026-01-01-old-change");
    expect(link?.linked).toBe(true);
    expect(link?.archived).toBe(true);
  });

  it("(D2) 활성 change 링크는 archived가 참이 아니다(archive 완화가 활성을 오염 안 함)", () => {
    const caps = new Set(["cap-a"]);
    makeChange(root, "active-change", ["cap-a"]);
    const idx = buildCapabilityIndex(caps, root);
    const link = idx.links.find((l) => l.changeKey === "active-change");
    expect(link?.archived).toBeFalsy();
  });

  it("(D2) 활성+archive가 같은 capability를 구현하면 둘 다 병합해 담는다", () => {
    const caps = new Set(["cap-a"]);
    makeChange(root, "active-a", ["cap-a"]);
    makeArchiveChange(root, "2026-01-01-archived-a", ["cap-a"]);
    const idx = buildCapabilityIndex(caps, root);
    expect(idx.byCapability.get("cap-a")).toEqual(
      expect.arrayContaining(["active-a", "2026-01-01-archived-a"]),
    );
    expect(idx.byCapability.get("cap-a")).toHaveLength(2);
  });

  it("(D2) archive 미매칭 change도 unlinked로 표면화(silent drop 금지, 활성과 동일 규칙)", () => {
    const caps = new Set(["cap-a"]);
    makeArchiveChange(root, "2026-01-01-orphan", ["nonexistent-cap"]);
    const idx = buildCapabilityIndex(caps, root);
    expect(idx.unlinked).toContainEqual({
      changeKey: "2026-01-01-orphan",
      capabilityKey: "nonexistent-cap",
    });
  });
});

/** FeatureTree 픽스처: 가상 루트 아래 요구사항 노드들(각자 capability 키). */
function makeFeatureTree(reqs: { label: string; capability: string }[]): FeatureTree {
  return {
    root: {
      id: "feat-root",
      kind: "requirement",
      label: "root",
      capability: "",
      priority: "",
      status: "",
      children: reqs.map((r, i) => ({
        id: `feat-root__r-${i}`,
        kind: "requirement" as const,
        label: r.label,
        capability: r.capability,
        priority: "" as const,
        status: "" as const,
        children: [
          {
            id: `feat-root__r-${i}__f-0`,
            kind: "feature" as const,
            label: `${r.label}-기능`,
            capability: "",
            priority: "" as const,
            status: "" as const,
            children: [],
          },
        ],
      })),
    },
  };
}

describe("buildCapabilityDetail — capability 단위 종합 집계", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "capdetail-"));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("(a) features는 일치 capability 요구사항 가지만 포함한다(다른 capability 제외)", () => {
    const charter = new Set(["payment", "shipping"]);
    const idx = buildCapabilityIndex(charter, root);
    const ft = makeFeatureTree([
      { label: "결제", capability: "payment" },
      { label: "배송", capability: "shipping" },
    ]);
    const detail = buildCapabilityDetail("payment", idx, ft, []);
    expect(detail.features).not.toBeNull();
    const reqs = detail.features!.root.children;
    expect(reqs).toHaveLength(1);
    expect(reqs[0]?.label).toBe("결제");
    expect(reqs[0]?.capability).toBe("payment");
    // 하위 가지(기능)는 보존된다.
    expect(reqs[0]?.children).toHaveLength(1);
  });

  it("(b) 유저플로우는 `> capability:` 마커가 그 키를 선언한 stem만 연결한다", () => {
    const idx = buildCapabilityIndex(new Set(["payment"]), root);
    const flows = [
      { stem: "checkout-v1", caps: ["payment"] },
      { stem: "browse-v1", caps: ["catalog"] },
      { stem: "multi-v1", caps: ["catalog", "payment"] },
    ];
    const detail = buildCapabilityDetail("payment", idx, null, flows);
    expect(detail.userFlows).toEqual(["checkout-v1", "multi-v1"]);
  });

  it("(c) changes는 역방향 인덱스 byCapability와 동일하다(재구현 없음)", () => {
    const charter = new Set(["payment"]);
    makeChange(root, "add-payment", ["payment"]);
    makeChange(root, "refactor-payment", ["payment"]);
    const idx = buildCapabilityIndex(charter, root);
    const detail = buildCapabilityDetail("payment", idx, null, []);
    expect(detail.changes.sort()).toEqual(idx.byCapability.get("payment")!.sort());
    expect(detail.changes).toEqual(expect.arrayContaining(["add-payment", "refactor-payment"]));
  });

  it("(d) 연결 0개여도 빈 구조를 반환한다(throw·null 응답 아님)", () => {
    const idx = buildCapabilityIndex(new Set(["lonely"]), root);
    const detail = buildCapabilityDetail("lonely", idx, null, []);
    expect(detail.features).toBeNull();
    expect(detail.userFlows).toEqual([]);
    expect(detail.changes).toEqual([]);
  });

  it("features가 null(파일 없음)이면 features=null로 안전 통과", () => {
    const idx = buildCapabilityIndex(new Set(["x"]), root);
    const detail = buildCapabilityDetail("x", idx, null, [{ stem: "f-v1", caps: ["x"] }]);
    expect(detail.features).toBeNull();
    expect(detail.userFlows).toEqual(["f-v1"]);
  });
});

describe("attachLinkedChanges — 요구사항 노드에 연관 change(linkedChanges) 부여", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "attach-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("(a) capability에 연관 change가 있으면 요구사항 노드에 linkedChanges를 붙인다", () => {
    makeChange(root, "ch1", ["cap-a"]);
    makeChange(root, "ch2", ["cap-a"]);
    const idx = buildCapabilityIndex(new Set(["cap-a"]), root);
    const tree = makeFeatureTree([{ label: "요구A", capability: "cap-a" }]);
    const linked = attachLinkedChanges(tree, idx);
    const reqNode = linked?.root.children[0];
    expect(reqNode?.linkedChanges).toEqual(["ch1", "ch2"]);
  });

  it("(b) 연관 change가 0개면 linkedChanges 필드를 붙이지 않는다(비파괴 옵셔널)", () => {
    const idx = buildCapabilityIndex(new Set(["cap-lonely"]), root); // change 없음
    const tree = makeFeatureTree([{ label: "요구B", capability: "cap-lonely" }]);
    const linked = attachLinkedChanges(tree, idx);
    const reqNode = linked?.root.children[0];
    expect(reqNode?.linkedChanges).toBeUndefined();
  });

  it("(c) capability 없는 노드(기능/상세기능·빈 capability)에는 부여하지 않는다", () => {
    makeChange(root, "ch1", ["cap-a"]);
    const idx = buildCapabilityIndex(new Set(["cap-a"]), root);
    const tree = makeFeatureTree([{ label: "요구A", capability: "cap-a" }]);
    const linked = attachLinkedChanges(tree, idx);
    const reqNode = linked?.root.children[0];
    const featureNode = reqNode?.children[0]; // makeFeatureTree가 만든 하위 기능 노드
    expect(featureNode?.kind).toBe("feature");
    expect(featureNode?.linkedChanges).toBeUndefined();
    // 가상 루트(capability="")에도 안 붙음
    expect(linked?.root.linkedChanges).toBeUndefined();
  });

  it("null 트리는 null로 안전 통과(throw 없음)", () => {
    const idx = buildCapabilityIndex(new Set(["cap-a"]), root);
    expect(attachLinkedChanges(null, idx)).toBeNull();
  });
});
