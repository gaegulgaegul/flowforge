/**
 * changes 단위 테스트 — resolveChangeDir 루트 파라미터화 (task 1.1 RED → 1.2 GREEN).
 *
 * 크로스프로젝트 뷰: resolveChangeDir(id, rootDir?)가
 * - rootDir 지정 시 그 루트의 changes/<id>를 해석하고
 * - rootDir 부재 시 현행 changesRoot() 기준(하위호환)이며
 * - '..'/미지 id는 루트와 무관하게 null(탈출 차단)임을 검증한다.
 *
 * writeOverlay/readOverlay — OVERLAY_ROOT 규약 (task 1.1/1.2 RED, cross-project-layout-persistence).
 * - OVERLAY_ROOT 설정 시: writeOverlay가 <OVERLAY_ROOT>/<project>/<changeId>.json에 쓰고
 *   changeDir 하위(PROJECTS_ROOT 등 RO 대상)에는 viz/를 만들지 않는다(design D1/D2).
 * - readOverlay는 OVERLAY_ROOT 우선 조회 + 기존 <changeDir>/viz/graph-overlay.json 폴백을
 *   둘 다 읽는다(무손실, design D3).
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChangeDir, writeOverlay, readOverlay } from "../changes.js";

/** <root>/changes/<change>/specs/<cap>/spec.md 픽스처. root는 openspec 루트(= changesRoot의 base). */
function makeChange(openspecRoot: string, change: string, cap = "cap-x"): string {
  const changeDir = join(openspecRoot, "changes", change);
  const specDir = join(changeDir, "specs", cap);
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "spec.md"), `## capability: ${cap}\n`);
  return changeDir;
}

describe("resolveChangeDir — 루트 파라미터화", () => {
  const ORIG = process.env.OPENSPEC_ROOT;
  let projA: string;
  let projB: string;

  beforeEach(() => {
    projA = mkdtempSync(join(tmpdir(), "changes-a-"));
    projB = mkdtempSync(join(tmpdir(), "changes-b-"));
  });
  afterEach(() => {
    rmSync(projA, { recursive: true, force: true });
    rmSync(projB, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.OPENSPEC_ROOT;
    else process.env.OPENSPEC_ROOT = ORIG;
  });

  it("rootDir 지정 시 그 루트의 changes/<id>를 해석한다", () => {
    const expected = makeChange(projB, "ch-in-b");
    const resolved = resolveChangeDir("ch-in-b", join(projB, "changes"));
    expect(resolved).toBe(expected);
  });

  it("rootDir 부재 시 현행 changesRoot()(OPENSPEC_ROOT) 기준으로 해석한다(하위호환)", () => {
    process.env.OPENSPEC_ROOT = projA;
    const expected = makeChange(projA, "ch-in-a");
    expect(resolveChangeDir("ch-in-a")).toBe(expected);
  });

  it("지정 루트에 없는 change는 null (다른 루트의 동명 change에 새지 않는다)", () => {
    makeChange(projA, "only-in-a");
    // projB 루트로 물으면 존재하지 않으므로 null
    expect(resolveChangeDir("only-in-a", join(projB, "changes"))).toBeNull();
  });

  it("'..' 경로 조작은 rootDir가 있어도 null (루트 밖 탈출 차단)", () => {
    makeChange(projB, "real");
    expect(resolveChangeDir("../real", join(projB, "changes"))).toBeNull();
    expect(resolveChangeDir("..", join(projB, "changes"))).toBeNull();
  });

  it("specs 없는 디렉토리는 null (rootDir 지정 시에도 hasSpecs 게이트 유지)", () => {
    mkdirSync(join(projB, "changes", "no-specs"), { recursive: true });
    expect(resolveChangeDir("no-specs", join(projB, "changes"))).toBeNull();
  });
});

describe("writeOverlay/readOverlay — OVERLAY_ROOT 규약", () => {
  const ORIG_OVERLAY = process.env.OVERLAY_ROOT;
  let overlayRoot: string;
  let changeDir: string;

  beforeEach(() => {
    overlayRoot = mkdtempSync(join(tmpdir(), "overlay-root-"));
    changeDir = mkdtempSync(join(tmpdir(), "change-dir-"));
  });

  afterEach(() => {
    rmSync(overlayRoot, { recursive: true, force: true });
    rmSync(changeDir, { recursive: true, force: true });
    if (ORIG_OVERLAY === undefined) delete process.env.OVERLAY_ROOT;
    else process.env.OVERLAY_ROOT = ORIG_OVERLAY;
  });

  it("OVERLAY_ROOT 설정 시 <OVERLAY_ROOT>/<project>/<changeId>.json 에 쓰고 changeDir 하위엔 viz/를 만들지 않는다", () => {
    process.env.OVERLAY_ROOT = overlayRoot;
    writeOverlay(changeDir, { "node-a": { x: 1, y: 2 } }, { project: "wowa-app", changeId: "feature-a" });

    const target = join(overlayRoot, "wowa-app", "feature-a.json");
    expect(existsSync(target)).toBe(true);
    expect(JSON.parse(readFileSync(target, "utf-8"))).toEqual({ "node-a": { x: 1, y: 2 } });
    expect(existsSync(join(changeDir, "viz"))).toBe(false);
  });

  it("OVERLAY_ROOT 설정 + archive/ 접두 changeId 도 하위 디렉토리로 자연스럽게 저장된다(0.1 결정)", () => {
    process.env.OVERLAY_ROOT = overlayRoot;
    writeOverlay(changeDir, { "node-a": { x: 3, y: 4 } }, {
      project: "wowa-app",
      changeId: "archive/2026-07-08-cross-project-change-views",
    });
    const target = join(overlayRoot, "wowa-app", "archive", "2026-07-08-cross-project-change-views.json");
    expect(existsSync(target)).toBe(true);
  });

  it("readOverlay는 OVERLAY_ROOT 를 우선 조회한다", () => {
    process.env.OVERLAY_ROOT = overlayRoot;
    writeOverlay(changeDir, { "node-a": { x: 5, y: 6 } }, { project: "wowa-app", changeId: "feature-a" });
    const result = readOverlay(changeDir, { project: "wowa-app", changeId: "feature-a" });
    expect(result).toEqual({ "node-a": { x: 5, y: 6 } });
  });

  it("readOverlay는 OVERLAY_ROOT 에 없으면 기존 <changeDir>/viz/graph-overlay.json 폴백을 읽는다(무손실, D3)", () => {
    process.env.OVERLAY_ROOT = overlayRoot;
    // OVERLAY_ROOT 쪽엔 아무것도 없고, 레거시 경로에만 기존 오버레이가 있는 상황
    const legacyDir = join(changeDir, "viz");
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(join(legacyDir, "graph-overlay.json"), JSON.stringify({ "node-legacy": { x: 7, y: 8 } }));

    const result = readOverlay(changeDir, { project: "wowa-app", changeId: "feature-a" });
    expect(result).toEqual({ "node-legacy": { x: 7, y: 8 } });
  });

  it("OVERLAY_ROOT 미설정 시 기존 <changeDir>/viz/ 에 쓰고 읽는다(폴백, 0.2 결정)", () => {
    delete process.env.OVERLAY_ROOT;
    writeOverlay(changeDir, { "node-b": { x: 9, y: 10 } }, { project: "wowa-app", changeId: "feature-a" });

    const legacyTarget = join(changeDir, "viz", "graph-overlay.json");
    expect(existsSync(legacyTarget)).toBe(true);
    expect(readOverlay(changeDir, { project: "wowa-app", changeId: "feature-a" })).toEqual({
      "node-b": { x: 9, y: 10 },
    });
  });
});
