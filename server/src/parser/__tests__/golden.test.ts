/**
 * 골든 테스트 — TS 포팅(buildGraph)이 Python 원본(gen_golden.py)과 동치인지 박제.
 *
 * golden.json은 generate_prototype.py로 생성된 정답. 같은 change 디렉토리를
 * buildGraph로 돌려 {nodes, edges}가 정확히 일치하는지 검증한다.
 * 한글 NAV·dangling·self-loop 엣지케이스의 포팅 표류를 막는 게 목적.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildGraph } from "../graphBuilder.js";
import type { SpecGraph } from "../graphBuilder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = join(__dirname, "..", "__golden__", "golden.json");

// change 이름 → 실제 디스크 경로 (골든 생성 시 쓴 입력과 동일해야 함)
const CHANGE_DIRS: Record<string, string> = {
  "2026-06-18-extract-wod-photo-logger":
    "/home/gaegul/wowa-app/openspec/changes/archive/2026-06-18-extract-wod-photo-logger",
  "2026-06-20-add-weekly-dashboard":
    "/home/gaegul/wowa-app/openspec/changes/archive/2026-06-20-add-weekly-dashboard",
};

/** 엣지를 결정적 순서로 정렬(비교 안정화) */
function normalize(g: SpecGraph) {
  const nodes = [...g.nodes].sort((a, b) => a.id.localeCompare(b.id));
  const edges = [...g.edges].sort((a, b) =>
    (a.from + a.to + a.scenario).localeCompare(b.from + b.to + b.scenario),
  );
  return { nodes, edges };
}

describe("골든 동치 (Python ↔ TS)", () => {
  const golden: Record<string, SpecGraph> = JSON.parse(
    readFileSync(GOLDEN_PATH, "utf-8"),
  );

  for (const [change, dir] of Object.entries(CHANGE_DIRS)) {
    it(`${change} 그래프가 Python 골든과 일치`, () => {
      const expected = golden[change];
      expect(expected).toBeDefined();
      const actual = buildGraph(dir);
      expect(actual.change).toBe(change);
      expect(normalize(actual)).toEqual(normalize(expected!));
    });
  }

  it("dangling/self-loop 엣지케이스가 보존됨", () => {
    const g = buildGraph(CHANGE_DIRS["2026-06-18-extract-wod-photo-logger"]!);
    // self-loop 없음: from === to 인 엣지가 없어야
    expect(g.edges.every((e) => e.from !== e.to)).toBe(true);
    // dangling 최소 1개(누락 표면화)
    expect(g.edges.some((e) => e.dangling)).toBe(true);
  });
});
