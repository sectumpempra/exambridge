import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const candidateDirectory = join(root, "data", "candidates", "academic-results-v2");
const generatedDirectory = join(root, "generated", "academic-results-v2");
const readJson = async path => JSON.parse(await readFile(path, "utf8"));

const [library, candidate, identities] = await Promise.all([
  readJson(join(candidateDirectory, "misconception-library.json")),
  readJson(join(candidateDirectory, "migration-candidate.json")),
  readJson(join(candidateDirectory, "qualification-identities.json")),
]);

const sourceIds = new Set(candidate.sources.map(source => source.sourceId));
const awardIds = new Set(identities.identities.map(identity => identity.awardQualificationId));
const versionIds = new Set(identities.identities.flatMap(identity =>
  identity.qualificationVersions.map(version => version.qualificationVersionId)));

for (const record of library.records) {
  for (const sourceId of record.sourceIds) {
    if (!sourceIds.has(sourceId)) throw new Error(`${record.misconceptionId} references unknown source ${sourceId}`);
  }
  for (const awardId of record.awardQualificationIds) {
    if (!awardIds.has(awardId)) throw new Error(`${record.misconceptionId} references unknown award ${awardId}`);
  }
  for (const versionId of record.qualificationVersionIds) {
    if (!versionIds.has(versionId)) throw new Error(`${record.misconceptionId} references unknown qualification version ${versionId}`);
  }
}

await mkdir(generatedDirectory, { recursive: true });
await writeFile(join(generatedDirectory, "misconception-library.json"), `${JSON.stringify(library, null, 2)}\n`);
console.log(`Misconception library: ${library.records.length} source-backed candidate records.`);
