/**
 * changes 단위 테스트 — resolveChangeDir 루트 파라미터화 (task 1.1 RED → 1.2 GREEN).
 *
 * 크로스프로젝트 뷰: resolveChangeDir(id, rootDir?)가
 * - rootDir 지정 시 그 루트의 changes/<id>를 해석하고
 * - rootDir 부재 시 현행 changesRoot() 기준(하위호환)이며
 * - '..'/미지 id는 루트와 무관하게 null(탈출 차단)임을 검증한다.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveChangeDir } from "../changes.js";

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
