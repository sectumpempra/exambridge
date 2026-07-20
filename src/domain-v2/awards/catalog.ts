import routesJson from "@/data/official/awards/routes.json";
import aqaJson from "@/data/official/awards/aqa-7357.json";
import ocrJson from "@/data/official/awards/ocr-h240.json";
import ocrFsmqJson from "@/data/official/awards/ocr-6993.json";
import caieJson from "@/data/official/awards/caie-9709.json";
import pearsonAsMathsJson from "@/data/official/awards/pearson-8ma0.json";
import estimatesJson from "../../../generated/estimates/award-boundaries-v1.json";
import {
  EstimatedAwardBoundarySchema,
  OfficialAwardBoundarySchema,
  OfficialAwardRouteSchema,
  type EstimatedAwardBoundary,
  type GradeCalculationAvailability,
  type OfficialAwardBoundary,
  type OfficialAwardRoute,
} from "./schema";

export type BoundaryQuery = {
  routeId: string;
  series: string;
  optionCode?: string;
  componentVariants?: string[];
};

export type AwardCatalogData = {
  routes: unknown[];
  officialBoundaries: unknown[];
  estimatedBoundaries: unknown[];
};

const variantsKey = (variants?: string[]) => variants ? [...variants].sort().join(",") : "";
const key = (routeId: string, series: string, optionCode?: string, variants?: string[]) =>
  [routeId, series, optionCode ?? "", variantsKey(variants)].join("|");

const validationError = (message: string): never => {
  throw new Error(`Award catalog validation failed: ${message}`);
};

const assertUniqueRouteIds = (routes: OfficialAwardRoute[]) => {
  const routeIds = new Set<string>();
  for (const route of routes) {
    if (routeIds.has(route.id)) validationError(`duplicate route ID "${route.id}"`);
    routeIds.add(route.id);
  }
};

const normalizedRouteVariants = (route: OfficialAwardRoute): string[] => route.components.map(component => {
  if (route.board !== "CAIE") return component.code;
  const separator = component.code.lastIndexOf("/");
  return separator === -1 ? component.code : component.code.slice(separator + 1);
}).sort();

const assertBoundaryMatchesRoute = (
  boundary: OfficialAwardBoundary | EstimatedAwardBoundary,
  route: OfficialAwardRoute,
  source: "official" | "estimated",
) => {
  const actualOption = boundary.optionCode ?? "<absent>";
  const expectedOption = route.optionCode ?? "<absent>";
  if (actualOption !== expectedOption) {
    validationError(`${source} boundary option code "${actualOption}" does not match route option code "${expectedOption}" for "${route.id}"`);
  }

  const actualVariants = [...boundary.componentVariants].sort();
  const expectedVariants = normalizedRouteVariants(route);
  const hasDuplicates = new Set(actualVariants).size !== actualVariants.length;
  if (hasDuplicates || actualVariants.length !== expectedVariants.length ||
    actualVariants.some((variant, index) => variant !== expectedVariants[index])) {
    validationError(`${source} boundary component variants [${actualVariants.join(",")}] do not match route components [${expectedVariants.join(",")}] for "${route.id}"`);
  }

  if (boundary.maximumMarkAfterWeighting !== route.maximumMarkAfterWeighting) {
    validationError(`${source} boundary maximumMarkAfterWeighting ${boundary.maximumMarkAfterWeighting} does not match route maximum ${route.maximumMarkAfterWeighting} for "${route.id}"`);
  }
};

const validateBoundaries = (
  boundaries: (OfficialAwardBoundary | EstimatedAwardBoundary)[],
  routeById: ReadonlyMap<string, OfficialAwardRoute>,
  source: "official" | "estimated",
): Set<string> => {
  const exactKeys = new Set<string>();
  for (const boundary of boundaries) {
    const series = boundary.source === "official" ? boundary.series : boundary.targetSeries;
    const exactKey = key(boundary.routeId, series, boundary.optionCode, boundary.componentVariants);
    if (exactKeys.has(exactKey)) validationError(`duplicate ${source} exact key "${exactKey}"`);
    exactKeys.add(exactKey);

    const route = routeById.get(boundary.routeId);
    if (!route) {
      throw new Error(`Award catalog validation failed: ${source} boundary references unknown route "${boundary.routeId}"`);
    }
    assertBoundaryMatchesRoute(boundary, route, source);
  }
  return exactKeys;
};

export function createAwardCatalog(data: AwardCatalogData) {
  const routes = data.routes.map(value => OfficialAwardRouteSchema.parse(value));
  const officialBoundaries = data.officialBoundaries.map(value => OfficialAwardBoundarySchema.parse(value));
  const estimatedBoundaries = data.estimatedBoundaries.map(value => EstimatedAwardBoundarySchema.parse(value));

  assertUniqueRouteIds(routes);
  const routeById = new Map(routes.map(route => [route.id, route]));
  const officialKeys = validateBoundaries(officialBoundaries, routeById, "official");
  const estimatedKeys = validateBoundaries(estimatedBoundaries, routeById, "estimated");
  for (const exactKey of estimatedKeys) {
    if (officialKeys.has(exactKey)) validationError(`official/estimated exact-key collision "${exactKey}"`);
  }

  const officialByKey = new Map(officialBoundaries.map(boundary => [
    key(boundary.routeId, boundary.series, boundary.optionCode, boundary.componentVariants),
    boundary,
  ]));
  const estimateByKey = new Map(estimatedBoundaries.map(boundary => [
    key(boundary.routeId, boundary.targetSeries, boundary.optionCode, boundary.componentVariants),
    boundary,
  ]));

  const findOfficialBoundary = (query: BoundaryQuery): OfficialAwardBoundary | undefined =>
    officialByKey.get(key(query.routeId, query.series, query.optionCode, query.componentVariants));

  const findEstimatedBoundary = (query: BoundaryQuery): EstimatedAwardBoundary | undefined =>
    estimateByKey.get(key(query.routeId, query.series, query.optionCode, query.componentVariants));

  return {
    routes,
    officialBoundaries,
    estimatedBoundaries,
    getAwardRoute: (routeId: string): OfficialAwardRoute | undefined => routeById.get(routeId),
    listAwardRoutes: (qualificationCode: string): OfficialAwardRoute[] =>
      routes.filter(route => route.qualificationCode === qualificationCode),
    findOfficialBoundary,
    findEstimatedBoundary,
    getGradeCalculationAvailability(qualificationCode: string): GradeCalculationAvailability {
      const routeIds = routes
        .filter(route => route.qualificationCode === qualificationCode)
        .map(route => route.id);
      if (officialBoundaries.some(boundary => routeIds.includes(boundary.routeId))) {
        return { status: "official", routeIds };
      }
      if (estimatedBoundaries.some(boundary => routeIds.includes(boundary.routeId))) {
        return { status: "estimated", routeIds, disclaimerRequired: true };
      }
      return { status: "unavailable", reason: "没有完整且已核验的整体资格路线与边界" };
    },
  };
}

export const awardCatalog = createAwardCatalog({
  routes: routesJson.routes,
  officialBoundaries: [...aqaJson.boundaries, ...ocrJson.boundaries, ...ocrFsmqJson.boundaries, ...pearsonAsMathsJson.boundaries, ...caieJson.boundaries],
  estimatedBoundaries: estimatesJson.boundaries,
});

export const getAwardRoute = (routeId: string) => awardCatalog.getAwardRoute(routeId);
export const listAwardRoutes = (qualificationCode: string) => awardCatalog.listAwardRoutes(qualificationCode);
export const findOfficialBoundary = (query: BoundaryQuery) => awardCatalog.findOfficialBoundary(query);
export const findEstimatedBoundary = (query: BoundaryQuery) => awardCatalog.findEstimatedBoundary(query);
export const getGradeCalculationAvailability = (qualificationCode: string) =>
  awardCatalog.getGradeCalculationAvailability(qualificationCode);
