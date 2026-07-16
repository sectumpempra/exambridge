# ExamBridge server release runbook

These files are templates. Do not copy them to production until the server's SSH ED25519 host-key fingerprint has been verified independently through the Aliyun console or another trusted channel and the read-only inventory has been approved.

## Runtime layout

```text
/var/www/exambridge/
  current -> releases/<verified-gh-pages-sha>
  releases/<verified-gh-pages-sha>/
  shared/
    exam-materials/                 # persistent; never inside a release
    exam-materials.minimum          # audited minimum PDF count
    gh-pages.sha                    # active gh-pages commit
    release-records/<sha>.json      # local verification evidence
    sync-gh-pages.sh
    rollback-release.sh
```

The persistent directory must contain a marker named `.exambridge-persistent-materials` whose complete content is:

```text
exambridge-persistent-materials-v1
```

Creating the marker and `exam-materials.minimum` is an explicit production mutation. First record the canonical path, owner, mode, PDF count and byte size through the Aliyun console. Set `exam-materials.minimum` to that approved PDF count; do not guess it and do not default it to zero.

## Required packages

- POSIX shell
- `curl` 7.71 or newer
- `git`
- `python3` 3.9 or newer
- `tar`
- Nginx and systemd

The service runs as `deploy`. By default, the persistent materials directory must also be owned by `deploy` and must not be world-writable. A different owner must be recorded and supplied through `EXAMBRIDGE_MATERIALS_OWNER` after approval.

## Read-only inventory before installation

Collect and approve all of the following before copying a template:

```sh
systemctl status exambridge-sync.timer exambridge-sync.service --no-pager
systemctl cat exambridge-sync.timer exambridge-sync.service
readlink -f /var/www/exambridge/current
find /var/www/exambridge/releases -mindepth 1 -maxdepth 1 -type d -print
find /var/www/exambridge/shared/exam-materials -type f -iname '*.pdf' -print
stat /var/www/exambridge/shared/exam-materials
du -sh /var/www/exambridge/shared/exam-materials
sha256sum /var/www/exambridge/shared/sync-gh-pages.sh
nginx -T
systemctl status certbot.timer --no-pager
```

Do not disable strict SSH host-key checking to obtain this inventory.

## Replica and production sequence

1. Run `node scripts/test-deployment-replica.mjs` from the repository. It must pass every success, refusal and rollback scenario.
2. Copy the approved scripts to `shared`, keep them owned by `deploy`, and install the reviewed systemd units.
3. Run the sync script with `EXAMBRIDGE_DRY_RUN=1`. This downloads the immutable gh-pages commit, validates the archive and provenance, verifies the persistent-directory guards, and exits without changing `current`.
4. Run `nginx -t` before reloading Nginx. The repository template makes `sw.js`, the web manifest and release provenance exact locations, so missing provenance cannot fall back to the SPA.
5. Start one sync manually and verify the systemd journal, `current`, `gh-pages.sha`, the release record, public health response and persistent PDF count.
6. Only then enable the timer.

The sync operation keeps at least the active and previous verified releases. It stages the immutable commit, rejects tracked PDFs and archive links, verifies provenance hashes, atomically changes `current`, runs the health check, and restores the old symlink on failure.

## Manual rollback

List retained verified records, choose the intended gh-pages SHA, and run:

```sh
sudo -u deploy /var/www/exambridge/shared/rollback-release.sh <40-character-gh-pages-sha>
```

The rollback command refuses releases without a matching local verification record, validates provenance again, checks the persistent-material link, switches atomically, performs a health check, and restores the original symlink if validation fails. It never deletes a release or the persistent materials directory.

## Public verification after an approved change

- `/` and `/index.html`: no-store response
- hashed `/assets/*`: one-year immutable response
- `/sw.js`: no-store response
- `/manifest.webmanifest`: `application/manifest+json`
- `/release-provenance.json`: JSON, no-store, no SPA fallback
- security headers present on all of the above
- `/exam-materials/`: no directory listing

HSTS must also be present in the effective HTTPS server block; a header emitted only over port 80 has no effect. Keep the CSP in report-only mode until browser-console and representative-traffic results have been reviewed. Enforce it only in a separate approved change.
