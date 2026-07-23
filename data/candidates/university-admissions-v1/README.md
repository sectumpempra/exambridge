# University Admissions V1 candidate

This directory contains the imported 2027 UK undergraduate admissions research batch.

- Maximum status: `codex-reviewed`.
- Activation status: candidate only.
- Unresolved and rejected records remain in the embedded quarantine section.
- No value in this directory is available to the production AI until a separate owner approval and activation step is completed.
- The importer verifies the complete source handoff SHA-256 manifest, validation report, status ceiling, counts, source references and foreign keys before writing atomically.

Rebuild from the reviewed handoff with:

```sh
node scripts/import-university-admissions-v1-candidate.mjs /absolute/path/to/sol-final
```
