import { mkdir, readFile, writeFile } from "node:fs/promises";

const rows = JSON.parse(await readFile("src/data/caie_al.json", "utf8"));
const sourceUrl = "https://www.cambridgeinternational.org/programmes-and-qualifications/grade-threshold-tables/";
const output = rows
  .filter((row) => !(String(row.Series) === "march-2026" && String(row.SubjectCode) === "9709"))
  .map((row) => ({
    ...row,
    _verificationStatus: "unverified",
    _sourceUrl: sourceUrl,
    _accessedAt: "2026-07-11",
    _extractionMethod: "legacy-import",
  }));

await mkdir("public/data", { recursive: true });
await writeFile("public/data/caie-al-history-v1.json", `${JSON.stringify(output)}\n`);
console.log(`Wrote ${output.length} CAIE A-Level history records.`);
