# Deal Cannon Solo 3.0

This repo stores the three Google Apps Script projects for Deal Cannon Solo 3.0.

## Projects

- `core/`
- `provisioner/`
- `frontend/`

## Local setup

1. Install `@google/clasp` if needed.
2. Run `clasp login`.
3. Run `powershell -ExecutionPolicy Bypass -File .\scripts\bind-clasp.ps1`.
4. Run `powershell -ExecutionPolicy Bypass -File .\scripts\pull-all.ps1`.

`.clasp.json` is intentionally ignored so each machine can bind locally without committing live script IDs.

## Sync

- Pull all: `powershell -ExecutionPolicy Bypass -File .\scripts\pull-all.ps1`
- Push all: `powershell -ExecutionPolicy Bypass -File .\scripts\push-all.ps1`
