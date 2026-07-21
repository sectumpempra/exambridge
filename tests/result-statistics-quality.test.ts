import { describe, expect, it } from 'vitest';
import officialOcr from '../src/data/official/ocr-results-statistics.json';
import edexcelALBoundaries from '../src/data/edexcel_al.json';
import {
  ALL_SUBJECT_STATS,
  getAvailableBoards,
  getAvailableLevels,
  getSubjectStats,
  isNineToOne,
} from '../src/data/resultStatistics';
import {
  OFFICIAL_STATISTICS_UNAVAILABLE_MESSAGE,
  SPECIAL_OVERVIEW_BOUNDARIES,
  SPECIAL_OVERVIEW_TOP_GRADES,
} from '../src/data/examOverviewInsightsData';

describe('official results statistics', () => {
  it('contains the complete extracted OCR June 2021-2025 dataset plus reviewed 2019 maths rows', () => {
    expect(officialOcr.gcse).toHaveLength(185);
    expect(officialOcr.aLevel).toHaveLength(217);
    expect(officialOcr.fsmq).toHaveLength(6);
    expect(Object.keys(officialOcr.sources)).toEqual(['2019', '2021', '2022', '2023', '2024', '2025']);
    expect(officialOcr.aLevel.find(row => row.code === 'H240' && row.year === 2019)).toMatchObject({
      rates: [20.93, 48.73, 65.1, 78.96, 90.46, 97.79],
      entries: 7149,
    });
    expect(officialOcr.fsmq.find(row => row.code === '6993' && row.year === 2019)).toMatchObject({
      rates: [45.86, 60.86, 73.46, 81.95, 88.16],
      entries: 7889,
    });
  });

  it('uses official current specification codes and exact published rates', () => {
    const maths = getSubjectStats('J560', 'OCR', 'GCSE')!;
    const maths2025 = maths.years.find(year => year.year === 2025)!;
    expect([
      maths2025.grade9Rate,
      maths2025.grade8Rate,
      maths2025.grade7Rate,
      maths2025.grade6Rate,
      maths2025.grade5Rate,
      maths2025.grade4Rate,
    ]).toEqual([3.2, 9.2, 16.6, 24.5, 41.5, 62.8]);
    expect(maths2025.entries).toBe(74199);

    const ancientHistory = getSubjectStats('H407', 'OCR', 'A-Level')!;
    const year2025 = ancientHistory.years.find(year => year.year === 2025)!;
    expect([
      year2025.aStarRate,
      year2025.aRate,
      year2025.bRate,
      year2025.cRate,
      year2025.dRate,
      year2025.eRate,
    ]).toEqual([2.4, 19, 54.8, 80.2, 93.9, 98.3]);
  });

  it('resolves current Pearson IAL codes and the WMA qualification alias', () => {
    expect(getSubjectStats('YBI11', 'Edexcel', 'A-Level')?.years.find(year => year.year === 2026 && year.series === 'january')?.aStarRate).toBe(6.4);
    expect(getSubjectStats('YCH11', 'Edexcel', 'A-Level')?.years.find(year => year.year === 2025 && year.series === 'june')?.bRate).toBe(56.9);
    expect(getSubjectStats('YEC11', 'Edexcel', 'A-Level')?.years.find(year => year.year === 2025 && year.series === 'autumn')?.aRate).toBe(37.5);
    expect(getSubjectStats('YPH11', 'Edexcel', 'A-Level')?.years.find(year => year.year === 2026 && year.series === 'january')?.eRate).toBe(86.0);
    expect(getSubjectStats('WMA', 'Edexcel', 'A-Level')?.code).toBe('YMA01');
    expect(getSubjectStats('4MA1', 'Edexcel', 'GCSE')?.years.at(-1)?.grade9Rate).toBeDefined();
    expect(getSubjectStats('0606', 'CAIE', 'GCSE')?.code).toBe('0606');
  });

  it('keeps non-standard highest grades explicit instead of relabelling them A-star', () => {
    expect(SPECIAL_OVERVIEW_TOP_GRADES['pearson-uk-8ma0']).toMatchObject({ label: 'A' });
    expect(SPECIAL_OVERVIEW_TOP_GRADES['pearson-uk-8ma0'].rows[0]).toMatchObject({ year: 2025, rate: 28.2, entries: 5014 });
    expect(SPECIAL_OVERVIEW_BOUNDARIES['pearson-uk-8ma0'].gradeFields.map(field => field.label)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(SPECIAL_OVERVIEW_BOUNDARIES['pearson-uk-8ma0'].rows[0]).toMatchObject({ maxMark: 160, a: 108, b: 95, c: 82, d: 69, e: 57 });
    expect(SPECIAL_OVERVIEW_TOP_GRADES['pearson-uk-7m20']).toMatchObject({ label: 'D*' });
    expect(SPECIAL_OVERVIEW_TOP_GRADES['ocr-6993']).toMatchObject({ label: 'A' });
    expect(SPECIAL_OVERVIEW_TOP_GRADES['ocr-6993'].rows.at(-1)?.rate).toBe(47.6);
    expect(SPECIAL_OVERVIEW_BOUNDARIES['ocr-6993'].gradeFields[0].label).toBe('A');
    expect(SPECIAL_OVERVIEW_BOUNDARIES['pearson-uk-7m20'].gradeFields[0].label).toBe('D*');
    expect(OFFICIAL_STATISTICS_UNAVAILABLE_MESSAGE).toBe('官方尚未发布，不提供估算');
    expect(SPECIAL_OVERVIEW_BOUNDARIES['cambridge-0607'].gradeFields[0].label).toBe('A*');
    expect(SPECIAL_OVERVIEW_BOUNDARIES['cambridge-0607'].rows.some((row) => row.component === 'Extended 22,42,62' && row['a*'] === 222)).toBe(true);
    expect(isNineToOne('Edexcel', 'GCSE')).toBe(true);
  });

  it('includes the official 2025 8MA0 AS statistics and overall boundary', () => {
    const statistics = getSubjectStats('8MA0', 'Edexcel UK', 'A-Level');
    expect(statistics?.name).toBe('AS Mathematics');
    expect(statistics?.years).toEqual([
      expect.objectContaining({ year: 2025, series: 'june', aStarRate: 0, aRate: 28.2, bRate: 40.3, cRate: 52.8, dRate: 66.3, eRate: 77.4, entries: 5014 }),
    ]);

    const boundary = (edexcelALBoundaries as Array<Record<string, string | number>>).find(row => row.code === '8MA0');
    expect(boundary).toMatchObject({ year: 2025, session: 'June', max_mark: 160, 'a*': '—', a: 108, b: 95, c: 82, d: 69, e: 57 });
    expect(boundary?._verificationStatus).toBe('verified');
    expect(boundary?._sourceUrl).toContain('grade-boundaries-june-2025-gce.pdf');
  });

  it('keeps every percentage in range and every cumulative grade sequence monotonic', () => {
    for (const subject of ALL_SUBJECT_STATS) {
      for (const year of subject.years) {
        const rates = subject.level === 'GCSE' || subject.level === 'IGCSE'
          ? [year.grade9Rate, year.grade8Rate, year.grade7Rate, year.grade6Rate, year.grade5Rate, year.grade4Rate, year.grade3Rate, year.grade2Rate, year.grade1Rate].filter((rate): rate is number => rate !== undefined)
          : [year.aStarRate, year.aRate, year.bRate, year.cRate, year.dRate, year.eRate];
        for (const rate of rates) expect(rate).toBeGreaterThanOrEqual(0);
        for (const rate of rates) expect(rate).toBeLessThanOrEqual(100);
        for (let index = 1; index < rates.length; index++) expect(rates[index]).toBeGreaterThanOrEqual(rates[index - 1]);
      }
    }
  });

  it('returns stable board and level ordering', () => {
    expect(getAvailableBoards()).toEqual(['CAIE', 'Edexcel', 'Edexcel UK', 'AQA', 'OCR', 'WJEC/Eduqas']);
    expect(getAvailableLevels('OCR')).toEqual(['GCSE', 'A-Level']);
  });
});
