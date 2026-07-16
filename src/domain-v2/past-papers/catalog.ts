import type { PastPaperAsset, PastPaperCatalog } from "./schema";
import { PastPaperCatalogSchema } from "./schema";

export const PAST_PAPER_CATALOG_REGISTRY = [
  { key: "caie-9709", board: "CAIE", codes: ["9709"], file: "caie-9709.json" },
  { key: "caie-0580", board: "CAIE", codes: ["0580"], file: "caie-0580.json" },
  { key: "caie-9231", board: "CAIE", codes: ["9231"], file: "caie-9231.json" },
  { key: "caie-0606", board: "CAIE", codes: ["0606"], file: "caie-0606.json" },
  { key: "pearson-4ma1", board: "Edexcel", codes: ["4MA1"], file: "pearson-4ma1.json" },
  { key: "pearson-yma01", board: "Edexcel", codes: ["YMA01", "XMA01", "WMA", "WMA11", "WMA12", "WMA13", "WMA14", "WME01", "WST01"], file: "pearson-yma01.json" },
  { key: "pearson-9ma0", board: "Edexcel", codes: ["9MA0"], file: "pearson-9ma0.json" },
  { key: "pearson-9fm0", board: "Edexcel", codes: ["9FM0"], file: "pearson-9fm0.json" },
  { key: "pearson-1ma1", board: "Edexcel", codes: ["1MA1"], file: "pearson-1ma1.json" },
  { key: "ocr-h240", board: "OCR", codes: ["H240"], file: "ocr-h240.json" },
] as const;

const cache = new Map<string, Promise<PastPaperCatalog>>();

function normalizedBoard(board: string): "CAIE" | "Edexcel" | "OCR" | undefined {
  const normalized = board.toLowerCase();
  if (normalized.includes("cambridge") || normalized === "caie") return "CAIE";
  if (normalized.includes("pearson") || normalized.includes("edexcel")) return "Edexcel";
  if (normalized.includes("ocr")) return "OCR";
  return undefined;
}

export function resolvePastPaperCatalogKey(board: string, code: string): string | undefined {
  const boardName = normalizedBoard(board);
  const normalizedCode = code.toUpperCase().replace(/\/.*$/, "").trim();
  return PAST_PAPER_CATALOG_REGISTRY.find((entry) =>
    entry.board === boardName && (entry.codes as readonly string[]).includes(normalizedCode)
  )?.key;
}

export function getPastPaperCatalogRegistryEntry(key: string) {
  return PAST_PAPER_CATALOG_REGISTRY.find((entry) => entry.key === key);
}

export async function loadPastPaperCatalog(key: string): Promise<PastPaperCatalog> {
  const registry = getPastPaperCatalogRegistryEntry(key);
  if (!registry) throw new Error(`Unsupported past-paper catalog: ${key}`);
  const existing = cache.get(key);
  if (existing) return existing;

  const base = import.meta.env.BASE_URL || "/";
  const request = fetch(`${base}data/past-papers/${registry.file}`).then(async (response) => {
    if (!response.ok) throw new Error(`Unable to load ${key}: ${response.status}`);
    return PastPaperCatalogSchema.parse(await response.json());
  });
  cache.set(key, request);
  request.catch(() => cache.delete(key));
  return request;
}

export interface PastPaperSet {
  id: string;
  paperCode?: string;
  componentCode?: string;
  year: number;
  series: PastPaperAsset["series"];
  title: string;
  questionPaper: PastPaperAsset;
  markScheme?: PastPaperAsset;
  companions: PastPaperAsset[];
}

export type PastPaperCatalogMaturity = "catalogued" | "metadata-ready" | "past-paper-ready" | "verified";

export function getPastPaperCatalogMaturity(catalog: PastPaperCatalog): PastPaperCatalogMaturity {
  if (catalog.assets.length === 0) return "catalogued";
  const questionPapers = catalog.assets.filter((asset) => asset.materialType === "question-paper");
  if (questionPapers.length === 0) return "metadata-ready";
  const publicQuestions = questionPapers.filter((asset) => asset.accessStatus === "public" && asset.linkStatus.status !== "broken");
  if (publicQuestions.length === 0) return "metadata-ready";
  const fullyPaired = publicQuestions.every((question) => catalog.assets.some((asset) =>
    asset.paperSetId === question.paperSetId && asset.materialType === "mark-scheme" && asset.linkStatus.status !== "broken"
  ));
  const humanVerified = catalog.assets.every((asset) => asset.provenance.verifiedBy === "human");
  return fullyPaired && humanVerified ? "verified" : "past-paper-ready";
}

export function buildPastPaperSets(
  catalog: PastPaperCatalog,
  componentCodes?: readonly string[],
  options: { forPlanning?: boolean } = {},
): PastPaperSet[] {
  const allowed = componentCodes?.length ? new Set(componentCodes.map((code) => code.toUpperCase())) : undefined;
  const questionPapers = catalog.assets.filter((asset) =>
    asset.materialType === "question-paper" && (!allowed || (asset.componentCode && allowed.has(asset.componentCode.toUpperCase())))
    && (!options.forPlanning || (
      asset.accessStatus === "public"
      && asset.linkStatus.status !== "broken"
      && asset.provenance.verifiedBy === "human"
      && asset.syllabusApplicability === "current"
    ))
  );

  return questionPapers.map((questionPaper) => ({
    id: questionPaper.paperSetId!,
    paperCode: questionPaper.paperCode,
    componentCode: questionPaper.componentCode,
    year: questionPaper.year,
    series: questionPaper.series,
    title: questionPaper.title,
    questionPaper,
    markScheme: catalog.assets.find((asset) => asset.paperSetId === questionPaper.paperSetId && asset.materialType === "mark-scheme"),
    companions: catalog.assets.filter((asset) => asset.paperSetId === questionPaper.paperSetId && !["question-paper", "mark-scheme"].includes(asset.materialType)),
  })).sort((a, b) => b.year - a.year || a.series.localeCompare(b.series) || (a.componentCode ?? "").localeCompare(b.componentCode ?? ""));
}

export function assetHref(asset: PastPaperAsset): string | undefined {
  if (asset.distributionStatus === "hosting-permitted") return asset.hostedPath;
  if (asset.accessStatus === "public" && asset.distributionStatus === "link-only") return asset.officialFileUrl ?? asset.sourcePageUrl;
  return undefined;
}
