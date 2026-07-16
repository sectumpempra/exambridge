# ExamBridge past-paper catalog acceptance — 2026-07-17

## Scope and publication state

- Batch: `past-paper-10-maths-20260717`
- Courses: CAIE 0580, 0606, 9231, 9709; Pearson 1MA1, 4MA1, 9MA0, 9FM0, YMA01; OCR H240
- Coverage window: 2021–2025, with every expected sitting represented by an explicit availability status
- Publication state: locally approved and committed only; not pushed and not deployed
- Distribution policy: official metadata and official links only; no PDF was copied, mirrored, or committed

## Accepted data

- 10 active catalogs
- 1,196 active assets
- 974 public official-file links
- 222 account-restricted assets represented as access states, without proxy URLs
- 402 question papers
- 13 assets quarantined after official links returned non-PDF/404 content
- 0 broken links remaining among active public assets
- 0 unpaired active public question papers

All active catalogs use schema `1.2.0`, carry qualification-version evidence, and record year- and sitting-level coverage. Planner eligibility requires a public, human-verified, current-version Question Paper with a matching public, human-verified Mark Scheme.

## Kimi review audit

- Client: the existing unified Kimi K3 client
- Provider: `kimi-code`
- Requested model: `k3`
- Returned model: `k3`
- Fallback: none
- Successful calls: 14; successful tokens: 203,364
- Invalid-JSON attempts retained in the audit trail: 7; tokens: 306,818
- Total recorded tokens: 510,182

The initial oversized YMA01 request reached the structured-output limit. It was not treated as valid data: collection parsing was corrected, the 2021–2025 review was split by year, and only successfully parsed candidate output was considered. Kimi output remained candidate data until Codex source, schema, pairing, link, and specification checks passed.

## Verification gates

| Gate | Result |
| --- | --- |
| Official public-link audit | 974/974 valid PDF responses |
| Past-paper schema/data audit | 10 catalogs, 1,196 assets passed |
| Full data audit | 208 JSON files; 0 unresolved legacy conflicts |
| TypeScript | Passed |
| ESLint | Passed |
| Vitest coverage | 41 files, 693 tests passed; past-paper statements 88.18%, branches 86.06%, functions 85.71%, lines 90.10% |
| Static build and PWA precache | Passed; 273 precached files; bundle budget passed |
| Playwright | 137/137 passed across Chromium, Firefox, WebKit and 320/360/390/768/1024 px layouts |
| Repository secret scan | 635 tracked files passed |
| Production dependency audit | No known vulnerabilities |
| Tracked PDF check | 0 |
| Candidate archive binary check | No PDF, ZIP, DOC, or DOCX files |

## Evidence artifacts

- `generated/past-paper-research-audit-report.json`: official snapshots, specification hashes, Kimi identity/usage, candidate decisions, link results, and quarantine detail
- `generated/past-paper-activation-report.json`: activated catalogs, coverage states, and activation totals
- `generated/past-paper-audit-report.json`: final schema and consistency audit
- `data/candidates/past-papers/approved/2026-07-17-past-paper-10-maths/`: immutable approved JSON candidate archive

No GitHub branch, `gh-pages` branch, production server, or server-persistent PDF directory was changed during this batch.
