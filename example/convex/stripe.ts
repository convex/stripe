/**
 * Benji's Store - Stripe Integration
 *
 * This file demonstrates how to use the @convex-dev/stripe component
 * for handling payments and subscriptions with Clerk authentication.
 */

import { action, query } from "./_generated/server";
import { components } from "./_generated/api";
import {
  StripeSubscriptions,
  vInvoice,
  vPayment,
  vSubscription,
} from "@convex-dev/stripe";
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
      cancelUrl: `${getAppUrl()}/?canceled=true`,
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
//
// This demo has no organization membership, so these queries only return
// billing that the signed-in user purchased. In a real app, check that the
// user belongs to `orgId` (for example with Clerk Organizations) instead.

/**
 * Get the current subscription for an organization.
 */
export const getOrgSubscription = query({
  args: {
    orgId: v.string(),
  },
  returns: v.union(vSubscription, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const subscription = await ctx.runQuery(
      components.stripe.public.getSubscriptionByOrgId,
      { orgId: args.orgId },
    );
    if (!subscription || subscription.userId !== identity.subject) {
      return null;
    }
    return subscription;
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
  returns: v.array(vInvoice),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const invoices = await ctx.runQuery(
      components.stripe.public.listInvoicesByOrgId,
      { orgId: args.orgId },
    );
    return invoices.filter((invoice) => invoice.userId === identity.subject);
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

    const customer = await ctx.runQuery(
      components.stripe.public.getCustomerByUserId,
      { userId: identity.subject },
    );
    if (customer) {
      return await stripeClient.createCustomerPortalSession(ctx, {
        customerId: customer.stripeCustomerId,
        returnUrl: `${getAppUrl()}/`,
      });
    }

    // Customers created before metadata.userId was set are only linked
    // through their subscriptions or payments. Skip any that Stripe has
    // deleted, since it has no portal for them.
    const subscriptions = await ctx.runQuery(
      components.stripe.public.listSubscriptionsByUserId,
      { userId: identity.subject },
    );
    const payments = await ctx.runQuery(
      components.stripe.public.listPaymentsByUserId,
      { userId: identity.subject },
    );
    const linkedCustomerIds = new Set([
      ...subscriptions.map((subscription) => subscription.stripeCustomerId),
      ...payments.map((payment) => payment.stripeCustomerId),
    ]);
    for (const customerId of linkedCustomerIds) {
      if (!customerId) continue;
      const linked = await ctx.runQuery(components.stripe.public.getCustomer, {
        stripeCustomerId: customerId,
      });
      if (linked?.deleted) continue;
      return await stripeClient.createCustomerPortalSession(ctx, {
        customerId,
        returnUrl: `${getAppUrl()}/`,
      });
    }
    return null;
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

/**
 * Get all one-time payments for the current authenticated user.
 */
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
      .filter((sub) => sub.status === "past_due" || sub.status === "unpaid")
      .map((sub) => ({
        stripeSubscriptionId: sub.stripeSubscriptionId,
        stripeCustomerId: sub.stripeCustomerId,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      }));
  },
});
