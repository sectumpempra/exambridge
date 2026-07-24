import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  boundsOfPoints,
  fitBounds,
  panBy,
  screenToWorld,
  worldToScreen,
  zoomAt,
} from "./coords.js";
import { findSnapTarget, snapPoint, snapValue } from "./snap.js";

describe("coords 视图变换", () => {
  it("worldToScreen 与 screenToWorld 互逆且 y 轴翻转", () => {
    const v = DEFAULT_VIEW;
    const w = { x: 1.5, y: 2 };
    const s = worldToScreen(w, v);
    expect(s.x).toBeCloseTo(1.5 * v.scale + v.tx, 9);
    expect(s.y).toBeCloseTo(-2 * v.scale + v.ty, 9);
    const back = screenToWorld(s, v);
    expect(back.x).toBeCloseTo(w.x, 9);
    expect(back.y).toBeCloseTo(w.y, 9);
  });

  it("zoomAt 保持光标下世界点不动", () => {
    const v = DEFAULT_VIEW;
    const center = { x: 400, y: 300 };
    const before = screenToWorld(center, v);
    const zoomed = zoomAt(v, center, 1.5);
    const after = screenToWorld(center, zoomed);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("panBy 平移", () => {
    const v = panBy(DEFAULT_VIEW, 10, -20);
    expect(v.tx).toBe(DEFAULT_VIEW.tx + 10);
    expect(v.ty).toBe(DEFAULT_VIEW.ty - 20);
  });

  it("fitBounds 居中并留边距", () => {
    const v = fitBounds({ minX: -1, minY: -1, maxX: 1, maxY: 1 }, 400, 300, 40);
    const c = worldToScreen({ x: 0, y: 0 }, v);
    expect(c.x).toBeCloseTo(200, 6);
    expect(c.y).toBeCloseTo(150, 6);
    expect(v.scale).toBeGreaterThan(0);
  });

  it("boundsOfPoints 空输入给默认盒", () => {
    expect(boundsOfPoints([]).minX).toBe(-3);
    expect(boundsOfPoints([{ x: 1, y: 2 }, { x: -1, y: 5 }]).maxY).toBe(5);
  });
});

describe("snap 吸附", () => {
  it("snapValue / snapPoint 按 0.25m 网格", () => {
    expect(snapValue(0.3)).toBeCloseTo(0.25, 9);
    expect(snapValue(0.13)).toBeCloseTo(0.25, 9);
    expect(snapPoint({ x: 1.1, y: -0.9 })).toEqual({ x: 1, y: -1 });
  });

  it("findSnapTarget 返回最近目标或 null", () => {
    const targets = [
      { id: "a", position: { x: 0, y: 0 }, kind: "object" as const },
      { id: "b", position: { x: 2, y: 0 }, kind: "pulley" as const },
    ];
    expect(findSnapTarget({ x: 0.2, y: 0.1 }, targets)?.id).toBe("a");
    expect(findSnapTarget({ x: 1.8, y: 0 }, targets)?.id).toBe("b");
    expect(findSnapTarget({ x: 5, y: 5 }, targets)).toBeNull();
  });
});
