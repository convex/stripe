import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import schema from "./schema.js";

// ============================================================================
// VALIDATOR HELPERS
// ============================================================================

// Reusable validators that omit system fields (_id, _creationTime)
const customerValidator = schema.tables.customers.validator;
const subscriptionValidator = schema.tables.subscriptions.validator;
const checkoutSessionValidator = schema.tables.checkout_sessions.validator;
const paymentValidator = schema.tables.payments.validator;
const invoiceValidator = schema.tables.invoices.validator;

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get a customer by their Stripe customer ID.
 */
export const getCustomer = query({
  args: { stripeCustomerId: v.string() },
  returns: v.union(customerValidator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .unique();
    if (!customer) return null;
    const { _id, _creationTime, ...data } = customer;
    return data;
  },
});

/**
 * Get the most recently created customer with this email address.
 * Customers deleted in Stripe are skipped.
 */
export const getCustomerByEmail = query({
  args: { email: v.string() },
  returns: v.union(customerValidator, v.null()),
  handler: async (ctx, args) => {
    const customers = ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .order("desc");
    for await (const { _id, _creationTime, ...data } of customers) {
      if (!data.deleted) return data;
    }
    return null;
  },
});

/**
 * Get the most recently created customer for a user ID.
 * Customers deleted in Stripe are skipped.
 */
export const getCustomerByUserId = query({
  args: { userId: v.string() },
  returns: v.union(customerValidator, v.null()),
  handler: async (ctx, args) => {
    const customers = ctx.db
      .query("customers")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc");
    for await (const { _id, _creationTime, ...data } of customers) {
      if (!data.deleted) return data;
    }
    return null;
  },
});

/**
 * Get a subscription by its Stripe subscription ID.
 */
export const getSubscription = query({
  args: { stripeSubscriptionId: v.string() },
  returns: v.union(subscriptionValidator, v.null()),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();
    if (!subscription) return null;
    const { _id, _creationTime, ...data } = subscription;
    return data;
  },
});

/**
 * List all subscriptions for a customer.
 */
export const listSubscriptions = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(subscriptionValidator),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .collect();
    return subscriptions.map(({ _id, _creationTime, ...data }) => data);
  },
});

const SUBSCRIPTION_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  trialing: 0,
  past_due: 1,
  unpaid: 1,
  paused: 1,
  incomplete: 2,
};

function subscriptionStatusPriority(status: string) {
  return SUBSCRIPTION_STATUS_PRIORITY[status] ?? 3;
}

/**
 * Get the current subscription for an organization ID.
 * When an org has several, prefers active or trialing, then past due, unpaid,
 * or paused, then incomplete, then anything else. Ties go to the newest.
 */
export const getSubscriptionByOrgId = query({
  args: { orgId: v.string() },
  returns: v.union(subscriptionValidator, v.null()),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .order("desc")
      .collect();
    let current: (typeof subscriptions)[number] | undefined;
    for (const subscription of subscriptions) {
      if (
        !current ||
        subscriptionStatusPriority(subscription.status) <
          subscriptionStatusPriority(current.status)
      ) {
        current = subscription;
      }
    }
    if (!current) return null;
    const { _id, _creationTime, ...data } = current;
    return data;
  },
});

/**
 * List all subscriptions for an organization ID.
 */
export const listSubscriptionsByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(subscriptionValidator),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
    return subscriptions.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List all subscriptions for a user ID.
 * Useful for looking up subscriptions by custom userId.
 */
export const listSubscriptionsByUserId = query({
  args: { userId: v.string() },
  returns: v.array(subscriptionValidator),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("subscriptions")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
    return subscriptions.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * Get a payment by its Stripe payment intent ID.
 */
export const getPayment = query({
  args: { stripePaymentIntentId: v.string() },
  returns: v.union(paymentValidator, v.null()),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent_id", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId),
      )
      .unique();
    if (!payment) return null;
    const { _id, _creationTime, ...data } = payment;
    return data;
  },
});

/**
 * List payments for a customer.
 */
export const listPayments = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(paymentValidator),
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .collect();
    return payments.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List payments for a user ID.
 */
export const listPaymentsByUserId = query({
  args: { userId: v.string() },
  returns: v.array(paymentValidator),
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
    return payments.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List payments for an organization ID.
 */
export const listPaymentsByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(paymentValidator),
  handler: async (ctx, args) => {
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
    return payments.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List invoices for a customer.
 */
export const listInvoices = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(invoiceValidator),
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .collect();
    return invoices.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List invoices for an organization ID.
 */
export const listInvoicesByOrgId = query({
  args: { orgId: v.string() },
  returns: v.array(invoiceValidator),
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .collect();
    return invoices.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List invoices for a user ID.
 */
export const listInvoicesByUserId = query({
  args: { userId: v.string() },
  returns: v.array(invoiceValidator),
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .collect();
    return invoices.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * Get a checkout session by its Stripe checkout session ID.
 */
export const getCheckoutSession = query({
  args: { stripeCheckoutSessionId: v.string() },
  returns: v.union(checkoutSessionValidator, v.null()),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("checkout_sessions")
      .withIndex("by_stripe_checkout_session_id", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId),
      )
      .unique();
    if (!session) return null;
    const { _id, _creationTime, ...data } = session;
    return data;
  },
});

/**
 * List checkout sessions for a customer.
 */
export const listCheckoutSessions = query({
  args: { stripeCustomerId: v.string() },
  returns: v.array(checkoutSessionValidator),
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("checkout_sessions")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .collect();
    return sessions.map(({ _id, _creationTime, ...data }) => data);
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Create or update a customer with metadata.
 * Returns the stripeCustomerId for consistency with the API.
 */
export const createOrUpdateCustomer = mutation({
  args: {
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .unique();

    const metadata = args.metadata || {};
    const userId = metadata.userId as string | undefined;

    if (existing?.deleted) {
      // Stripe deleted this customer. Leave its scrubbed row alone.
      return args.stripeCustomerId;
    }
    if (existing) {
      await ctx.db.patch("customers", existing._id, {
        ...(args.email !== undefined && { email: args.email }),
        ...(args.name !== undefined && { name: args.name }),
        ...(args.metadata !== undefined && { metadata: args.metadata }),
        ...(userId !== undefined && { userId }),
      });
    } else {
      await ctx.db.insert("customers", {
        stripeCustomerId: args.stripeCustomerId,
        email: args.email,
        name: args.name,
        metadata: args.metadata,
        userId,
      });
    }
    return args.stripeCustomerId;
  },
});

/**
 * Update subscription metadata for custom lookups.
 * You can provide orgId and userId for efficient indexed lookups,
 * and additional data in the metadata field.
 */
export const updateSubscriptionMetadata = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    metadata: v.any(),
    orgId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();

    if (!subscription) {
      throw new Error(
        `Subscription ${args.stripeSubscriptionId} not found in database`,
      );
    }

    await ctx.db.patch("subscriptions", subscription._id, {
      metadata: args.metadata,
      ...(args.orgId !== undefined && { orgId: args.orgId }),
      ...(args.userId !== undefined && { userId: args.userId }),
    });

    return null;
  },
});
