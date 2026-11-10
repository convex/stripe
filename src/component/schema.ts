import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  customers: defineTable({
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    userId: v.optional(v.string()),
    deleted: v.optional(v.boolean()),
    // Stripe `event.created` (seconds) of the newest webhook applied
    lastEventCreated: v.optional(v.number()),
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
    // Stripe `event.created` (seconds) of the newest webhook applied
    lastEventCreated: v.optional(v.number()),
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
    // Set by `charge.refunded`. Stripe keeps `status` as "succeeded" after a
    // refund, so these are how a refund shows up.
    amountRefunded: v.optional(v.number()),
    refunded: v.optional(v.boolean()),
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
  webhook_events: defineTable({
    stripeEventId: v.string(),
    type: v.string(),
    created: v.number(),
    processedAt: v.number(),
  })
    .index("by_stripe_event_id", ["stripeEventId"])
    .index("by_processed_at", ["processedAt"]),
});

export default schema;

// Customers and subscriptions as the public queries return them. They leave
// out `lastEventCreated`, which the component only uses to order webhooks, so
// a new bookkeeping field can't break an app's `returns` validators.
const { lastEventCreated: _customerEventTime, ...customerFields } =
  schema.tables.customers.validator.fields;
const { lastEventCreated: _subscriptionEventTime, ...subscriptionFields } =
  schema.tables.subscriptions.validator.fields;
export const vCustomer = v.object(customerFields);
export const vSubscription = v.object(subscriptionFields);
