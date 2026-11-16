---
"@convex-dev/stripe": minor
---

Sync Stripe Entitlements. The webhook route now handles
`entitlements.active_entitlement_summary.updated` and stores each customer's
active entitlements in a new `customer_entitlements` table. Check them with the
`getEntitlements` and `hasEntitlement` queries, and load customers whose
entitlements predate the webhook with `StripeSubscriptions.syncEntitlements()`.
Add the event to your Stripe webhook endpoint to use it.
