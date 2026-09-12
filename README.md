# Deal Cannon Solo 3.0

This repo stores the Google Apps Script projects for Deal Cannon Solo 3.0.

## Projects

- `core/`
- `provisioner/`
- `frontend/`
## Local setup

### Apps Script

1. Install `@google/clasp` if needed.
2. Run `clasp login`.
3. Run `powershell -ExecutionPolicy Bypass -File .\scripts\bind-clasp.ps1`.
4. Run `powershell -ExecutionPolicy Bypass -File .\scripts\pull-all.ps1`.

`.clasp.json` is intentionally ignored so each machine can bind locally without committing live script IDs.

## Sync

- Pull all Apps Script projects: `powershell -ExecutionPolicy Bypass -File .\scripts\pull-all.ps1`
- Push all Apps Script projects: `powershell -ExecutionPolicy Bypass -File .\scripts\push-all.ps1`

## Live Deploy Notes

- `frontend/` live updates may require `clasp push --force`; a plain push can report `Skipping push` and leave the web app UI unchanged.
- `provisioner/` source pushes do not automatically update an already-issued live deployment URL. If the live provisioner URL is in use, create a new script version and redeploy that existing deployment ID.
