/**
 * Benji's Store - Stripe Integration
 *
 * This file demonstrates how to use the @convex-dev/stripe component
 * for handling payments and subscriptions with Clerk authentication.
 */

import { action, mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { StripeSubscriptions } from "@convex-dev/stripe";
import { v } from "convex/values";

const stripeClient = new StripeSubscriptions(components.stripe, {});

// Validate required environment variables
function getAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) {
    throw new Error(
      "APP_URL environment variable is not set. Add it in your Convex dashboard.",
    );
  }
  return url;
}

// ============================================================================
// PRODUCTS & PRICES
// ============================================================================

// Shared validators for products and prices
const productFields = {
  stripeProductId: v.string(),
  name: v.string(),
  description: v.optional(v.string()),
  active: v.boolean(),
  type: v.optional(v.string()),
  defaultPriceId: v.optional(v.string()),
  metadata: v.optional(v.any()),
  images: v.optional(v.array(v.string())),
};

const priceFields = {
  stripePriceId: v.string(),
  stripeProductId: v.string(),
  active: v.boolean(),
  currency: v.string(),
  type: v.string(),
  unitAmount: v.optional(v.number()),
  description: v.optional(v.string()),
  lookupKey: v.optional(v.string()),
  recurringInterval: v.optional(v.string()),
  recurringIntervalCount: v.optional(v.number()),
  trialPeriodDays: v.optional(v.number()),
  usageType: v.optional(v.string()),
  billingScheme: v.optional(v.string()),
  tiersMode: v.optional(v.string()),
  tiers: v.optional(
    v.array(
      v.object({
        upTo: v.union(v.number(), v.null()),
        flatAmount: v.optional(v.number()),
        unitAmount: v.optional(v.number()),
      }),
    ),
  ),
  metadata: v.optional(v.any()),
};

/**
 * Get a product by its Stripe product ID.
 */
export const getProduct = query({
  args: { stripeProductId: v.string() },
  returns: v.union(v.object(productFields), v.null()),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.getProduct, {
      stripeProductId: args.stripeProductId,
    });
  },
});

/**
 * List all products.
 */
export const listProducts = query({
  args: {},
  returns: v.array(v.object(productFields)),
  handler: async (ctx) => {
    return await ctx.runQuery(components.stripe.public.listProducts, {});
  },
});

/**
 * List all active products.
 */
export const listActiveProducts = query({
  args: {},
  returns: v.array(v.object(productFields)),
  handler: async (ctx) => {
    return await ctx.runQuery(components.stripe.public.listActiveProducts, {});
  },
});

/**
 * Get a price by its Stripe price ID.
 */
export const getPrice = query({
  args: { stripePriceId: v.string() },
  returns: v.union(v.object(priceFields), v.null()),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.getPrice, {
      stripePriceId: args.stripePriceId,
    });
  },
});

/**
 * Get a price by its lookup key.
 */
export const getPriceByLookupKey = query({
  args: { lookupKey: v.string() },
  returns: v.union(v.object(priceFields), v.null()),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.getPriceByLookupKey, {
      lookupKey: args.lookupKey,
    });
  },
});

/**
 * List all prices.
 */
export const listPrices = query({
  args: {},
  returns: v.array(v.object(priceFields)),
  handler: async (ctx) => {
    return await ctx.runQuery(components.stripe.public.listPrices, {});
  },
});

/**
 * List all active prices.
 */
export const listActivePrices = query({
  args: {},
  returns: v.array(v.object(priceFields)),
  handler: async (ctx) => {
    return await ctx.runQuery(components.stripe.public.listActivePrices, {});
  },
});

/**
 * List all prices for a specific product.
 */
export const listPricesByProduct = query({
  args: { stripeProductId: v.string() },
  returns: v.array(v.object(priceFields)),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.listPricesByProduct, {
      stripeProductId: args.stripeProductId,
    });
  },
});

/**
 * List all active prices for a specific product.
 */
export const listActivePricesByProduct = query({
  args: { stripeProductId: v.string() },
  returns: v.array(v.object(priceFields)),
  handler: async (ctx, args) => {
    return await ctx.runQuery(
      components.stripe.public.listActivePricesByProduct,
      { stripeProductId: args.stripeProductId },
    );
  },
});

/**
 * Get a product with all its prices.
 */
export const getProductWithPrices = query({
  args: { stripeProductId: v.string() },
  returns: v.union(
    v.object({
      product: v.object(productFields),
      prices: v.array(v.object(priceFields)),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.getProductWithPrices, {
      stripeProductId: args.stripeProductId,
    });
  },
});

// ============================================================================
// SYNC ACTIONS
// ============================================================================

/**
 * Sync all products from Stripe to the local database.
 * Useful for initial setup or populating existing products.
 */
export const syncProducts = action({
  args: {},
  returns: v.object({ synced: v.number() }),
  handler: async (ctx) => {
    return await stripeClient.syncProducts(ctx);
  },
});

/**
 * Sync all prices from Stripe to the local database.
 * Useful for initial setup or populating existing prices.
 */
export const syncPrices = action({
  args: {},
  returns: v.object({ synced: v.number() }),
  handler: async (ctx) => {
    return await stripeClient.syncPrices(ctx);
  },
});

/**
 * Sync all products and prices from Stripe to the local database.
 * Products are synced first, then prices.
 */
export const syncProductsAndPrices = action({
  args: {},
  returns: v.object({ products: v.number(), prices: v.number() }),
  handler: async (ctx) => {
    return await stripeClient.syncProductsAndPrices(ctx);
  },
});

// ============================================================================
// CUSTOMER MANAGEMENT (Customer Creation)
// ============================================================================

/**
 * Create or get a Stripe customer for the current user.
 * This ensures every user has a linked Stripe customer.
 */
export const getOrCreateCustomer = action({
  args: {},
  returns: v.object({
    customerId: v.string(),
    isNew: v.boolean(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });
  },
});

// ============================================================================
// CHECKOUT SESSIONS
// ============================================================================

/**
 * Create a checkout session for a subscription.
 * Automatically creates/links a customer first.
 */
export const createSubscriptionCheckout = action({
  args: {
    priceId: v.string(),
    quantity: v.optional(v.number()),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or create customer using the component
    const customerResult = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    // Create checkout session with subscription metadata for linking
    return await stripeClient.createCheckoutSession(ctx, {
      priceId: args.priceId,
      customerId: customerResult.customerId,
      mode: "subscription",
      quantity: args.quantity,
      successUrl: `${getAppUrl()}/?success=true`,
      cancelUrl: `${getAppUrl()}/?canceled=true`,
      metadata: {
        userId: identity.subject,
        productType: "hat_subscription",
      },
      subscriptionMetadata: {
        userId: identity.subject,
      },
    });
  },
});

/**
 * Create a checkout session for a TEAM subscription.
 * Links the subscription to an organization ID.
 */
export const createTeamSubscriptionCheckout = action({
  args: {
    priceId: v.string(),
    orgId: v.string(),
    quantity: v.optional(v.number()),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or create customer using the component
    const customerResult = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    // Create checkout session with BOTH userId and orgId in metadata
    return await stripeClient.createCheckoutSession(ctx, {
      priceId: args.priceId,
      customerId: customerResult.customerId,
      mode: "subscription",
      quantity: args.quantity ?? 1,
      successUrl: `${getAppUrl()}/?success=true&org=${args.orgId}`,
      cancelUrl: `${process.env.APP_URL}/?canceled=true`,
      metadata: {
        userId: identity.subject,
        orgId: args.orgId,
        productType: "team_subscription",
      },
      subscriptionMetadata: {
        userId: identity.subject,
        orgId: args.orgId,
      },
    });
  },
});

/**
 * Create a checkout session for a one-time payment.
 */
export const createPaymentCheckout = action({
  args: {
    priceId: v.string(),
  },
  returns: v.object({
    sessionId: v.string(),
    url: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get or create customer using the component
    const customerResult = await stripeClient.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: identity.email,
      name: identity.name,
    });

    // Create checkout session with payment intent metadata for linking
    return await stripeClient.createCheckoutSession(ctx, {
      priceId: args.priceId,
      customerId: customerResult.customerId,
      mode: "payment",
      successUrl: `${getAppUrl()}/?success=true`,
      cancelUrl: `${getAppUrl()}/?canceled=true`,
      metadata: {
        userId: identity.subject,
        productType: "hat",
      },
      paymentIntentMetadata: {
        userId: identity.subject,
      },
    });
  },
});

// ============================================================================
// SEAT-BASED PRICING (#5 - Quantity/Seats UI)
// ============================================================================

/**
 * Update the seat count for a subscription.
 * Call this when users are added/removed from an organization.
 */
export const updateSeats = action({
  args: {
    subscriptionId: v.string(),
    seatCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership
    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscription,
      { stripeSubscriptionId: args.subscriptionId },
    );

    if (!subscription || subscription.userId !== identity.subject) {
      throw new Error("Subscription not found or access denied");
    }

    // Use stripeClient which has access to the API key
    await stripeClient.updateSubscriptionQuantity(ctx, {
      stripeSubscriptionId: args.subscriptionId,
      quantity: args.seatCount,
    });

    return null;
  },
});

// ============================================================================
// ORGANIZATION-BASED LOOKUPS (#4 - Team Billing)
// ============================================================================

/**
 * Get subscription for an organization.
 */
export const getOrgSubscription = query({
  args: {
    orgId: v.string(),
  },
  returns: v.union(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      priceId: v.string(),
      quantity: v.optional(v.number()),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.getSubscriptionByOrgId, {
      orgId: args.orgId,
    });
  },
});

/**
 * Get all payments for an organization.
 */
export const getOrgPayments = query({
  args: {
    orgId: v.string(),
  },
  returns: v.array(
    v.object({
      stripePaymentIntentId: v.string(),
      stripeCustomerId: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      created: v.number(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.listPaymentsByOrgId, {
      orgId: args.orgId,
    });
  },
});

/**
 * Get invoices for an organization's subscription.
 * Subscriptions generate invoices, not payment intents.
 */
export const getOrgInvoices = query({
  args: {
    orgId: v.string(),
  },
  returns: v.array(
    v.object({
      stripeInvoiceId: v.string(),
      stripeCustomerId: v.string(),
      stripeSubscriptionId: v.optional(v.string()),
      status: v.string(),
      amountDue: v.number(),
      amountPaid: v.number(),
      created: v.number(),
      metadata: v.optional(v.any()),
      orgId: v.optional(v.string()),
      userId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    // Direct lookup by orgId (now that invoices have orgId index)
    return await ctx.runQuery(components.stripe.public.listInvoicesByOrgId, {
      orgId: args.orgId,
    });
  },
});

/**
 * Link subscription to an organization (for team billing).
 */
export const linkSubscriptionToOrg = mutation({
  args: {
    subscriptionId: v.string(),
    orgId: v.string(),
    userId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(components.stripe.public.updateSubscriptionMetadata, {
      stripeSubscriptionId: args.subscriptionId,
      orgId: args.orgId,
      userId: args.userId,
      metadata: {
        linkedAt: new Date().toISOString(),
      },
    });
    return null;
  },
});

// ============================================================================
// SUBSCRIPTION QUERIES
// ============================================================================

/**
 * Get subscription information by subscription ID.
 */
export const getSubscriptionInfo = query({
  args: {
    subscriptionId: v.string(),
  },
  returns: v.union(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      priceId: v.string(),
      quantity: v.optional(v.number()),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.runQuery(components.stripe.public.getSubscription, {
      stripeSubscriptionId: args.subscriptionId,
    });
  },
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT
// ============================================================================

/**
 * Cancel a subscription either immediately or at period end.
 */
export const cancelSubscription = action({
  args: {
    subscriptionId: v.string(),
    immediately: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership by checking the subscription's userId
    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscription,
      { stripeSubscriptionId: args.subscriptionId },
    );

    if (!subscription || subscription.userId !== identity.subject) {
      throw new Error("Subscription not found or access denied");
    }

    await stripeClient.cancelSubscription(ctx, {
      stripeSubscriptionId: args.subscriptionId,
      cancelAtPeriodEnd: !args.immediately,
    });

    return null;
  },
});

/**
 * Reactivate a subscription that was set to cancel at period end.
 */
export const reactivateSubscription = action({
  args: {
    subscriptionId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Verify ownership
    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscription,
      { stripeSubscriptionId: args.subscriptionId },
    );

    if (!subscription || subscription.userId !== identity.subject) {
      throw new Error("Subscription not found or access denied");
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new Error("Subscription is not set to cancel");
    }

    // Reactivate by setting cancel_at_period_end to false
    await stripeClient.reactivateSubscription(ctx, {
      stripeSubscriptionId: args.subscriptionId,
    });

    return null;
  },
});

// ============================================================================
// CUSTOMER PORTAL (#6 - Manage Billing)
// ============================================================================

/**
 * Generate a link to the Stripe Customer Portal where users can
 * manage their subscriptions, update payment methods, retry failed payments, etc.
 */
export const getCustomerPortalUrl = action({
  args: {},
  returns: v.union(
    v.object({
      url: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Find customer ID from subscriptions or payments
    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );

    if (subscriptions.length > 0) {
      return await stripeClient.createCustomerPortalSession(ctx, {
        customerId: subscriptions[0].stripeCustomerId,
        returnUrl: `${getAppUrl()}/`,
      });
    }

    const payments = await ctx.runQuery(
      components.stripe.public.listPaymentsByUserId,
      { userId: identity.subject },
    );

    if (payments.length > 0 && payments[0].stripeCustomerId) {
      return await stripeClient.createCustomerPortalSession(ctx, {
        customerId: payments[0].stripeCustomerId,
        returnUrl: `${getAppUrl()}/`,
      });
    }

    // No customer found
    return null;
  },
});

// ============================================================================
// CUSTOMER DATA
// ============================================================================

/**
 * Get customer data including subscriptions and invoices.
 */
export const getCustomerData = query({
  args: {
    customerId: v.string(),
  },
  returns: v.object({
    customer: v.union(
      v.object({
        stripeCustomerId: v.string(),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        metadata: v.optional(v.any()),
      }),
      v.null(),
    ),
    subscriptions: v.array(
      v.object({
        stripeSubscriptionId: v.string(),
        stripeCustomerId: v.string(),
        status: v.string(),
        priceId: v.string(),
        quantity: v.optional(v.number()),
        currentPeriodEnd: v.number(),
        cancelAtPeriodEnd: v.boolean(),
        metadata: v.optional(v.any()),
        userId: v.optional(v.string()),
        orgId: v.optional(v.string()),
      }),
    ),
    invoices: v.array(
      v.object({
        stripeInvoiceId: v.string(),
        stripeCustomerId: v.string(),
        stripeSubscriptionId: v.optional(v.string()),
        status: v.string(),
        amountDue: v.number(),
        amountPaid: v.number(),
        created: v.number(),
        metadata: v.optional(v.any()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const customer = await ctx.runQuery(components.stripe.public.getCustomer, {
      stripeCustomerId: args.customerId,
    });
    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptions,
      { stripeCustomerId: args.customerId },
    );
    const invoices = await ctx.runQuery(components.stripe.public.listInvoices, {
      stripeCustomerId: args.customerId,
    });

    return {
      customer,
      subscriptions,
      invoices,
    };
  },
});

// ============================================================================
// USER-SPECIFIC QUERIES (for profile page)
// ============================================================================

/**
 * Get all subscriptions for the current authenticated user.
 * Uses the userId stored in subscription metadata for lookup.
 */
export const getUserSubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      priceId: v.string(),
      quantity: v.optional(v.number()),
      currentPeriodEnd: v.number(),
      cancelAtPeriodEnd: v.boolean(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );
  },
});

/**
 * Get all one-time payments for the current authenticated user.
 */
export const getUserPayments = query({
  args: {},
  returns: v.array(
    v.object({
      stripePaymentIntentId: v.string(),
      stripeCustomerId: v.optional(v.string()),
      amount: v.number(),
      currency: v.string(),
      status: v.string(),
      created: v.number(),
      metadata: v.optional(v.any()),
      userId: v.optional(v.string()),
      orgId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.runQuery(components.stripe.public.listPaymentsByUserId, {
      userId: identity.subject,
    });
  },
});

/**
 * Check if user has any subscriptions with past_due status (#9 - Failed Payment)
 */
export const getFailedPaymentSubscriptions = query({
  args: {},
  returns: v.array(
    v.object({
      stripeSubscriptionId: v.string(),
      stripeCustomerId: v.string(),
      status: v.string(),
      currentPeriodEnd: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );

    return subscriptions
      .filter(
        (sub: { status: string }) =>
          sub.status === "past_due" || sub.status === "unpaid",
      )
      .map((sub: any) => ({
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripeCustomerId: sub.stripeCustomerId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      }));
  },
});
