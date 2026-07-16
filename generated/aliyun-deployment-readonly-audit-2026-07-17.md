# ExamBridge Aliyun deployment chain — read-only audit

Date: 2026-07-17 (Asia/Shanghai)

## Outcome

The GitHub Actions verification/deploy dependency is correctly structured, but the current server-sync and Nginx templates do not yet satisfy the planned production-safety standard. Production push should remain blocked until the P0 findings below are fixed and exercised in a replica directory.

No server files, services, releases, symlinks, Nginx settings, or PDF directories were modified during this audit.

## Evidence reviewed

- `.github/workflows/deploy.yml`
- `ops/server/sync-gh-pages.sh`
- `ops/server/exambridge-sync.service`
- `ops/server/exambridge-sync.timer`
- `ops/nginx/exambridge.conf`
- `scripts/build-release-provenance.mjs`
- Public HTTPS responses from `https://exambridge.cn`

An SSH attempt as the repository-declared service account `deploy` stopped before authentication or remote command execution because this Mac does not have a trusted ED25519 host key for `exambridge.cn`. Strict host-key checking was not disabled. Server-internal evidence therefore remains pending until the owner independently verifies the server fingerprint.

## P0 — release integrity and persistent data safety

### 1. Branch/commit race in the sync script

The script first reads the `gh-pages` branch SHA, but downloads `tar.gz/refs/heads/gh-pages`. If the branch changes between those requests, the directory can be named for SHA A while containing SHA B.

Required fix: download the immutable commit archive using the observed SHA, then verify the extracted provenance identifies that same commit.

### 2. Provenance is generated but not available to the server

`build-release-provenance.mjs` writes `generated/release-provenance.json`, while GitHub publishes only `dist-static`. The public request for `/release-provenance.json` currently returns the SPA `index.html` with HTTP 200, not provenance data.

Required fix: place a signed/hashed provenance record inside the verified static artifact, verify its commit and data-manifest hashes before switching, and make a missing provenance path return a real error rather than the SPA fallback.

### 3. Persistent-directory guard is insufficient

`link_exam_materials` executes `rm -rf "$target/exam-materials"`. It is safe only while the path is a symlink. If the path is unexpectedly a real directory, its contents are deleted.

Required fix: refuse to proceed unless the shared directory has the expected canonical path, owner and nonzero guard evidence; only unlink an existing symlink; abort if the release path is a real directory; verify PDF count/size before and after every switch.

### 4. Release switch is not fully transactional

Extraction occurs directly into the final release directory, and `ln -sfn` is used without a temporary link, post-switch health check or automatic rollback.

Required fix: extract into a staging directory, validate file counts/provenance/health, rename to the immutable release, create a temporary current symlink and atomically rename it, then roll back automatically if the public health check fails.

### 5. No demonstrated rollback or retention policy

The template does not record pre/post manifests, retain an explicit known-good pair, or provide a tested one-command rollback.

Required fix: retain at least two verified releases, record artifact SHA/file counts/PDF guard evidence, and exercise failed-update and rollback scenarios in a replica tree.

## P1 — public Nginx and PWA behaviour

### Confirmed good

- HTTPS certificate validation succeeds.
- Certificate subject is `exambridge.cn`, issued by Let's Encrypt YE1, valid from 2026-07-15 through 2026-10-13.
- `/` and `/index.html` return `Cache-Control: no-cache, no-store, must-revalidate`.
- Hashed JavaScript assets return `Cache-Control: public, max-age=31536000, immutable`.
- `/exam-materials/` directory request returns 403, so directory listing is not publicly exposed.

### Findings

1. `sw.js` has no explicit `Cache-Control: no-cache`, which can delay service-worker updates.
2. `manifest.webmanifest` is served as `application/octet-stream`; together with `X-Content-Type-Options: nosniff`, this can impair manifest processing. It should be `application/manifest+json`.
3. Security headers declared at server level are absent from `/`, `/index.html` and hashed assets because Nginx `add_header` inheritance is replaced inside locations that define their own header. Repeat the security headers in those locations or use an included header block.
4. No HSTS, Content-Security-Policy or Permissions-Policy header was observed. These should be introduced carefully after a report-only CSP pass.
5. Certificate renewal automation could not be verified without server access.

## P2 — operations and rate limits

- The unauthenticated GitHub branch API is queried about every two minutes. A single server normally remains below GitHub's unauthenticated hourly limit, but retries, duplicate timers or another consumer can exhaust it. Prefer conditional requests with ETag, a scoped token, or an immutable fetch mechanism with explicit rate-limit handling.
- The public server currently returns HTTP 200 with a verified TLS chain, but the deployed Git commit cannot be proven because public provenance is missing.

## Required server-side read-only follow-up

After the owner independently confirms the SSH host-key fingerprint, collect:

- `systemctl status` and `systemctl cat` for the timer/service
- installed sync-script hash versus repository template
- current and previous release targets and artifact hashes
- shared PDF directory canonical path, owner, mode, PDF count, size and filesystem
- timer journal for failed or overlapping runs
- Nginx effective configuration (`nginx -T`), TLS renewal timer and certificate history
- dry-run evidence that a failed release cannot delete or replace persistent PDFs

Only after that report is approved should the server template or live configuration be changed.
