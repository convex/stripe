# @convex-dev/stripe

[![Integrate Stripe with Convex in 10 mins (Stripe Component)](https://thumbs.video-to-markdown.com/71e9f645.jpg)](https://youtu.be/-S4iHTAxnRw)

A Convex component for integrating Stripe payments, subscriptions, and billing
into your Convex application.

[![npm version](https://badge.fury.io/js/@convex-dev%2Fstripe.svg)](https://badge.fury.io/js/@convex-dev%2Fstripe)

Requires Node.js 18 or later, matching the Stripe Node SDK v22 runtime
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

Add these to your [Convex Dashboard](https://dashboard.convex.dev) → Settings → Environment Variables:

| Variable                | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Your Stripe secret key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) - see Step 4       |

### 4. Configure Stripe Webhooks

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://<your-convex-deployment>.convex.site/stripe/webhook
   ```
   (Find your deployment name in the Convex dashboard - it's the part before `.convex.cloud` in your URL)
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
   - `payment_intent.payment_failed`
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
  apiVersion: "2026-04-22.dahlia", // Optional
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
  apiVersion: "2026-04-22.dahlia", // Optional Stripe API version
});
```

#### Methods

| Method | Description |
|--------|-------------|
| `createCheckoutSession()` | Create a Stripe Checkout session |
| `createCustomerPortalSession()` | Generate a Customer Portal URL |
| `createCustomer()` | Create a new Stripe customer |
| `getOrCreateCustomer()` | Get existing or create new customer |
| `cancelSubscription()` | Cancel a subscription |
| `reactivateSubscription()` | Reactivate a subscription set to cancel |
| `updateSubscriptionQuantity()` | Update seat count |

### createCheckoutSession

```typescript
await stripeClient.createCheckoutSession(ctx, {
  priceId: "price_...",
  customerId: "cus_...",           // Optional
  mode: "subscription",             // "subscription" | "payment" | "setup"
  successUrl: "https://...",
  cancelUrl: "https://...",
  quantity: 1,                      // Optional, default 1
  metadata: {},                     // Optional, session metadata
  subscriptionMetadata: {},         // Optional, attached to subscription
  paymentIntentMetadata: {},        // Optional, attached to payment intent
  params: {
    allow_promotion_codes: true,
    ui_mode: "embedded_page",
    return_url: "https://...",
  },                                // Optional Stripe Checkout Session params
});
```

`params` is a typed passthrough for Stripe Checkout Session fields that the
component does not model directly. Fields in `params` override constructed
defaults, except `mode`, which remains controlled by the top-level `mode`
argument. For non-hosted Checkout UI modes, the component omits `successUrl` and
`cancelUrl` from the Stripe request and expects redirect behavior to be supplied
through Stripe-supported params such as `return_url`.

### getOrCreateCustomer

```typescript
const { customerId, isNew } = await stripeClient.getOrCreateCustomer(ctx, {
  userId: identity.subject,
  email: identity.email, // Optional
  name: identity.name, // Optional
});
```

Returns the customer linked to `userId`, or the customer on the user's
subscriptions or payments. If there is none, it reuses a customer with the same
email only when that customer isn't linked to any user yet, and links it to
this user. Otherwise it creates a new customer with `metadata.userId` set.
Customers deleted in Stripe are never returned.

### Component Queries

Access data directly via the component's public queries:

```typescript
import { query } from "./_generated/server";
import { components } from "./_generated/api";

// List subscriptions for a user
export const getUserSubscriptions = query({
  args: {},
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
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.stripe.public.listPaymentsByUserId, {
      userId: identity.subject,
    });
  },
});
```

### Available Public Queries

| Query                       | Arguments               | Description                       |
| --------------------------- | ----------------------- | --------------------------------- |
| `getCustomer`               | `stripeCustomerId`      | Get a customer by Stripe ID       |
| `listSubscriptions`         | `stripeCustomerId`      | List subscriptions for a customer |
| `listSubscriptionsByUserId` | `userId`                | List subscriptions for a user     |
| `getSubscription`           | `stripeSubscriptionId`  | Get a subscription by ID          |
| `getSubscriptionByOrgId`    | `orgId`                 | Get subscription for an org       |
| `getPayment`                | `stripePaymentIntentId` | Get a payment by ID               |
| `listPayments`              | `stripeCustomerId`      | List payments for a customer      |
| `listPaymentsByUserId`      | `userId`                | List payments for a user          |
| `listPaymentsByOrgId`       | `orgId`                 | List payments for an org          |
| `listInvoices`              | `stripeCustomerId`      | List invoices for a customer      |
| `listInvoicesByUserId`      | `userId`                | List invoices for a user          |
| `listInvoicesByOrgId`       | `orgId`                 | List invoices for an org          |

## Webhook Events

The component automatically handles these Stripe webhook events:

| Event                           | Action                              |
| ------------------------------- | ----------------------------------- |
| `customer.created`              | Creates customer record             |
| `customer.updated`              | Updates customer record             |
| `customer.deleted`              | Scrubs customer PII                 |
| `customer.subscription.created` | Creates subscription record         |
| `customer.subscription.updated` | Updates subscription record         |
| `customer.subscription.deleted` | Marks subscription as canceled      |
| `payment_intent.succeeded`      | Creates payment record              |
| `payment_intent.payment_failed` | Updates payment status              |
| `invoice.created`               | Creates invoice record              |
| `invoice.finalized`             | Upserts invoice record              |
| `invoice.updated`               | Mirrors invoice metadata changes    |
| `invoice.paid`                  | Upserts invoice as paid             |
| `invoice.payment_failed`        | Marks invoice as failed             |
| `checkout.session.completed`    | Handles completed checkout sessions |

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
    "customer.subscription.updated": async (ctx, event: Stripe.CustomerSubscriptionUpdatedEvent) => {
      const subscription = event.data.object;
      console.log("Subscription updated:", subscription.id, subscription.status);
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
customer fields. To see the underlying error, pass `onError` and send it to
your own logging or monitoring:

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

| Field              | Type    | Description        |
| ------------------ | ------- | ------------------ |
| `stripeCustomerId` | string  | Stripe customer ID |
| `email`            | string? | Customer email     |
| `name`             | string? | Customer name      |
| `metadata`         | object? | Custom metadata    |

### subscriptions

| Field                  | Type    | Description               |
| ---------------------- | ------- | ------------------------- |
| `stripeSubscriptionId` | string  | Stripe subscription ID    |
| `stripeCustomerId`     | string  | Customer ID               |
| `status`               | string  | Subscription status       |
| `priceId`              | string  | Price ID                  |
| `quantity`             | number? | Seat count                |
| `currentPeriodEnd`     | number  | Period end timestamp      |
| `cancelAtPeriodEnd`    | boolean | Will cancel at period end |
| `userId`               | string? | Linked user ID            |
| `orgId`                | string? | Linked org ID             |
| `metadata`             | object? | Custom metadata           |

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

## Example App

Check out the full example app in the [`example/`](./example) directory:

```bash
git clone https://github.com/get-convex/convex-stripe
cd convex-stripe
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

## License

Apache-2.0
