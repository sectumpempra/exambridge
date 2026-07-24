import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VectorGeometryLabWorkspace } from "@/pages/vector-geometry-lab/VectorGeometryLabWorkspace";
import { ResultsPanel } from "@/pages/vector-geometry-lab/components/ResultsPanel";
import { StoragePanel } from "@/pages/vector-geometry-lab/components/StoragePanel";
import { createStubThree } from "./stub-three.js";

async function renderApp(stub = createStubThree()) {
  render(<VectorGeometryLabWorkspace loader={stub.loader} />);
  await waitFor(() =>
    expect(screen.getByTestId("viewport3d")).toHaveAttribute("data-status", "ready"),
  );
  return stub;
}

describe("VectorGeometryLabWorkspace — structure and examples", () => {
  it("renders the 16 built-in examples and the default solved analysis", async () => {
    await renderApp();
    const select = screen.getByLabelText("Built-in example");
    expect(select).toBeInTheDocument();
    // Scoped to the example picker: other selects (PNG scale) also use <option>.
    expect(within(select).getAllByRole("option")).toHaveLength(16);
    // Default example: angle between two vectors → perpendicular, 90°.
    expect(screen.getAllByText(/90°/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("perpendicular").length).toBeGreaterThan(0);
    expect(screen.getByText("solved")).toBeInTheDocument();
  });

  it("loads the 3d module lazily through the injected loader", async () => {
    const stub = await renderApp();
    expect(stub.loaderCalls).toHaveLength(1);
    expect(stub.detectWebGLSupport).toHaveBeenCalled();
    expect(stub.buildSceneGraph).toHaveBeenCalled();
    expect(stub.createVectorGeometryRenderer).toHaveBeenCalled();
  });

  it("switching to the degenerate example shows the refusal, never a fake answer", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.selectOptions(screen.getByLabelText("Built-in example"), "degenerate-input");
    expect(await screen.findByText(/refused \(zero-vector\)/)).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("zero vector");
    expect(alert.textContent).toContain("no result is displayed");
    // No angle-shaped answer anywhere.
    expect(screen.queryByText(/θ = \d+°/)).not.toBeInTheDocument();
  });
});

describe("VectorGeometryLabWorkspace — WebGL degradation (spec §10.11)", () => {
  it("probe failure → unavailable banner + complete text results", async () => {
    const stub = createStubThree({ webglSupported: false });
    render(<VectorGeometryLabWorkspace loader={stub.loader} />);
    const viewport = await screen.findByTestId("viewport3d");
    await waitFor(() =>
      expect(viewport).toHaveAttribute("data-status", "unavailable"),
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("三维视图暂不可用");
    // The text/table results are fully rendered regardless.
    expect(screen.getAllByText(/90°/).length).toBeGreaterThan(0);
    expect(screen.getByText("Worked solution & verification")).toBeInTheDocument();
  });

  it("renderer creation failure (structured webgl-unavailable) → same fallback", async () => {
    const stub = createStubThree({ rendererOk: false });
    render(<VectorGeometryLabWorkspace loader={stub.loader} />);
    const viewport = await screen.findByTestId("viewport3d");
    await waitFor(() =>
      expect(viewport).toHaveAttribute("data-status", "unavailable"),
    );
    expect(screen.getAllByText(/90°/).length).toBeGreaterThan(0);
  });
});

describe("VectorGeometryLabWorkspace — coordinate editing", () => {
  it("editing a coordinate re-runs the analysis", async () => {
    const user = userEvent.setup();
    await renderApp();
    const input = screen.getByLabelText("vector u components x");
    await user.clear(input);
    await user.type(input, "2");
    // u becomes (2, 2, 3); u·v = -4 + 2 + 0 = -2 → obtuse, θ ≈ 99.594°
    await waitFor(() =>
      expect(screen.getAllByText("obtuse").length).toBeGreaterThan(0),
    );
  });

  it("invalid input shows a validation error and keeps the last valid results", async () => {
    const user = userEvent.setup();
    await renderApp();
    const input = screen.getByLabelText("vector u components x");
    await user.clear(input);
    await user.type(input, "abc");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Invalid coordinates");
    expect(alert.textContent).toContain("abc");
    // Last valid analysis still visible.
    expect(screen.getAllByText(/90°/).length).toBeGreaterThan(0);
    // The offending slot is flagged invalid.
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

describe("VectorGeometryLabWorkspace — panel interactions drive the renderer stub", () => {
  it("visibility checkbox toggles setObjectVisibility", async () => {
    const user = userEvent.setup();
    const stub = await renderApp();
    const toggle = screen.getByLabelText("Show vector u");
    await user.click(toggle);
    expect(stub.handle.setObjectVisibility).toHaveBeenCalledWith("u", false);
    await user.click(toggle);
    expect(stub.handle.setObjectVisibility).toHaveBeenCalledWith("u", true);
  });

  it("opacity slider drives setObjectOpacity", async () => {
    const stub = await renderApp();
    const slider = screen.getByLabelText("Opacity of vector u");
    // range input: set value directly
    const { fireEvent } = await import("@testing-library/react");
    fireEvent.change(slider, { target: { value: "40" } });
    expect(stub.handle.setObjectOpacity).toHaveBeenCalledWith("u", 0.4);
  });

  it("view / projection / reset buttons call the renderer handle", async () => {
    const user = userEvent.setup();
    const stub = await renderApp();
    await user.click(screen.getByRole("button", { name: "Front" }));
    expect(stub.handle.setView).toHaveBeenCalledWith("front");
    await user.click(screen.getByRole("button", { name: "Top" }));
    expect(stub.handle.setView).toHaveBeenCalledWith("top");
    await user.click(screen.getByRole("button", { name: "Reset camera" }));
    expect(stub.handle.resetCamera).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Perspective" }));
    expect(stub.handle.setProjection).toHaveBeenCalledWith("orthographic");
    expect(
      screen.getByRole("button", { name: "Orthographic" }),
    ).toBeInTheDocument();
  });

  it("toolbar buttons are disabled while the viewport is not ready", async () => {
    const stub = createStubThree({ webglSupported: false });
    render(<VectorGeometryLabWorkspace loader={stub.loader} />);
    const front = screen.getByRole("button", { name: "Front" });
    expect(front).toBeDisabled();
  });

  it("reduce-motion toggle re-creates the renderer with the override", async () => {
    const user = userEvent.setup();
    const stub = await renderApp();
    const callsBefore = stub.createVectorGeometryRenderer.mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Reduce motion" }));
    await waitFor(() =>
      expect(stub.createVectorGeometryRenderer.mock.calls.length).toBe(callsBefore + 1),
    );
    const lastCall = stub.createVectorGeometryRenderer.mock.calls.at(-1);
    expect(lastCall?.[1]?.matchMediaFn?.("(prefers-reduced-motion: reduce)")).toEqual({
      matches: true,
    });
  });
});

describe("VectorGeometryLabWorkspace — object details and copy", () => {
  it("selecting an object shows its equation and key parameters", async () => {
    const user = userEvent.setup();
    await renderApp();
    await user.click(screen.getByRole("button", { name: "vector u" }));
    const details = await screen.findByTestId("object-details");
    expect(details.textContent).toContain("u = (1, 2, 3)");
    expect(details.textContent).toContain("vector-arrow");
  });

  it("copy button writes the full analysis text to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await renderApp();
    await user.click(screen.getByRole("button", { name: "Copy full analysis text" }));
    await screen.findByText("已复制。");
    expect(writeText).toHaveBeenCalledTimes(1);
    const text = writeText.mock.calls[0]?.[0] as string;
    expect(text).toContain("== 1. 已知条件 / Known inputs ==");
    expect(text).toContain(
      "== 10. 特殊情形与适用限制 / Conditions and limitations ==",
    );
    expect(text).toContain("Status: solved");
  });

  it("falls back to the hidden textarea when the Clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await renderApp();
    await user.click(screen.getByRole("button", { name: "Copy full analysis text" }));

    expect(await screen.findByText("已复制。")).toBeInTheDocument();
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports a copy failure without hiding the completed analysis", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
      configurable: true,
    });
    const execCommand = vi.fn(() => false);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
    });

    await renderApp();
    await user.click(screen.getByRole("button", { name: "Copy full analysis text" }));

    expect(
      await screen.findByText("复制失败，请手动选择文字。"),
    ).toBeInTheDocument();
    expect(screen.getByText("Worked solution & verification")).toBeInTheDocument();
  });

  it("renders an explicit empty state when no analysis is selected", () => {
    render(<ResultsPanel models={[]} inputError={null} />);
    expect(screen.getByText("尚未选择分析。")).toBeInTheDocument();
  });

  it("reports a dropped invalid saved scene without blocking the empty store", () => {
    render(
      <StoragePanel
        entries={[]}
        storeError={null}
        droppedEntries={1}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "1 stored entry was skipped",
    );
    expect(screen.getByText("尚未保存场景。")).toBeInTheDocument();
  });
});
