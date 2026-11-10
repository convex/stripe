# Benji's Store - Example App

A complete example app demonstrating the `@convex-dev/stripe` component with
Clerk authentication.

![Benji's Store Screenshot](https://via.placeholder.com/800x400?text=Benji%27s+Store)

## Features Demonstrated

- ✅ One-time payments (Buy a Hat)
- ✅ Subscriptions (Hat of the Month Club)
- ✅ User profile with order history
- ✅ Subscription management (cancel, update seats)
- ✅ Customer portal integration
- ✅ Team/organization billing
- ✅ Failed payment handling
- ✅ Real-time data sync via webhooks

## Prerequisites

- Node.js 20+
- A [Convex](https://convex.dev) account
- A [Stripe](https://stripe.com) account (test mode)
- A [Clerk](https://clerk.com) account

## Setup

### 1. Clone and Install

```bash
git clone https://github.com/get-convex/convex-stripe
cd convex-stripe
npm install
```

### 2. Configure Clerk

1. Create a new application at [clerk.com](https://dashboard.clerk.com)
2. Copy your **Publishable Key** from the Clerk dashboard
3. Note your Clerk domain (e.g., `your-app-name.clerk.accounts.dev`)

### 3. Configure Stripe

1. Go to
   [Stripe Dashboard → Developers → API Keys](https://dashboard.stripe.com/test/apikeys)
2. Copy your **Secret Key** (`sk_test_...`)

3. Create two products in
   [Stripe Dashboard → Products](https://dashboard.stripe.com/test/products):

   **Product 1: Single Hat**
   - Name: "Premium Hat"
   - One-time payment: $49.00
   - Copy the Price ID (`price_...`)

   **Product 2: Hat Subscription**
   - Name: "Hat of the Month Club"
   - Recurring: $29.00/month
   - Copy the Price ID (`price_...`)

4. Create `.env.local` in the project root with all frontend variables:

```env
# Clerk
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Stripe Price IDs (from Stripe Dashboard → Products)
VITE_STRIPE_ONE_TIME_PRICE_ID=price_...
VITE_STRIPE_SUBSCRIPTION_PRICE_ID=price_...
```

### 4. Configure Convex

1. Start the development server (this will prompt you to set up Convex):

```bash
npm run dev
```

2. Add environment variables in [Convex Dashboard](https://dashboard.convex.dev)
   → Settings → Environment Variables:

| Variable                | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `STRIPE_SECRET_KEY`     | `sk_test_...` (from Stripe)                      |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from Step 5)                        |
| `APP_URL`               | `http://localhost:5173` (or your production URL) |

3. Create `example/convex/auth.config.ts`:

```typescript
export default {
  providers: [
    {
      domain: "https://your-app-name.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
```

4. Push the auth config:

```bash
npx convex dev --once
```

### 5. Configure Stripe Webhooks

1. Go to
   [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/test/webhooks)

2. Click **"Add endpoint"**

3. Enter your Convex webhook URL:

   ```
   https://YOUR_CONVEX_DEPLOYMENT.convex.site/stripe/webhook
   ```

   Find your deployment name in the Convex dashboard. It's the part before
   `.convex.cloud` in your URL:

   ```
   VITE_CONVEX_URL=https://YOUR_CONVEX_DEPLOYMENT.convex.cloud
   # Webhook URL uses .convex.site instead: YOUR_CONVEX_DEPLOYMENT.convex.site/stripe/webhook
   ```

4. Select these events:
   - `customer.created`
   - `customer.updated`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `charge.refunded`
   - `payment_intent.payment_failed`
   - `invoice.created`
   - `invoice.finalized`
   - `invoice.paid`
   - `invoice.payment_failed`
   - `checkout.session.completed`

5. Click **"Add endpoint"**

6. Click on your endpoint and copy the **Signing secret** (`whsec_...`)

7. Add it to Convex environment variables as `STRIPE_WEBHOOK_SECRET`

### 6. Run the App

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Testing Payments

Use these [Stripe test cards](https://stripe.com/docs/testing):

| Scenario                | Card Number           |
| ----------------------- | --------------------- |
| Successful payment      | `4242 4242 4242 4242` |
| Declined                | `4000 0000 0000 0002` |
| Requires authentication | `4000 0025 0000 3155` |
| Insufficient funds      | `4000 0000 0000 9995` |

Use any future expiration date and any 3-digit CVC.

## Project Structure

```
example/
├── src/
│   ├── App.tsx          # Main React app with all pages
│   ├── main.tsx         # Entry point with Clerk/Convex providers
│   └── index.css        # Styling
└── convex/
    ├── auth.config.ts   # Clerk authentication config
    ├── convex.config.ts # Component installation
    ├── http.ts          # Webhook route registration
    ├── schema.ts        # App schema (extends component)
    └── stripe.ts        # Stripe actions and queries
```

## Key Files

### `convex/stripe.ts`

Contains all the Stripe integration logic:

- `createSubscriptionCheckout` - Create subscription checkout
- `createPaymentCheckout` - Create one-time payment checkout
- `createTeamSubscriptionCheckout` - Create team/org subscription checkout
- `cancelSubscription` - Cancel a subscription
- `reactivateSubscription` - Reactivate a canceled subscription
- `updateSeats` - Update subscription quantity
- `getCustomerPortalUrl` - Get customer portal URL
- `getUserSubscriptions` - List user's subscriptions
- `getUserPayments` - List user's payments
- `getOrgSubscription` - Get org's subscription
- `getOrgInvoices` - List org's invoices

### `convex/http.ts`

Registers the Stripe webhook handler with optional custom event handlers.

### `src/App.tsx`

React app with four pages:

- **Home** - Landing page with product showcase
- **Store** - Product cards with purchase buttons (single-user subscriptions)
- **Profile** - Order history and subscription management
- **Team** - Team/organization billing with seat-based subscriptions

## Troubleshooting

### "Not authenticated" error

1. Make sure Clerk is configured in `.env.local`
2. Create `convex/auth.config.ts` with your Clerk domain
3. Run `npx convex dev --once` to push the config

### Webhooks not working

1. Check the webhook URL matches your Convex deployment
2. Verify all required events are selected
3. Check `STRIPE_WEBHOOK_SECRET` is set correctly
4. Look at Stripe webhook logs for delivery status

### Tables empty after purchase

1. Ensure `invoice.created` and `invoice.finalized` events are enabled
2. Check Convex logs for webhook processing errors
3. Verify `STRIPE_SECRET_KEY` is set

### Build errors

```bash
# Rebuild the component
npm run build

# Re-sync Convex
npx convex dev --once
```

## Learn More

- [Convex Documentation](https://docs.convex.dev)
- [Stripe Documentation](https://stripe.com/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [@convex-dev/stripe Component](../README.md)
