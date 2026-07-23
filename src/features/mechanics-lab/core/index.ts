/**
 * @/features/mechanics-lab/core — ExamBridge Mechanics Lab V1 确定性力学求解器。
 * 纯 TypeScript：不依赖 React / DOM / SVG / Canvas / AI API。
 */
export { NUMERICAL_TOLERANCE, DISPLAY_TOLERANCE, ROPE_SNAP_COSINE } from "./tolerances.js";
export { solveMechanicsScene } from "./solver.js";
export { analyzeLinearSystem, type LinearSystemAnalysis } from "./linear-system.js";
export { buildSceneModel, type SceneModel, type TopologyIssue } from "./topology.js";
export { assembleSystem, type AssembledSystem, type FrictionAssignment } from "./equations.js";
