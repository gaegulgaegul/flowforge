/** FlowDetailPanel 화면 허브 상호참조 렌더 테스트 — flowforge-screen-crosslink C.1 + E.1~E.3.
 *
 * 화면(page) 노드 + 와이어/기능 있음 → 연관 와이어 프리뷰 + 연관 기능 목록 렌더.
 * 화면 아님 노드 → 두 섹션 미노출(흐름 섹션만, 기존 동작 보존).
 * 연결 0개 / dangling → 빈 상태 렌더, 크래시 없음. */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { WireDoc } from "@flowforge/shared";
import { FlowDetailPanel, type ScreenCrosslinkData } from "../FlowDetailPanel.js";
import type { SpecNodeData } from "../graphAdapter.js";

afterEach(() => cleanup());

function screenNode(overrides: Partial<SpecNodeData> = {}): SpecNodeData {
  return {
    label: "홈 화면",
    kind: "screen",
    screenId: "home",
    incoming: [],
    outgoing: [],
    ...overrides,
  };
}

function actionNode(): SpecNodeData {
  return { label: "권한 확인", kind: "action", incoming: [], outgoing: [] };
}

const WIRE: WireDoc = {
  id: "home",
  title: "홈",
  device: "desktop",
  html: "<!doctype html><title>홈</title><p>본문</p>",
};

describe("FlowDetailPanel 화면 허브 상호참조", () => {
  it("C.1 화면 노드 + 와이어/기능 있음 → 연관 와이어 프리뷰 + 연관 기능 목록 렌더", () => {
    const crosslink: ScreenCrosslinkData = { wire: WIRE, featureLabels: ["알림 설정", "프로필 편집"] };
    render(<FlowDetailPanel node={screenNode()} onClose={() => {}} crosslink={crosslink} onOpenWire={() => {}} />);
    // 연관 와이어 섹션 + 프리뷰(디바이스 프레임) + 열기 버튼.
    expect(screen.getByTestId("flow-detail-wire")).toBeInTheDocument();
    expect(screen.getByTestId("wf-df-desktop")).toBeInTheDocument();
    expect(screen.getByTestId("flow-detail-open-wire")).toBeInTheDocument();
    // 연관 기능 섹션 + 상세기능 라벨 칩.
    const features = screen.getByTestId("flow-detail-features");
    expect(features).toBeInTheDocument();
    expect(features).toHaveTextContent("알림 설정");
    expect(features).toHaveTextContent("프로필 편집");
  });

  it("E.1 화면 아님(행동) 노드 → 상호참조 섹션 미노출(흐름 섹션만)", () => {
    const crosslink: ScreenCrosslinkData = { wire: WIRE, featureLabels: ["알림 설정"] };
    render(<FlowDetailPanel node={actionNode()} onClose={() => {}} crosslink={crosslink} />);
    expect(screen.queryByTestId("flow-detail-wire")).toBeNull();
    expect(screen.queryByTestId("flow-detail-features")).toBeNull();
  });

  it("E.2 연결 0개(와이어도 기능도 없음) → 빈 상태, 크래시 없음", () => {
    const crosslink: ScreenCrosslinkData = { wire: null, featureLabels: [] };
    render(<FlowDetailPanel node={screenNode()} onClose={() => {}} crosslink={crosslink} />);
    expect(screen.getByTestId("flow-detail-wire")).toHaveTextContent("연결된 와이어 없음");
    expect(screen.getByTestId("flow-detail-features")).toHaveTextContent("연관 기능 없음");
  });

  it("E.3 dangling 화면 id(레지스트리·와이어 어디에도 없음) → 빈 상태, id 숨기지 않고 크래시 없음", () => {
    // crosslink 미제공(undefined) = 조인 결과 없음. 화면 노드지만 상호참조 데이터가 없어도 빈 상태로 렌더.
    render(<FlowDetailPanel node={screenNode({ screenId: "ghost" })} onClose={() => {}} />);
    expect(screen.getByTestId("flow-detail-wire")).toHaveTextContent("연결된 와이어 없음");
    expect(screen.getByTestId("flow-detail-features")).toHaveTextContent("연관 기능 없음");
  });

  it("흐름 섹션은 화면 노드에서도 그대로 병존한다(회귀 없음)", () => {
    const node = screenNode({
      outgoing: [{ otherId: "n2", otherLabel: "다음 화면", edgeLabel: "이동", edgecase: false, dangling: false }],
    });
    render(<FlowDetailPanel node={node} onClose={() => {}} crosslink={{ wire: WIRE, featureLabels: [] }} />);
    expect(screen.getByText("➡️ 나가는 흐름")).toBeInTheDocument();
    expect(screen.getByText("⬅️ 들어오는 흐름")).toBeInTheDocument();
  });
});
