/**
 * Lazy boundary for the 3d package (spec §10.18/19): the ONLY module in the
 * app that references @/features/vector-geometry-lab/three, and only through a
 * dynamic import — three.js never enters the initial bundle. Tests inject a
 * stub loader through Viewport3D's `loader` prop.
 */

import type {
  buildSceneGraph,
  createLegendElement,
  createVectorGeometryRenderer,
  detectWebGLSupport,
  readSceneGraphMeta,
} from "@/features/vector-geometry-lab/three";

/** The structural slice of the 3d package the demo consumes. */
export interface VectorGeometry3DModule {
  readonly buildSceneGraph: typeof buildSceneGraph;
  readonly createVectorGeometryRenderer: typeof createVectorGeometryRenderer;
  readonly detectWebGLSupport: typeof detectWebGLSupport;
  readonly readSceneGraphMeta: typeof readSceneGraphMeta;
  readonly createLegendElement: typeof createLegendElement;
}

export type ThreeLoader = () => Promise<VectorGeometry3DModule>;

/** Production loader: lazy chunk, fetched on first viewport mount. */
export const loadVectorGeometry3D: ThreeLoader = () =>
  import("@/features/vector-geometry-lab/three");
