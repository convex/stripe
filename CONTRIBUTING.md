# Developing guide

## Running locally

```sh
npm i
npm run dev
```

## Testing

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm run format:check
npm test
```

`npm test` runs unit tests against mocked Stripe and an in-memory Convex.

### End-to-end tests

```sh
npm run test:e2e
```

This deploys the example app and the component to a local Convex backend
(downloaded on first run, no Convex account needed), then sends signed Stripe
webhooks to the real HTTP route and checks what the component stored. It writes
`.env.local` and a `.convex/` folder, both gitignored.

The suite sets `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the backend it
uses. It refuses to start if the checkout points at any other Convex deployment
through `.env.local`, `.env`, or environment variables, which is what
`npm run dev` sets up when you are logged in to Convex. If you run the example
app on the same local backend, set your own Stripe keys again afterwards.

To also run the real Stripe suite, install the
[Stripe CLI](https://docs.stripe.com/stripe-cli) and set a test-mode key:

```sh
STRIPE_E2E_SECRET_KEY=sk_test_... npm run test:e2e
```

It creates customers, subscriptions, and payments in that test account, and
`stripe listen` forwards the account's webhooks to the local backend. Use a
sandbox dedicated to testing.

## CI

Every pull request runs:

- **Test and lint**: build, unit tests, typecheck, and lint. Required to merge.
- **Format**: `npm run format:check`.
- **Node 22.x / 24.x**: build and unit tests on newer Node versions.
- **Generated code**: regenerates `_generated` on a local backend and fails if
  the committed files differ. Run `npx convex dev --once` and
  `npx convex codegen --component-dir ./src/component` to fix it.
- **End-to-end**: `npm run test:e2e` with signed webhooks.
- **End-to-end (Stripe test mode)**: the real Stripe suite, using the
  `STRIPE_E2E_SECRET_KEY` repository secret. It skips on pull requests from
  forks and when the secret isn't set.

The **Canary** workflow runs nightly against the newest `stripe` and `convex`
releases, with Stripe webhooks rendered in the latest API version, and opens an
issue when it fails.
