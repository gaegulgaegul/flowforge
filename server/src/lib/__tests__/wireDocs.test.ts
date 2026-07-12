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
import { createRequire } from "node:module";
import type { WireDoc, WireSuggestion } from "@flowforge/shared";
import { WIRE_IFRAME_SANDBOX, WIRE_DOC_CSP, WIRE_APP_CSP, injectWireDocCsp } from "@flowforge/shared";
import {
  readDocsWireframeSuggestions,
  isValidWireSuggestion,
  isValidWireDoc,
  applyWireframeSuggestions,
  wireframeInvariantHolds,
  buildDocsPlanningWireframe2,
  appendWireframeFeedback,
  readWireframeFeedback,
  updateWireframeFeedback,
  wireframeFeedbackRoot,
  approvedWireframePath,
  feedbackSidecarPath,
  pruneWireframeQueue,
} from "../wireDocs.js";
import { PLANNING_WIREFRAME_FIXTURE } from "../../parser/planningWireframeFixture.js";
// jsdom 최소 타입 슬라이스: 서버 tsconfig엔 DOM lib·@types/jsdom이 없다(백엔드). CSP 주입 결과를
// 실파싱 검증하는 데 필요한 API 표면만 로컬로 선언한다(테스트 파일 국소화 — 새 devDep/tsconfig 변경 없음).
interface JsdomEl {
  getAttribute(name: string): string | null;
  querySelector(sel: string): JsdomEl | null;
  readonly content: { querySelector(sel: string): JsdomEl | null };
}
interface JsdomDoc {
  readonly head: JsdomEl;
  querySelectorAll(sel: string): ArrayLike<JsdomEl>;
}
type JsdomCtor = new (html: string) => { window: { document: JsdomDoc } };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: JsdomCtor };

/** 최소 유효 WireDoc(데스크탑, 자족 HTML). */
function screen(id: string, over: Partial<WireDoc> = {}): WireDoc {
  return {
    id,
    title: `화면 ${id}`,
    device: "desktop",
    html: `<!DOCTYPE html><html><body><h1>화면 ${id}</h1></body></html>`,
    ...over,
  };
}

/** WireSuggestion 헬퍼(화면별 HTML 문서 교체 제안). */
function sug(id: string, screenId: string, docOver?: WireDoc, rationale?: string): WireSuggestion {
  return { id, screenId, doc: docOver ?? screen(screenId), ...(rationale ? { rationale } : {}) };
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

describe("isValidWireDoc (화면별 HTML 문서 스키마 가드)", () => {
  it("정상 문서는 통과한다(id·title·device·html)", () => {
    expect(isValidWireDoc(screen("home"))).toBe(true);
  });
  it("html이 string이 아니면 거부(계약 위반)", () => {
    expect(isValidWireDoc({ id: "home", title: "홈", device: "desktop", html: 123 })).toBe(false);
    expect(isValidWireDoc({ id: "home", title: "홈", device: "desktop" })).toBe(false);
  });
  it("id·title이 string이 아니면 거부", () => {
    expect(isValidWireDoc({ id: 1, title: "홈", device: "desktop", html: "<html></html>" })).toBe(false);
    expect(isValidWireDoc({ id: "home", title: 2, device: "desktop", html: "<html></html>" })).toBe(false);
  });
  it("device가 어휘 밖(tablet)이면 거부", () => {
    expect(isValidWireDoc({ id: "home", title: "홈", device: "tablet", html: "<html></html>" })).toBe(false);
  });
  it("desktop·mobile은 허용된다", () => {
    expect(isValidWireDoc(screen("a", { device: "desktop" }))).toBe(true);
    expect(isValidWireDoc(screen("b", { device: "mobile" }))).toBe(true);
  });
  it("빈 html 문자열도 스키마상 유효(자족성/내용 검증은 격리·CSP가 방어)", () => {
    expect(isValidWireDoc(screen("home", { html: "" }))).toBe(true);
  });
});

describe("isValidWireSuggestion (WireDoc 문서 교체 제안 가드)", () => {
  it("정상 제안은 통과한다", () => {
    expect(isValidWireSuggestion(sug("s1", "home"))).toBe(true);
  });
  it("id·screenId가 string이 아니면 거부", () => {
    expect(isValidWireSuggestion({ id: 1, screenId: "home", doc: screen("home") })).toBe(false);
    expect(isValidWireSuggestion({ id: "s1", screenId: 2, doc: screen("home") })).toBe(false);
  });
  it("doc이 없으면 거부", () => {
    expect(isValidWireSuggestion({ id: "s1", screenId: "home" })).toBe(false);
  });
  it("doc.device가 어휘 밖이면 거부", () => {
    expect(isValidWireSuggestion({ id: "s1", screenId: "home", doc: { ...screen("home"), device: "tv" } })).toBe(false);
  });
  it("doc.html이 문자열이 아니면 거부", () => {
    expect(isValidWireSuggestion({ id: "s1", screenId: "home", doc: { id: "home", title: "홈", device: "desktop" } })).toBe(false);
  });
});

/** 보안 상수 단일 원천(D8) — allow-same-origin 미부여·CSP 외부 차단·frame-ancestors. drift=보안 구멍. */
describe("wire-security 상수 (격리·CSP 불변식)", () => {
  it("sandbox 값에 allow-scripts는 있고 allow-same-origin은 없다(sandbox 무력화 방지 — 최상위 보안)", () => {
    expect(WIRE_IFRAME_SANDBOX).toContain("allow-scripts");
    expect(WIRE_IFRAME_SANDBOX).not.toContain("allow-same-origin");
  });
  it("sandbox 값에 top-navigation·popups·downloads가 없다(앱 탈취·이탈 방지)", () => {
    expect(WIRE_IFRAME_SANDBOX).not.toContain("allow-top-navigation");
    expect(WIRE_IFRAME_SANDBOX).not.toContain("allow-popups");
    expect(WIRE_IFRAME_SANDBOX).not.toContain("allow-downloads");
  });
  it("문서 CSP는 default-src 'none' 기반이고 외부 connect를 차단한다(외부 유출 0)", () => {
    expect(WIRE_DOC_CSP).toContain("default-src 'none'");
    expect(WIRE_DOC_CSP).toContain("connect-src 'none'");
  });
  it("문서 CSP는 외부 호스트 script/style/img 소스를 허용하지 않는다(인라인/data만)", () => {
    expect(WIRE_DOC_CSP).not.toMatch(/https?:\/\//);
    expect(WIRE_DOC_CSP).toContain("script-src 'unsafe-inline'");
  });
  it("앱 CSP는 frame-ancestors로 clickjacking을 방어한다", () => {
    expect(WIRE_APP_CSP).toContain("frame-ancestors 'self'");
  });
});

/**
 * injectWireDocCsp — srcdoc 렌더 직전 문서 CSP 주입(적대적 HTML 방어).
 * 보안 리뷰 BLOCK 회귀: 주석 안 가짜 <head>로 CSP를 우회하려는 입력을 실제 head에 주입해야 한다.
 */
describe("injectWireDocCsp (문서 CSP 주입 — 주석 우회 방어)", () => {
  const META = `<meta http-equiv="Content-Security-Policy" content="${WIRE_DOC_CSP}">`;

  it("정상 문서: 실제 <head> 바로 안에 CSP 메타를 삽입한다", () => {
    const out = injectWireDocCsp("<!DOCTYPE html><html><head><title>t</title></head><body>b</body></html>");
    expect(out).toContain(META);
    // 메타가 <head> 바로 뒤, <title> 앞에 온다.
    expect(out.indexOf(META)).toBeLessThan(out.indexOf("<title>"));
  });

  it("🔴 BLOCK 회귀: 주석 안 가짜 <head>가 앞서도 CSP는 죽은 주석이 아니라 실제 <head>에 들어간다", () => {
    const evil = '<!-- <head> --><head foo="bar"><title>t</title></head><body>y</body></html>';
    const out = injectWireDocCsp(evil);
    // 메타는 주석 종료(-->) 이후, 실제 <head foo="bar"> 뒤에 삽입돼야 한다.
    const metaAt = out.indexOf(META);
    expect(metaAt).toBeGreaterThan(out.indexOf("-->"));
    expect(metaAt).toBeGreaterThan(out.indexOf('<head foo="bar">'));
    // 주석 내용은 원본 그대로 보존(주석 안에 메타가 들어가지 않음).
    expect(out).toContain("<!-- <head> -->");
  });

  it("🔴 BLOCK 회귀: inert <template> 안 가짜 <head>가 앞서도 CSP는 template이 아니라 실제 <head>에 들어간다", () => {
    // <template>의 content는 inert DOM fragment라 그 안 <head>는 실제 문서 head가 아니다.
    // 마스킹 없이는 정규식이 template 안 가짜 head에 먼저 매치 → CSP가 죽은 fragment에 갇힌다(BLOCK 실측).
    const evil =
      '<html><template><head></head></template><head><title>real</title></head><body>y</body></html>';
    const out = injectWireDocCsp(evil);
    const metaAt = out.indexOf(META);
    // 메타는 template 종료(</template>) 이후, 실제 <head> 뒤에 삽입돼야 한다.
    expect(metaAt).toBeGreaterThan(out.indexOf("</template>"));
    expect(metaAt).toBeGreaterThan(out.indexOf("<head><title>real</title>"));
    // 실제 head 안 <title> 앞에 온다(= 실제 head 바로 뒤).
    expect(metaAt).toBeLessThan(out.indexOf("<title>real</title>"));
    // template의 원본 내용은 보존(그 안에 메타가 들어가지 않음).
    expect(out).toContain("<template><head></head></template>");
  });

  it("🔴 BLOCK 회귀(jsdom 실파싱): 주입 결과의 live head엔 CSP가 있고 template.content엔 갇히지 않는다", () => {
    // review가 jsdom `live head has CSP:false`로 BLOCK을 실증했다 → 수정 후엔 true여야 한다.
    const evil =
      '<html><template><head></head></template><head><title>real</title></head><body>y</body></html>';
    const out = injectWireDocCsp(evil);
    const doc = new JSDOM(out).window.document;
    const CSP_SEL = 'meta[http-equiv="Content-Security-Policy"]';

    // 1) 실제 문서 head(live head)에 우리 CSP 메타가 있다.
    const liveCsp = doc.head.querySelector(CSP_SEL);
    const liveHeadHasCsp = liveCsp !== null;
    expect(liveHeadHasCsp).toBe(true); // ← 수정 전엔 false(BLOCK)였던 지점
    expect(liveCsp?.getAttribute("content")).toBe(WIRE_DOC_CSP);

    // 2) CSP 메타가 어떤 <template>의 inert content에도 갇히지 않았다.
    const templates = doc.querySelectorAll("template");
    let trappedInTemplate = false;
    for (let i = 0; i < templates.length; i++) {
      if (templates[i]?.content.querySelector(CSP_SEL)) {
        trappedInTemplate = true;
      }
    }
    expect(trappedInTemplate).toBe(false);
  });

  it("주석 안 가짜 <html>이 앞서도 실제 <html>/<head> 경로로 주입된다", () => {
    const evil = "<!-- <html> --><html><body>y</body></html>";
    const out = injectWireDocCsp(evil);
    expect(out).toContain(META);
    expect(out.indexOf(META)).toBeGreaterThan(out.indexOf("-->"));
  });

  it("<head> 없이 <html>만 있으면 <head>를 만들어 그 안에 CSP를 넣는다", () => {
    const out = injectWireDocCsp("<html><body>only body</body></html>");
    expect(out).toContain(`<head>${META}</head>`);
  });

  it("<html>도 <head>도 없으면 문서 맨 앞에 CSP를 앞세운다", () => {
    const out = injectWireDocCsp("<body>bare</body>");
    expect(out.startsWith(META)).toBe(true);
  });

  it("공격자가 느슨한 CSP 메타를 심어도 우리 메타가 앞선다(스펙상 정책은 restrictive 결합)", () => {
    const evil = '<html><head><meta http-equiv="Content-Security-Policy" content="default-src *"><title>t</title></head><body>y</body></html>';
    const out = injectWireDocCsp(evil);
    // 우리 메타(default-src 'none' 포함)가 공격자 메타(default-src *)보다 먼저 온다.
    expect(out.indexOf(META)).toBeLessThan(out.indexOf('content="default-src *"'));
  });

  it("대문자 HEAD도 인식한다(대소문자 무관)", () => {
    const out = injectWireDocCsp("<HTML><HEAD></HEAD><BODY>b</BODY></HTML>");
    expect(out).toContain(META);
    expect(out.indexOf(META)).toBeLessThan(out.indexOf("</HEAD>"));
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

  it("좌표를 찍어 피드백을 남기면 {id,status,screenId,text,ts,xPct,yPct,region}가 append 되고 ok:true", () => {
    const dir = makePlanning(root, "p");
    const r = appendWireframeFeedback(
      dir,
      "p",
      { screenId: "grid", text: "하단을 탭바로 바꿔줘", xPct: 50, yPct: 90, region: "하단 메뉴바" },
      () => "2026-07-10T00:00:00.000Z",
      () => "fixed-id-1",
    );
    expect(r.ok).toBe(true);
    const path = join(feedbackRoot, "p.feedback.json");
    const items = JSON.parse(readFileSync(path, "utf-8")) as unknown[];
    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      id: "fixed-id-1",
      status: "open",
      screenId: "grid",
      text: "하단을 탭바로 바꿔줘",
      ts: "2026-07-10T00:00:00.000Z",
      xPct: 50,
      yPct: 90,
      region: "하단 메뉴바",
    });
  });

  it("신규 피드백의 status는 항상 open이고 id가 고유하게 부여된다", () => {
    const dir = makePlanning(root, "p");
    let n = 0;
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "a", xPct: 5, yPct: 5 }, () => "2026-07-10T00:00:00.000Z", () => `id-${++n}`);
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "b", xPct: 6, yPct: 6 }, () => "2026-07-10T00:00:01.000Z", () => `id-${++n}`);
    const items = JSON.parse(readFileSync(join(feedbackRoot, "p.feedback.json"), "utf-8")) as { id: string; status: string }[];
    expect(items.map((i) => i.status)).toEqual(["open", "open"]);
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it("id 생성기를 주입하지 않아도 고유 id가 부여된다(기본=crypto)", () => {
    const dir = makePlanning(root, "p");
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "a", xPct: 5, yPct: 5 }, () => "2026-07-10T00:00:00.000Z");
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "b", xPct: 6, yPct: 6 }, () => "2026-07-10T00:00:01.000Z");
    const items = JSON.parse(readFileSync(join(feedbackRoot, "p.feedback.json"), "utf-8")) as { id: string }[];
    expect(typeof items[0]?.id).toBe("string");
    expect(items[0]?.id.length).toBeGreaterThan(0);
    expect(items[0]?.id).not.toBe(items[1]?.id);
  });

  it("region 없이도 좌표만으로 append 된다(region은 선택)", () => {
    const dir = makePlanning(root, "p");
    const r = appendWireframeFeedback(dir, "p", { screenId: "grid", text: "여기", xPct: 10, yPct: 20 }, () => "2026-07-10T00:00:00.000Z", () => "id-1");
    expect(r.ok).toBe(true);
    const items = JSON.parse(readFileSync(join(feedbackRoot, "p.feedback.json"), "utf-8")) as Record<string, unknown>[];
    expect(items[0]).toEqual({ id: "id-1", status: "open", screenId: "grid", text: "여기", ts: "2026-07-10T00:00:00.000Z", xPct: 10, yPct: 20 });
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

  it("현재 와이어에 없는 화면 id면 거부한다(ok:false, 파일 미기록) — 쓰레기 피드백 방지", () => {
    const dir = makePlanning(root, "p");
    // grid/skeleton은 픽스처에 실재하는 화면 → 유효. ghost-screen은 없음 → 거부.
    expect(appendWireframeFeedback(dir, "p", { screenId: "ghost-screen", text: "x", xPct: 5, yPct: 5 }).ok).toBe(false);
    expect(existsSync(join(feedbackRoot, "p.feedback.json"))).toBe(false);
    // 대조: 실재 화면은 통과.
    expect(appendWireframeFeedback(dir, "p", { screenId: "grid", text: "x", xPct: 5, yPct: 5 }, () => "2026-07-10T00:00:00.000Z").ok).toBe(true);
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

/** flowforge-pin-feedback-lifecycle Group B — read(하위호환)·update(in-place). */
describe("readWireframeFeedback (목록 read + id/status 하위호환 기본값)", () => {
  let root: string;
  let feedbackRoot: string;
  const ORIG = process.env.WIREFRAME_FEEDBACK_ROOT;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-read-fb-"));
    feedbackRoot = mkdtempSync(join(tmpdir(), "wire-fbroot-"));
    process.env.WIREFRAME_FEEDBACK_ROOT = feedbackRoot;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(feedbackRoot, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG;
  });

  it("파일이 없으면 빈 배열을 반환한다(throw 금지)", () => {
    const dir = makePlanning(root, "p");
    expect(readWireframeFeedback(dir, "p")).toEqual([]);
  });

  it("append된 피드백을 배열로 반환한다(id·status 포함)", () => {
    const dir = makePlanning(root, "p");
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "a", xPct: 5, yPct: 5 }, () => "2026-07-10T00:00:00.000Z", () => "id-1");
    const items = readWireframeFeedback(dir, "p");
    expect(items).toHaveLength(1);
    expect(items[0]?.id).toBe("id-1");
    expect(items[0]?.status).toBe("open");
    expect(items[0]?.text).toBe("a");
  });

  it("id/status 없는 구버전 레코드에 결정적 기본값을 주입한다(id 생성·status='open')", () => {
    const dir = makePlanning(root, "p");
    // 구버전 포맷(id/status 없음)을 직접 심는다.
    mkdirSync(feedbackRoot, { recursive: true });
    writeFileSync(
      feedbackSidecarPath(dir, "p"),
      JSON.stringify([
        { screenId: "grid", text: "옛날", ts: "2026-01-01T00:00:00.000Z", xPct: 10, yPct: 20 },
        { screenId: "skeleton", text: "옛날2", ts: "2026-01-02T00:00:00.000Z", xPct: 30, yPct: 40 },
      ]),
    );
    const items = readWireframeFeedback(dir, "p");
    expect(items).toHaveLength(2);
    for (const it of items) {
      expect(typeof it.id).toBe("string");
      expect(it.id.length).toBeGreaterThan(0);
      expect(it.status).toBe("open");
    }
    // 기존 필드는 보존.
    expect(items[0]?.text).toBe("옛날");
    expect(items[0]?.xPct).toBe(10);
  });

  it("기본값 주입 id는 결정적이다(같은 레코드는 read마다 같은 id) — resolve 대상 안정성", () => {
    const dir = makePlanning(root, "p");
    mkdirSync(feedbackRoot, { recursive: true });
    writeFileSync(
      feedbackSidecarPath(dir, "p"),
      JSON.stringify([{ screenId: "grid", text: "옛날", ts: "2026-01-01T00:00:00.000Z", xPct: 10, yPct: 20 }]),
    );
    const a = readWireframeFeedback(dir, "p");
    const b = readWireframeFeedback(dir, "p");
    expect(a[0]?.id).toBe(b[0]?.id);
  });

  it("읽기만으로는 파일을 재기록하지 않는다(lazy — 부작용 최소)", () => {
    const dir = makePlanning(root, "p");
    mkdirSync(feedbackRoot, { recursive: true });
    const raw = JSON.stringify([{ screenId: "grid", text: "옛날", ts: "2026-01-01T00:00:00.000Z", xPct: 10, yPct: 20 }]);
    writeFileSync(feedbackSidecarPath(dir, "p"), raw);
    readWireframeFeedback(dir, "p");
    // 파일 원본이 그대로(재기록 안 함).
    expect(readFileSync(feedbackSidecarPath(dir, "p"), "utf-8")).toBe(raw);
  });

  it("깨진 JSON이면 빈 배열(throw 금지)", () => {
    const dir = makePlanning(root, "p");
    mkdirSync(feedbackRoot, { recursive: true });
    writeFileSync(feedbackSidecarPath(dir, "p"), "{ broken");
    expect(readWireframeFeedback(dir, "p")).toEqual([]);
  });
});

describe("updateWireframeFeedback (id 기반 in-place — resolve/수정)", () => {
  let root: string;
  let feedbackRoot: string;
  const ORIG = process.env.WIREFRAME_FEEDBACK_ROOT;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "wire-upd-"));
    feedbackRoot = mkdtempSync(join(tmpdir(), "wire-fbroot-"));
    process.env.WIREFRAME_FEEDBACK_ROOT = feedbackRoot;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(feedbackRoot, { recursive: true, force: true });
    if (ORIG === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
    else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG;
  });

  function seed(dir: string): void {
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "a", xPct: 10, yPct: 20 }, () => "2026-07-10T00:00:00.000Z", () => "id-a");
    appendWireframeFeedback(dir, "p", { screenId: "skeleton", text: "b", xPct: 30, yPct: 40 }, () => "2026-07-10T00:00:01.000Z", () => "id-b");
  }

  it("status를 resolved로 토글하고 좌표·screenId·id를 보존한다", () => {
    const dir = makePlanning(root, "p");
    seed(dir);
    const r = updateWireframeFeedback(dir, "p", "id-a", { status: "resolved" });
    expect(r.ok).toBe(true);
    const items = readWireframeFeedback(dir, "p");
    const a = items.find((i) => i.id === "id-a");
    expect(a?.status).toBe("resolved");
    expect(a?.screenId).toBe("grid");
    expect(a?.xPct).toBe(10);
    expect(a?.yPct).toBe(20);
    // 다른 레코드 유실 없음.
    expect(items.find((i) => i.id === "id-b")?.status).toBe("open");
  });

  it("resolved를 다시 open으로 재토글할 수 있다", () => {
    const dir = makePlanning(root, "p");
    seed(dir);
    updateWireframeFeedback(dir, "p", "id-a", { status: "resolved" });
    updateWireframeFeedback(dir, "p", "id-a", { status: "open" });
    expect(readWireframeFeedback(dir, "p").find((i) => i.id === "id-a")?.status).toBe("open");
  });

  it("text를 in-place로 수정하고 배열 길이를 늘리지 않는다(중복 append 없음)", () => {
    const dir = makePlanning(root, "p");
    seed(dir);
    const before = readWireframeFeedback(dir, "p").length;
    const r = updateWireframeFeedback(dir, "p", "id-a", { text: "고친 텍스트" });
    expect(r.ok).toBe(true);
    const items = readWireframeFeedback(dir, "p");
    expect(items).toHaveLength(before); // 길이 불변
    const a = items.find((i) => i.id === "id-a");
    expect(a?.text).toBe("고친 텍스트");
    expect(a?.xPct).toBe(10); // 좌표 보존
  });

  it("존재하지 않는 id는 {ok:false}이고 파일을 변경하지 않는다", () => {
    const dir = makePlanning(root, "p");
    seed(dir);
    const raw = readFileSync(feedbackSidecarPath(dir, "p"), "utf-8");
    const r = updateWireframeFeedback(dir, "p", "nope", { status: "resolved" });
    expect(r.ok).toBe(false);
    expect(readFileSync(feedbackSidecarPath(dir, "p"), "utf-8")).toBe(raw); // 파일 불변
  });

  it("파일이 없으면 {ok:false}(크래시 없음)", () => {
    const dir = makePlanning(root, "p");
    expect(updateWireframeFeedback(dir, "p", "id-a", { status: "resolved" }).ok).toBe(false);
  });

  it("빈 text는 거부한다(ok:false, 파일 불변) — 쓰레기 방지", () => {
    const dir = makePlanning(root, "p");
    seed(dir);
    const raw = readFileSync(feedbackSidecarPath(dir, "p"), "utf-8");
    expect(updateWireframeFeedback(dir, "p", "id-a", { text: "   " }).ok).toBe(false);
    expect(readFileSync(feedbackSidecarPath(dir, "p"), "utf-8")).toBe(raw);
  });

  it("append 직후 resolve해도 다른 레코드가 유실되지 않는다(read-modify-write)", () => {
    const dir = makePlanning(root, "p");
    seed(dir);
    appendWireframeFeedback(dir, "p", { screenId: "grid", text: "c", xPct: 50, yPct: 60 }, () => "2026-07-10T00:00:02.000Z", () => "id-c");
    updateWireframeFeedback(dir, "p", "id-c", { status: "resolved" });
    const items = readWireframeFeedback(dir, "p");
    expect(items).toHaveLength(3);
    expect(items.find((i) => i.id === "id-c")?.status).toBe("resolved");
    expect(items.find((i) => i.id === "id-a")?.text).toBe("a");
    expect(items.find((i) => i.id === "id-b")?.text).toBe("b");
  });

  it("구버전 레코드도 부여된 id로 resolve할 수 있고, 그 write가 파일을 최신 스키마로 승격한다", () => {
    const dir = makePlanning(root, "p");
    mkdirSync(feedbackRoot, { recursive: true });
    writeFileSync(
      feedbackSidecarPath(dir, "p"),
      JSON.stringify([{ screenId: "grid", text: "옛날", ts: "2026-01-01T00:00:00.000Z", xPct: 10, yPct: 20 }]),
    );
    const legacyId = readWireframeFeedback(dir, "p")[0]?.id as string;
    const r = updateWireframeFeedback(dir, "p", legacyId, { status: "resolved" });
    expect(r.ok).toBe(true);
    const items = readWireframeFeedback(dir, "p");
    expect(items[0]?.status).toBe("resolved");
    // write 후 파일이 id·status를 갖는 최신 스키마로 승격됨.
    const onDisk = JSON.parse(readFileSync(feedbackSidecarPath(dir, "p"), "utf-8")) as Record<string, unknown>[];
    expect(typeof onDisk[0]?.["id"]).toBe("string");
    expect(onDisk[0]?.["status"]).toBe("resolved");
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
