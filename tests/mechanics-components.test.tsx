import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { solveMechanicsScene } from "@/features/mechanics-lab/core";
import {
  ForceArrow,
  FreeBodyDiagram,
  MechanicsCanvas,
  createEditorState,
} from "@/features/mechanics-lab/svg";
import { EXAMPLE_SCENES } from "@/pages/mechanics-lab/examples";

const scene = EXAMPLE_SCENES[2]!.scene;
const solution = solveMechanicsScene(scene);

describe("Mechanics Lab React components", () => {
  it("renders the interactive canvas on the server without browser globals", () => {
    const state = createEditorState(scene);
    const html = renderToStaticMarkup(
      <MechanicsCanvas
        state={state}
        dispatch={() => undefined}
        ariaLabel="宿主 SSR 力学画布"
      />,
    );

    expect(html).toContain("宿主 SSR 力学画布");
    expect(html).toContain('role="application"');
    expect(html).toContain("m-obj-1");
  });

  it("renders a free-body diagram with textual force equivalents", () => {
    const html = renderToStaticMarkup(
      <FreeBodyDiagram
        solution={solution}
        mode="all"
        showComponents
        showLocalAxes
        showConstraintDirections
      />,
    );

    expect(html).toContain("自由体图");
    expect(html).toContain("重力");
    expect(html).toContain("支持力");
  });

  it("renders a force arrow with a complete accessible label", () => {
    const force = solution.forces[0]!;
    const html = renderToStaticMarkup(
      <svg>
        <ForceArrow
          force={force}
          x={0}
          y={0}
          length={40}
          showComponents
          markerId="test-arrow"
        />
      </svg>,
    );

    expect(html).toContain(`data-force-id="${force.forceId}"`);
    expect(html).toContain(`作用于 ${force.objectId}`);
    expect(html).toContain(force.symbol);
  });
});
