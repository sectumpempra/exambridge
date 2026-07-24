/**
 * Legend: a pure, testable model (`buildLegendModel`) plus an optional DOM
 * renderer (`createLegendElement`). The legend carries THREE channels for
 * every entry — colour swatch, line-style swatch, and text — because colour
 * alone must never distinguish objects (spec §5).
 */

import { DISPLAY_STYLES } from "./styles.js";
import type { LineStyle } from "./styles.js";
import type { SceneObjectEntry, SceneObjectKind } from "./types.js";

export interface LegendEntry {
  readonly id: string;
  readonly kind: SceneObjectKind;
  readonly name: string;
  readonly cssColor: string;
  readonly lineStyle: LineStyle;
  readonly symbol: string;
  readonly kindLabel: string;
}

export interface LegendModel {
  readonly title: string;
  readonly entries: readonly LegendEntry[];
}

/** Order in which kinds appear in the legend. */
const KIND_ORDER: readonly SceneObjectKind[] = [
  "point",
  "vector-arrow",
  "line",
  "plane",
  "normal-arrow",
  "segment",
  "angle-arc",
  "axis",
  "grid",
  "origin-marker",
];

/**
 * Derives the legend from a scene-graph registry: one row per registry
 * entry, ordered by kind. Pure data — no DOM, no THREE.
 */
export function buildLegendModel(
  registry: readonly SceneObjectEntry[],
  title = "Legend",
): LegendModel {
  const sorted = [...registry].sort((a, b) => {
    const orderA = KIND_ORDER.indexOf(a.kind);
    const orderB = KIND_ORDER.indexOf(b.kind);
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.id.localeCompare(b.id);
  });
  return {
    title,
    entries: sorted.map((entry) => {
      const style = DISPLAY_STYLES[entry.kind];
      return {
        id: entry.id,
        kind: entry.kind,
        name: entry.name,
        cssColor: style.cssColor,
        lineStyle: style.lineStyle,
        symbol: style.symbol,
        kindLabel: style.legendLabel,
      };
    }),
  };
}

function swatchStyleFor(entry: LegendEntry): string {
  switch (entry.lineStyle) {
    case "dashed":
      return `width:24px;border-top:3px dashed ${entry.cssColor};`;
    case "solid":
      return `width:24px;border-top:3px solid ${entry.cssColor};`;
    case "tube":
      return `width:24px;border-top:6px solid ${entry.cssColor};border-radius:3px;`;
    case "arc":
      return `width:16px;height:16px;border:2px solid ${entry.cssColor};border-radius:50%;border-top-color:transparent;background:rgba(0,0,0,0.12);`;
    case "fill":
      return `width:16px;height:16px;background:${entry.cssColor};opacity:0.5;border:1px solid ${entry.cssColor};`;
    case "grid":
      return `width:16px;height:16px;background:repeating-linear-gradient(0deg,${entry.cssColor} 0 1px,transparent 1px 5px),repeating-linear-gradient(90deg,${entry.cssColor} 0 1px,transparent 1px 5px);`;
    case "marker":
    default:
      return `width:14px;height:14px;border-radius:50%;background:${entry.cssColor};`;
  }
}

/**
 * Renders the legend model to a DOM subtree. `doc` is injectable for jsdom
 * tests and non-browser contexts. Pure presentation: reads only the model.
 */
export function createLegendElement(
  model: LegendModel,
  doc: Document = document,
): HTMLElement {
  const root = doc.createElement("aside");
  root.setAttribute("data-legend", "");
  root.setAttribute("aria-label", model.title);
  root.style.cssText =
    "font-family:sans-serif;font-size:12px;line-height:1.5;list-style:none;";

  const heading = doc.createElement("h3");
  heading.textContent = model.title;
  heading.style.cssText = "margin:0 0 4px;font-size:13px;";
  root.appendChild(heading);

  const list = doc.createElement("ul");
  list.style.cssText = "margin:0;padding:0;list-style:none;";
  for (const entry of model.entries) {
    const item = doc.createElement("li");
    item.setAttribute("data-legend-entry", entry.id);
    item.setAttribute("data-legend-kind", entry.kind);
    item.style.cssText = "display:flex;align-items:center;gap:6px;margin:2px 0;";

    const swatch = doc.createElement("span");
    swatch.setAttribute("aria-hidden", "true");
    swatch.setAttribute("data-legend-swatch", entry.lineStyle);
    swatch.style.cssText = `display:inline-block;flex:none;${swatchStyleFor(entry)}`;
    item.appendChild(swatch);

    const text = doc.createElement("span");
    text.textContent = `${entry.name} — ${entry.kindLabel}`;
    item.appendChild(text);

    list.appendChild(item);
  }
  root.appendChild(list);
  return root;
}
