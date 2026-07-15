import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const root = process.cwd();
const officialDir = path.join(root, 'work', 'official');
const outputDir = path.join(root, 'src', 'data', 'official');

const n = value => value === '-' || value == null || value === '' ? 0 : Number(value);

async function rows(file) {
  const workbook = await SpreadsheetFile.importXlsx(
    await FileBlob.load(path.join(officialDir, file))
  );
  return workbook.worksheets.items.flatMap(sheet => sheet.getRange('A1:N1200').values);
}

function gcseRecord(year, session, code, subject, maxMark, grades) {
  const [grade9, grade8, grade7, grade6, grade5, grade4, grade3, grade2, grade1] = grades.map(n);
  return { year: String(year), session, code, subject, maxMark: n(maxMark), grade9, grade8, grade7, grade6, grade5, grade4, grade3, grade2, grade1 };
}

function aLevelRecord(year, session, code, unit, maxMark, grades) {
  const [a_star, a, b, c, d, e] = grades.map(n);
  return { year: String(year), session, code, unit, max_mark: n(maxMark), a_star, a, b, c, d, e };
}

async function extractGcse8300(file, year, session) {
  const source = await rows(file);
  const output = [];
  for (const row of source) {
    const subjectCode = String(row[0] ?? '');
    const componentCode = String(row[2] ?? '');
    if (/^8300[FH]$/.test(subjectCode)) {
      output.push(gcseRecord(year, session, '8300', `${row[1]} · Overall`, row[2], row.slice(3, 12)));
    } else if (/^8300\//.test(componentCode)) {
      output.push(gcseRecord(year, session, '8300', `${componentCode} · ${row[3]}`, row[4], row.slice(5, 14)));
    }
  }
  return output;
}

async function extractL2(file, year, session) {
  const source = await rows(file);
  const output = [];
  for (const row of source) {
    const code = String(row[0] ?? '');
    if (code === '8365') {
      output.push(gcseRecord(year, session, '8365', '8365 · Further Mathematics Overall', row[2], row.slice(3, 9)));
    } else if (/^8365\//.test(code)) {
      output.push(gcseRecord(year, session, '8365', `${code} · ${row[1]}`, row[2], row.slice(3, 9)));
    }
  }
  return output;
}

async function extractALevel(file, year, session) {
  const source = await rows(file);
  const output = [];
  for (const row of source) {
    const subjectCode = String(row[0] ?? '');
    const componentCode = String(row[2] ?? '');
    if (/^(7357|7367)\//.test(componentCode)) {
      const code = componentCode.slice(0, 4);
      output.push(aLevelRecord(year, session, code, `${componentCode} · ${row[3]}`, row[4], row.slice(5, 11)));
    } else if (subjectCode === '7357' || /^7367(?:DS|MD|SM)$/.test(subjectCode)) {
      const code = subjectCode.startsWith('7367') ? '7367' : '7357';
      output.push(aLevelRecord(year, session, code, `${subjectCode} · ${row[1]} · Overall`, row[2], row.slice(3, 9)));
    }
  }
  return output;
}

const gcse = [
  // June 2019 (official PDF; no summer exams in 2020 or 2021)
  gcseRecord(2019, 'June', '8300', 'MATHEMATICS TIER F · Overall', 240, [0, 0, 0, 0, 157, 122, 89, 57, 25]),
  gcseRecord(2019, 'June', '8300', 'MATHEMATICS TIER H · Overall', 240, [206, 171, 136, 105, 74, 43, 27, 0, 0]),
  ...[
    ['8300/1F', 'MATHEMATICS PAPER 1 TIER F', [0, 0, 0, 0, 53, 42, 31, 20, 10]],
    ['8300/2F', 'MATHEMATICS PAPER 2 TIER F', [0, 0, 0, 0, 50, 38, 27, 17, 7]],
    ['8300/3F', 'MATHEMATICS PAPER 3 TIER F', [0, 0, 0, 0, 53, 42, 30, 19, 8]],
    ['8300/1H', 'MATHEMATICS PAPER 1 TIER H', [68, 55, 42, 32, 23, 14, 9, 0, 0]],
    ['8300/2H', 'MATHEMATICS PAPER 2 TIER H', [69, 57, 46, 35, 24, 14, 9, 0, 0]],
    ['8300/3H', 'MATHEMATICS PAPER 3 TIER H', [70, 59, 48, 37, 26, 15, 9, 0, 0]],
  ].map(([component, title, grades]) => gcseRecord(2019, 'June', '8300', `${component} · ${title}`, 80, grades)),
  // Legacy AQA Certificate (superseded by 8365 from 2020)
  gcseRecord(2019, 'June', '8360', '8360 · Further Mathematics Overall (legacy AQA Certificate)', 175, [150, 123, 96, 71, 46, 0, 0, 0, 0]),
  gcseRecord(2019, 'June', '8360', '8360/1 · Paper 1 (non-calculator)', 70, [61, 0, 39, 0, 17, 0, 0, 0, 0]),
  gcseRecord(2019, 'June', '8360', '8360/2 · Paper 2 (calculator)', 105, [89, 0, 57, 0, 29, 0, 0, 0, 0]),
  // November 2019
  gcseRecord(2019, 'November', '8300', 'MATHEMATICS (FOUNDATION) · Overall', 240, [0, 0, 0, 0, 162, 134, 98, 62, 27]),
  gcseRecord(2019, 'November', '8300', 'MATHEMATICS (HIGHER) · Overall', 240, [199, 168, 137, 107, 78, 49, 34, 0, 0]),
  ...[
    ['8300/1F', 'MATHEMATICS (FOUNDATION) PAPER 1', [0, 0, 0, 0, 51, 41, 30, 19, 9]],
    ['8300/2F', 'MATHEMATICS (FOUNDATION) PAPER 2', [0, 0, 0, 0, 57, 49, 35, 22, 9]],
    ['8300/3F', 'MATHEMATICS (FOUNDATION) PAPER 3', [0, 0, 0, 0, 54, 44, 32, 20, 9]],
    ['8300/1H', 'MATHEMATICS (HIGHER) PAPER 1', [66, 55, 44, 33, 23, 13, 9, 0, 0]],
    ['8300/2H', 'MATHEMATICS (HIGHER) PAPER 2', [66, 56, 46, 36, 27, 18, 12, 0, 0]],
    ['8300/3H', 'MATHEMATICS (HIGHER) PAPER 3', [67, 57, 47, 37, 27, 18, 12, 0, 0]],
  ].map(([component, title, grades]) => gcseRecord(2019, 'November', '8300', `${component} · ${title}`, 80, grades)),
  // November 2020 (the summer series was cancelled, but November exams ran)
  gcseRecord(2020, 'November', '8300', 'MATHEMATICS (FOUNDATION) · Overall', 240, [0, 0, 0, 0, 146, 116, 86, 56, 26]),
  gcseRecord(2020, 'November', '8300', 'MATHEMATICS (HIGHER) · Overall', 240, [194, 159, 124, 95, 67, 39, 25, 0, 0]),
  ...[
    ['8300/1F', 'MATHEMATICS (FOUNDATION) PAPER 1', [0, 0, 0, 0, 48, 38, 28, 18, 9]],
    ['8300/2F', 'MATHEMATICS (FOUNDATION) PAPER 2', [0, 0, 0, 0, 50, 41, 30, 19, 9]],
    ['8300/3F', 'MATHEMATICS (FOUNDATION) PAPER 3', [0, 0, 0, 0, 47, 37, 27, 17, 8]],
    ['8300/1H', 'MATHEMATICS (HIGHER) PAPER 1', [64, 51, 39, 30, 21, 12, 7, 0, 0]],
    ['8300/2H', 'MATHEMATICS (HIGHER) PAPER 2', [65, 53, 42, 32, 22, 12, 7, 0, 0]],
    ['8300/3H', 'MATHEMATICS (HIGHER) PAPER 3', [65, 54, 43, 33, 24, 15, 10, 0, 0]],
  ].map(([component, title, grades]) => gcseRecord(2020, 'November', '8300', `${component} · ${title}`, 80, grades)),
  ...(await extractGcse8300('aqa-gcse-boundaries-nov-2021-maths.xlsx', 2021, 'November')),
  ...(await extractL2('aqa-l2fm-boundaries-nov-2021.xlsx', 2021, 'November')),
];

for (const year of [2022, 2023, 2024, 2025]) {
  gcse.push(...await extractGcse8300(`aqa-gcse-boundaries-${year}.xlsx`, year, 'June'));
  gcse.push(...await extractL2(`aqa-l2fm-boundaries-${year}.xlsx`, year, 'June'));
  gcse.push(...await extractGcse8300(`aqa-gcse-boundaries-nov-${year}.xlsx`, year, 'November'));
}

const aLevel = [
  aLevelRecord(2019, 'June', '7357', '7357 · Mathematics Overall', 300, [231, 185, 151, 118, 85, 52]),
  ...[
    ['7357/1', 'Maths Paper 1', [72, 53, 43, 33, 24, 15]],
    ['7357/2', 'Maths Paper 2', [77, 62, 50, 38, 27, 16]],
    ['7357/3', 'Maths Paper 3', [82, 70, 57, 45, 33, 21]],
  ].map(([component, title, grades]) => aLevelRecord(2019, 'June', '7357', `${component} · ${title}`, 100, grades)),
  ...[
    ['7367DS', 'Further Maths Overall option DS', [216, 175, 144, 114, 84, 54]],
    ['7367MD', 'Further Maths Overall option MD', [212, 171, 141, 111, 82, 53]],
    ['7367SM', 'Further Maths Overall option SM', [210, 169, 138, 107, 76, 46]],
  ].map(([component, title, grades]) => aLevelRecord(2019, 'June', '7367', `${component} · ${title}`, 300, grades)),
  ...[
    ['7367/1', 'Further Maths Paper 1', 100, [67, 52, 42, 32, 22, 12]],
    ['7367/2', 'Further Maths Paper 2', 100, [69, 55, 45, 35, 26, 17]],
    ['7367/3D', 'Further Maths Paper 3 Discrete', 50, [40, 35, 30, 25, 20, 16]],
    ['7367/3M', 'Further Maths Paper 3 Mechanics', 50, [36, 29, 23, 18, 13, 8]],
    ['7367/3S', 'Further Maths Paper 3 Statistics', 50, [38, 33, 27, 21, 15, 9]],
  ].map(([component, title, maxMark, grades]) => aLevelRecord(2019, 'June', '7367', `${component} · ${title}`, maxMark, grades)),
  aLevelRecord(2020, 'November', '7357', '7357 · Mathematics Overall', 300, [218, 171, 140, 109, 78, 47]),
  ...[
    ['7357/1', 'Mathematics Paper 1', [71, 55, 44, 34, 24, 14]],
    ['7357/2', 'Mathematics Paper 2', [69, 51, 41, 31, 22, 13]],
    ['7357/3', 'Mathematics Paper 3', [78, 65, 53, 42, 31, 20]],
  ].map(([component, title, grades]) => aLevelRecord(2020, 'November', '7357', `${component} · ${title}`, 100, grades)),
  ...[
    ['7367DS', 'Further Mathematics Overall option DS', [198, 152, 124, 96, 69, 42]],
    ['7367MD', 'Further Mathematics Overall option MD', [195, 149, 122, 95, 68, 42]],
    ['7367SM', 'Further Mathematics Overall option SM', [193, 147, 120, 93, 67, 41]],
  ].map(([component, title, grades]) => aLevelRecord(2020, 'November', '7367', `${component} · ${title}`, 300, grades)),
  ...[
    ['7367/1', 'Further Mathematics Paper 1', 100, [63, 46, 37, 28, 19, 10]],
    ['7367/2', 'Further Mathematics Paper 2', 100, [66, 50, 41, 32, 23, 15]],
    ['7367/3D', 'Further Mathematics Paper 3 Discrete', 50, [36, 29, 24, 19, 14, 9]],
    ['7367/3M', 'Further Mathematics Paper 3 Mechanics', 50, [32, 24, 20, 16, 12, 8]],
    ['7367/3S', 'Further Mathematics Paper 3 Statistics', 50, [34, 27, 22, 17, 12, 8]],
  ].map(([component, title, maxMark, grades]) => aLevelRecord(2020, 'November', '7367', `${component} · ${title}`, maxMark, grades)),
  ...(await extractALevel('aqa-a-level-boundaries-nov-2021.xlsx', 2021, 'November')),
];

for (const year of [2022, 2023, 2024, 2025]) {
  aLevel.push(...await extractALevel(`aqa-a-level-boundaries-${year}.xlsx`, year, 'June'));
}

await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(path.join(outputDir, 'aqa-math-grade-boundaries.json'), `${JSON.stringify(gcse, null, 2)}\n`);
await fs.writeFile(path.join(outputDir, 'aqa-a-level-math-grade-boundaries.json'), `${JSON.stringify(aLevel, null, 2)}\n`);

console.log(`Wrote ${gcse.length} GCSE/L2 rows and ${aLevel.length} A-Level rows.`);
