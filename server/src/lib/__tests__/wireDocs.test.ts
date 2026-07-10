/**
 * 와이어 레이아웃 제안 승인/반려 + 화면별 피드백 write lib 단위 테스트
 * (planning-wireframe-generation-feedback change).
 *
 * 대상:
 *  - readDocsWireframeSuggestions — 큐 read(파일부재 빈큐·깨진JSON·스키마위반 필터·id dedup·throw금지)
 *  - isValidWireSuggestion — id·screenId string + layout이 WireScreen2 스키마 만족
 *  - applyWireframeSuggestions + wireframeInvariantHolds — 승인분만 반영(JSON merge)·반려 큐제거·
 *    화면id 집합 보존 위반 시 writeFailed·skipped 표면화·queuePruneFailed·id dedup
 *  - buildDocsPlanningWireframe2 — 승인분 JSON 있으면 그걸, 없으면 픽스처 폴백
 *  - appendWireframeFeedback — 핀 피드백 append(screenId·text·ts·xPct·yPct·region)·빈텍스트/범위밖좌표 거부·ts 주입
 *
 * D4(JSON 사이드카)·D5(WIREFRAME_FEEDBACK_ROOT RW 볼륨)·D6(화면id 격리) 준수.
 * 파일 IO는 실제 tmp 픽스처(mkdtempSync)로 검증. featureDocs/userFlowDocs 원형을 JSON 저장에 맞게 조정.
 */
import * as fs from "node:fs";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WireScreen2, WireSuggestion } from "@flowforge/shared";
import {
  readDocsWireframeSuggestions,
  isValidWireSuggestion,
  applyWireframeSuggestions,
  wireframeInvariantHolds,
  buildDocsPlanningWireframe2,
  appendWireframeFeedback,
  wireframeFeedbackRoot,
  approvedWireframePath,
  pruneWireframeQueue,
} from "../wireDocs.js";
import { PLANNING_WIREFRAME_FIXTURE } from "../../parser/planningWireframeFixture.js";

/** 최소 유효 WireScreen2(데스크탑, body grid). */
function screen(id: string, over: Partial<WireScreen2> = {}): WireScreen2 {
  return {
    id,
    title: `화면 ${id}`,
    device: "desktop",
    regions: {
      body: { layout: "grid", elements: [{ kind: "card", label: "카드" }] },
    },
    ...over,
  };
}

/** WireSuggestion 헬퍼. */
function sug(id: string, screenId: string, layout?: WireScreen2, rationale?: string): WireSuggestion {
  return { id, screenId, layout: layout ?? screen(screenId), ...(rationale ? { rationale } : {}) };
}

/** <root>/<project>/docs/planning 을 만들고, 선택적으로 wireframe.suggestions.json 큐를 심는다. */
function makePlanning(root: string, project: string, sugs?: unknown[]): string {
  const docsDir = join(root, project, "docs");
  mkdirSync(join(docsDir, "planning"), { recursive: true });
  // docs 인식용 최소 문서(resolveDocsDir 게이트는 route 테스트에서 다룸 — lib은 docsDir 직접).
  writeFileSync(join(docsDir, "planning", "prd.md"), "# PRD\n\n## 개요\n\nx\n");
  if (sugs) {
    writeFileSync(
      join(docsDir, "planning", "wireframe.suggestions.json"),
      JSON.stringify({ version: 1, suggestions: sugs }, null, 2),
    );
  }
  return docsDir;
}

describe("isValidWireSuggestion (WireScreen2 스키마 가드)", () => {
  it("정상 제안은 통과한다", () => {
    expect(isValidWireSuggestion(sug("s1", "home"))).toBe(true);
  });
  it("id·screenId가 string이 아니면 거부", () => {
    expect(isValidWireSuggestion({ id: 1, screenId: "home", layout: screen("home") })).toBe(false);
    expect(isValidWireSuggestion({ id: "s1", screenId: 2, layout: screen("home") })).toBe(false);
  });
  it("layout이 없으면 거부", () => {
    expect(isValidWireSuggestion({ id: "s1", screenId: "home" })).toBe(false);
  });
  it("device가 어휘 밖(tablet)이면 거부", () => {
    expect(isValidWireSuggestion(sug("s1", "home", { ...screen("home"), device: "tablet" as never }))).toBe(false);
  });
  it("body.layout이 어휘 밖(carousel)이면 거부", () => {
    const bad = screen("home", { regions: { body: { layout: "carousel" as never, elements: [] } } });
    expect(isValidWireSuggestion(sug("s1", "home", bad))).toBe(false);
  });
  it("요소 kind가 8종 밖이면 거부", () => {
    const bad = screen("home", { regions: { body: { layout: "grid", elements: [{ kind: "widget" as never, label: "x" }] } } });
    expect(isValidWireSuggestion(sug("s1", "home", bad))).toBe(false);
  });
  it("8종 kind는 모두 허용된다", () => {
    const kinds = ["nav-item", "tab", "card", "input", "button", "text", "tree-node", "placeholder"] as const;
    for (const kind of kinds) {
      const ok = screen("home", { regions: { body: { layout: "stack", elements: [{ kind, label: "x" }] } } });
      expect(isValidWireSuggestion(sug("s1", "home", ok))).toBe(true);
    }
  });
});

describe("readDocsWireframeSuggestions", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-read-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("정상 큐를 파싱해 반환한다", () => {
    const dir = makePlanning(root, "p", [sug("s1", "home")]);
    const q = readDocsWireframeSuggestions(dir);
    expect(q.version).toBe(1);
    expect(q.suggestions).toHaveLength(1);
    expect(q.suggestions[0]?.id).toBe("s1");
    expect(q.suggestions[0]?.screenId).toBe("home");
  });

  it("큐 파일이 없으면 빈 큐를 반환한다(404 아님)", () => {
    const dir = makePlanning(root, "p");
    expect(readDocsWireframeSuggestions(dir)).toEqual({ version: 1, suggestions: [] });
  });

  it("깨진 JSON이면 빈 큐를 반환한다(throw 금지)", () => {
    const dir = makePlanning(root, "p");
    writeFileSync(join(dir, "planning", "wireframe.suggestions.json"), "{ not json ");
    expect(readDocsWireframeSuggestions(dir)).toEqual({ version: 1, suggestions: [] });
  });

  it("스키마 위반 항목은 필터하고 유효분만 반환한다", () => {
    const dir = makePlanning(root, "p", [
      sug("ok", "home"),
      { id: "bad-no-layout", screenId: "x" },
      { id: 1, screenId: "y", layout: screen("y") }, // non-string id
      { id: "bad-device", screenId: "z", layout: { ...screen("z"), device: "tv" } },
    ]);
    expect(readDocsWireframeSuggestions(dir).suggestions.map((s) => s.id)).toEqual(["ok"]);
  });

  it("id 중복은 first-occurrence-wins로 dedup", () => {
    const dir = makePlanning(root, "p", [sug("dup", "home"), sug("dup", "settings")]);
    const q = readDocsWireframeSuggestions(dir);
    expect(q.suggestions).toHaveLength(1);
    expect(q.suggestions[0]?.screenId).toBe("home");
  });
});

describe("wireframeInvariantHolds (화면 id 집합 보존)", () => {
  it("화면 id 집합이 같으면 true", () => {
    const before = [screen("a"), screen("b")];
    const after = [screen("a", { title: "바뀐 제목" }), screen("b")];
    expect(wireframeInvariantHolds(before, after)).toBe(true);
  });
  it("화면 id가 사라지면 false", () => {
    expect(wireframeInvariantHolds([screen("a"), screen("b")], [screen("a")])).toBe(false);
  });
  it("화면 id가 늘면 false", () => {
    expect(wireframeInvariantHolds([screen("a")], [screen("a"), screen("ghost")])).toBe(false);
  });
  it("화면 id가 다른 값으로 바뀌면 false", () => {
    expect(wireframeInvariantHolds([screen("a")], [screen("b")])).toBe(false);
  });
});

describe("applyWireframeSuggestions", () => {
  let root: string;
  let feedbackRoot: string;
  const ORIG = process.env.WIREFRAME_FEEDBACK_ROOT;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-apply-"));
    feedbackRoot = mkdtempSync(join(tmpdir(), "wire-fbroot-"));
    process.env.WIREFRAME_FEEDBACK_ROOT = feedbackRoot;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(feedbackRoot, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG;
  });

  it("승인분만 반영(승인 화면 레이아웃이 승인분 원천에 저장)되고 반려는 큐에서만 제거", () => {
    const dir = makePlanning(root, "p", [
      sug("s1", "grid", screen("grid", { title: "새 그리드" })),
      sug("s2", "skeleton", screen("skeleton", { title: "새 기획뷰" })),
    ]);
    const r = applyWireframeSuggestions(dir, { approve: ["s1"], reject: ["s2"] });
    expect(r.applied).toBe(1);
    expect(r.rejected).toBe(1);
    expect(r.remaining).toBe(0);
    // 승인분이 이제 buildDocsPlanningWireframe2의 원천 — grid 화면만 새 제목으로.
    const screens = buildDocsPlanningWireframe2(dir);
    const grid = screens.find((s) => s.id === "grid");
    expect(grid?.title).toBe("새 그리드");
    // 반려(s2)는 원천에 반영 안 됨 — skeleton은 픽스처 원본 제목.
    const skeleton = screens.find((s) => s.id === "skeleton");
    expect(skeleton?.title).toBe("기획 뷰");
  });

  it("승인분은 docsDir(홈 RO)가 아니라 WIREFRAME_FEEDBACK_ROOT 하위에 저장된다(D5)", () => {
    const dir = makePlanning(root, "p", [sug("s1", "grid", screen("grid", { title: "새 그리드" }))]);
    applyWireframeSuggestions(dir, { approve: ["s1"], reject: [] });
    // docsDir 하위엔 wireframe.json이 없어야 한다(RO 볼륨 오염 금지).
    expect(existsSync(join(dir, "planning", "wireframe.json"))).toBe(false);
    // 승인분은 RW 볼륨(feedbackRoot/<project>.wireframe.json)에.
    expect(existsSync(approvedWireframePath(dir))).toBe(true);
    expect(approvedWireframePath(dir).startsWith(feedbackRoot)).toBe(true);
  });

  it("self-roundtrip: 승인 화면 id가 기존 화면 집합 밖(신규 화면)이면 화면 id 집합이 커져 writeFailed", () => {
    // 픽스처에 없는 새 화면 id를 승인하면 화면 id 집합이 커진다 → 불변식 위반 → writeFailed(원본 보호).
    const dir = makePlanning(root, "p", [sug("s1", "brand-new-screen", screen("brand-new-screen"))]);
    const r = applyWireframeSuggestions(dir, { approve: ["s1"], reject: [] });
    expect(r.writeFailed).toBe(true);
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1); // 큐 보존
  });

  it("미실재 id는 skipped로 표면화한다(silent drop 금지)", () => {
    const dir = makePlanning(root, "p", [sug("s1", "grid")]);
    const r = applyWireframeSuggestions(dir, { approve: ["nope"], reject: [] });
    expect(r.skipped).toContain("nope");
    expect(r.applied).toBe(0);
    expect(r.remaining).toBe(1);
  });

  it("같은 화면 두 승인은 큐 순서 뒤가 이긴다(결정론)", () => {
    const dir = makePlanning(root, "p", [
      sug("s1", "grid", screen("grid", { title: "먼저" })),
      sug("s2", "grid", screen("grid", { title: "나중" })),
    ]);
    applyWireframeSuggestions(dir, { approve: ["s1", "s2"], reject: [] });
    const screens = buildDocsPlanningWireframe2(dir);
    expect(screens.find((s) => s.id === "grid")?.title).toBe("나중");
  });

  it("id dedup: 같은 id가 두 번 있고 한 번 승인하면 첫 항목만 반영", () => {
    const dir = makePlanning(root, "p", [
      sug("dup", "grid", screen("grid", { title: "첫번째" })),
      sug("dup", "skeleton", screen("skeleton", { title: "두번째" })),
    ]);
    const r = applyWireframeSuggestions(dir, { approve: ["dup"], reject: [] });
    expect(r.applied).toBe(1);
    const screens = buildDocsPlanningWireframe2(dir);
    expect(screens.find((s) => s.id === "grid")?.title).toBe("첫번째");
    expect(screens.find((s) => s.id === "skeleton")?.title).toBe("기획 뷰"); // 미반영(dedup)
  });

  it("prune 쓰기 실패 시 throw하지 않고 queuePruneFailed=true, 승인분은 반영된다", () => {
    if (typeof process.getuid === "function" && process.getuid() === 0) return; // root: chmod 무시 → 스킵
    const dir = makePlanning(root, "p", [sug("s1", "grid", screen("grid", { title: "새" }))]);
    const sugPath = join(dir, "planning", "wireframe.suggestions.json");
    fs.chmodSync(sugPath, 0o444); // read OK, prune write만 EACCES
    try {
      let result: ReturnType<typeof applyWireframeSuggestions> | undefined;
      expect(() => {
        result = applyWireframeSuggestions(dir, { approve: ["s1"], reject: [] });
      }).not.toThrow();
      expect(result?.queuePruneFailed).toBe(true);
      expect(result?.applied).toBe(1);
      // 승인분은 이미 저장됨(prune 실패는 승인분 write 성공 이후).
      expect(buildDocsPlanningWireframe2(dir).find((s) => s.id === "grid")?.title).toBe("새");
    } finally {
      fs.chmodSync(sugPath, 0o644);
    }
  });
});

describe("buildDocsPlanningWireframe2 (승인분 있으면 그걸, 없으면 픽스처 폴백)", () => {
  let root: string;
  let feedbackRoot: string;
  const ORIG = process.env.WIREFRAME_FEEDBACK_ROOT;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-build-"));
    feedbackRoot = mkdtempSync(join(tmpdir(), "wire-fbroot-"));
    process.env.WIREFRAME_FEEDBACK_ROOT = feedbackRoot;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(feedbackRoot, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG;
  });

  it("승인분 JSON이 없으면 기존 픽스처를 반환한다(1단계 렌더 폴백 유지)", () => {
    const dir = makePlanning(root, "p");
    const screens = buildDocsPlanningWireframe2(dir);
    expect(screens.map((s) => s.id)).toEqual(PLANNING_WIREFRAME_FIXTURE.map((s) => s.id));
  });

  it("승인분 JSON이 깨졌으면 픽스처로 안전 폴백(throw 금지)", () => {
    const dir = makePlanning(root, "p");
    mkdirSync(feedbackRoot, { recursive: true });
    writeFileSync(approvedWireframePath(dir), "{ broken");
    const screens = buildDocsPlanningWireframe2(dir);
    expect(screens.map((s) => s.id)).toEqual(PLANNING_WIREFRAME_FIXTURE.map((s) => s.id));
  });
});

describe("appendWireframeFeedback (feedback 사이드카 append)", () => {
  let root: string;
  let feedbackRoot: string;
  const ORIG = process.env.WIREFRAME_FEEDBACK_ROOT;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-fb-"));
    feedbackRoot = mkdtempSync(join(tmpdir(), "wire-fbroot-"));
    process.env.WIREFRAME_FEEDBACK_ROOT = feedbackRoot;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(feedbackRoot, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG;
  });

  it("좌표를 찍어 피드백을 남기면 {screenId,text,ts,xPct,yPct,region}가 append 되고 ok:true", () => {
    const dir = makePlanning(root, "p");
    const r = appendWireframeFeedback(
      dir,
      "p",
      { screenId: "grid", text: "하단을 탭바로 바꿔줘", xPct: 50, yPct: 90, region: "하단 메뉴바" },
      () => "2026-07-10T00:00:00.000Z",
    );
    expect(r.ok).toBe(true);
    const path = join(feedbackRoot, "p.feedback.json");
    const items = JSON.parse(readFileSync(path, "utf-8")) as unknown[];
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      screenId: "grid",
      text: "하단을 탭바로 바꿔줘",
      ts: "2026-07-10T00:00:00.000Z",
      xPct: 50,
      yPct: 90,
      region: "하단 메뉴바",
    });
  });

  it("region 없이도 좌표만으로 append 된다(region은 선택)", () => {
    const dir = makePlanning(root, "p");
    const r = appendWireframeFeedback(dir, "p", { screenId: "grid", text: "여기", xPct: 10, yPct: 20 }, () => "2026-07-10T00:00:00.000Z");
    expect(r.ok).toBe(true);
    const items = JSON.parse(readFileSync(join(feedbackRoot, "p.feedback.json"), "utf-8")) as Record<string, unknown>[];
    expect(items[0]).toEqual({ screenId: "grid", text: "여기", ts: "2026-07-10T00:00:00.000Z", xPct: 10, yPct: 20 });
    expect("region" in (items[0] ?? {})).toBe(false); // 빈 region은 저장 안 함
  });

  it("여러 번 append 되면 누적된다(기존 파일 보존)", () => {
    const dir = makePlanning(root, "p");
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "첫번째", xPct: 10, yPct: 10 }, () => "2026-07-10T00:00:00.000Z");
    appendWireframeFeedback(dir, "p", { screenId: "skeleton", text: "두번째", xPct: 20, yPct: 20 }, () => "2026-07-10T00:00:01.000Z");
    const items = JSON.parse(readFileSync(join(feedbackRoot, "p.feedback.json"), "utf-8")) as unknown[];
    expect(items).toHaveLength(2);
    expect((items[1] as { text: string }).text).toBe("두번째");
  });

  it("빈 텍스트(공백만)는 거부한다(ok:false, 파일 미기록)", () => {
    const dir = makePlanning(root, "p");
    const r = appendWireframeFeedback(dir, "p", { screenId: "grid", text: "   ", xPct: 50, yPct: 50 }, () => "2026-07-10T00:00:00.000Z");
    expect(r.ok).toBe(false);
    expect(existsSync(join(feedbackRoot, "p.feedback.json"))).toBe(false);
  });

  it("좌표가 0~100 범위 밖이면 거부한다(ok:false, 파일 미기록)", () => {
    const dir = makePlanning(root, "p");
    expect(appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: -1, yPct: 50 }).ok).toBe(false);
    expect(appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: 50, yPct: 101 }).ok).toBe(false);
    expect(existsSync(join(feedbackRoot, "p.feedback.json"))).toBe(false);
  });

  it("좌표가 숫자가 아니거나 NaN/Infinity면 거부한다(ok:false)", () => {
    const dir = makePlanning(root, "p");
    expect(appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: Number.NaN, yPct: 50 }).ok).toBe(false);
    expect(appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: 50, yPct: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: "50" as never, yPct: 50 }).ok).toBe(false);
    expect(existsSync(join(feedbackRoot, "p.feedback.json"))).toBe(false);
  });

  it("피드백 파일은 docsDir(홈 RO)가 아니라 WIREFRAME_FEEDBACK_ROOT 하위에 쓴다(D5)", () => {
    const dir = makePlanning(root, "p");
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: 5, yPct: 5 }, () => "2026-07-10T00:00:00.000Z");
    expect(existsSync(join(dir, "planning", "p.feedback.json"))).toBe(false);
    expect(existsSync(join(feedbackRoot, "p.feedback.json"))).toBe(true);
  });

  it("ts는 주입한 시계(nowIso)를 쓴다(테스트 안정성 — Date.now 직접 사용 금지)", () => {
    const dir = makePlanning(root, "p");
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: 5, yPct: 5 }, () => "2000-01-01T00:00:00.000Z");
    const items = JSON.parse(readFileSync(join(feedbackRoot, "p.feedback.json"), "utf-8")) as { ts: string }[];
    expect(items[0]?.ts).toBe("2000-01-01T00:00:00.000Z");
  });
});

describe("wireframeFeedbackRoot (env 폴백)", () => {
  const ORIG = process.env.WIREFRAME_FEEDBACK_ROOT;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG;
  });
  it("env가 있으면 env 값을 쓴다", () => {
    process.env.WIREFRAME_FEEDBACK_ROOT = "/data/wireframe-feedback";
    expect(wireframeFeedbackRoot()).toBe("/data/wireframe-feedback");
  });
  it("env가 없으면 tmp 폴백을 쓴다(빈 문자열/undefined 아님)", () => {
    delete process.env.WIREFRAME_FEEDBACK_ROOT;
    const p = wireframeFeedbackRoot();
    expect(typeof p).toBe("string");
    expect(p.length).toBeGreaterThan(0);
  });
});

/** D-2 큐 clobber 완화 — 재독 차집합 계약(헬퍼 단위 박제, features/userflow와 동일 사유). */
describe("pruneWireframeQueue (D-2 재독 차집합)", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-prune-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("재독본에만 있는 신규 제안은 보존하고 처리 id만 제거한다", () => {
    const dir = makePlanning(root, "p", [sug("s1", "grid"), sug("s2", "skeleton")]);
    const remaining = pruneWireframeQueue(dir, new Set(["s1"]));
    expect(remaining).toBe(1);
    expect(readDocsWireframeSuggestions(dir).suggestions.map((s) => s.id)).toEqual(["s2"]);
  });

  it("큐 파일이 없으면 빈 큐를 쓰고 0을 반환한다", () => {
    const dir = makePlanning(root, "p");
    expect(pruneWireframeQueue(dir, new Set(["s1"]))).toBe(0);
  });
});
