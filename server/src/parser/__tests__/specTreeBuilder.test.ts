/**
 * specTreeBuilder.buildSpecTree 단위 테스트 — change(specs/) → 요구사항→기능→상세기능 3단 트리.
 * 실제 wowa change에 의존하지 않고, 임시 디렉토리에 자체 spec.md 픽스처를 써서 검증한다.
 * 핵심: Scenario를 count가 아니라 detail 노드로 펼치고 WHEN/THEN을 노출함을 본다.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpecTreeNode } from "@flowforge/shared";
import { buildSpecTree } from "../specTreeBuilder.js";

/** 임시 change 디렉토리 생성 + capability별 specs/<cap>/spec.md 작성. */
function makeChangeDir(specs: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-tree-builder-"));
  for (const [cap, body] of Object.entries(specs)) {
    const capDir = join(dir, "specs", cap);
    mkdirSync(capDir, { recursive: true });
    writeFileSync(join(capDir, "spec.md"), body);
  }
  return dir;
}

const SPEC_AUTH = [
  "## ADDED Requirements",
  "",
  "### Requirement: 회원 가입",
  "이메일로 계정을 만든다.",
  "",
  "#### Scenario: 이메일로 가입",
  "- **WHEN** 사용자가 이메일을 입력한다",
  "- **THEN** 계정이 생성된다",
  "",
  "#### Scenario: 중복 이메일",
  "- **WHEN** 이미 있는 이메일을 입력한다",
  "- **THEN** 오류를 표시한다",
].join("\n");

const SPEC_EMPTY_REQ = [
  "## ADDED Requirements",
  "",
  "### Requirement: 빈 요구사항",
  "시나리오가 아직 없다.",
].join("\n");

/** kind로 첫 자식을 찾는 헬퍼(없으면 테스트가 명확히 실패하도록 undefined 반환). */
function childByKind(
  node: SpecTreeNode,
  kind: SpecTreeNode["kind"],
): SpecTreeNode | undefined {
  return node.children.find((c) => c.kind === kind);
}

describe("buildSpecTree", () => {
  it("change→requirement→feature→detail 3단 위계를 만든다", () => {
    const dir = makeChangeDir({ auth: SPEC_AUTH });
    try {
      const { root } = buildSpecTree(dir);
      expect(root.kind).toBe("change");

      const requirement = childByKind(root, "requirement");
      expect(requirement).toBeDefined();
      expect(requirement!.label).toBe("auth");

      const feature = childByKind(requirement!, "feature");
      expect(feature).toBeDefined();
      expect(feature!.label).toBe("회원 가입");

      const detail = childByKind(feature!, "detail");
      expect(detail).toBeDefined();
      expect(detail!.kind).toBe("detail");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Scenario N개를 count가 아니라 detail 자식 N개로 펼친다", () => {
    const dir = makeChangeDir({ auth: SPEC_AUTH });
    try {
      const { root } = buildSpecTree(dir);
      const feature = childByKind(childByKind(root, "requirement")!, "feature")!;
      // SPEC_AUTH의 "회원 가입"에는 Scenario 2개.
      expect(feature.children).toHaveLength(2);
      expect(feature.children.every((c) => c.kind === "detail")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detail 노드에 WHEN/THEN 텍스트가 들어 있다", () => {
    const dir = makeChangeDir({ auth: SPEC_AUTH });
    try {
      const { root } = buildSpecTree(dir);
      const feature = childByKind(childByKind(root, "requirement")!, "feature")!;
      const first = feature.children[0]!;
      expect(first.label).toBe("이메일로 가입");
      expect(first.when).toBe("사용자가 이메일을 입력한다");
      expect(first.then).toBe("계정이 생성된다");
      expect(first.detail).toBe("계정이 생성된다");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Scenario 0개 Requirement는 feature children 빈 배열(에러 없음)", () => {
    const dir = makeChangeDir({ misc: SPEC_EMPTY_REQ });
    try {
      const { root } = buildSpecTree(dir);
      const feature = childByKind(childByKind(root, "requirement")!, "feature")!;
      expect(feature.label).toBe("빈 요구사항");
      expect(feature.children).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("두 capability 디렉토리가 정렬 순서로 children에 들어간다", () => {
    // 입력 순서를 역순으로 줘도 정렬되어야 함(beta 먼저 작성).
    const dir = makeChangeDir({ beta: SPEC_AUTH, alpha: SPEC_AUTH });
    try {
      const { root } = buildSpecTree(dir);
      const caps = root.children.map((c) => c.label);
      expect(caps).toEqual(["alpha", "beta"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("specs/ 디렉토리가 없으면 빈 children 루트를 반환한다(에러 X)", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-tree-empty-"));
    try {
      const { root } = buildSpecTree(dir);
      expect(root.kind).toBe("change");
      expect(root.children).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
