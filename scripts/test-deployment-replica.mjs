import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const syncScript = resolve(root, "ops/server/sync-gh-pages.sh");
const rollbackScript = resolve(root, "ops/server/rollback-release.sh");
const fixtureRoot = mkdtempSync(join(tmpdir(), "exambridge-deployment-replica-"));
const base = join(fixtureRoot, "site");
const releases = join(base, "releases");
const shared = join(base, "shared");
const materials = join(shared, "exam-materials");
const shaFile = join(fixtureRoot, "gh-pages.sha");
const results = [];

const oldSha = "0".repeat(40);
const successSha = "1".repeat(40);
const dryRunSha = "2".repeat(40);
const failedHealthSha = "3".repeat(40);
const pdfLeakSha = "4".repeat(40);
const collisionSha = "5".repeat(40);
const retentionSha = "6".repeat(40);
const sourceCommit = "a".repeat(40);

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function createArtifact(ghPagesSha, { pdfLeak = false, materialsCollision = false } = {}) {
  const container = join(fixtureRoot, `artifact-${ghPagesSha}`);
  const artifact = join(container, `exambridge-${ghPagesSha}`);
  const manifest = `${JSON.stringify({ schemaVersion: "fixture", ghPagesSha })}\n`;
  mkdirSync(join(artifact, "data", "v3.2-new"), { recursive: true });
  writeFileSync(join(artifact, "index.html"), `<!doctype html><title>${ghPagesSha}</title>\n`);
  writeFileSync(join(artifact, "data", "v3.2-new", "manifest.json"), manifest);
  writeFileSync(
    join(artifact, "release-provenance.json"),
    `${JSON.stringify({
      schemaVersion: 1,
      commit: sourceCommit,
      generatedAt: "2026-07-17T00:00:00.000Z",
      trackedPdfCount: 0,
      evidence: {
        "dist-static/data/v3.2-new/manifest.json": sha256(manifest),
      },
    }, null, 2)}\n`,
  );
  if (pdfLeak) writeFileSync(join(artifact, "leaked.pdf"), "%PDF-1.4 forbidden fixture\n");
  if (materialsCollision) {
    mkdirSync(join(artifact, "exam-materials"));
    writeFileSync(join(artifact, "exam-materials", "collision.txt"), "must be rejected\n");
  }
  const archive = join(fixtureRoot, `${ghPagesSha}.tar.gz`);
  const packed = spawnSync("tar", ["-czf", archive, "-C", container, basename(artifact)], {
    encoding: "utf8",
    env: { ...process.env, COPYFILE_DISABLE: "1" },
  });
  assert.equal(packed.status, 0, packed.stderr || packed.stdout);
  return archive;
}

function runSync(sha, archive, extraEnv = {}) {
  writeFileSync(shaFile, `${sha}\n`);
  return spawnSync("/bin/sh", [syncScript], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      EXAMBRIDGE_BASE: realpathSync(base),
      EXAMBRIDGE_ALLOW_NONSTANDARD_BASE: "1",
      EXAMBRIDGE_SHA_FILE: shaFile,
      EXAMBRIDGE_ARCHIVE_URL: pathToFileURL(archive).href,
      EXAMBRIDGE_HEALTH_URL: pathToFileURL(join(base, "current", "index.html")).href,
      EXAMBRIDGE_KEEP_RELEASES: "2",
      EXAMBRIDGE_MIN_PDF_COUNT: "1",
      EXAMBRIDGE_MATERIALS_OWNER: userInfo().username,
      ...extraEnv,
    },
  });
}

function runRollback(sha, extraEnv = {}) {
  return spawnSync("/bin/sh", [rollbackScript, sha], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      EXAMBRIDGE_BASE: realpathSync(base),
      EXAMBRIDGE_ALLOW_NONSTANDARD_BASE: "1",
      EXAMBRIDGE_HEALTH_URL: pathToFileURL(join(base, "current", "index.html")).href,
      EXAMBRIDGE_MATERIALS_OWNER: userInfo().username,
      ...extraEnv,
    },
  });
}

function expectSuccess(label, result) {
  assert.equal(result.status, 0, `${label}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  results.push({ label, status: "passed" });
}

function expectRefusal(label, result, pattern) {
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
  assert.match(`${result.stdout}\n${result.stderr}`, pattern);
  results.push({ label, status: "passed" });
}

try {
  mkdirSync(materials, { recursive: true });
  mkdirSync(releases, { recursive: true });
  writeFileSync(join(materials, ".exambridge-persistent-materials"), "exambridge-persistent-materials-v1\n");
  writeFileSync(join(materials, "persistent-fixture.pdf"), "%PDF-1.4 persistent fixture\n");

  const oldRelease = join(releases, oldSha);
  mkdirSync(oldRelease);
  writeFileSync(join(oldRelease, "index.html"), "<!doctype html><title>old</title>\n");
  symlinkSync(oldRelease, join(base, "current"));
  writeFileSync(join(shared, "gh-pages.sha"), `${oldSha}\n`);
  chmodSync(syncScript, 0o755);
  chmodSync(rollbackScript, 0o755);

  const successArchive = createArtifact(successSha);
  const success = runSync(successSha, successArchive);
  expectSuccess("verified release switches atomically", success);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));
  assert.equal(realpathSync(join(base, "current", "exam-materials")), realpathSync(materials));
  assert.equal(readFileSync(join(shared, "gh-pages.sha"), "utf8").trim(), successSha);
  assert.ok(existsSync(join(shared, "release-records", `${successSha}.json`)));

  const materialBefore = readFileSync(join(materials, "persistent-fixture.pdf"));

  const countGuard = runSync(successSha, successArchive, { EXAMBRIDGE_MIN_PDF_COUNT: "2" });
  expectRefusal("persistent PDF count drop guard blocks deployment", countGuard, /below the configured minimum/);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));

  const dryRunArchive = createArtifact(dryRunSha);
  const dryRun = runSync(dryRunSha, dryRunArchive, { EXAMBRIDGE_DRY_RUN: "1" });
  expectSuccess("dry run validates without switching", dryRun);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));
  assert.equal(existsSync(join(releases, dryRunSha)), false);
  assert.equal(readFileSync(join(shared, "gh-pages.sha"), "utf8").trim(), successSha);

  const failedHealthArchive = createArtifact(failedHealthSha);
  const failedHealth = runSync(failedHealthSha, failedHealthArchive, {
    EXAMBRIDGE_HEALTH_URL: pathToFileURL(join(base, "current", "missing-health-check.html")).href,
  });
  expectRefusal("failed health check restores previous release", failedHealth, /previous current symlink restored/);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));
  assert.equal(readFileSync(join(shared, "gh-pages.sha"), "utf8").trim(), successSha);

  const pdfLeakArchive = createArtifact(pdfLeakSha, { pdfLeak: true });
  const pdfLeak = runSync(pdfLeakSha, pdfLeakArchive);
  expectRefusal("artifact PDF is blocked before switching", pdfLeak, /forbidden PDF/);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));

  const collisionArchive = createArtifact(collisionSha, { materialsCollision: true });
  const collision = runSync(collisionSha, collisionArchive);
  expectRefusal("real exam-materials path is never replaced", collision, /real exam-materials path/);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));

  const retentionArchive = createArtifact(retentionSha);
  const retention = runSync(retentionSha, retentionArchive);
  expectSuccess("retention keeps the active and previous verified releases", retention);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, retentionSha)));
  assert.equal(existsSync(join(releases, successSha)), true);
  assert.equal(existsSync(join(releases, oldSha)), false);
  assert.equal(existsSync(join(releases, failedHealthSha)), false);

  const rollback = runRollback(successSha);
  expectSuccess("manual rollback accepts only a retained verified release", rollback);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));
  assert.equal(readFileSync(join(shared, "gh-pages.sha"), "utf8").trim(), successSha);

  const invalidRollback = runRollback("not-a-sha");
  expectRefusal("manual rollback rejects an invalid target", invalidRollback, /40-character/);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));

  const retainedProvenance = join(releases, retentionSha, "release-provenance.json");
  const originalProvenance = readFileSync(retainedProvenance);
  writeFileSync(retainedProvenance, Buffer.concat([originalProvenance, Buffer.from("\n")]));
  const tamperedRollback = runRollback(retentionSha);
  expectRefusal("manual rollback rejects tampered provenance", tamperedRollback, /digest does not match/);
  assert.equal(realpathSync(join(base, "current")), realpathSync(join(releases, successSha)));
  writeFileSync(retainedProvenance, originalProvenance);

  assert.deepEqual(readFileSync(join(materials, "persistent-fixture.pdf")), materialBefore);
  results.push({ label: "persistent PDF bytes remain unchanged", status: "passed" });

  process.stdout.write(`${JSON.stringify({ status: "passed", scenarios: results }, null, 2)}\n`);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}
