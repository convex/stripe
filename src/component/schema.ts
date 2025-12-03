import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    stripeProductId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    active: v.boolean(),
    type: v.optional(v.string()), // "service" | "good"
    defaultPriceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    images: v.optional(v.array(v.string())),
  })
    .index("by_stripe_product_id", ["stripeProductId"])
    .index("by_active", ["active"]),

  prices: defineTable({
    stripePriceId: v.string(),
    stripeProductId: v.string(),
    active: v.boolean(),
    currency: v.string(),
    type: v.string(), // "one_time" | "recurring"
    unitAmount: v.optional(v.number()), // in cents
    description: v.optional(v.string()),
    lookupKey: v.optional(v.string()),
    // Recurring-specific fields
    recurringInterval: v.optional(v.string()), // "day" | "week" | "month" | "year"
    recurringIntervalCount: v.optional(v.number()),
    trialPeriodDays: v.optional(v.number()),
    usageType: v.optional(v.string()), // "licensed" | "metered"
    // Tiered pricing fields
    billingScheme: v.optional(v.string()), // "per_unit" | "tiered"
    tiersMode: v.optional(v.string()), // "graduated" | "volume"
    tiers: v.optional(
      v.array(
        v.object({
          upTo: v.union(v.number(), v.null()), // null means infinity (last tier)
          flatAmount: v.optional(v.number()),
          unitAmount: v.optional(v.number()),
        }),
      ),
    ),
    metadata: v.optional(v.any()),
  })
    .index("by_stripe_price_id", ["stripePriceId"])
    .index("by_stripe_product_id", ["stripeProductId"])
    .index("by_active", ["active"])
    .index("by_lookup_key", ["lookupKey"]),

  customers: defineTable({
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
  })
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_email", ["email"])
    .index("by_user_id", ["userId"]),
  subscriptions: defineTable({
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    cancelAt: v.optional(v.number()),
    quantity: v.optional(v.number()),
    priceId: v.string(),
    metadata: v.optional(v.any()),
    // Custom lookup fields for efficient querying
    orgId: v.optional(v.string()),
    userId: v.optional(v.string()),
  })
    .index("by_stripe_subscription_id", ["stripeSubscriptionId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_org_id", ["orgId"])
    .index("by_user_id", ["userId"]),
  checkout_sessions: defineTable({
    stripeCheckoutSessionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    status: v.string(),
    mode: v.string(),
    metadata: v.optional(v.any()),
  })
    .index("by_stripe_checkout_session_id", ["stripeCheckoutSessionId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"]),
  payments: defineTable({
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    created: v.number(),
    metadata: v.optional(v.any()),
    // Custom lookup fields for efficient querying
    orgId: v.optional(v.string()),
    userId: v.optional(v.string()),
  })
    .index("by_stripe_payment_intent_id", ["stripePaymentIntentId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_org_id", ["orgId"])
    .index("by_user_id", ["userId"]),
  invoices: defineTable({
    stripeInvoiceId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.string(),
    amountDue: v.number(),
    amountPaid: v.number(),
    created: v.number(),
    metadata: v.optional(v.any()),
    // Custom lookup fields for efficient querying
    orgId: v.optional(v.string()),
    userId: v.optional(v.string()),
  })
    .index("by_stripe_invoice_id", ["stripeInvoiceId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_stripe_subscription_id", ["stripeSubscriptionId"])
    .index("by_org_id", ["orgId"])
    .index("by_user_id", ["userId"]),
});
