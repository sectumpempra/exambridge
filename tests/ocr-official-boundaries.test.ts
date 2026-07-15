import { describe, expect, it } from 'vitest';
import official from '../src/data/official/ocr-2025-grade-boundaries.json';
import { OCR_GCSE_BOUNDARIES, OCR_FSMQ_BOUNDARIES } from '../src/data/ocrGradeBoundaries';

describe('OCR official grade boundaries', () => {
  it('imports every extractable June 2025 GCSE component row', () => {
    expect(official.records).toHaveLength(144);
    expect(OCR_GCSE_BOUNDARIES.filter(row => row.year === '2025' && row.session === 'June')).toHaveLength(144);
  });

  it('replaces placeholder J560 rows with exact official notional boundaries', () => {
    const paper4 = OCR_GCSE_BOUNDARIES.find(row => row.year === '2025' && row.session === 'June' && row.code === 'J560' && row.component === '04')!;
    expect(paper4).toMatchObject({
      maxMark: 100,
      grade9: 90,
      grade8: 76,
      grade7: 60,
      grade6: 46,
      grade5: 32,
      grade4: 17,
      grade3: 9,
    });
  });

  it('removes misattributed 6993/Y533-Y535 rows and keeps the verified FSMQ record separately', () => {
    expect(OCR_GCSE_BOUNDARIES.some(row => row.code === '6993')).toBe(false);
    expect(OCR_FSMQ_BOUNDARIES).toEqual([expect.objectContaining({
      code: '6993', component: '01', maxMark: 100, a: 67, b: 60, c: 53, d: 47, e: 41,
    })]);
  });

  it('keeps every published boundary within the component maximum', () => {
    for (const row of official.records) {
      const values = [row.grade9, row.grade8, row.grade7, row.grade6, row.grade5, row.grade4, row.grade3, row.grade2, row.grade1];
      for (const value of values) expect(value).toBeLessThanOrEqual(row.maxMark);
      const published = values.filter(value => value > 0);
      for (let index = 1; index < published.length; index++) expect(published[index]).toBeLessThanOrEqual(published[index - 1]);
    }
  });
});
