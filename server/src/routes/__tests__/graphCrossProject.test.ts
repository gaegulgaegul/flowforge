/**
 * graph API 크로스프로젝트 통합 테스트 (task 2.1 RED → 2.2 GREEN).
 *
 * 5종 뷰 GET·layout PUT에 선택적 ?project=<name>을 붙이면 그 프로젝트의
 * openspec/changes에서 change를 해석한다. 격리 PROJECTS_ROOT에 2개 프로젝트 픽스처.
 * - ?project= 있음 → 그 프로젝트 산출물로 200
 * - ?project= 없음 → 현행 글로벌(OPENSPEC_ROOT) 루트 동작 불변
 * - project=../.. / 미지 프로젝트 → 404 (루트 밖 접근 없음)
 *
 * RO 루트 재현 (task 3.1, cross-project-layout-persistence, design D5):
 * 기존 mkdtempSync 픽스처는 쓰기 가능이라 프로덕션의 RO 마운트(PROJECTS_ROOT)보다 관대했다
 * — green인 채로 프로덕션 500이 났던 실사례. chmod 0555로 실제 RO 조건을 재현해 409를 검증한다.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

async function loadApp() {
  const mod = await import("../../index.js");
  return mod.app;
}

/** <root>/<project>/openspec/changes/<change>/specs/<cap>/spec.md 픽스처. */
function makeProjectChange(root: string, project: string, change: string, cap = "scr-a"): string {
  const changeDir = join(root, project, "openspec", "changes", change);
  const specDir = join(changeDir, "specs", cap);
  mkdirSync(specDir, { recursive: true });
  writeFileSync(
    join(specDir, "spec.md"),
    "### Requirement: 화면 A\n#### Scenario: 진입\n- **WHEN** 탭한다\n- **THEN** 화면에 표시한다 화면 위젯 버튼\n",
  );
  return changeDir;
}

describe("graph API — 크로스프로젝트 ?project=", () => {
  const ORIG_PROJECTS = process.env.PROJECTS_ROOT;
  const ORIG_OPENSPEC = process.env.OPENSPEC_ROOT;
  let projectsRoot: string;
  let globalOpenspec: string;

  beforeEach(() => {
    projectsRoot = mkdtempSync(join(tmpdir(), "xproj-"));
    // 두 프로젝트: 각자 고유 change
    makeProjectChange(projectsRoot, "wowa-app", "feature-a");
    makeProjectChange(projectsRoot, "ssoksok", "feature-b");
    process.env.PROJECTS_ROOT = projectsRoot;

    // 글로벌 루트에는 별도 change(글로벌 경로 불변 검증용)
    globalOpenspec = mkdtempSync(join(tmpdir(), "xglobal-"));
    const gdir = join(globalOpenspec, "changes", "global-change", "specs", "scr-g");
    mkdirSync(gdir, { recursive: true });
    writeFileSync(
      join(gdir, "spec.md"),
      "### Requirement: 글로벌\n#### Scenario: 진입\n- **THEN** 화면에 표시한다 위젯\n",
    );
    process.env.OPENSPEC_ROOT = globalOpenspec;
  });

  afterEach(() => {
    rmSync(projectsRoot, { recursive: true, force: true });
    rmSync(globalOpenspec, { recursive: true, force: true });
    if (ORIG_PROJECTS === undefined) delete process.env.PROJECTS_ROOT;
    else process.env.PROJECTS_ROOT = ORIG_PROJECTS;
    if (ORIG_OPENSPEC === undefined) delete process.env.OPENSPEC_ROOT;
    else process.env.OPENSPEC_ROOT = ORIG_OPENSPEC;
  });

  it("?project= 있으면 그 프로젝트 change로 5종 뷰 200 (404 없음)", async () => {
    const app = await loadApp();
    for (const view of ["graph", "wireframe", "prd", "spec-tree"]) {
      const res = await request(app).get(`/api/changes/feature-a/${view}?project=wowa-app`);
      expect(res.status).toBe(200);
    }
    // 다른 프로젝트의 change는 자기 project로 열려야 한다
    const b = await request(app).get("/api/changes/feature-b/graph?project=ssoksok");
    expect(b.status).toBe(200);
  });

  it("?project= 없으면 글로벌 루트 기준(현행 동작 불변)", async () => {
    const app = await loadApp();
    // 글로벌 루트에 있는 change는 project 없이 200
    const g = await request(app).get("/api/changes/global-change/graph");
    expect(g.status).toBe(200);
    // 프로젝트에만 있는 change는 project 없이는 글로벌에 없으므로 404
    const noProj = await request(app).get("/api/changes/feature-a/graph");
    expect(noProj.status).toBe(404);
  });

  it("project=../.. 조작 → 404 (루트 밖 접근 없음)", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes/feature-a/graph?project=..%2f..");
    expect(res.status).toBe(404);
  });

  it("dotfile 프로젝트명(.ssh 등) → 404 (화이트리스트가 문 앞에서 차단, review C-1)", async () => {
    // 픽스처에 실재하는 숨김 디렉토리(openspec 구조까지 갖춰도) 통과 금지.
    makeProjectChange(projectsRoot, ".hidden", "sneaky-change");
    const app = await loadApp();
    const dot = await request(app).get("/api/changes/sneaky-change/graph?project=.hidden");
    expect(dot.status).toBe(404);
    const ssh = await request(app).get("/api/changes/x/graph?project=.ssh");
    expect(ssh.status).toBe(404);
    const space = await request(app).get(`/api/changes/x/graph?project=${encodeURIComponent("a b")}`);
    expect(space.status).toBe(404);
  });

  it("미지 프로젝트 → 404", async () => {
    const app = await loadApp();
    const res = await request(app).get("/api/changes/feature-a/graph?project=no-such-project");
    expect(res.status).toBe(404);
  });

  it("PUT layout ?project= — 그 프로젝트 change의 viz에 오버레이 저장", async () => {
    const app = await loadApp();
    const res = await request(app)
      .put("/api/changes/feature-a/layout?project=wowa-app")
      .send({ "screen-scr-a": { x: 10, y: 20 } });
    expect(res.status).toBe(200);
    const overlay = join(
      projectsRoot,
      "wowa-app",
      "openspec",
      "changes",
      "feature-a",
      "viz",
      "graph-overlay.json",
    );
    expect(existsSync(overlay)).toBe(true);
    expect(JSON.parse(readFileSync(overlay, "utf-8"))["screen-scr-a"]).toEqual({ x: 10, y: 20 });
  });

  it("PUT layout — 쓰기 불가 대상(RO 루트)은 409 read_only_target, 내부 경로 미노출 (task 3.1, design D5)", async () => {
    const changeDir = makeProjectChange(projectsRoot, "wowa-app", "feature-a");
    // 프로덕션 재현: change 디렉토리 자체를 RO로 만들어 viz/ mkdir이 EROFS/ENOENT로 실패하게 한다
    // (OVERLAY_ROOT 미설정 상태 — 실제 사고 당시와 동일 조건, changes.ts 레거시 폴백 경로 타겟).
    chmodSync(changeDir, 0o555);
    try {
      const app = await loadApp();
      const res = await request(app)
        .put("/api/changes/feature-a/layout?project=wowa-app")
        .send({ "screen-scr-a": { x: 1, y: 2 } });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: "read_only_target" });
      // 내부 파일시스템 경로가 응답 본문에 노출되지 않는다(30-security)
      expect(JSON.stringify(res.body)).not.toContain(changeDir);
      expect(JSON.stringify(res.body)).not.toContain(projectsRoot);
    } finally {
      chmodSync(changeDir, 0o755); // afterEach의 rmSync가 지울 수 있도록 원복
    }
  });
});
