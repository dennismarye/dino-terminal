import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentViewModeSwitch } from "./AgentViewModeSwitch";

describe("AgentViewModeSwitch", () => {
  it("test_callbacks_and_no_op_on_active_segment", () => {
    const onRich = vi.fn();
    const onClassic = vi.fn();
    const { rerender } = render(
      <AgentViewModeSwitch
        mode="classic"
        onSelectClassic={onClassic}
        onSelectRich={onRich}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Classic" }));
    expect(onClassic).not.toHaveBeenCalled();
    expect(onRich).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Rich" }));
    expect(onRich).toHaveBeenCalledTimes(1);

    rerender(
      <AgentViewModeSwitch
        mode="rich"
        onSelectClassic={onClassic}
        onSelectRich={onRich}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rich" }));
    expect(onRich).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Classic" }));
    expect(onClassic).toHaveBeenCalledTimes(1);
  });
});
