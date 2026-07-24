/**
 * Display style tokens. Colour is NEVER the only channel that distinguishes
 * object kinds (spec §5): every kind also carries a distinct line style
 * (solid / dashed / tube / fill / marker / arc) and the legend exposes both
 * channels plus a text label.
 *
 * Palette: Okabe–Ito (colour-blind safe) for entities; axes keep the
 * conventional RGB mnemonic but additionally differ by label and by the
 * solid-positive / dashed-negative encoding.
 */

import type { SceneObjectKind } from "./types.js";

export const LINE_STYLES = [
  "solid",
  "dashed",
  "tube",
  "fill",
  "marker",
  "arc",
  "grid",
] as const;
export type LineStyle = (typeof LINE_STYLES)[number];

export interface DisplayStyle {
  readonly colorHex: number;
  readonly cssColor: string;
  readonly lineStyle: LineStyle;
  /** Short symbol name used by the legend swatch renderer. */
  readonly symbol:
    | "sphere"
    | "arrow"
    | "dashed-arrow"
    | "line-dashed-extension"
    | "translucent-square"
    | "tube"
    | "arc-sector"
    | "axis-line"
    | "grid-square"
    | "origin-dot";
  readonly legendLabel: string;
}

export const DISPLAY_STYLES: Readonly<Record<SceneObjectKind, DisplayStyle>> =
  Object.freeze({
    point: {
      colorHex: 0x0072b2,
      cssColor: "#0072B2",
      lineStyle: "marker",
      symbol: "sphere",
      legendLabel: "point",
    },
    "vector-arrow": {
      colorHex: 0xd55e00,
      cssColor: "#D55E00",
      lineStyle: "solid",
      symbol: "arrow",
      legendLabel: "vector (solid arrow)",
    },
    line: {
      colorHex: 0x009e73,
      cssColor: "#009E73",
      lineStyle: "solid",
      symbol: "line-dashed-extension",
      legendLabel: "line (solid window + dashed extension)",
    },
    plane: {
      colorHex: 0xcc79a7,
      cssColor: "#CC79A7",
      lineStyle: "fill",
      symbol: "translucent-square",
      legendLabel: "plane (translucent, double-sided)",
    },
    segment: {
      colorHex: 0xe69f00,
      cssColor: "#E69F00",
      lineStyle: "tube",
      symbol: "tube",
      legendLabel: "shortest-distance segment (tube)",
    },
    "angle-arc": {
      colorHex: 0x000000,
      cssColor: "#000000",
      lineStyle: "arc",
      symbol: "arc-sector",
      legendLabel: "angle arc / sector",
    },
    "normal-arrow": {
      colorHex: 0x56b4e9,
      cssColor: "#56B4E9",
      lineStyle: "dashed",
      symbol: "dashed-arrow",
      legendLabel: "plane normal (dashed arrow)",
    },
    axis: {
      colorHex: 0x666666,
      cssColor: "#666666",
      lineStyle: "solid",
      symbol: "axis-line",
      legendLabel: "axis (positive solid, negative dashed)",
    },
    grid: {
      colorHex: 0x999999,
      cssColor: "#999999",
      lineStyle: "grid",
      symbol: "grid-square",
      legendLabel: "grid",
    },
    "origin-marker": {
      colorHex: 0x000000,
      cssColor: "#000000",
      lineStyle: "marker",
      symbol: "origin-dot",
      legendLabel: "origin O",
    },
  });

/** Conventional axis colours; labels + dash encoding carry the meaning. */
export const AXIS_COLORS = Object.freeze({
  x: { colorHex: 0xe31a1c, cssColor: "#E31A1C", label: "x" },
  y: { colorHex: 0x33a02c, cssColor: "#33A02C", label: "y" },
  z: { colorHex: 0x1f78b4, cssColor: "#1F78B4", label: "z" },
} as const);

export type AxisName = keyof typeof AXIS_COLORS;
