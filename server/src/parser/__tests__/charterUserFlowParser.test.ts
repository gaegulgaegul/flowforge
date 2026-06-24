/**
 * charterUserFlowParser 단위 테스트 — charter user-flow.md 문법 포트.
 * flow/화면(컴포넌트+경로)/step/goto(화면·엔드포인트) + 문서 SEED 감지를 검증.
 */
import { parseCharterUserFlow } from "../charterUserFlowParser.js";

const SEED_DOC = [
  "# 쏙쏙 상주 유저 플로우",
  "> owner: @lim_myeongseop",
  "> ⚠️ SEED — 코드에서 역생성한 초안.",
  "",
  "## flow: login",
  "가족만 들어오는 초대코드 기반 로그인.",
  "### 화면: 로그인·가입 (InviteCodeScreen, /login)",
  "- step: 이메일·비밀번호 입력",
  "- step: 로그인 버튼",
  "- goto: (POST /api/auth/login)",
  "- goto: 홈 (HomeScreen)",
  "",
  "## flow: children",
  "### 화면: 홈 (HomeScreen, /)",
  "- step: 날짜별 사진 목록",
  "- goto: (GET /api/children)",
  "- goto: 업로드 (UploadScreen)",
].join("\n");

describe("parseCharterUserFlow", () => {
  it("flow/화면/step/goto를 구조화하고 화면 heading의 컴포넌트·경로를 분해한다", () => {
    const uf = parseCharterUserFlow(SEED_DOC);

    expect(uf.flows.map((f) => f.key)).toEqual(["login", "children"]);

    const login = uf.flows[0]!;
    expect(login.screens).toHaveLength(1);
    const loginScreen = login.screens[0]!;
    expect(loginScreen.name).toBe("로그인·가입");
    expect(loginScreen.rawHeading).toBe("로그인·가입 (InviteCodeScreen, /login)");
    expect(loginScreen.component).toBe("InviteCodeScreen");
    expect(loginScreen.path).toBe("/login");
    expect(loginScreen.steps).toEqual(["이메일·비밀번호 입력", "로그인 버튼"]);
  });

  it("endpoint goto는 (METHOD /path)로, 화면 goto는 후행 (Component)를 떼어낸 화면명으로 파싱한다", () => {
    const uf = parseCharterUserFlow(SEED_DOC);
    const loginScreen = uf.flows[0]!.screens[0]!;

    expect(loginScreen.gotos).toHaveLength(2);
    expect(loginScreen.gotos[0]).toEqual({
      kind: "endpoint",
      method: "POST",
      path: "/api/auth/login",
    });
    // "홈 (HomeScreen)" → target "홈"
    expect(loginScreen.gotos[1]).toEqual({ kind: "screen", target: "홈" });

    // children flow의 화면 goto도 동일 규칙
    const homeScreen = uf.flows[1]!.screens[0]!;
    expect(homeScreen.gotos).toEqual([
      { kind: "endpoint", method: "GET", path: "/api/children" },
      { kind: "screen", target: "업로드" },
    ]);
  });

  it("문서 헤더(첫 ## 이전)에 SEED가 있으면 seed:true", () => {
    expect(parseCharterUserFlow(SEED_DOC).seed).toBe(true);
  });

  it("SEED 마킹이 없으면 seed:false", () => {
    const noSeed = [
      "# 제목",
      "> owner: @who",
      "",
      "## flow: f",
      "### 화면: 화면 A (CompA, /a)",
      "- step: 뭔가",
    ].join("\n");
    expect(parseCharterUserFlow(noSeed).seed).toBe(false);
  });

  it("본문(첫 ## 이후)에 나오는 SEED 단어는 문서 seed로 보지 않는다", () => {
    const bodySeed = [
      "# 제목",
      "## flow: f",
      "### 화면: SEED 데이터 화면 (Comp, /x)",
      "- step: SEED 표시",
    ].join("\n");
    expect(parseCharterUserFlow(bodySeed).seed).toBe(false);
  });

  it("괄호 없는 화면 heading은 전체가 name이고 component/path는 null", () => {
    const uf = parseCharterUserFlow(["## flow: f", "### 화면: 홈", "- goto: 홈"].join("\n"));
    const screen = uf.flows[0]!.screens[0]!;
    expect(screen.name).toBe("홈");
    expect(screen.component).toBeNull();
    expect(screen.path).toBeNull();
    expect(screen.gotos[0]).toEqual({ kind: "screen", target: "홈" });
  });

  it("flow 없이 등장한 화면은 (unscoped) flow로 묶인다", () => {
    const uf = parseCharterUserFlow(["### 화면: 외톨이 (X, /x)", "- step: s"].join("\n"));
    expect(uf.flows).toHaveLength(1);
    expect(uf.flows[0]!.key).toBe("(unscoped)");
    expect(uf.flows[0]!.screens[0]!.name).toBe("외톨이");
  });
});
