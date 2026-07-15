# Exam overview candidates

Scheduled research writes `candidate.json` here. A candidate must use the
`ExamOverviewCandidateSchema` shape and must keep `release.status` as
`candidate`. Running `scripts/build-exam-overview-update-report.mjs` produces a
diff report but never edits the active catalog. Publication requires a separate
human-reviewed code change.
