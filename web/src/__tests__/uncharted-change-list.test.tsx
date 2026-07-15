/** 기획 없는 프로젝트의 change 목록 노출 테스트 (uncharted-project-change-list).
 * 1.1: 활성 change 2개 → 항목 2개 렌더 + 클릭 시 onOpenChange(name) 호출.
 * 1.2: 활성 change 없음 → 빈 상태 표기, 링크를 지어내지 않음.
 * 3.1: hasCharter=true → 회귀 없음(섹션 자체 미노출). 무력화 프로브: hasCharter 가드를
 *      지우면(항상 렌더) 이 테스트가 red — 회귀 가드가 실제로 걸려 있음을 고정. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { UnchartedChangeList } from "../UnchartedChangeList.js";

afterEach(() => cleanup());

describe("UnchartedChangeList", () => {
  it("1.1 활성 change가 있으면 각각 클릭 가능한 항목으로 렌더되고 클릭 시 onOpenChange(name) 호출", () => {
    const onOpenChange = vi.fn();
    render(<UnchartedChangeList hasCharter={false} changeNames={["a", "b"]} onOpenChange={onOpenChange} />);

    const list = screen.getByTestId("uncharted-change-list");
    expect(list).toBeInTheDocument();
    expect(screen.getByTestId("uncharted-change-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("uncharted-change-item-b")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("uncharted-change-item-a"));
    expect(onOpenChange).toHaveBeenCalledWith("a");
  });

  it("1.2 활성 change가 없으면 목록을 지어내지 않고 빈 상태를 정직하게 표기", () => {
    const onOpenChange = vi.fn();
    render(<UnchartedChangeList hasCharter={false} changeNames={[]} onOpenChange={onOpenChange} />);

    expect(screen.queryByTestId("uncharted-change-list")).toBeNull();
    expect(screen.getByTestId("uncharted-change-list-empty")).toHaveTextContent("활성 change 없음");
  });

  it("3.1 hasCharter=true(기획 있는 프로젝트)이면 change가 있어도 섹션을 렌더하지 않는다(회귀 없음)", () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <UnchartedChangeList hasCharter={true} changeNames={["a", "b"]} onOpenChange={onOpenChange} />,
    );

    expect(screen.queryByTestId("uncharted-change-list")).toBeNull();
    expect(screen.queryByTestId("uncharted-change-list-empty")).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });
});
