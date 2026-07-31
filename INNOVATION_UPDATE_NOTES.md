# I-FAMOUS Innovation Update v1

This code-first update targets the `daniel-ifamous-innovation` branch at commit `c0d25fc`.

## Included

- Multi-role staff accounts: supervisor and examiner responsibilities can coexist across different FYPs.
- Same-project conflict rule: a project's supervisor cannot be assigned as its examiner.
- Combined staff dashboard with separate supervised and grading assignments.
- Assignment-based project access control for students, supervisors, examiners and coordinators.
- Proposal approval separated from final approval for examination.
- FYP journey: project links, milestones, progress updates, logbooks, action items, risk status and readiness checks.
- Versioned file upload, preview/download, feedback attachments and locked approved examination package.
- Student supervisor nomination with capacity checks.
- Coordinator examiner queue, manual assignment and AI-assisted ranking.
- Optional Ollama semantic examiner ranking with an explainable local fallback.
- Examiner dashboard, approved-document review, rubric scoring, draft and final submission.
- Supervisor rubric assessment kept separately from examiner grading.
- Coordinator-configurable grade weightage; no percentage is guessed or hard-coded.
- Result calculation, coordinator release and student result visibility after release.
- Profile and availability management.
- Secure internal notifications and optional email webhook delivery.
- Global JWT attachment for Axios and Fetch requests.

## Database

The Python patch does **not** change the database. It adds:

`Schema/innovation_update_v1.sql`

Back up the Aiven database and review this migration before executing it. New screens return `MIGRATION_REQUIRED` until the migration has been applied.

## Optional AI and email settings

Examiner matching uses the existing Ollama configuration when available:

- `OLLAMA_API_URL`
- `OLLAMA_API_KEY`
- `OLLAMA_MODEL`

Without them, it uses transparent expertise, workload and availability scoring.

Optional email delivery can be connected through:

- `EMAIL_WEBHOOK_URL`
- `EMAIL_WEBHOOK_TOKEN` (optional)

The webhook receives JSON containing `to`, `subject`, `text`, and `project`.

## Important limits

- Official supervisor/examiner weightage must be entered by the coordinator before results can be released.
- Official pass/minor-correction/major-correction/fail rules are not guessed. Add them only after confirming faculty policy.
- GitHub and Google Drive are stored as links. Live private-repository analytics require a later OAuth integration.
- WhatsApp and Telegram remain optional future integrations.

## Verification completed

- Vue production build: passed.
- Node syntax checks for all modified and new backend JavaScript files: passed.
- Database runtime integration: intentionally deferred until the SQL migration is applied.
