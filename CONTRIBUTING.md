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

Once your PR is open, add its number in parentheses at the end of the first
paragraph of each changeset, for example `(#279)`.

Review and merge the release PR when ready. Click **Approve workflows to run**
on the PR if its checks are waiting for approval. To refresh it manually, run
the [Update release PR workflow](./.github/workflows/version.yml) on main.

When the release PR merges, CI tags the commit that set the new version as
`v<version>` and starts the [Release workflow](./.github/workflows/release.yml)
on that tag. To release a different commit, tag it yourself:

```sh
gh api repos/convex/stripe/git/refs -f ref=refs/tags/v1.2.3 -f sha=<commit>
```

Or, from a local clone: `git tag v1.2.3 <commit> && git push origin v1.2.3`.

The tag must match `package.json`'s version. Stable releases must be on `main`;
the commit may be older than the current tip. GitHub runs the release workflow
from the tagged commit, so the commit must include it. The workflow builds and
tests that commit, then stages the tested package on npm.

Review the package on npm's **Staged Packages** page and approve with 2FA, or
run:

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
through a checked PR.

For a branch prerelease, prepare a prerelease version with Changesets on that
branch and tag its commit, such as `v1.2.3-alpha.0`. The first prerelease
identifier selects the npm channel, such as `alpha`.

### Recovery

The tag records intent to release; npm is the source of truth for what was
staged. If the workflow fails, check npm's staged packages first:

- Tagged, but Release didn't start: start it on the tag with
  `gh workflow run release.yml -R convex/stripe --ref v1.2.3`.
- Not staged: rerun the failed jobs
  (`gh run rerun <run-id> -R convex/stripe --failed`), for example after pushing
  `main` if the tag went first. A rerun uses the run's original commit and works
  for 30 days.

  To release a different commit, fix the source and move the tag:

  ```sh
  gh api -X PATCH repos/convex/stripe/git/refs/tags/v1.2.3 -f sha=<commit> -F force=true
  ```

- Staged, but rejected in review: `npm stage reject <stage-id>` frees the
  version, so you can move the tag to a corrected commit. A published version
  cannot be reused; prepare a new version instead.
