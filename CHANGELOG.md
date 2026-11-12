# Changelog

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
