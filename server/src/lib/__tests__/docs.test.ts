/**
 * docs lib 단위 테스트 — DOCS_ROOT 1단계 스캔 + 경로 안전 해석(읽기전용).
 * 임시 DOCS_ROOT를 만들어 검증하고 끝나면 환경변수 복원.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listDocsProjects, resolveDocsDir, readDocsFile, docsRoot } from "../docs.js";

/** <root>/<project>/docs/<file> 픽스처 생성. */
function makeProject(root: string, project: string, files: Record<string, string>): string {
  const docsDir = join(root, project, "docs");
  mkdirSync(docsDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(docsDir, name), content);
  }
  return docsDir;
}

describe("docs lib", () => {
  const ORIG = process.env.DOCS_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "docs-lib-"));
    process.env.DOCS_ROOT = root;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.DOCS_ROOT;
    else process.env.DOCS_ROOT = ORIG;
  });

  it("docsRoot는 DOCS_ROOT를 반영한다", () => {
    expect(docsRoot()).toBe(root);
  });

  it("user-flow.md 또는 PRD.md 있는 프로젝트만 스캔하고 정렬한다", () => {
    makeProject(root, "beta", { "user-flow.md": "## flow: x\n" });
    makeProject(root, "alpha", { "PRD.md": "## decision: D1\n" });
    makeProject(root, "gamma", { "user-flow.md": "", "PRD.md": "" });
    // docs/ 하위에 두 파일 모두 없는 프로젝트는 제외.
    mkdirSync(join(root, "nodocs", "docs", "other"), { recursive: true });
    writeFileSync(join(root, "nodocs", "docs", "readme.md"), "x");

    expect(listDocsProjects()).toEqual(["alpha", "beta", "gamma"]);
  });

  it("docs 디렉토리 자체가 없는 프로젝트는 무시한다", () => {
    mkdirSync(join(root, "plain"), { recursive: true });
    writeFileSync(join(root, "plain", "user-flow.md"), "## flow: x\n"); // docs/ 밖 → 무시
    expect(listDocsProjects()).toEqual([]);
  });

  it("심볼릭 링크 프로젝트 디렉토리는 따라가지 않는다", () => {
    const realRoot = mkdtempSync(join(tmpdir(), "docs-real-"));
    try {
      makeProject(realRoot, "target", { "user-flow.md": "## flow: x\n" });
      // root/linked → realRoot/target (심링크). 따라가면 안 됨.
      symlinkSync(join(realRoot, "target"), join(root, "linked"), "dir");
      makeProject(root, "regular", { "user-flow.md": "## flow: y\n" });
      expect(listDocsProjects()).toEqual(["regular"]);
    } finally {
      rmSync(realRoot, { recursive: true, force: true });
    }
  });

  it("DOCS_ROOT가 비었으면(존재하지 않으면) 빈 배열", () => {
    rmSync(root, { recursive: true, force: true });
    expect(listDocsProjects()).toEqual([]);
  });

  it("resolveDocsDir는 존재하는 프로젝트의 docs 절대경로를 돌려준다", () => {
    const docsDir = makeProject(root, "myproj", { "user-flow.md": "## flow: x\n" });
    expect(resolveDocsDir("myproj")).toBe(docsDir);
  });

  it("resolveDocsDir는 '..' 경로 조작을 거부한다 → null", () => {
    expect(resolveDocsDir("../etc")).toBeNull();
    expect(resolveDocsDir("a/../b")).toBeNull();
  });

  it("resolveDocsDir는 화이트리스트 밖 문자를 거부한다 → null", () => {
    expect(resolveDocsDir("a b")).toBeNull(); // 공백
    expect(resolveDocsDir("a$b")).toBeNull(); // 특수문자
    expect(resolveDocsDir("프로젝트")).toBeNull(); // 비ASCII
  });

  it("resolveDocsDir는 docs가 없는(또는 user-flow/PRD 둘 다 없는) 프로젝트면 null", () => {
    mkdirSync(join(root, "empty", "docs"), { recursive: true });
    writeFileSync(join(root, "empty", "docs", "notes.md"), "x");
    expect(resolveDocsDir("empty")).toBeNull();
    expect(resolveDocsDir("does-not-exist")).toBeNull();
  });

  it("readDocsFile은 파일이 있으면 내용을, 없으면 null을 반환한다", () => {
    const docsDir = makeProject(root, "p", { "PRD.md": "hello" });
    expect(readDocsFile(docsDir, "PRD.md")).toBe("hello");
    expect(readDocsFile(docsDir, "missing.md")).toBeNull();
  });
});
