# Notifications

KarKR uses a shared, provider-neutral transactional notification outbox. The first implemented notification types are `ESTIMATE_AWAITING_APPROVAL` and `ESTIMATE_APPROVAL_REMINDER`; Email and SMS are independent delivery rows.

## Flow and ownership

```text
Automotive domain event
    ↓
Outbox intent (same transaction as approval link)
    ↓
Shared channel eligibility
    ↓
Atomic bounded claim + processing lease
    ↓
Automotive template injected at the app composition root
    ↓
Email/SMS provider adapter
    ↓
Sent / Retry / Failed / Cancelled
```

Core owns delivery mechanics. Automotive owns the event meaning, vehicle/estimate template data, approval-link cancellation policy, and template rendering. Core modules never import Automotive.

## Outbox and idempotency

Each logical delivery has a stable key such as:

```text
estimate-approval:<link-id>:v3:email:initial
estimate-approval:<link-id>:v3:sms:reminder-1
```

A unique database constraint prevents duplicate intent. `claim_notification_outbox_batch` uses `FOR UPDATE SKIP LOCKED`, a bounded batch of 25, and a 15-minute lease. A crashed worker's stale claim can be recovered. Providers receive the deduplication key when their interface supports it. External delivery remains at-least-once at the provider boundary when a provider cannot honor idempotency; exactly-once delivery is not claimed.

Statuses are `pending`, `processing`, `sent`, `failed`, and `cancelled`. `sent` means provider accepted, not delivered or read. Delivery receipts/webhooks are not implemented.

## Consent and destinations

The existing `customer_communication_preferences` row is the channel-policy source of truth. This implementation requires explicit `email_opt_in` or `sms_opt_in`, snapshots the normalized address at enqueue, and checks current opt-in again immediately before send. A contact edit does not silently redirect an already queued private link; the snapshot stays authoritative. A current opt-out blocks it.

Missing, invalid, opted-out, disabled, expired, or unavailable-secret channels are cancelled without a provider attempt. Email is trimmed/lowercased and conservatively validated. Philippine mobile forms `09171234567`, `+639171234567`, and `639171234567` normalize to `+639171234567`; ambiguous local/foreign numbers are rejected.

## Approval-link security

Public approval validation continues to compare a SHA-256 token hash. Generic outbox JSON contains only allowlisted template context and protected record references—never a raw token or full approval URL. When `NOTIFICATION_LINK_ENCRYPTION_KEY` is configured, the raw token is AES-256-GCM encrypted into a service-role-only table. The worker decrypts it only in memory immediately before rendering the provider request.

The encrypted value is destroyed on approve, decline, revoke, or supersession. Expired messages are cancelled. Logs and audit events include safe IDs, type, channel, attempt, provider, and controlled error code; they exclude destination, body, URL, token, and credentials.

## Retry and reminders

Provider attempts use bounded backoff: 1 minute, 5 minutes, 15 minutes, 1 hour, then 6 hours, with six attempts maximum. Retryable network/provider errors return to `pending`; permanent provider rejection becomes `failed`. Eligibility/configuration cancellation does not count as a provider attempt. Authorized owners, managers, and advisors can requeue a failed row while its approval link and encrypted secret remain active.

One reminder per eligible channel is enqueued when an active undecided link is within 24 hours of expiry. The reminder has its own deterministic key. Initial delivery need not have succeeded, but channels cancelled as ineligible are excluded. Approve, decline, revoke, and supersede cancel pending or claimed reminders.

## Provider and scheduler setup

No production email/SMS SDK is currently installed or configured. The supported selections are:

```text
EMAIL_PROVIDER=disabled|console
SMS_PROVIDER=disabled|console
```

`console` is development/test-only, logs masked metadata without bodies or URLs, and is forcibly disabled in production. Add a real provider only through `NotificationDeliveryProvider`; do not call a vendor from Automotive or a server action.

Required server-only configuration:

```text
NOTIFICATION_LINK_ENCRYPTION_KEY=<base64 32-byte key>
NOTIFICATION_CRON_SECRET=<at least 24 characters>
```

Generate the encryption key with `openssl rand -base64 32`. Schedule `POST /api/cron/notifications` every 1–5 minutes with `Authorization: Bearer <NOTIFICATION_CRON_SECRET>`. The endpoint first idempotently enqueues due reminders, then processes one bounded outbox batch. Missing or incorrect authentication returns 401.

With providers or the encryption key unset, approval-link generation still succeeds and the advisor can copy the link manually. No production messages are sent.

Vehicle maintenance uses the same outbox, worker lease, consent recheck, providers, retry policy, and safe audit trail as estimate delivery. Automotive owns the `vehicle-maintenance-*` Email/SMS templates. Deduplication is per due projection, stage (`DUE_SOON`, `DUE`, `OVERDUE`), and channel, so a daily scheduler cannot spam the same stage. Satisfying or dismissing a cycle cancels pending work. Maintenance payloads need no delivery secret; estimate approval continues to require one.

## Maintenance reminder eligibility

Automotive evaluates whether a maintenance reminder should exist; Shared Notifications independently evaluates whether Email or SMS may be delivered. The centralized Automotive precedence is:

```text
Completed / satisfied?        → suppress
Inactive vehicle?             → suppress
Active related appointment?   → suppress
Snoozed until a future time?  → suppress
Legacy backfill not activated?→ suppress
Stage/channel already sent?   → suppress through the existing dedup key
Otherwise                     → eligible
```

Creating or reactivating a related appointment cancels pending or claimed maintenance intents. The generic worker rechecks its database claim immediately before provider send, so a concurrently cancelled row is not sent. Cancellation/no-show ends appointment suppression; an unexpired snooze still applies. Snooze expiry does not reset stage deduplication, and sent rows remain immutable history.

Legacy backfill creates no outbox rows. Its due projections stay notification-disabled until explicit owner/manager activation.

Notification history is retained in this phase. Define an audited retention/archive policy before table growth makes cleanup necessary.
