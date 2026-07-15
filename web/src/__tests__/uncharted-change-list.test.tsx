/** 기획 없는 프로젝트의 change 목록 노출 테스트 (uncharted-project-change-list).
 * 1.1: 활성 change 2개 → 항목 2개 렌더 + 클릭 시 onOpenChange(name) 호출.
 * 1.2: 활성 change 없음 → 빈 상태 표기, 링크를 지어내지 않음. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { UnchartedChangeList } from "../UnchartedChangeList.js";

afterEach(() => cleanup());

describe("UnchartedChangeList", () => {
  it("1.1 활성 change가 있으면 각각 클릭 가능한 항목으로 렌더되고 클릭 시 onOpenChange(name) 호출", () => {
    const onOpenChange = vi.fn();
    render(<UnchartedChangeList changeNames={["a", "b"]} onOpenChange={onOpenChange} />);

    const list = screen.getByTestId("uncharted-change-list");
    expect(list).toBeInTheDocument();
    expect(screen.getByTestId("uncharted-change-item-a")).toBeInTheDocument();
    expect(screen.getByTestId("uncharted-change-item-b")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("uncharted-change-item-a"));
    expect(onOpenChange).toHaveBeenCalledWith("a");
  });

  it("1.2 활성 change가 없으면 목록을 지어내지 않고 빈 상태를 정직하게 표기", () => {
    const onOpenChange = vi.fn();
    render(<UnchartedChangeList changeNames={[]} onOpenChange={onOpenChange} />);

    expect(screen.queryByTestId("uncharted-change-list")).toBeNull();
    expect(screen.getByTestId("uncharted-change-list-empty")).toHaveTextContent("활성 change 없음");
  });
});
