# Changelog

## 0.2.0

### Minor Changes

- 8f92e55: Breaking changes:

  - Upgrade the Stripe Node SDK to v23.1. Apps that don't set `apiVersion` now
    call Stripe with `2026-10-28.endive` instead of `2026-05-27.dahlia`. The
    component's own Stripe calls and the webhook fields it reads work the same
    on both. The event types passed to `events` and `onEvent` handlers now come
    from stripe v23, while webhook payloads keep the API version configured on
    your webhook endpoint.
  - The Stripe SDK now requires Node.js 20 or later.
  - `createCheckoutSession` throws if `params` includes `payment_method_types`
    on endive API versions, where Stripe rejects it. Use
    `allowed_payment_method_types` instead. Apps that pin an older `apiVersion`
    can still pass it.
  - `getOrCreateCustomer` no longer returns a customer that belongs to another
    user. It only reuses a customer by email when you pass `matchByEmail: true`,
    and then only one that has no `userId`, which it links to the user in Stripe
    and in Convex. Leave `matchByEmail` off unless your auth provider verifies
    email addresses.
  - Remove `public.updateSubscriptionQuantity`, which always threw. Use
    `StripeSubscriptions.updateSubscriptionQuantity()`.
  - Remove the unused `private.handleInvoicePaid` and
    `private.listSubscriptionsWithCreationTime` functions.
  - Remove the `@convex-dev/stripe/react` entrypoint, which only exported a
    placeholder hook, and the `react` peer dependency.

  Fixes:

  - Fix subscription renewals being recorded as one-time payments. Stripe
    removed `PaymentIntent.invoice` in API version `2025-03-31.basil`, so
    `payment_intent.succeeded` now finds the invoice through the Invoice
    Payments API. Apps on earlier releases may have renewal charges in the
    `payments` table; they are the rows whose payment intent belongs to a
    subscription invoice.
  - An older `customer.subscription.updated` can no longer revive a canceled
    subscription (thanks @milehighideas, #68).
  - Webhook processing failures now return 500 so Stripe redelivers the event,
    including failures while syncing a checkout's invoice or checking whether a
    payment belongs to a subscription. Previously these were logged and
    acknowledged with 200.
  - `payment_intent.succeeded` now calls Stripe's Invoice Payments and Invoices
    APIs, and a subscription checkout reads its subscription and invoice. A
    restricted `STRIPE_SECRET_KEY` needs read access to all three, or those
    events fail with a 500 and Stripe keeps retrying them.
  - Webhook logs no longer include raw errors, which could contain the payload,
    signature header, or customer fields. Add the new `onError` option to
    `registerRoutes` to report the underlying error yourself.
  - Invoices without a customer are skipped instead of failing validation, and
    expanded customer, subscription, and invoice objects in event payloads are
    read correctly.
  - Customers deleted in Stripe are marked `deleted: true`, including ones the
    component had never stored. `getOrCreateCustomer`, `getCustomerByUserId`,
    and `getCustomerByEmail` skip them, so a user whose customer was deleted
    gets a new one instead of a checkout error.
  - `getOrCreateCustomer` also replaces a customer that was deleted within 24
    hours of being created. Stripe replays the original response for the
    idempotency key during that time, which used to hand the deleted customer
    back and fail checkout with "No such customer".
  - Customer documents have a new optional `deleted` field, and `getCustomer`
    still returns deleted customers. If you wrote your own `returns` validator
    for customer data, add `deleted: v.optional(v.boolean())` to it.
  - `getCustomerByUserId` and `getCustomerByEmail` return the newest matching
    customer instead of the oldest.
  - `customer.updated` creates the customer if it isn't stored yet and links
    `userId` from metadata, so customers created before the webhook was set up
    start syncing.
  - `getSubscriptionByOrgId` returns the org's live subscription (active or
    trialing first) instead of the oldest one, which was often canceled.
  - A subscription whose `customer.subscription.deleted` arrives before the
    component has stored it is now saved as canceled. Previously the event was
    dropped, and a late `created` or `updated` event then stored the
    subscription as active for good.
  - Subscription events fall back to the subscription's own `current_period_end`
    when its first item has none, instead of storing `currentPeriodEnd` as `0`.
    Real payloads on API version `2023-08-16` already carry the value on the
    item, so this only matters for payloads that leave it out.
  - `createCheckoutSession` merges `params.metadata` with the `metadata`
    argument instead of letting it replace the argument. The argument wins on
    shared keys, as `subscriptionMetadata` and `paymentIntentMetadata` already
    did.
  - When Stripe delivers one event twice at the same moment, only one delivery
    runs the sync and your handlers. The other gets a 409 and Stripe retries it.
    Both used to run.
  - A failed or canceled refund lowers the payment's `amountRefunded` again, and
    a `charge.refunded` from before the failure that arrives late can't raise it
    back. Add `refund.failed` to your webhook endpoint's events. A restricted
    `STRIPE_SECRET_KEY` needs read access to charges for this.
  - `getOrCreateCustomer` with `matchByEmail` finds an unclaimed customer even
    when a newer customer with the same email belongs to another user.
  - The example app no longer ships public functions without auth checks. If you
    copied `linkSubscriptionToOrg`, `getCustomerData`, `getSubscriptionInfo`,
    `getOrgSubscription`, `getOrgPayments`, or `getOrgInvoices` from it, add an
    authorization check to your copy. `linkSubscriptionToOrg` let any caller
    attach any subscription to themselves and then cancel it.

  Other changes:

  - `createCheckoutSession` supports `mode: "setup"` without a `priceId` and no
    longer sends a line item in setup mode.
  - `CreateCheckoutSessionArgs` is exported.
  - Export `vCustomer`, `vSubscription`, `vCheckoutSession`, `vPayment`, and
    `vInvoice` for `returns` validators on queries that pass component data
    through.
  - The webhook route records processed event IDs in a new `webhook_events`
    table and acknowledges redeliveries without running the sync or your
    handlers again. It logs each one it skips. A daily component cron deletes
    entries after 30 days.
  - Resending an event from the Stripe Dashboard or CLI reuses its ID, so an
    event that was already processed is skipped as well. Pass
    `deduplicateEvents: false` to `registerRoutes` while you replay events.
  - Customers and subscriptions track the `created` time of the newest event
    applied (`lastEventCreated`) and ignore older events that arrive late. The
    public queries don't return this field.
  - Refunds of one-time payments are synced. `charge.refunded` sets the new
    optional `amountRefunded` and `refunded` fields on the payment, and its
    `status` stays as Stripe reports it. Add `charge.refunded` to your webhook
    endpoint's events to turn this on. If you wrote your own `returns` validator
    for payment data, add both fields or use `vPayment`.
  - Checkout sessions have a new optional `paymentStatus` field, and the
    component handles `checkout.session.async_payment_succeeded` and
    `checkout.session.async_payment_failed`. A session paid with a delayed
    method such as a bank debit is `complete` while still `unpaid`, so check
    `paymentStatus` before you deliver an order. Add both events to your webhook
    endpoint. If you wrote your own `returns` validator for checkout session
    data, add `paymentStatus: v.optional(v.string())` or use `vCheckoutSession`.
  - The `list*` queries take an optional `limit` and then return the newest
    matches first. Without it they still return every match.
  - `getCustomerByEmail` takes an optional `unclaimed` flag that skips customers
    linked to a user.
  - Invoice webhooks skip writes that change nothing, which cuts down the write
    conflicts when several events for one invoice arrive together (#24).
  - New `StripeSubscriptions.updateSubscriptionMetadata()` writes metadata to
    Stripe and syncs it. The component's `updateSubscriptionMetadata` mutation
    now takes optional `metadata`, so it can link an `orgId` or `userId` without
    replacing the metadata mirrored from Stripe.

## 0.1.7

- Adds a /test entrypoint for testing, compatibile with convex-test's new
  `defineTestApp` capability.

## 0.1.5

- Upgrade Stripe Node SDK support to v22.2.1 and document Node.js >=18.
- Add optional `apiVersion` configuration for `StripeSubscriptions` and webhook
  route registration.
- Add a typed Checkout Session `params` passthrough while keeping the top-level
  `mode` authoritative.
- Improve webhook robustness for customer deletion, subscription update upserts,
  invoice upserts, v22 invoice parent metadata, metadata mirroring, and
  out-of-order invoice status handling.
- Preserve current lint/codegen/workflow dependency hygiene and clear reported
  npm audit vulnerabilities.

## 0.1.4

- Fix subscription quantity updates outside component actions
- Add userId to customers table to prevent duplicates
- Fix cancelAtPeriodEnd not set when canceling via Stripe Portal
- Fix updateSubscriptionMetadata undefined wipe for orgId/userId

credit: advaitpaliwal

## 0.1.3

- Fix subscription sync: `priceId` now updates on plan changes, and
  `cancelAtPeriodEnd` is correctly derived when Stripe sets `cancel_at`

## 0.1.2

- Fix updateSubscriptionQuantity: we now pass in STRIPE_SECRET_KEY explicitly.
  component context did not have access to process.env

## 0.1.1

- Update docs

## 0.1.0

- Initial release.
