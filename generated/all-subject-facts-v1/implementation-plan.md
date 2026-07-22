# ExamBridge verified-facts data expansion plan

Generated for the `feature/verified-facts-data-expansion-20260723` local branch. This plan combines the two most recent data requests: fixing the AI's incomplete view of existing results data, and auditing/expanding resit rules, grade boundaries and Grade Statistics across the catalogue with university admissions content first.

## Safety and publication boundary

- Canonical active data is the only source for definite AI facts and calculations.
- Legacy rows are evidence inventory, not active facts.
- DeepSeek may classify, normalize and independently review non-AQA candidate batches; it may not activate data or invent missing facts.
- AQA source rows and source text remain local-only.
- University records and rebuilt 0580 statistics remain candidate-only until owner approval.
- Data approval, GitHub push and production deployment remain separate decisions.

## Completed foundation

1. Fixed historical qualification-version selection in AI queries.
2. Added coverage-only availability metadata so the AI distinguishes “not active” from “never collected”.
3. Rebuilt 17 official CAIE 0580 Grade Statistics rows from 2019–2026 with correct cumulative A*–G values, series, source pages and version IDs.
4. Imported the reviewed 2027 UK university batch: 20 institutions, 23 programmes, 22 requirements, 4 admissions assessments and 28 official sources.
5. Quarantined the three unresolved university records and enforced a `codex-reviewed` status ceiling.
6. Fixed catalogue display identity so different qualification levels sharing a code are no longer collapsed.
7. Added an all-subject inventory separating legacy boundaries, legacy statistics and owner-approved rule coverage.

## Data expansion waves

### Wave 0 — university admissions

- Candidate import is complete.
- Next gate: owner review of scope, Oxford TMUA resolution and the three quarantined items.
- After approval, add a read-only active manifest and deterministic admission lookup tool; no model-created requirements.

### Wave 1 — core qualification rules

- Keep the 13 existing mathematics qualifications as the rule-quality reference set.
- Close remaining P1 issues: current overall boundary evidence for 9709, 9231, 4MA1, IAL Mathematics and IAL Further Mathematics.
- Re-test resit, carry-forward, cash-in, locking/unlocking, valid combinations and A* rules by effective version.
- Grade Statistics gaps remain auxiliary and do not block rule explanation.

### Wave 2 — high-demand science and business subjects

- CAIE: Biology 9700, Chemistry 9701, Physics 9702, Computer Science 9618, Economics 9708 and Business 9609.
- Pearson International: Biology YBI11, Chemistry YCH11, Physics YPH11, Economics YEC11 and Business YBS11.
- AQA local-only: Biology 7402, Chemistry 7405, Physics 7408, Economics 7136, Business 7132 and Computer Science 7517.
- OCR: Biology H420, Chemistry H432, Physics H556 and Computer Science H443.
- For each qualification, establish version identity, Paper/unit structure, valid combinations, resit policy, boundary granularity and statistics publication policy before migrating numeric rows.

### Wave 3 — remaining current catalogue

- Process by subject category, then board, then qualification version.
- Keep unsupported qualifications catalogued with an explicit reason instead of presenting an empty capability.
- Historical qualifications are handled only when a business question or active rule depends on them.

## DeepSeek allocation

Suitable non-AQA tasks:

- candidate row classification and identity normalization;
- duplicate/conflict clustering;
- first-pass source-to-field extraction;
- independent review of a small structured batch;
- gap and anomaly summaries.

Codex-only tasks:

- all AQA processing;
- official-source verification and page/row location;
- deterministic validation, calculations and conflict adjudication;
- status promotion, Git commits and release decisions.

DeepSeek is unnecessary for deterministic catalogue deduplication, hash verification, schema checks, coverage calculations or the 0580 PDF rows already extracted exactly.

## Acceptance gates for each qualification

1. Identity includes board, qualification level, subject code and version.
2. Paper/unit structure and effective dates have official evidence.
3. Resit and award rules are either fully source-backed or explicitly explain-only.
4. Boundaries are separated into overall and component records with exact route/tier/option/variant identity.
5. Grade Statistics states cumulative/exclusive, population, region and publication status.
6. Candidate conflicts are zero before owner approval.
7. AI answers use canonical tools, not model memory or legacy display rows.
8. Tests, data audit, TypeScript, ESLint, build audit, secret scan and tracked-PDF check pass.
