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

## Releases

Include a changeset with changes that need a release:

```sh
npx changeset
```

Choose the version bump, describe the user-visible change, and commit the
generated file with your implementation. Docs-only and development-tooling
changes do not need a changeset.

Review and merge the release PR when ready. A PR opened by the Changesets
workflow may have no automatic checks. Run
[Test and lint](./.github/workflows/test.yml) on its `changeset-release/main`
branch and wait for the required check to pass. To refresh the release PR, run
[Update release PR](./.github/workflows/version.yml) on main.

After staging, review the package on npm's **Staged Packages** page and approve
with 2FA, or run:

```sh
npm stage approve <stage-id>
```

Use the stage ID from the workflow log. Approve versions in order to avoid
moving `latest` backward.

### Local preparation and prereleases

To prepare a release locally instead of using the bot:

```sh
npm ci
npm run build
npm run check
npx changeset version
```

Review and commit the version, changelog, and consumed changesets, then merge
through a checked PR. A push to main stages the latest version-bump commit in
that push.

For a branch prerelease, prepare a prerelease version with Changesets and
dispatch **Release** from the Actions page on that branch. The first prerelease
identifier selects the npm channel, such as `alpha`. Stable releases require
main.

### Recovery

If staging has not been attempted, dispatch **Release** on the appropriate ref
with the 40-character SHA of a version-bump commit reachable from that ref. Once
staging starts, inspect npm before retrying: dispatching **Release** runs
`npm stage publish` again. If the package is already staged, retry only the
failed tag job or, after verifying the staged version, create its source tag at
the version-bump commit.

| Failure                                         | Recovery                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Failure before staging was attempted            | Retry failed jobs for the same commit.                                           |
| Staging succeeded; tagging failed               | Retry only the failed tag job, or create the source tag after verifying staging. |
| Upload outcome uncertain                        | Inspect npm; retry staging only if absent, or recover the tag if already staged. |
| Fix requires changing the release commit's code | Prepare a new version-bump commit.                                               |
| Candidate rejected after staging                | Leave its tag and prepare a new version.                                         |
