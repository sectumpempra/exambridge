import { describe, expect, it } from 'vitest';
import aqaGcse from '../src/data/official/aqa-math-grade-boundaries.json';
import aqaALevel from '../src/data/official/aqa-a-level-math-grade-boundaries.json';
import caieGcse2026 from '../src/data/official/caie-math-grade-boundaries-2026.json';
import caieALevel2026 from '../src/data/official/caie-a-level-math-grade-boundaries-2026.json';
import {
  MERGED_AQA_GCSE_DATA,
  MERGED_AQA_A_LEVEL_DATA,
  MERGED_CAIE_GCSE_DATA,
  MERGED_CAIE_A_LEVEL_DATA,
} from '../src/data/official/mergedMathData';
import { getSubjectStats } from '../src/data/resultStatistics';

describe('official AQA mathematics data', () => {
  it('replaces synthetic GCSE rows with subject and component boundaries', () => {
    const june2025 = aqaGcse.filter(row => row.code === '8300' && row.year === '2025' && row.session === 'June');
    expect(june2025).toHaveLength(8);
    expect(june2025.find(row => row.subject.startsWith('8300/1F'))).toMatchObject({
      maxMark: 80,
      grade5: 64,
      grade4: 56,
      grade3: 41,
      grade2: 26,
      grade1: 12,
    });
    expect(aqaGcse.some(row => row.year === '2021' && row.session === 'June')).toBe(false);
  });

  it('includes the complete A-Level maths and further maths subject/component sets', () => {
    expect(aqaALevel.filter(row => row.code === '7357' && row.year === '2025')).toHaveLength(4);
    expect(aqaALevel.filter(row => row.code === '7367' && row.year === '2025')).toHaveLength(8);
    expect(aqaALevel.find(row => row.unit.startsWith('7357/1') && row.year === '2025')).toMatchObject({
      max_mark: 100,
      a_star: 87,
      a: 74,
      b: 61,
      c: 48,
      d: 35,
      e: 22,
    });
  });

  it('uses all-candidate statistics and stores entries in the correct field', () => {
    const maths = getSubjectStats('8300', 'AQA', 'GCSE')!;
    const maths2025 = maths.years.find(year => year.year === 2025)!;
    expect(maths.name).toContain('all candidates');
    expect(maths2025.entries).toBe(189529);
    expect(maths2025.grade9Rate).toBe(3.3);

    const aLevel = getSubjectStats('7357', 'AQA', 'A-Level')!;
    const year2025 = aLevel.years.find(year => year.year === 2025)!;
    expect(year2025.entries).toBe(15532);
    expect(year2025.grade9Rate).toBeUndefined();
    expect([year2025.aStarRate, year2025.aRate, year2025.bRate, year2025.cRate, year2025.dRate, year2025.eRate])
      .toEqual([12.2, 36.2, 57.3, 74.8, 87.6, 95.2]);
  });

  it('feeds the official replacement rows into the live GCSE and A-Level route data', () => {
    const liveGcse2025 = MERGED_AQA_GCSE_DATA.filter(row => row.code === '8300' && row.year === '2025' && row.session === 'June');
    expect(liveGcse2025).toHaveLength(8);
    expect(new Set(liveGcse2025.map(row => row.subject)).size).toBe(8);
    expect(MERGED_AQA_GCSE_DATA.some(row => row.code === '8300' && row.year === '2021' && row.session === 'June')).toBe(false);
    expect(MERGED_AQA_A_LEVEL_DATA.filter(row => row.code === '7357' && row.year === '2025')).toHaveLength(4);
    expect(MERGED_AQA_A_LEVEL_DATA.filter(row => row.code === '7367' && row.year === '2025')).toHaveLength(8);
  });
});

describe('official CAIE March 2026 mathematics data', () => {
  it('contains only the components that were actually offered', () => {
    expect(caieGcse2026.filter(row => row.subjectCode === '0580').map(row => row.component)).toEqual(['12', '22', '32', '42']);
    expect(caieGcse2026.filter(row => row.subjectCode === '0606').map(row => row.component)).toEqual(['12', '22']);
    expect(caieALevel2026.map(row => row.Component)).toEqual(['12', '22', '32', '42', '52', '62']);
    expect(caieALevel2026[0]).toMatchObject({ SubjectCode: '9709', MaxRawMark: 75, A: 65, E: 26 });
  });

  it('feeds March 2026 replacements into both live CAIE route datasets', () => {
    expect(MERGED_CAIE_GCSE_DATA.filter(row => row.subjectCode === '0580' && row.series === 'm-2026')).toHaveLength(4);
    expect(MERGED_CAIE_GCSE_DATA.filter(row => row.subjectCode === '0606' && row.series === 'm-2026')).toHaveLength(2);
    expect(MERGED_CAIE_A_LEVEL_DATA.filter(row => row.SubjectCode === '9709' && row.Series === 'march-2026')).toHaveLength(6);
    expect(MERGED_CAIE_A_LEVEL_DATA.some(row => row.SubjectCode === '9231' && row.Series === 'march-2026')).toBe(false);
  });
});
