/**
 * wire-nav 브리지 테스트 — 와이어 문서 안의 클릭으로 화면을 전환하는 postMessage 계약.
 *
 * 배경: 화면 선택 툴바(프로젝트 목록/기획 뷰/기능명세)를 제거하고, 전환 수단을 와이어 안의 요소
 * (`data-nav`) 클릭으로 옮겼다. 문서는 opaque origin이라 부모가 내부 DOM을 못 보므로 문서가
 * postMessage로 알리는 구조다.
 *
 * 검증 대상:
 *  - isWireNavMessage — 신뢰 불가 입력 좁힘(부모가 이 결과로 화면을 바꾼다)
 *  - WIRE_NAV_SCRIPT — 계약 타입 송신·이벤트 위임·네트워크 미사용
 *  - 보안 불변식 — 브리지 도입이 sandbox/CSP를 약화시키지 않았다(allow-same-origin 여전히 없음)
 *  - 픽스처 배선 — 화면 전환 경로가 실제로 존재하고 대상 id가 실재 화면이다(끊긴 링크 방지)
 */
import {
  WIRE_DOC_CSP,
  WIRE_IFRAME_SANDBOX,
  WIRE_NAV_MESSAGE_TYPE,
  WIRE_NAV_SCRIPT,
  isWireNavMessage,
} from "@flowforge/shared";
import { PLANNING_WIREFRAME_FIXTURE } from "../parser/planningWireframeFixture.js";

describe("isWireNavMessage — 신뢰 불가 입력 좁힘", () => {
  it("정상 메시지를 통과시킨다", () => {
    expect(isWireNavMessage({ type: "wf-nav", screenId: "skeleton" })).toBe(true);
  });

  it("type이 다르거나 없으면 거부한다(다른 앱·확장이 보낸 메시지 배제)", () => {
    expect(isWireNavMessage({ type: "other", screenId: "skeleton" })).toBe(false);
    expect(isWireNavMessage({ screenId: "skeleton" })).toBe(false);
  });

  it("screenId가 문자열이 아니거나 비어 있으면 거부한다", () => {
    expect(isWireNavMessage({ type: "wf-nav", screenId: "" })).toBe(false);
    expect(isWireNavMessage({ type: "wf-nav", screenId: 42 })).toBe(false);
    expect(isWireNavMessage({ type: "wf-nav" })).toBe(false);
  });

  it("객체가 아닌 값을 크래시 없이 거부한다", () => {
    expect(isWireNavMessage(null)).toBe(false);
    expect(isWireNavMessage(undefined)).toBe(false);
    expect(isWireNavMessage("wf-nav")).toBe(false);
    expect(isWireNavMessage(["wf-nav"])).toBe(false);
    expect(isWireNavMessage(0)).toBe(false);
  });
});

describe("WIRE_NAV_SCRIPT — 문서에 심는 송신 스크립트", () => {
  it("계약된 메시지 타입을 송신한다(부모 리스너와 같은 값 — drift 방지)", () => {
    expect(WIRE_NAV_SCRIPT).toContain(`type: '${WIRE_NAV_MESSAGE_TYPE}'`);
    expect(WIRE_NAV_SCRIPT).toContain("parent.postMessage");
  });

  it("data-nav 요소를 이벤트 위임(closest)으로 잡는다", () => {
    expect(WIRE_NAV_SCRIPT).toContain("[data-nav]");
    expect(WIRE_NAV_SCRIPT).toContain("closest");
  });

  it("네트워크 송신을 하지 않는다(CSP connect-src 'none'과 정합)", () => {
    expect(WIRE_NAV_SCRIPT).not.toContain("fetch(");
    expect(WIRE_NAV_SCRIPT).not.toContain("XMLHttpRequest");
  });
});

describe("보안 불변식 — 브리지가 격리를 약화시키지 않았다", () => {
  it("sandbox에 allow-same-origin이 여전히 없다(postMessage만으로 성립)", () => {
    expect(WIRE_IFRAME_SANDBOX).toBe("allow-scripts");
    expect(WIRE_IFRAME_SANDBOX).not.toContain("allow-same-origin");
  });

  it("문서 CSP가 여전히 외부 네트워크를 차단한다", () => {
    expect(WIRE_DOC_CSP).toContain("connect-src 'none'");
    expect(WIRE_DOC_CSP).toContain("default-src 'none'");
  });
});

describe("픽스처 화면 전환 배선", () => {
  const byId = new Map(PLANNING_WIREFRAME_FIXTURE.map((s) => [s.id, s]));

  it("모든 화면 문서에 송신 스크립트가 심겨 있다", () => {
    for (const s of PLANNING_WIREFRAME_FIXTURE) {
      expect(s.html).toContain("parent.postMessage");
    }
  });

  it("data-nav 대상이 전부 실재하는 화면 id다(끊긴 전환 경로 없음)", () => {
    const ids = new Set(PLANNING_WIREFRAME_FIXTURE.map((s) => s.id));
    for (const s of PLANNING_WIREFRAME_FIXTURE) {
      for (const m of s.html.matchAll(/data-nav="([^"]+)"/g)) {
        expect(ids.has(String(m[1]))).toBe(true);
      }
    }
  });

  it("데스크탑: 카드 클릭으로 목록→기획 뷰, 좌측 메뉴로 기획 뷰→기능명세로 간다", () => {
    expect(byId.get("grid")?.html).toContain('class="card" data-nav="skeleton"');
    expect(byId.get("skeleton")?.html).toContain('data-nav="features"');
  });

  it("데스크탑: 기능명세·기획 뷰에서 목록으로 되돌아갈 수 있다(막다른 화면 없음)", () => {
    expect(byId.get("features")?.html).toContain('data-nav="grid"');
    expect(byId.get("skeleton")?.html).toContain('data-nav="grid"');
  });

  it("모바일: 카드로 진입하고 뒤로가기 버튼으로 목록에 돌아온다", () => {
    expect(byId.get("grid-m")?.html).toContain('data-nav="skeleton-m"');
    expect(byId.get("skeleton-m")?.html).toContain('data-nav="grid-m"');
  });

  it("모바일 화면은 모바일 화면끼리만 잇는다(디바이스 교차 전환 없음)", () => {
    for (const s of PLANNING_WIREFRAME_FIXTURE) {
      for (const m of s.html.matchAll(/data-nav="([^"]+)"/g)) {
        expect(byId.get(String(m[1]))?.device).toBe(s.device);
      }
    }
  });
});

/**
 * 화면 **안**의 이벤트가 내용을 실제로 바꾸는지(껍데기 반응 방지).
 *
 * 회귀 대상: 예전엔 탭을 눌러도 밑줄(.on)만 옮겨가고 본문은 고정, 검색창은 "검색: xxx" 문구만 뜨고
 * 목록은 그대로였다(라이브 실측). 와이어의 값어치가 "실제로 동작하는 화면"이므로 그 반응이 살아있어야 한다.
 */
describe("화면 내 이벤트 → 내용 변경", () => {
  const byId = new Map(PLANNING_WIREFRAME_FIXTURE.map((s) => [s.id, s]));

  it("기획 뷰: 탭별 본문 데이터가 있고 클릭 시 갈아끼운다(밑줄만 바뀌지 않는다)", () => {
    const html = byId.get("skeleton")?.html ?? "";
    // 탭 3종 각각의 본문이 데이터로 존재
    expect(html).toContain("PANELS");
    expect(html).toContain("panel.innerHTML");
    for (const key of ["prd", "features", "flow"]) {
      expect(html).toContain(`data-tab="${key}"`);
    }
    // 유저플로우 탭 본문은 PRD 본문과 다른 내용이어야 한다(고정 본문 회귀 탐지)
    expect(html).toContain("시작 → 로그인");
  });

  it("기획 뷰: 좌측 메뉴도 죽은 링크가 아니다(클릭하면 탭이 열린다)", () => {
    const html = byId.get("skeleton")?.html ?? "";
    expect(html).toContain('data-tab-link="prd"');
    expect(html).toContain('data-tab-link="flow"');
  });

  it("기능명세: 검색이 트리를 실제로 거른다(문구만 바뀌지 않는다)", () => {
    const html = byId.get("features")?.html ?? "";
    expect(html).toContain("tree.innerHTML");
    expect(html).toContain(".filter(");
    expect(html).toContain("일치하는 기능이 없습니다"); // 0건 경로 존재
  });

  it("모바일 목록: 검색이 카드를 실제로 거른다", () => {
    const html = byId.get("grid-m")?.html ?? "";
    expect(html).toContain("plist.innerHTML");
    expect(html).toContain(".filter(");
    expect(html).toContain("일치하는 프로젝트가 없습니다");
  });

  it("모바일 기획 뷰: 탭이 본문을 갈아끼운다", () => {
    const html = byId.get("skeleton-m")?.html ?? "";
    expect(html).toContain("MPANELS");
    expect(html).toContain("mpanel.innerHTML");
  });

  it("사용자 입력을 그대로 innerHTML에 넣지 않는다(문서 안 XSS 자해 방지)", () => {
    // 검색어는 esc()를 거치거나 textContent로만 나가야 한다. innerHTML에 q.value 직결이면 위험.
    for (const s of PLANNING_WIREFRAME_FIXTURE) {
      expect(s.html).not.toMatch(/innerHTML\s*=\s*[^;]*\bq\.value\b/);
      expect(s.html).not.toMatch(/innerHTML\s*=\s*[^;]*\bpq\.value\b/);
    }
  });
});
