# Scheduler Rebuild Plan

## Goal

Let a user set one daily send schedule for their active `Ready to Email` leads.
The backend should begin dispatch at the exact local time they choose every day, move successful leads into `Email Sent`, and automatically stop once that campaign has no leads left to send.

## Product Rules

- Scheduled sending is supported only for approved Deal Cannon users.
- Scheduled sending is supported only when the connected Gmail sender exactly matches the approved Deal Cannon user email.
- `gmail.com` accounts are rejected for scheduled sending.
- Scheduled sending uses Gmail API from a backend, not Apps Script triggers.
- Apps Script remains the UI, licensing, and workbook layer.
- Manual send can remain in Apps Script for now.
- Scheduled draft mode is out of scope for phase 1.
- App policy caps scheduled sending at `300` sends per user per local day.
- A daily schedule keeps draining its remaining leads until all scheduled leads reach `Email Sent` or terminal failure, then the schedule stops.

## Core Architecture

### Apps Script responsibilities

- approved-user lookup
- customer workbook lookup
- onboarding UI
- scheduler UI
- workbook lead preparation and template rendering
- backend adapter calls through `UrlFetchApp`

### Backend responsibilities

- Gmail OAuth connect / disconnect
- durable schedule state
- exact daily dispatch timing
- daily cap reservation and enforcement
- Gmail API send execution
- workbook reconciliation through a backend service account
- audit logs and retry handling

## Key Design Change

The old rebuild plan assumed one queue row per email and local Apps Script trigger ownership.
That is no longer the target design.

The new target design is:

1. One recurring daily schedule definition per campaign.
2. One next-run backend task per active campaign.
3. One backend dispatch run per day at the chosen local time.
4. Each run claims up to the campaign's daily cap from the remaining lead set.
5. The backend re-enqueues the next daily run only if unsent leads remain.
6. When no sendable leads remain, the campaign is marked complete and stops.

This model avoids Apps Script trigger fragility and avoids Cloud Tasks' 30-day future scheduling limit because the system only needs to enqueue the next daily run.

## Stable Lead Identity

To make delayed sending reliable, Deal Cannon should stop depending on row numbers alone.

### Requirement

Add a first-class `leadId` that travels with a lead across:

- `Ready to Email`
- `Email Sent`
- `Archive`
- backend schedule records
- workbook reconciliation operations

### Why

Row numbers are not stable after deletes, moves, archiving, or cleanup.
If this scheduler is going to be reliable, backend schedule state needs a durable lead identity.

### Rule

- `leadId` becomes the primary scheduler identity.
- row number remains a convenience field for short-term workbook updates.
- if a row moves, the backend can still find the lead by `leadId`.

## Supported Daily Schedule Behavior

Phase 1 schedule creation should work like this:

1. User selects active leads from `Ready to Email`.
2. User chooses:
   - start date
   - exact local send time
   - timezone
   - daily cap up to `300`
3. Apps Script renders the final email snapshot for each selected lead.
4. Backend creates one recurring campaign definition plus one lead item per selected lead.
5. Backend creates the first dispatch task for the chosen start date/time.
6. At each daily run, the backend sends up to the remaining daily cap.
7. Successful leads move to `Email Sent`.
8. Failed leads remain visible with error state.
9. If leads remain for later days, backend schedules the next daily run.
10. If no leads remain, backend marks the campaign complete and stops.

## Backend Data Model

Use Firestore as the scheduler source of truth.

### Primary collections

- `users/{userKey}`
- `gmailConnections/{userKey}`
- `scheduleCampaigns/{campaignId}`
- `scheduleLeadItems/{campaignId_leadId}`
- `dailyCapacity/{userKey_yyyy_mm_dd}`
- `scheduleAudits/{eventId}`

### `scheduleCampaigns`

Fields:

- `campaignId`
- `userEmail`
- `customerSheetId`
- `connectedSenderEmail`
- `timezone`
- `startDate`
- `sendTimeLocal`
- `dailyLimit`
- `status`
- `remainingLeadCount`
- `sentCount`
- `failedCount`
- `cancelledCount`
- `nextRunAtUtc`
- `lastRunAt`
- `lastRunStatus`
- `lastErrorMessage`
- `createdAt`
- `completedAt`

Statuses:

- `ACTIVE`
- `PAUSED`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

### `scheduleLeadItems`

Fields:

- `campaignId`
- `leadId`
- `userEmail`
- `customerSheetId`
- `sourceReadyRowNumber`
- `leadKey`
- `recipientEmail`
- `offerType`
- `subject`
- `body`
- `status`
- `attemptCount`
- `providerMessageId`
- `errorCode`
- `errorMessage`
- `lastAttemptAt`
- `sentAt`
- `createdAt`

Statuses:

- `PENDING`
- `SENDING`
- `SENT`
- `FAILED`
- `CANCELLED`

### `dailyCapacity`

Fields:

- `userEmail`
- `localDate`
- `timezone`
- `reservedCount`
- `sentCount`
- `updatedAt`

`reservedCount` is required so campaign creation cannot overbook a local day when multiple schedules are created close together.

## Gmail Connection Model

Keep three identities separate:

- Deal Cannon approved user
- customer workbook
- connected Gmail sender

Phase 1 rules:

- connected Gmail sender email must exactly match approved Deal Cannon user email
- hosted domain claim must exist
- `gmail.com` accounts are rejected

## Workbook Sync Rules

The backend service account updates customer workbooks directly.

### On campaign create

- mark selected `Ready to Email` rows as `SCHEDULED`
- persist `leadId` if missing

### On send success

- append the lead to `Email Sent`
- remove the lead from `Ready to Email`
- if that move fails, fall back to marking the row status in place and record reconciliation failure

### On permanent failure

- mark the workbook row `FAILED`
- keep the lead visible in scheduler UI with error detail

### On cancel

- restore any not-yet-sent workbook rows back to `NEW`

## Provisioner Changes

The backend needs workbook access without user-scoped Apps Script execution.

### Required change

Update provisioner workbook sharing so every customer workbook is shared with:

- the customer user email
- the scheduler backend service account

This should happen at workbook create, register, repair, and reactivation seams.

## Apps Script Integration Seams

### Keep as-is

- `core/AuthService.js` approved-user and workbook lookup
- `frontend/index.html` onboarding shell
- `frontend/Dashboard.html` scheduler UI shell

### Add / extend

- `core/SchedulerBackendService.js`
  - backend adapter for Cloud Run
- `frontend/ScheduledSendingBackend.js`
  - thin wrapper file for frontend RPC calls
- `core/ConfigService.js`
  - include Gmail connection summary in setup state
- `core/AuthService.js`
  - include backend scheduler summary in app context

### Future cutover target

`frontend/EmailScheduler.js` becomes a UI-facing adapter layer instead of a local scheduler owner.

## Backend API Shape

Initial internal API shape:

- `POST /internal/oauth/google/start`
- `GET /oauth/google/callback`
- `POST /internal/gmail-connection/status`
- `POST /internal/gmail-connection/disconnect`
- `POST /internal/schedules/preview`
- `POST /internal/schedules`
- `GET /internal/schedules`
- `POST /internal/schedules/cancel`
- `POST /internal/schedules/delete`
- `POST /internal/schedules/run-now`

## Exact-Time Definition

Phase 1 promise:

- the backend begins that day's dispatch at the exact scheduled local time
- cloud jitter should be seconds, not minutes
- Gmail still controls final delivery timing after API acceptance

## Verification Checklist

1. Connect correct Workspace account.
2. Reject wrong account.
3. Reject `gmail.com` account.
4. Create one daily campaign for a small lead set.
5. Create one daily campaign for a large lead set.
6. Verify send success moves rows into `Email Sent`.
7. Verify failed rows remain diagnosable.
8. Verify next daily run is created only when leads remain.
9. Verify campaign auto-stops when all leads are terminal.
10. Verify workbook reconciliation can recover from partial failure.
11. Verify revoking Gmail access produces a visible failure state.
12. Verify no user exceeds `300` scheduled sends for a local day.

## Build Order

1. scaffold `scheduler-service/`
2. add Apps Script backend adapter in `core/`
3. add Gmail OAuth connect / status flow
4. add backend service-account workbook access through `provisioner/`
5. add `leadId` to workbook-backed lead flows
6. add backend campaign preview / create / list / cancel APIs
7. add daily dispatch worker
8. cut scheduler UI over from local ownership to backend ownership
9. remove Apps Script trigger dependency after backend path is proven
