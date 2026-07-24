/**
 * @/features/vector-geometry-lab/three
 *
 * Stage 5: Three.js display package for ExamBridge Vector Geometry Lab V1.
 *
 * Layer map (rendering/math separation is the hard rule, spec §5):
 * - types.ts            Result/RendererError, registry entries, PickInfo
 * - scalars.ts          ONE-WAY ScalarV1→float display conversions
 * - environment.ts      injectable prefers-reduced-motion / WebGL probes
 * - styles.ts           colour + line-style tokens (colour never sole channel)
 * - labels.ts           CanvasTexture text sprites, injectable canvas factory
 * - arrows.ts           solid/dashed arrow objects
 * - axes.ts             axes (solid +/dashed −, labels), grid, origin marker
 * - display-builders.ts DisplayGeometryV1 kind → THREE object mapping
 * - legend.ts           legend model + DOM renderer (three-channel entries)
 * - scene-graph.ts      buildSceneGraph — pure scene construction (no GL)
 * - renderer.ts         GL-isolated renderer factory + camera + picking
 *
 * The math layer never reads anything back from this package.
 */

export * from "./types.js";
export * from "./scalars.js";
export * from "./environment.js";
export * from "./styles.js";
export * from "./labels.js";
export * from "./arrows.js";
export * from "./axes.js";
export * from "./display-builders.js";
export * from "./legend.js";
export * from "./scene-graph.js";
export * from "./renderer.js";
