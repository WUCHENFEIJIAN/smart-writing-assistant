import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "@/components/shared/error-boundary";

function BrokenView(): never {
  throw new Error("private draft detail");
}

describe("ErrorBoundary", () => {
  it("shows a recovery screen without exposing the runtime error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", { configurable: true, value: { ...originalLocation, reload } });
    const user = userEvent.setup();

    render(<ErrorBoundary><BrokenView /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("页面暂时无法显示");
    expect(screen.queryByText("private draft detail")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "重新载入" }));
    expect(reload).toHaveBeenCalledOnce();

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });
});
