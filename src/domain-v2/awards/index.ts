export type {
  AwardCalculationInput,
  AwardCalculationResult,
  EstimatedAwardBoundary,
  GradeCalculationAvailability,
  OfficialAwardBoundary,
  OfficialAwardRoute,
} from "./schema";
export {
  awardCatalog,
  createAwardCatalog,
  findEstimatedBoundary,
  findOfficialBoundary,
  getAwardRoute,
  getGradeCalculationAvailability,
  listAwardRoutes,
  type AwardCatalogData,
  type BoundaryQuery,
} from "./catalog";
export {
  AwardCalculationError,
  calculateOfficialAward,
  type AwardErrorCode,
} from "./official-engine";
export {
  ESTIMATE_WARNING,
  calculateEstimatedAward,
} from "./estimate-engine";
export {
  ESTIMATE_METHOD_VERSION,
  assertEstimateMonotonicity,
  generateEstimatedBoundary,
  type EstimateBand,
  type EstimateBands,
  type EstimatedAwardBoundaryDraft,
  type GenerateEstimatedBoundaryInput,
} from "./estimate-core";
export {
  weightedQuantile,
  type WeightedSample,
} from "./weighted-quantile";
