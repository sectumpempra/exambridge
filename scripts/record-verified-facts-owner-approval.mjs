import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const approvedAt = "2026-07-23";
const requestedBatchIds = process.argv.slice(2);

if (requestedBatchIds.length === 0) {
  throw new Error("Usage: node scripts/record-verified-facts-owner-approval.mjs <batch-id> [...]");
}

const batchFiles = new Map([
  [
    "verified-facts-caie-0580-statistics-202107-202603-20260723",
    "caie-0580-statistics-20260723.json",
  ],
  [
    "verified-facts-university-admissions-2027-20260723",
    "university-admissions-2027-20260723.json",
  ],
]);

const writeJsonAtomic = async (relativePath, value) => {
  const target = join(root, relativePath);
  const temporary = `${target}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, target);
};

for (const batchId of requestedBatchIds) {
  const fileName = batchFiles.get(batchId);
  if (!fileName) throw new Error(`Unknown or non-approvable batch: ${batchId}`);

  const candidatePath = `data/candidates/approval-batches/${fileName}`;
  const generatedPath = `generated/verified-facts-approval/${fileName}`;
  const batch = JSON.parse(await readFile(join(root, candidatePath), "utf8"));

  if (batch.batchId !== batchId || batch.integrity?.result !== "pass") {
    throw new Error(`${batchId} does not match a passing approval pack`);
  }
  if (batch.approvalStatus !== "pending-owner" || batch.activationStatus !== "candidate-only") {
    throw new Error(`${batchId} is not awaiting owner approval`);
  }

  const approved = {
    ...batch,
    approvalStatus: "owner-approved",
    activationStatus: "approved-not-activated",
    approvedAt,
    approvedBy: "owner",
  };
  await Promise.all([
    writeJsonAtomic(candidatePath, approved),
    writeJsonAtomic(generatedPath, approved),
  ]);
  console.log(`Recorded owner approval for ${batchId}.`);
}
