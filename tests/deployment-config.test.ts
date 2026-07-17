import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("deployment safety contract", () => {
  const sync = readFileSync("ops/server/sync-gh-pages.sh", "utf8");
  const rollback = readFileSync("ops/server/rollback-release.sh", "utf8");
  const nginx = readFileSync("ops/nginx/exambridge.conf", "utf8");
  const workflow = readFileSync(".github/workflows/deploy.yml", "utf8");
  const provenance = readFileSync("scripts/build-release-provenance.mjs", "utf8");

  it("downloads an immutable gh-pages commit and verifies release provenance", () => {
    expect(sync).toContain('archive_url="https://codeload.github.com/${repo}/tar.gz/${sha}"');
    expect(sync).not.toContain("tar.gz/refs/heads/gh-pages");
    expect(sync).toContain("validate_provenance");
    expect(sync).toContain("trackedPdfCount");
    expect(provenance).toContain('resolve(root, "dist-static/release-provenance.json")');
    expect(workflow).toContain("name: Test deployment safety in a replica tree");
  });

  it("never recursively removes a release exam-materials path", () => {
    expect(sync).not.toContain('rm -rf "$target/exam-materials"');
    expect(sync).toContain(".exambridge-persistent-materials");
    expect(sync).toContain("refusing to replace a real exam-materials path");
    expect(sync).toContain("persistent PDF count changed during staging");
    expect(sync).toContain("persistent PDF count dropped below the last verified release");
    expect(sync).toContain("persistent materials changed; previous current symlink restored");
  });

  it("uses a staged switch with health rollback and release retention", () => {
    expect(sync).toContain(".staging-$sha-$$");
    expect(sync).toContain("atomic_symlink");
    expect(sync).toContain("new release health check failed; previous current symlink restored");
    expect(sync).toContain("EXAMBRIDGE_KEEP_RELEASES");
    expect(sync).toContain("release-records");
    expect(rollback).toContain("target release has no trusted verification record");
    expect(rollback).toContain("original current symlink restored");
  });

  it("serves PWA metadata and release provenance with explicit safe headers", () => {
    expect(nginx).toContain("listen 443 ssl");
    expect(nginx).toContain("return 301 https://exambridge.cn$request_uri");
    expect(nginx).toContain("/etc/letsencrypt/live/exambridge.cn/fullchain.pem");
    expect(sync).toContain('EXAMBRIDGE_HEALTH_URL:-https://exambridge.cn/index.html');
    expect(nginx).toContain("location = /sw.js");
    expect(nginx).toContain('Cache-Control "no-cache, no-store, must-revalidate" always');
    expect(nginx).toContain("location = /manifest.webmanifest");
    expect(nginx).toContain("default_type application/manifest+json");
    expect(nginx).toContain("location = /release-provenance.json");
    expect(nginx).toContain("Content-Security-Policy-Report-Only");
    expect(nginx.match(/X-Content-Type-Options/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
