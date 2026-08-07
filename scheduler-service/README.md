# Scheduler Service

Backend service for Deal Cannon scheduled sending.

## Purpose

This service will own:

- Gmail OAuth connection state
- recurring daily schedule campaigns
- daily dispatch timing
- Gmail API sends
- workbook reconciliation

## Phase 1 target

One active campaign should be able to:

1. start at an exact local time on the chosen date
2. send up to the configured daily cap
3. continue every day until its remaining leads are exhausted
4. stop automatically when all campaign leads are terminal

## Local development

1. Copy `.env.example` to `.env`.
2. Fill in the required values.
3. Run `npm install`.
4. Run `npm run dev`.

## Notes

- Apps Script will call this service through `core/SchedulerBackendService.js`.
- Firestore is the scheduler source of truth.
- Customer workbook access should happen through a backend service account that the provisioner adds as an editor.
