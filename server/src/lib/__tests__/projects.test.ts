/**
 * projects 단위 테스트 (task 2.1 RED → 3.1 GREEN).
 *
 * 홈서버 프로젝트를 스캔해 카드 그리드용 ProjectCard[]를 만든다.
 * - (a) change 있는 프로젝트는 전부 반환
 * - (b) charter(docs/) 없는 프로젝트도 포함(charter 유무 무관)
 * - (c) 각 항목에 hasCharter·changeCount·auditStatus·displayName을 채운다
 *
 * 스캔 모델: PROJECTS_ROOT(테스트 주입) 1단계 하위 <project>/ 가
 * openspec/changes/ 에 change를 1개 이상 가지면 프로젝트로 본다.
 * docs/ (user-flow.md|PRD.md) 존재 → hasCharter.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listProjectCards } from "../projects.js";

/** <root>/<project>/openspec/changes/<change>/specs/<cap>/spec.md 픽스처. */
function makeChange(root: string, project: string, change: string, cap = "cap-x"): void {
  const dir = join(root, project, "openspec", "changes", change, "specs", cap);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "spec.md"), `## capability: ${cap}\n`);
}

/** <root>/<project>/docs/<file> 픽스처(charter 상주 docs). */
function makeCharter(root: string, project: string): void {
  const dir = join(root, project, "docs");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "PRD.md"), "## decision: D1\n");
}

/** <root>/<project>/docs/audit.json 픽스처. raw를 주면 finalJudgment 대신 본문 그대로 쓴다. */
function makeAudit(root: string, project: string, finalJudgment?: string, raw?: string): void {
  const dir = join(root, project, "docs");
  mkdirSync(dir, { recursive: true });
  const body = raw ?? JSON.stringify(finalJudgment === undefined ? {} : { finalJudgment });
  writeFileSync(join(dir, "audit.json"), body);
}

describe("listProjectCards — 홈서버 프로젝트 카드 스캔", () => {
  const ORIG = process.env.PROJECTS_ROOT;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "projects-"));
    process.env.PROJECTS_ROOT = root;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.PROJECTS_ROOT;
    else process.env.PROJECTS_ROOT = ORIG;
  });

  it("(a) change 있는 프로젝트를 전부 반환하고 이름순 정렬한다", () => {
    makeChange(root, "beta", "ch1");
    makeChange(root, "alpha", "ch1");
    const cards = listProjectCards();
    expect(cards.map((c) => c.name)).toEqual(["alpha", "beta"]);
  });

  it("(a-2) 활성 change 0이어도 docs 인식 프로젝트는 카드로 포함한다(도달성)", () => {
    // charter 문서만 있는 프로젝트 (change 전부 archive된 정상 상태)
    makeCharter(root, "charter-only");
    // 기획 산출물만 있는 planning-only 프로젝트
    const pdir = join(root, "planning-only", "docs", "planning");
    mkdirSync(pdir, { recursive: true });
    writeFileSync(join(pdir, "features.md"), "# 기능명세\n");
    // docs도 change도 없는 디렉토리는 여전히 제외
    mkdirSync(join(root, "not-a-project"), { recursive: true });
    const cards = listProjectCards();
    const names = cards.map((c) => c.name);
    expect(names).toContain("charter-only");
    expect(names).toContain("planning-only");
    expect(names).not.toContain("not-a-project");
    expect(cards.find((c) => c.name === "charter-only")?.changeCount).toBe(0);
  });

  it("(b) charter(docs/) 없는 프로젝트도 포함한다(hasCharter=false)", () => {
    makeChange(root, "nocharter", "ch1"); // docs/ 없음
    makeChange(root, "withcharter", "ch1");
    makeCharter(root, "withcharter");
    const cards = listProjectCards();
    const noc = cards.find((c) => c.name === "nocharter");
    const wic = cards.find((c) => c.name === "withcharter");
    expect(noc?.hasCharter).toBe(false);
    expect(wic?.hasCharter).toBe(true);
  });

  it("(c) 각 카드에 changeCount·auditStatus·displayName을 채운다", () => {
    makeChange(root, "proj", "ch1");
    makeChange(root, "proj", "ch2");
    const card = listProjectCards().find((c) => c.name === "proj")!;
    expect(card.changeCount).toBe(2);
    // 정적 audit(예광탄): 실시간 산출 안 함 → 'unknown' 허용값.
    expect(["unknown", "clean", "warn", "fail"]).toContain(card.auditStatus);
    // displayName 폴백 = 영문 name(한글맵 없으면).
    expect(card.displayName).toBe("proj");
  });

  describe("auditStatus — docs/audit.json finalJudgment 매핑·폴백", () => {
    const cardOf = (project: string) =>
      listProjectCards().find((c) => c.name === project)!;

    it('(a) "조건부" → warn', () => {
      makeChange(root, "proj", "ch1");
      makeAudit(root, "proj", "조건부");
      expect(cardOf("proj").auditStatus).toBe("warn");
    });

    it('(b) "FAIL" → fail', () => {
      makeChange(root, "proj", "ch1");
      makeAudit(root, "proj", "FAIL");
      expect(cardOf("proj").auditStatus).toBe("fail");
    });

    it('(c) "PASS" → clean', () => {
      makeChange(root, "proj", "ch1");
      makeAudit(root, "proj", "PASS");
      expect(cardOf("proj").auditStatus).toBe("clean");
    });

    it("(d) audit.json 없음 → unknown 폴백", () => {
      makeChange(root, "proj", "ch1");
      expect(cardOf("proj").auditStatus).toBe("unknown");
    });

    it("(e) 깨진 JSON → unknown 폴백(throw 금지)", () => {
      makeChange(root, "proj", "ch1");
      makeAudit(root, "proj", undefined, "{not json!");
      expect(cardOf("proj").auditStatus).toBe("unknown");
    });

    it('(f) "UNVERIFIABLE"·finalJudgment 필드 없음 → unknown', () => {
      makeChange(root, "unver", "ch1");
      makeAudit(root, "unver", "UNVERIFIABLE");
      makeChange(root, "nofield", "ch1");
      makeAudit(root, "nofield", undefined); // {} — 필드 없음
      expect(cardOf("unver").auditStatus).toBe("unknown");
      expect(cardOf("nofield").auditStatus).toBe("unknown");
    });
  });

  it("change도 docs도 없는 디렉토리는 프로젝트로 보지 않는다", () => {
    mkdirSync(join(root, "empty"), { recursive: true });
    makeCharter(root, "onlydocs"); // docs만 있고 change 없음 → 도달성 규칙으로 포함
    makeChange(root, "real", "ch1");
    const names = listProjectCards().map((c) => c.name);
    expect(names).toEqual(["onlydocs", "real"]);
  });

  /**
   * 카드 칩(activeChangeNames)은 2개까지만 표시하지만, 진입로가 쓰는
   * allActiveChangeNames는 잘리면 안 된다 — 3번째 이후 change가 도달 불가가 되기 때문
   * (uncharted-project-change-list, review BLOCK 지적).
   */
  describe("activeChangeNames(칩, 2개 상한) vs allActiveChangeNames(진입로, 전체)", () => {
    it("활성 change가 2개를 넘으면 칩은 2개로 자르고 전체 목록은 전부 싣는다", () => {
      makeChange(root, "many", "ch1");
      makeChange(root, "many", "ch2");
      makeChange(root, "many", "ch3");
      makeChange(root, "many", "ch4");
      const card = listProjectCards().find((c) => c.name === "many");
      expect(card?.activeChangeNames).toHaveLength(2); // 칩은 잘림(레이아웃 유지)
      expect(card?.allActiveChangeNames).toEqual(["ch1", "ch2", "ch3", "ch4"]); // 진입로는 전량
    });

    it("활성 change가 상한 이하면 둘이 같다", () => {
      makeChange(root, "few", "ch1");
      const card = listProjectCards().find((c) => c.name === "few");
      expect(card?.activeChangeNames).toEqual(["ch1"]);
      expect(card?.allActiveChangeNames).toEqual(["ch1"]);
    });

    it("활성 change가 없으면 전체 목록도 빈 배열이다(없는 링크를 지어내지 않음)", () => {
      makeCharter(root, "nochange");
      const card = listProjectCards().find((c) => c.name === "nochange");
      expect(card?.allActiveChangeNames).toEqual([]);
    });
  });
});
