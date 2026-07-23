import { createHash } from "node:crypto";

export const sha256Json = value => createHash("sha256")
  .update(`${JSON.stringify(value, null, 2)}\n`)
  .digest("hex");

export const assertUnique = (values, label) => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicate values: ${[...new Set(duplicates)].join(", ")}`);
  }
};

export const assertCumulativeGradeRates = record => {
  let previous = -Infinity;
  for (const grade of record.gradeOrder) {
    const value = record.gradeRates[grade];
    if (typeof value !== "number" || value < 0 || value > 100) {
      throw new Error(`${record.statisticsId} has an invalid ${grade} rate`);
    }
    if (value < previous) {
      throw new Error(`${record.statisticsId} is not cumulative and monotonic at ${grade}`);
    }
    previous = value;
  }
};

export const assertApprovalBatchReady = (batch, expectedDomain) => {
  if (batch.schemaVersion !== "1.0.0") throw new Error("Unsupported approval-batch schema");
  if (batch.domain !== expectedDomain) throw new Error(`Expected ${expectedDomain}, received ${batch.domain}`);
  if (batch.approvalStatus !== "owner-approved") {
    throw new Error(`Batch ${batch.batchId} is ${batch.approvalStatus}; explicit owner approval is required`);
  }
  if (batch.activationStatus !== "approved-not-activated") {
    throw new Error(`Batch ${batch.batchId} is not ready for activation`);
  }
  if (batch.integrity?.result !== "pass") throw new Error(`Batch ${batch.batchId} did not pass integrity checks`);
  return batch;
};

