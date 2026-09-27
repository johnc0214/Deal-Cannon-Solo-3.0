# Local Secrets and Integration Setup

This repo uses local `.env` files for machine-only credentials and Apps Script Script Properties for Google-hosted runtime secrets.

## Files

- `.env.example` — safe template; can be committed.
- `.env.local` — real local secrets; ignored by git.
- `scheduler-service/.env.example` — safe scheduler template; can be committed.
- `scheduler-service/.env` — real scheduler-service secrets; ignored by git.

## Local GHL variables

```bash
GHL_API_TOKEN=
GHL_LOCATION_ID=
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28
```

Use a GoHighLevel/LeadConnector API v2 Private Integration token. Start read-only when possible, then add write scopes after field mappings and dry-runs are verified.

Recommended first scopes:

- `contacts.readonly`
- `opportunities.readonly`
- `locations.readonly`
- `custom-fields.readonly`

Add write scopes later only when automation is ready:

- `contacts.write`
- `opportunities.write`
- `custom-fields.write`
- `conversations.write`
- `workflows.write`

## Local n8n variables

```bash
N8N_BASE_URL=
N8N_API_KEY=
N8N_WEBHOOK_SECRET=
```

Use these for future workflow creation and webhook signing. Keep n8n API access separate from GHL access.

## Apps Script runtime secrets

Apps Script cannot read local `.env.local`. Production Apps Script secrets must be stored in Script Properties, not in committed source files.

Examples of Script Properties this project already expects:

- `DEAL_CANNON_SCHEDULER_SERVICE_BASE_URL`
- `DEAL_CANNON_SCHEDULER_SERVICE_INTERNAL_SECRET`
- `DEAL_CANNON_SCHEDULER_BACKEND_SERVICE_ACCOUNT_EMAIL`

Future GHL properties should use names like:

- `GHL_API_TOKEN`
- `GHL_LOCATION_ID`

## Local shell usage

From the repo root:

```bash
set -a
source .env.local
set +a
```

Then commands and scripts launched from that shell can read the variables.

For scheduler-service local development:

```bash
cp scheduler-service/.env.example scheduler-service/.env
# edit scheduler-service/.env with real values
cd scheduler-service
npm run dev
```

## Safety rules

- Never commit real `.env`, `.env.local`, or `scheduler-service/.env` files.
- Never paste live tokens into chat logs if you can place them directly in the local file instead.
- Rotate any secret that was ever committed to GitHub history.
- Keep GHL, n8n, Google OAuth, and Deal Cannon internal secrets as separate credentials.
