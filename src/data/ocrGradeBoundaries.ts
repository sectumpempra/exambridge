import legacyRows from './ocr.json';
import official2025 from './official/ocr-2025-grade-boundaries.json';

export type OcrGcseBoundaryRow = (typeof official2025.records)[number];

const retainedLegacy = (legacyRows as OcrGcseBoundaryRow[]).filter(row =>
  row.code !== '6993' && !(row.year === '2025' && row.session === 'June')
);

/**
 * OCR GCSE component boundaries with the official June 2025 release taking
 * precedence over the repository's former provisional/placeholder rows.
 */
export const OCR_GCSE_BOUNDARIES: OcrGcseBoundaryRow[] = [
  ...retainedLegacy,
  ...(official2025.records as OcrGcseBoundaryRow[]),
];

export const OCR_FSMQ_BOUNDARIES = official2025.fsmq;
export const OCR_BOUNDARY_SOURCES = {
  gcse: official2025.source,
  fsmq: official2025.fsmq[0].source,
} as const;
