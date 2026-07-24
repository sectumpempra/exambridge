/**
 * @/features/mechanics-lab/svg — SVG 场景编辑器与自由体图。
 * 本包负责渲染与交互，绝不自行计算物理答案（物理结果只能来自 mechanics-core）。
 */
export * from "./coords.js";
export * from "./snap.js";
export * from "./geometry.js";
export * from "./editor-state.js";
export * from "./motion.js";
export * from "./export-svg.js";
export { MechanicsCanvas, type MechanicsCanvasProps } from "./MechanicsCanvas.js";
export { FreeBodyDiagram, type FreeBodyDiagramProps } from "./FreeBodyDiagram.js";
export { ForceArrow, FORCE_KIND_LABEL, FORCE_KIND_STYLE, type ForceArrowProps } from "./ForceArrow.js";
