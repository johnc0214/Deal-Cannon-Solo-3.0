# Deal Cannon Solo 3.0

This repo stores the Google Apps Script projects and backend scheduler service for Deal Cannon Solo 3.0.

## Projects

- `core/`
- `provisioner/`
- `frontend/`
- `scheduler-service/`

## Local setup

### Apps Script

1. Install `@google/clasp` if needed.
2. Run `clasp login`.
3. Run `powershell -ExecutionPolicy Bypass -File .\scripts\bind-clasp.ps1`.
4. Run `powershell -ExecutionPolicy Bypass -File .\scripts\pull-all.ps1`.

`.clasp.json` is intentionally ignored so each machine can bind locally without committing live script IDs.

### Scheduler service

1. Install Node.js 20+.
2. Run `npm install` inside `scheduler-service/`.
3. Copy `scheduler-service/.env.example` to `.env` and fill in values.
4. Run `npm run dev` inside `scheduler-service/`.

## Sync

- Pull all Apps Script projects: `powershell -ExecutionPolicy Bypass -File .\scripts\pull-all.ps1`
- Push all Apps Script projects: `powershell -ExecutionPolicy Bypass -File .\scripts\push-all.ps1`

## Scheduler Direction

The current priority is moving scheduled sending off Apps Script triggers and into `scheduler-service/`, while keeping Apps Script as the UI and workbook layer.
