import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server.js";
import schema from "./schema.js";

// ============================================================================
// VALIDATOR HELPERS
// ============================================================================

// Reusable validators that omit system fields (_id, _creationTime)
const productValidator = schema.tables.products.validator;
const priceValidator = schema.tables.prices.validator;
const customerValidator = schema.tables.customers.validator;
const subscriptionValidator = schema.tables.subscriptions.validator;
const checkoutSessionValidator = schema.tables.checkout_sessions.validator;
const paymentValidator = schema.tables.payments.validator;
const invoiceValidator = schema.tables.invoices.validator;

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

// ============================================================================
// PRODUCTS
// ============================================================================

/**
 * Get a product by its Stripe product ID.
 */
export const getProduct = query({
  args: { stripeProductId: v.string() },
  returns: v.union(productValidator, v.null()),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_stripe_product_id", (q) =>
        q.eq("stripeProductId", args.stripeProductId),
      )
      .unique();
    if (!product) return null;
    const { _id, _creationTime, ...data } = product;
    return data;
  },
});

/**
 * List all products.
 */
export const listProducts = query({
  args: {},
  returns: v.array(productValidator),
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return products.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List all active products.
 */
export const listActiveProducts = query({
  args: {},
  returns: v.array(productValidator),
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return products.map(({ _id, _creationTime, ...data }) => data);
  },
});

// ============================================================================
// PRICES
// ============================================================================

/**
 * Get a price by its Stripe price ID.
 */
export const getPrice = query({
  args: { stripePriceId: v.string() },
  returns: v.union(priceValidator, v.null()),
  handler: async (ctx, args) => {
    const price = await ctx.db
      .query("prices")
      .withIndex("by_stripe_price_id", (q) =>
        q.eq("stripePriceId", args.stripePriceId),
      )
      .unique();
    if (!price) return null;
    const { _id, _creationTime, ...data } = price;
    return data;
  },
});

/**
 * List all prices.
 */
export const listPrices = query({
  args: {},
  returns: v.array(priceValidator),
  handler: async (ctx) => {
    const prices = await ctx.db.query("prices").collect();
    return prices.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List all active prices.
 */
export const listActivePrices = query({
  args: {},
  returns: v.array(priceValidator),
  handler: async (ctx) => {
    const prices = await ctx.db
      .query("prices")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    return prices.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List all prices for a product.
 */
export const listPricesByProduct = query({
  args: { stripeProductId: v.string() },
  returns: v.array(priceValidator),
  handler: async (ctx, args) => {
    const prices = await ctx.db
      .query("prices")
      .withIndex("by_stripe_product_id", (q) =>
        q.eq("stripeProductId", args.stripeProductId),
      )
      .collect();
    return prices.map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * List all active prices for a product.
 */
export const listActivePricesByProduct = query({
  args: { stripeProductId: v.string() },
  returns: v.array(priceValidator),
  handler: async (ctx, args) => {
    const prices = await ctx.db
      .query("prices")
      .withIndex("by_stripe_product_id", (q) =>
        q.eq("stripeProductId", args.stripeProductId),
      )
      .collect();
    return prices
      .filter((price) => price.active)
      .map(({ _id, _creationTime, ...data }) => data);
  },
});

/**
 * Get a price by its lookup key.
 */
export const getPriceByLookupKey = query({
  args: { lookupKey: v.string() },
  returns: v.union(priceValidator, v.null()),
  handler: async (ctx, args) => {
    const price = await ctx.db
      .query("prices")
      .withIndex("by_lookup_key", (q) => q.eq("lookupKey", args.lookupKey))
      .unique();
    if (!price) return null;
    const { _id, _creationTime, ...data } = price;
    return data;
  },
});

/**
 * Get a product with all its prices.
 */
export const getProductWithPrices = query({
  args: { stripeProductId: v.string() },
  returns: v.union(
    v.object({
      product: productValidator,
      prices: v.array(priceValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_stripe_product_id", (q) =>
        q.eq("stripeProductId", args.stripeProductId),
      )
      .unique();
    if (!product) return null;

    const prices = await ctx.db
      .query("prices")
      .withIndex("by_stripe_product_id", (q) =>
        q.eq("stripeProductId", args.stripeProductId),
      )
      .collect();

    const { _id, _creationTime, ...productData } = product;
    return {
      product: productData,
      prices: prices.map(({ _id, _creationTime, ...data }) => data),
    };
  },
});

// ============================================================================
// CUSTOMERS
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
 * Get a customer by their email address.
 * Uses the by_email index for efficient lookup.
 */
export const getCustomerByEmail = query({
  args: { email: v.string() },
  returns: v.union(customerValidator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!customer) return null;
    const { _id, _creationTime, ...data } = customer;
    return data;
  },
});

/**
 * Get a customer by their user ID.
 * Uses the by_user_id index for efficient lookup.
 */
export const getCustomerByUserId = query({
  args: { userId: v.string() },
  returns: v.union(customerValidator, v.null()),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .first();
    if (!customer) return null;
    const { _id, _creationTime, ...data } = customer;
    return data;
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

/**
 * Get a subscription by organization ID.
 * Useful for looking up subscriptions by custom orgId.
 */
export const getSubscriptionByOrgId = query({
  args: { orgId: v.string() },
  returns: v.union(subscriptionValidator, v.null()),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_org_id", (q) => q.eq("orgId", args.orgId))
      .first();
    if (!subscription) return null;
    const { _id, _creationTime, ...data } = subscription;
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

/**
 * Update subscription quantity (for seat-based pricing).
 * This component action cannot safely update Stripe directly because component
 * actions do not have reliable access to STRIPE_SECRET_KEY.
 * Use the StripeSubscriptions client to update Stripe, then sync Convex.
 */
export const updateSubscriptionQuantity = action({
  args: {
    stripeSubscriptionId: v.string(),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async () => {
    throw new Error(
      "updateSubscriptionQuantity must be called through StripeSubscriptions.updateSubscriptionQuantity() so the Stripe secret key stays outside component actions",
    );
    return null;
  },
});
