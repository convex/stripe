# @convex-dev/stripe

[![Integrate Stripe with Convex in 10 mins (Stripe Component)](https://thumbs.video-to-markdown.com/71e9f645.jpg)](https://youtu.be/-S4iHTAxnRw)

A Convex component for integrating Stripe payments, subscriptions, and billing
into your Convex application.

[![npm version](https://badge.fury.io/js/@convex-dev%2Fstripe.svg)](https://badge.fury.io/js/@convex-dev%2Fstripe)

Requires Node.js 20 or later, matching the Stripe Node SDK v23 runtime
requirement.

## Features

- 🛒 **Checkout Sessions** - Create one-time payment and subscription checkouts
- 📦 **Subscription Management** - Create, update, cancel subscriptions
- 👥 **Customer Management** - Automatic customer creation and linking
- 💳 **Customer Portal** - Let users manage their billing
- 🪑 **Seat-Based Pricing** - Update subscription quantities for team billing
- 🔗 **User/Org Linking** - Link payments and subscriptions to users or
  organizations
- 🔔 **Webhook Handling** - Automatic sync of Stripe data to your Convex
  database
- 📊 **Real-time Data** - Query payments, subscriptions, invoices in real-time

## Quick Start

### 1. Install the Component

```bash
npm install @convex-dev/stripe
```

### 2. Add to Your Convex App

Create or update `convex/convex.config.ts`:

```typescript
import { defineApp } from "convex/server";
import stripe from "@convex-dev/stripe/convex.config.js";

const app = defineApp();
app.use(stripe);

export default app;
```

### 3. Set Up Environment Variables

Add these to your [Convex Dashboard](https://dashboard.convex.dev) → Settings →
Environment Variables:

| Variable                | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Your Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) - see Step 4       |

### 4. Configure Stripe Webhooks

1. Go to
   [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://<your-convex-deployment>.convex.site/stripe/webhook
   ```
   (Find your deployment name in the Convex dashboard - it's the part before
   `.convex.cloud` in your URL)
4. Select these events:
   - `checkout.session.completed`
   - `customer.created`
   - `customer.updated`
   - `customer.deleted`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.created`
   - `invoice.finalized`
   - `invoice.updated`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `payment_intent.succeeded`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** and add it as `STRIPE_WEBHOOK_SECRET` in Convex

### 5. Register Webhook Routes

Create `convex/http.ts`:

```typescript
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { registerRoutes } from "@convex-dev/stripe";

const http = httpRouter();

// Register Stripe webhook handler at /stripe/webhook
registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  apiVersion: "2026-10-28.endive", // Optional
});

export default http;
```

### 6. Use the Component

Create `convex/stripe.ts`:

```typescript
import { action } from "./_generated/server";
import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { v } from "convex/values";

const stripeClient = new StripeSubscriptions(components.stripe, {});

// Create a checkout session for a subscription
export const createSubscriptionCheckout = action({
  args: { priceId: v.string() },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or create a Stripe customer
    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    // Create checkout session
    return await stripeClient.createCheckoutSession(ctx, {
      priceId: args.priceId,
      customerId: customer.customerId,
      mode: "subscription",
      successUrl: "http://localhost:5173/?success=true",
      cancelUrl: "http://localhost:5173/?canceled=true",
      subscriptionMetadata: { userId: identity.subject },
    });
  },
});

// Create a checkout session for a one-time payment
export const createPaymentCheckout = action({
  args: { priceId: v.string() },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const customer = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    return await stripeClient.createCheckoutSession(ctx, {
      priceId: args.priceId,
      customerId: customer.customerId,
      mode: "payment",
      successUrl: "http://localhost:5173/?success=true",
      cancelUrl: "http://localhost:5173/?canceled=true",
      paymentIntentMetadata: { userId: identity.subject },
    });
  },
});
```

## API Reference

### StripeSubscriptions Client

```typescript
import { StripeSubscriptions } from "@convex-dev/stripe";

const stripeClient = new StripeSubscriptions(components.stripe, {
  STRIPE_SECRET_KEY: "sk_...", // Optional, defaults to process.env.STRIPE_SECRET_KEY
  apiVersion: "2026-10-28.endive", // Optional Stripe API version
});
```

Without `apiVersion`, API calls use the version pinned by the installed Stripe
SDK, which changes when the SDK's major version changes. Set `apiVersion` here
and in `registerRoutes` to control when you upgrade.

#### Methods

| Method                          | Description                             |
| ------------------------------- | --------------------------------------- |
| `createCheckoutSession()`       | Create a Stripe Checkout session        |
| `createCustomerPortalSession()` | Generate a Customer Portal URL          |
| `createCustomer()`              | Create a new Stripe customer            |
| `getOrCreateCustomer()`         | Get existing or create new customer     |
| `cancelSubscription()`          | Cancel a subscription                   |
| `reactivateSubscription()`      | Reactivate a subscription set to cancel |
| `updateSubscriptionQuantity()`  | Update seat count                       |
| `updateSubscriptionMetadata()`  | Update metadata in Stripe and sync it   |

Stripe is the source of truth for subscription metadata, and webhooks overwrite
the copy in Convex. Change metadata with
`stripeClient.updateSubscriptionMetadata(ctx, { stripeSubscriptionId, metadata })`,
which writes to Stripe first. The component's `updateSubscriptionMetadata`
mutation is for linking a subscription to an `orgId` or `userId` in Convex only.

### createCheckoutSession

```typescript
await stripeClient.createCheckoutSession(ctx, {
  priceId: "price_...",
  customerId: "cus_...", // Optional
  mode: "subscription", // "subscription" | "payment" | "setup"
  successUrl: "https://...",
  cancelUrl: "https://...",
  quantity: 1, // Optional, default 1
  metadata: {}, // Optional, session metadata
  subscriptionMetadata: {}, // Optional, attached to subscription
  paymentIntentMetadata: {}, // Optional, attached to payment intent
  params: {
    allow_promotion_codes: true,
    ui_mode: "embedded_page",
    return_url: "https://...",
  }, // Optional Stripe Checkout Session params
});
```

`params` is a typed passthrough for Stripe Checkout Session fields that the
component does not model directly. Fields in `params` override constructed
defaults, except `mode`, which remains controlled by the top-level `mode`
argument. For non-hosted Checkout UI modes, the component omits `successUrl` and
`cancelUrl` from the Stripe request and expects redirect behavior to be supplied
through Stripe-supported params such as `return_url`.

On API version `2026-09-30.endive` and later, Stripe rejects
`payment_method_types`, so `createCheckoutSession` throws if `params` includes
it. Use `allowed_payment_method_types`, or leave it out to use dynamic payment
methods.

To save a payment method without charging, use `mode: "setup"` without a
`priceId`. Stripe needs `params.currency` in setup mode unless you set
`params.allowed_payment_method_types`:

```typescript
await stripeClient.createCheckoutSession(ctx, {
  mode: "setup",
  customerId: "cus_...",
  successUrl: "https://...",
  cancelUrl: "https://...",
  params: { currency: "usd" },
});
```

### getOrCreateCustomer

```typescript
const { customerId, isNew } = await stripeClient.getOrCreateCustomer(ctx, {
  userId: identity.subject,
  email: identity.email, // Optional
  name: identity.name, // Optional
  matchByEmail: false, // Optional, default false
});
```

Returns the customer linked to `userId`, or the customer on the user's
subscriptions or payments. Otherwise it creates a new customer with
`metadata.userId` set. Customers deleted in Stripe are never returned.

With `matchByEmail: true`, it first reuses a customer with the same email that
isn't linked to any user yet, and links it to this user. Only turn this on if
your auth provider verifies email addresses. Otherwise someone can sign up with
another person's email and take over their Stripe customer, including saved
payment methods and invoices.

### Component Queries

Access data directly via the component's public queries:

```typescript
import { query } from "./_generated/server";
import { components } from "./_generated/api";
import { vPayment, vSubscription } from "@convex-dev/stripe";
import { v } from "convex/values";

// List subscriptions for a user
export const getUserSubscriptions = query({
  args: {},
  returns: v.array(vSubscription),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );
  },
});

// List payments for a user
export const getUserPayments = query({
  args: {},
  returns: v.array(vPayment),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.stripe.public.listPaymentsByUserId, {
      userId: identity.subject,
    });
  },
});
```

`vCustomer`, `vSubscription`, `vCheckoutSession`, `vPayment`, and `vInvoice`
match the documents these queries return. Use them in your `returns` validators
so they stay in sync when the component adds fields.

These queries return data for whatever ID you pass, so check that the signed-in
user is allowed to see it before calling them, as the examples above do with
`identity.subject`.

### Available Public Queries

| Query                       | Arguments                 | Description                                     |
| --------------------------- | ------------------------- | ----------------------------------------------- |
| `getCustomer`               | `stripeCustomerId`        | Get a customer by Stripe ID                     |
| `getCustomerByUserId`       | `userId`                  | Newest customer for a user, skipping deleted    |
| `getCustomerByEmail`        | `email`                   | Newest customer with an email, skipping deleted |
| `getSubscription`           | `stripeSubscriptionId`    | Get a subscription by ID                        |
| `listSubscriptions`         | `stripeCustomerId`        | List subscriptions for a customer               |
| `listSubscriptionsByUserId` | `userId`                  | List subscriptions for a user                   |
| `listSubscriptionsByOrgId`  | `orgId`                   | List subscriptions for an org                   |
| `getSubscriptionByOrgId`    | `orgId`                   | An org's live subscription, preferring active   |
| `getPayment`                | `stripePaymentIntentId`   | Get a payment by ID                             |
| `listPayments`              | `stripeCustomerId`        | List payments for a customer                    |
| `listPaymentsByUserId`      | `userId`                  | List payments for a user                        |
| `listPaymentsByOrgId`       | `orgId`                   | List payments for an org                        |
| `listInvoices`              | `stripeCustomerId`        | List invoices for a customer                    |
| `listInvoicesByUserId`      | `userId`                  | List invoices for a user                        |
| `listInvoicesByOrgId`       | `orgId`                   | List invoices for an org                        |
| `getCheckoutSession`        | `stripeCheckoutSessionId` | Get a completed checkout session by ID          |
| `listCheckoutSessions`      | `stripeCustomerId`        | List completed checkout sessions for a customer |

### Public Mutations

| Mutation                     | Arguments                                                | Description                                               |
| ---------------------------- | -------------------------------------------------------- | --------------------------------------------------------- |
| `createOrUpdateCustomer`     | `stripeCustomerId`, `email?`, `name?`, `metadata?`       | Store a customer; `metadata.userId` links it to a user    |
| `updateSubscriptionMetadata` | `stripeSubscriptionId`, `metadata?`, `orgId?`, `userId?` | Link a subscription to an org or user for indexed lookups |

## Webhook Events

The component automatically handles these Stripe webhook events:

| Event                           | Action                                                       |
| ------------------------------- | ------------------------------------------------------------ |
| `customer.created`              | Creates customer record                                      |
| `customer.updated`              | Updates or creates customer record                           |
| `customer.deleted`              | Scrubs customer PII and marks it deleted                     |
| `customer.subscription.created` | Creates subscription record                                  |
| `customer.subscription.updated` | Updates or creates subscription record                       |
| `customer.subscription.deleted` | Marks subscription as canceled                               |
| `payment_intent.succeeded`      | Creates payment record, skipping subscription payments       |
| `invoice.created`               | Creates invoice record                                       |
| `invoice.finalized`             | Upserts invoice record                                       |
| `invoice.updated`               | Upserts invoice record, including metadata changes           |
| `invoice.paid`                  | Upserts invoice as paid                                      |
| `invoice.payment_succeeded`     | Upserts invoice record                                       |
| `invoice.payment_failed`        | Keeps the invoice `open`; never downgrades a paid invoice    |
| `checkout.session.completed`    | Records the session and syncs its first subscription invoice |

Stripe can deliver an event more than once and doesn't guarantee order. The
component handles both:

- After an event is synced and your handlers succeed, its ID goes into the
  `webhook_events` table. Later deliveries of the same event get a 200 without
  running the sync or your handlers again. A daily cron deletes entries after 30
  days.
- Customers and subscriptions store the `created` time of the newest event
  applied to them, and older events for the same object are ignored. A canceled
  subscription is never moved back to another status.

### Custom Webhook Handlers

Add custom logic to webhook events:

```typescript
import { httpRouter } from "convex/server";
import { components } from "./_generated/api";
import { registerRoutes } from "@convex-dev/stripe";
import type Stripe from "stripe";

const http = httpRouter();

registerRoutes(http, components.stripe, {
  events: {
    "customer.subscription.updated": async (
      ctx,
      event: Stripe.CustomerSubscriptionUpdatedEvent,
    ) => {
      const subscription = event.data.object;
      console.log(
        "Subscription updated:",
        subscription.id,
        subscription.status,
      );
      // Add custom logic here
    },
  },
  onEvent: async (ctx, event: Stripe.Event) => {
    // Called for ALL events - useful for logging/analytics
    console.log("Stripe event:", event.type);
  },
});

export default http;
```

If processing an event fails, the route responds with a 500 so Stripe retries
the delivery. The component only logs a fixed message plus the event ID and
type, because errors can contain the raw payload, the signature header, or
customer fields. To see the underlying error, pass `onError` and send it to your
own logging or monitoring:

```typescript
registerRoutes(http, components.stripe, {
  onError: async (ctx, error, { stage, event }) => {
    // stage is "signature" or "processing"; event is set once verified
    reportToMonitoring(error, { stage, eventId: event?.id });
  },
});
```

## Database Schema

The component creates these tables in its namespace:

### customers

| Field              | Type     | Description                               |
| ------------------ | -------- | ----------------------------------------- |
| `stripeCustomerId` | string   | Stripe customer ID                        |
| `email`            | string?  | Customer email                            |
| `name`             | string?  | Customer name                             |
| `metadata`         | object?  | Custom metadata                           |
| `userId`           | string?  | Linked user ID, from `metadata`           |
| `deleted`          | boolean? | `true` once deleted in Stripe             |
| `lastEventCreated` | number?  | `created` time of the newest event synced |

### subscriptions

| Field                  | Type    | Description                               |
| ---------------------- | ------- | ----------------------------------------- |
| `stripeSubscriptionId` | string  | Stripe subscription ID                    |
| `stripeCustomerId`     | string  | Customer ID                               |
| `status`               | string  | Subscription status                       |
| `priceId`              | string  | Price ID                                  |
| `quantity`             | number? | Seat count                                |
| `currentPeriodEnd`     | number  | Period end timestamp                      |
| `cancelAtPeriodEnd`    | boolean | Will cancel at period end                 |
| `cancelAt`             | number? | Scheduled cancel time                     |
| `userId`               | string? | Linked user ID                            |
| `orgId`                | string? | Linked org ID                             |
| `metadata`             | object? | Metadata mirrored from Stripe             |
| `lastEventCreated`     | number? | `created` time of the newest event synced |

### checkout_sessions

| Field                     | Type    | Description                               |
| ------------------------- | ------- | ----------------------------------------- |
| `stripeCheckoutSessionId` | string  | Checkout session ID                       |
| `stripeCustomerId`        | string? | Customer ID                               |
| `status`                  | string  | Session status                            |
| `mode`                    | string  | Session mode (payment/subscription/setup) |
| `metadata`                | object? | Custom metadata                           |

### payments

| Field                   | Type    | Description       |
| ----------------------- | ------- | ----------------- |
| `stripePaymentIntentId` | string  | Payment intent ID |
| `stripeCustomerId`      | string? | Customer ID       |
| `amount`                | number  | Amount in cents   |
| `currency`              | string  | Currency code     |
| `status`                | string  | Payment status    |
| `created`               | number  | Created timestamp |
| `userId`                | string? | Linked user ID    |
| `orgId`                 | string? | Linked org ID     |
| `metadata`              | object? | Custom metadata   |

### invoices

| Field                  | Type    | Description       |
| ---------------------- | ------- | ----------------- |
| `stripeInvoiceId`      | string  | Invoice ID        |
| `stripeCustomerId`     | string  | Customer ID       |
| `stripeSubscriptionId` | string? | Subscription ID   |
| `status`               | string  | Invoice status    |
| `amountDue`            | number  | Amount due        |
| `amountPaid`           | number  | Amount paid       |
| `created`              | number  | Created timestamp |
| `userId`               | string? | Linked user ID    |
| `orgId`                | string? | Linked org ID     |
| `metadata`             | object? | Invoice metadata  |

### webhook_events

| Field           | Type   | Description                               |
| --------------- | ------ | ----------------------------------------- |
| `stripeEventId` | string | Stripe event ID                           |
| `type`          | string | Event type                                |
| `created`       | number | Stripe `event.created` (seconds)          |
| `processedAt`   | number | When the component finished processing it |

## Example App

Check out the full example app in the [`example/`](./example) directory:

```bash
git clone https://github.com/get-convex/stripe
cd stripe
npm install
npm run dev
```

The example includes:

- Landing page with product showcase
- One-time payments and subscriptions
- User profile with order history
- Subscription management (cancel, update seats)
- Customer portal integration
- Team/organization billing

## Authentication

This component works with any Convex authentication provider. The example uses
[Clerk](https://clerk.com):

1. Create a Clerk application at [clerk.com](https://clerk.com)
2. Add `VITE_CLERK_PUBLISHABLE_KEY` to your `.env.local`
3. Create `convex/auth.config.ts`:

```typescript
export default {
  providers: [
    {
      domain: "https://your-clerk-domain.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
```

## Troubleshooting

### Tables are empty after checkout

Make sure you've:

1. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Convex environment
   variables
2. Configured the webhook endpoint in Stripe with the correct events
3. Added `invoice.created` and `invoice.finalized` events (not just
   `invoice.paid`)

### "Not authenticated" errors

Ensure your auth provider is configured:

1. Create `convex/auth.config.ts` with your provider
2. Run `npx convex dev` to push the config
3. Verify the user is signed in before calling actions

### Webhooks returning 400/500

Check the Convex logs in your dashboard for errors. Common issues:

- Missing `STRIPE_WEBHOOK_SECRET`
- Wrong webhook URL (should be
  `https://<deployment>.convex.site/stripe/webhook`)
- Missing events in webhook configuration
- A restricted `STRIPE_SECRET_KEY` that can't read invoices, invoice payments,
  or subscriptions. The webhook route looks these up in Stripe.

## License

Apache-2.0
