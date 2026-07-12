/**
 * 와이어 문서 서빙 라우트 통합 테스트 — CSP meta→HTTP 헤더 전환의 근본해결 실증.
 *
 * 대상:
 *  - GET  /api/docs/:project/planning-wireframe/:screenId/doc   승인분(원천) 문서 직접 서빙
 *  - POST /api/docs/:project/planning-wireframe/preview          미승인 임시 HTML → 토큰 발급
 *  - GET  /api/docs/:project/planning-wireframe/preview/:token/doc  토큰으로 미리보기 문서 서빙
 *
 * 핵심 실증(= 근본해결): 문서 HTML에 어떤 적대적 페이로드를 넣어도 응답의
 *   Content-Security-Policy 헤더는 WIRE_DOC_CSP로 **불변**이다(문서는 헤더를 못 바꾼다).
 * 과거 injectWireDocCsp(meta 주입)는 정규식 마스킹을 뚫는 6종 페이로드에 우회당했다 —
 * 헤더 전달은 그 벡터 전체를 무의미하게 만든다(브라우저가 문서 내용과 무관하게 강제).
 *
 * DOCS_ROOT(RO 픽스처) + WIREFRAME_FEEDBACK_ROOT(승인분 RW 볼륨)를 임시 디렉토리로 잡고
 * supertest로 실제 라우트를 태운다.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import type { WireDoc } from "@flowforge/shared";
import { WIRE_DOC_CSP } from "@flowforge/shared";
import { _resetWirePreviewStore, WIRE_PREVIEW_MAX_HTML_BYTES } from "../../lib/wirePreview.js";

let ROOT: string;
let FEEDBACK_ROOT: string;
let ORIG_DOCS: string | undefined;
let ORIG_FEEDBACK: string | undefined;

const PROJECT = "wireproj";

/** 최소 유효 features.md(planning 문서가 있어야 resolveDocsDir가 docs로 인정). */
const FEATURES_MD = ["# 기능명세", "## 화면목록", "### 홈", "<!-- screen: home -->", ""].join("\n");

/** 정상 문서(대조군) — 명시 상수로 좁혀 `string | undefined` 인덱스 접근을 피한다. */
const NORMAL = '<!doctype html><html><head><title>ok</title></head><body><h1>ok</h1></body></html>';

/** 6종 적대 페이로드 — 과거 meta 주입 정규식 마스킹을 뚫던 벡터들. 지금은 doc.html로 넣어도 무의미. */
const ADVERSARIAL: Record<string, string> = {
  // ① script가 head 안에서 먼저 실행되도록 배치(meta 주입 시점 우회 시도)
  scriptInHead:
    '<!doctype html><html><head><script>window.x=1</script><title>t</title></head><body>b</body></html>',
  // ② 속성값 안에 </template> 문자열(마스킹 정규식 조기 종료 유도)
  attrCloseTemplate:
    '<html><head><meta data-x="</template>"></head><body><template><head></head></template>y</body></html>',
  // ③ 미종료 template(마스킹 정규식이 끝을 못 찾게)
  unterminatedTemplate: '<html><body><template><head>trap</head>y</body></html>',
  // ④ 주석 데코이(주석 안 가짜 <head>로 CSP를 죽은 노드에 가두려던 시도)
  commentDecoy: '<!-- <head> --><head foo="bar"><title>real</title></head><body>y</body></html>',
  // ⑤ inert template 안 가짜 head 중첩
  nestedTemplateHead:
    '<html><template><head></head></template><head><title>real</title></head><body>y</body></html>',
  // ⑥ 정상 문서(대조군)
  normal: NORMAL,
};

function writeApproved(docs: WireDoc[]): void {
  writeFileSync(join(FEEDBACK_ROOT, `${PROJECT}.wireframe.json`), JSON.stringify(docs), "utf-8");
}

function loadApp() {
  return import("../../index.js").then((m) => m.app);
}

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), "wiredoc-docs-"));
  FEEDBACK_ROOT = mkdtempSync(join(tmpdir(), "wiredoc-fb-"));
  const docsDir = join(ROOT, PROJECT, "docs");
  mkdirSync(join(docsDir, "planning"), { recursive: true });
  writeFileSync(join(docsDir, "planning", "features.md"), FEATURES_MD);
  ORIG_DOCS = process.env.DOCS_ROOT;
  ORIG_FEEDBACK = process.env.WIREFRAME_FEEDBACK_ROOT;
  process.env.DOCS_ROOT = ROOT;
  process.env.WIREFRAME_FEEDBACK_ROOT = FEEDBACK_ROOT;
});

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(FEEDBACK_ROOT, { recursive: true, force: true });
  if (ORIG_DOCS === undefined) delete process.env.DOCS_ROOT;
  else process.env.DOCS_ROOT = ORIG_DOCS;
  if (ORIG_FEEDBACK === undefined) delete process.env.WIREFRAME_FEEDBACK_ROOT;
  else process.env.WIREFRAME_FEEDBACK_ROOT = ORIG_FEEDBACK;
});

beforeEach(() => {
  _resetWirePreviewStore();
});

describe("GET /planning-wireframe/:screenId/doc (승인분 원천 서빙)", () => {
  it("200 text/html + WIRE_DOC_CSP 헤더 + 본문 무변형", async () => {
    const html = NORMAL;
    writeApproved([{ id: "home", title: "홈", device: "desktop", html }]);
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/${PROJECT}/planning-wireframe/home/doc`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    // 헤더 CSP = 단일 원천 상수와 정확히 일치(문자열 무변형).
    expect(res.headers["content-security-policy"]).toBe(WIRE_DOC_CSP);
    // 본문은 저장한 HTML 그대로(주입·변형 없음).
    expect(res.text).toBe(html);
  });

  it("미존재 screenId는 404", async () => {
    writeApproved([{ id: "home", title: "홈", device: "desktop", html: NORMAL }]);
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/${PROJECT}/planning-wireframe/ghost/doc`);
    expect(res.status).toBe(404);
  });

  it("미존재 project는 404(경로조작·미등록 차단)", async () => {
    const app = await loadApp();
    const res = await request(app).get(`/api/docs/nope/planning-wireframe/home/doc`);
    expect(res.status).toBe(404);
  });
});

describe("6 적대 페이로드 → 헤더 CSP 불변 실증(근본해결)", () => {
  // 각 페이로드를 승인분 doc.html로 넣어도 응답 헤더 CSP는 WIRE_DOC_CSP로 불변이고 본문은 무변형이다.
  // = 문서는 자신을 서빙하는 응답의 헤더를 바꿀 수 없다(meta 마스킹 우회가 통째로 무의미해진다).
  for (const [name, html] of Object.entries(ADVERSARIAL)) {
    it(`[${name}] 문서가 응답 헤더 CSP를 바꾸지 못한다(불변) + 본문 무변형`, async () => {
      writeApproved([{ id: "home", title: "홈", device: "desktop", html }]);
      const app = await loadApp();
      const res = await request(app).get(`/api/docs/${PROJECT}/planning-wireframe/home/doc`);
      expect(res.status).toBe(200);
      // 어떤 적대적 HTML이든 헤더 CSP는 동일한 강한 정책으로 고정.
      expect(res.headers["content-security-policy"]).toBe(WIRE_DOC_CSP);
      expect(res.headers["content-security-policy"]).toContain("default-src 'none'");
      // 문서 안에 <meta ... Content-Security-Policy ...>를 주입하지 않는다(본문 무변형).
      expect(res.text).toBe(html);
      // (헤더 전달이므로) 서버가 문서에 meta CSP를 심지 않았음을 명시적으로 확인.
      expect(res.text).not.toContain('http-equiv="Content-Security-Policy"');
    });
  }
});

describe("POST /planning-wireframe/preview → GET preview/:token/doc (미승인 왕복)", () => {
  it("POST가 토큰을 발급하고 GET이 그 토큰으로 동일 헤더·무변형 본문을 서빙한다", async () => {
    const html = ADVERSARIAL.commentDecoy as string; // 적대 페이로드도 미리보기 경로에서 동일하게 무의미
    const app = await loadApp();
    const post = await request(app)
      .post(`/api/docs/${PROJECT}/planning-wireframe/preview`)
      .send({ html });
    expect(post.status).toBe(200);
    const token = post.body.token as string;
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const get = await request(app).get(
      `/api/docs/${PROJECT}/planning-wireframe/preview/${token}/doc`,
    );
    expect(get.status).toBe(200);
    expect(get.headers["content-type"]).toMatch(/text\/html/);
    expect(get.headers["content-security-policy"]).toBe(WIRE_DOC_CSP);
    expect(get.text).toBe(html);
    expect(get.text).not.toContain('http-equiv="Content-Security-Policy"');
  });

  it("미존재 토큰 GET은 404(토큰 추측 불가 — 열거 무의미)", async () => {
    const app = await loadApp();
    const res = await request(app).get(
      `/api/docs/${PROJECT}/planning-wireframe/preview/deadbeef-not-a-token/doc`,
    );
    expect(res.status).toBe(404);
  });

  it("리셋(만료 시뮬레이션) 후 이전 토큰 GET은 404", async () => {
    const app = await loadApp();
    const post = await request(app)
      .post(`/api/docs/${PROJECT}/planning-wireframe/preview`)
      .send({ html: "<p>ephemeral</p>" });
    const token = post.body.token as string;
    // 저장소를 비우면(=TTL 만료 등가) 이전 토큰은 서빙 불가.
    _resetWirePreviewStore();
    const res = await request(app).get(
      `/api/docs/${PROJECT}/planning-wireframe/preview/${token}/doc`,
    );
    expect(res.status).toBe(404);
  });

  it("html 누락 POST는 400", async () => {
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/${PROJECT}/planning-wireframe/preview`)
      .send({ notHtml: 1 });
    expect(res.status).toBe(400);
  });

  it("크기 상한 초과 HTML POST는 413(토큰 미발급)", async () => {
    const app = await loadApp();
    const tooBig = "x".repeat(WIRE_PREVIEW_MAX_HTML_BYTES + 1);
    const res = await request(app)
      .post(`/api/docs/${PROJECT}/planning-wireframe/preview`)
      .send({ html: tooBig });
    expect(res.status).toBe(413);
  });

  it("미존재 project POST는 404", async () => {
    const app = await loadApp();
    const res = await request(app)
      .post(`/api/docs/nope/planning-wireframe/preview`)
      .send({ html: "<p>x</p>" });
    expect(res.status).toBe(404);
  });
});
