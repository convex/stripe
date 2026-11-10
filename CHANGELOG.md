# Changelog

## 0.2.0 (unreleased)

Breaking changes:

- Upgrade the Stripe Node SDK to v23.1. Apps that don't set `apiVersion` now
  call Stripe with `2026-10-28.endive` instead of `2026-05-27.dahlia`. The
  component's own Stripe calls and the webhook fields it reads work the same on
  both. The event types passed to `events` and `onEvent` handlers now come from
  stripe v23, while webhook payloads keep the API version configured on your
  webhook endpoint.
- The Stripe SDK now requires Node.js 20 or later.
- `createCheckoutSession` throws if `params` includes `payment_method_types` on
  endive API versions, where Stripe rejects it. Use
  `allowed_payment_method_types` instead. Apps that pin an older `apiVersion`
  can still pass it.
- `getOrCreateCustomer` only reuses a customer by email when you pass
  `matchByEmail: true`. Leave it off unless your auth provider verifies email
  addresses.
- Remove `public.updateSubscriptionQuantity`, which always threw. Use
  `StripeSubscriptions.updateSubscriptionQuantity()`.
- Remove the unused `private.handleInvoicePaid` and
  `private.listSubscriptionsWithCreationTime` functions.
- Remove the `@convex-dev/stripe/react` entrypoint, which only exported a
  placeholder hook, and the `react` peer dependency.

Other changes:

- `createCheckoutSession` supports `mode: "setup"` without a `priceId` and no
  longer sends a line item in setup mode.
- `CreateCheckoutSessionArgs` is exported.

## 0.1.8 (unreleased)

- Fix subscription renewals being recorded as one-time payments. Stripe removed
  `PaymentIntent.invoice` in API version `2025-03-31.basil`, so
  `payment_intent.succeeded` now finds the invoice through the Invoice Payments
  API. Apps on earlier releases may have renewal charges in the `payments`
  table; they are the rows whose payment intent belongs to a subscription
  invoice.
- An older `customer.subscription.updated` can no longer revive a canceled
  subscription (thanks @milehighideas, #68).
- Webhook processing failures now return 500 so Stripe redelivers the event,
  including failures while syncing a checkout's invoice or checking whether a
  payment belongs to a subscription. Previously these were logged and
  acknowledged with 200.
- `payment_intent.succeeded` now calls Stripe's Invoice Payments and Invoices
  APIs, and a subscription checkout reads its subscription and invoice. A
  restricted `STRIPE_SECRET_KEY` needs read access to all three, or those events
  fail with a 500 and Stripe keeps retrying them.
- Webhook logs no longer include raw errors, which could contain the payload,
  signature header, or customer fields. Add the new `onError` option to
  `registerRoutes` to report the underlying error yourself.
- Invoices without a customer are skipped instead of failing validation, and
  expanded customer, subscription, and invoice objects in event payloads are
  read correctly.
- `getOrCreateCustomer` no longer returns a customer that belongs to another
  user. An email match is only reused when that customer has no `userId`, and
  the customer is then linked to the user in Stripe and in Convex.
- Customers deleted in Stripe are marked `deleted: true`, including ones the
  component had never stored. `getOrCreateCustomer`, `getCustomerByUserId`, and
  `getCustomerByEmail` skip them, so a user whose customer was deleted gets a
  new one instead of a checkout error.
- `getOrCreateCustomer` also replaces a customer that was deleted within 24
  hours of being created. Stripe replays the original response for the
  idempotency key during that time, which used to hand the deleted customer back
  and fail checkout with "No such customer".
- Customer documents have a new optional `deleted` field, and `getCustomer`
  still returns deleted customers. If you wrote your own `returns` validator for
  customer data, add `deleted: v.optional(v.boolean())` to it.
- `getCustomerByUserId` and `getCustomerByEmail` return the newest matching
  customer instead of the oldest.
- `customer.updated` creates the customer if it isn't stored yet and links
  `userId` from metadata, so customers created before the webhook was set up
  start syncing.
- `getSubscriptionByOrgId` returns the org's live subscription (active or
  trialing first) instead of the oldest one, which was often canceled.
- Export `vCustomer`, `vSubscription`, `vCheckoutSession`, `vPayment`, and
  `vInvoice` for `returns` validators on queries that pass component data
  through.
- The example app no longer ships public functions without auth checks. If you
  copied `linkSubscriptionToOrg`, `getCustomerData`, `getSubscriptionInfo`,
  `getOrgSubscription`, `getOrgPayments`, or `getOrgInvoices` from it, add an
  authorization check to your copy. `linkSubscriptionToOrg` let any caller
  attach any subscription to themselves and then cancel it.

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
