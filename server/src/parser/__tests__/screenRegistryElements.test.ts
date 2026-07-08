/**
 * screenRegistry element 파싱 테스트 — 화면 헤더 컨텍스트 아래
 * `<!-- element: <kind> "<label>" [-> detail:<라벨>] [-> screen:<id>] -->` 주석 수집(additive).
 *
 * RED: ScreenNode.elements? + ScreenElement 파싱이 없으면 실패. 기존 id/label/N:M 링크는
 * 무영향(회귀 0)이어야 한다 — 같은 파일의 hand-built 라인으로 검증한다.
 */
import { buildScreenRegistryFromLines } from "../screenRegistry.js";

/** `## 화면목록` 컨텍스트로 감싼 라인 배열 헬퍼(테스트 가독). */
function screensSection(...body: string[]): string[] {
  return ["# 기능명세", "", "## 화면목록", "", ...body];
}

describe("screenRegistry — element 파싱(additive)", () => {
  it("한 화면에 여러 요소를 순서 보존해 수집한다", () => {
    const { screens } = buildScreenRegistryFromLines(
      screensSection(
        "### 로그인 화면",
        "<!-- screen: login -->",
        '<!-- element: field "이메일" -->',
        '<!-- element: field "비밀번호" -->',
        '<!-- element: button "로그인" -->',
      ),
    );
    const login = screens.find((s) => s.id === "login")!;
    expect(login.elements).toBeDefined();
    expect(login.elements!.map((e) => e.label)).toEqual(["이메일", "비밀번호", "로그인"]);
    expect(login.elements!.map((e) => e.kind)).toEqual(["field", "field", "button"]);
  });

  it("kind 5종을 모두 인식한다", () => {
    const { screens } = buildScreenRegistryFromLines(
      screensSection(
        "### 홈 화면",
        "<!-- screen: home -->",
        '<!-- element: header "제목" -->',
        '<!-- element: list "피드" -->',
        '<!-- element: button "새로고침" -->',
        '<!-- element: field "검색" -->',
        '<!-- element: empty "빈 상태" -->',
      ),
    );
    const home = screens.find((s) => s.id === "home")!;
    expect(home.elements!.map((e) => e.kind)).toEqual(["header", "list", "button", "field", "empty"]);
  });

  it("옵션(detail/screen) 유무를 각각 파싱한다", () => {
    const { screens } = buildScreenRegistryFromLines(
      screensSection(
        "### 로그인 화면",
        "<!-- screen: login -->",
        '<!-- element: button "로그인" -> screen:home -->',
        '<!-- element: button "저장" -> detail:저장처리 -->',
        '<!-- element: button "이동" -> detail:이동기능 -> screen:home -->',
        '<!-- element: field "이메일" -->',
      ),
    );
    const els = screens.find((s) => s.id === "login")!.elements!;
    expect(els[0]).toMatchObject({ kind: "button", label: "로그인", screen: "home" });
    expect(els[0]!.detail).toBeUndefined();
    expect(els[1]).toMatchObject({ kind: "button", label: "저장", detail: "저장처리" });
    expect(els[1]!.screen).toBeUndefined();
    expect(els[2]).toMatchObject({ kind: "button", label: "이동", detail: "이동기능", screen: "home" });
    expect(els[3]).toMatchObject({ kind: "field", label: "이메일" });
    expect(els[3]!.detail).toBeUndefined();
    expect(els[3]!.screen).toBeUndefined();
  });

  it("요소가 없는 화면은 elements가 비거나 undefined다(지어내지 않음)", () => {
    const { screens } = buildScreenRegistryFromLines(
      screensSection("### 설정 화면", "<!-- screen: settings -->"),
    );
    const settings = screens.find((s) => s.id === "settings")!;
    expect(settings.elements ?? []).toEqual([]);
  });

  it("기존 id·label·N:M 링크 파싱은 무영향(회귀 0)", () => {
    const { screens, links } = buildScreenRegistryFromLines([
      "# 기능명세",
      "",
      "## 화면목록",
      "",
      "### 로그인 화면",
      "<!-- screen: login -->",
      '<!-- element: field "이메일" -->',
      "",
      "### 홈 화면",
      "<!-- screen: home -->",
      "",
      "## 상세기능",
      "",
      "#### 이메일 로그인",
      "<!-- screens: login -->",
      "#### 피드 조회",
      "<!-- screens: home -->",
    ]);
    // 화면 id/label 무변
    expect(screens.map((s) => s.id)).toEqual(["login", "home"]);
    expect(screens.map((s) => s.label)).toEqual(["로그인 화면", "홈 화면"]);
    // N:M 링크 무변
    expect(links).toEqual([
      { detailLabel: "이메일 로그인", screenIds: ["login"] },
      { detailLabel: "피드 조회", screenIds: ["home"] },
    ]);
    // 다른 섹션(## 상세기능)의 라인은 요소로 오염되지 않음(login 요소는 그 1개뿐)
    expect(screens.find((s) => s.id === "login")!.elements!.map((e) => e.label)).toEqual(["이메일"]);
  });
});
