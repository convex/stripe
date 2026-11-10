import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { internalMutation, mutation, query } from "./_generated/server.js";

// ============================================================================
// WEBHOOK EVENT LEDGER
// ============================================================================

const WEBHOOK_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const WEBHOOK_EVENT_PRUNE_BATCH = 500;

export const isWebhookEventProcessed = query({
  args: { stripeEventId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("webhook_events")
      .withIndex("by_stripe_event_id", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .unique();
    return event !== null;
  },
});

export const markWebhookEventProcessed = mutation({
  args: {
    stripeEventId: v.string(),
    type: v.string(),
    created: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhook_events")
      .withIndex("by_stripe_event_id", (q) =>
        q.eq("stripeEventId", args.stripeEventId),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("webhook_events", {
        ...args,
        processedAt: Date.now(),
      });
    }
    return null;
  },
});

export const pruneWebhookEvents = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("webhook_events")
      .withIndex("by_processed_at", (q) =>
        q.lt("processedAt", Date.now() - WEBHOOK_EVENT_RETENTION_MS),
      )
      .take(WEBHOOK_EVENT_PRUNE_BATCH);
    for (const event of expired) {
      await ctx.db.delete("webhook_events", event._id);
    }
    if (expired.length === WEBHOOK_EVENT_PRUNE_BATCH) {
      await ctx.scheduler.runAfter(0, internal.private.pruneWebhookEvents, {});
    }
    return null;
  },
});

// Stripe's `event.created` has one-second resolution, so events from the same
// second are applied in arrival order.
function isStaleEvent(
  lastEventCreated: number | undefined,
  eventCreated: number | undefined,
) {
  return (
    lastEventCreated !== undefined &&
    eventCreated !== undefined &&
    eventCreated < lastEventCreated
  );
}

// Several webhooks for one object often arrive at once with the same data.
// Skipping writes that change nothing keeps them from conflicting with each
// other and exhausting Convex's retries.
function patchChangesDocument(
  document: Record<string, unknown>,
  patch: Record<string, unknown>,
) {
  return Object.entries(patch).some(
    ([key, value]) => JSON.stringify(document[key]) !== JSON.stringify(value),
  );
}

function newestEventCreated(
  lastEventCreated: number | undefined,
  eventCreated: number | undefined,
) {
  if (eventCreated === undefined) return lastEventCreated;
  if (lastEventCreated === undefined) return eventCreated;
  return Math.max(lastEventCreated, eventCreated);
}

// ============================================================================
// INTERNAL MUTATIONS (for webhooks and internal use)
// ============================================================================

export const updateSubscriptionQuantityInternal = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    quantity: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();

    if (subscription) {
      await ctx.db.patch("subscriptions", subscription._id, {
        quantity: args.quantity,
      });
    }

    return null;
  },
});

export const handleCustomerCreated = mutation({
  args: {
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    eventCreated: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .unique();

    if (!existing) {
      const metadata = args.metadata || {};
      const userId = metadata.userId as string | undefined;
      await ctx.db.insert("customers", {
        stripeCustomerId: args.stripeCustomerId,
        email: args.email,
        name: args.name,
        metadata,
        userId,
        lastEventCreated: args.eventCreated,
      });
    }

    return null;
  },
});

export const handleCustomerUpdated = mutation({
  args: {
    stripeCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    metadata: v.optional(v.any()),
    eventCreated: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .unique();

    const metadata = args.metadata || {};
    const userId = metadata.userId as string | undefined;

    if (customer?.deleted) {
      return null;
    }
    if (customer) {
      if (isStaleEvent(customer.lastEventCreated, args.eventCreated)) {
        return null;
      }
      await ctx.db.patch("customers", customer._id, {
        email: args.email,
        name: args.name,
        metadata: args.metadata,
        ...(userId !== undefined && { userId }),
        lastEventCreated: newestEventCreated(
          customer.lastEventCreated,
          args.eventCreated,
        ),
      });
    } else {
      await ctx.db.insert("customers", {
        stripeCustomerId: args.stripeCustomerId,
        email: args.email,
        name: args.name,
        metadata,
        userId,
        lastEventCreated: args.eventCreated,
      });
    }

    return null;
  },
});

export const handleCustomerDeleted = mutation({
  args: {
    stripeCustomerId: v.string(),
    eventCreated: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId),
      )
      .unique();

    if (customer) {
      await ctx.db.patch("customers", customer._id, {
        email: undefined,
        name: undefined,
        metadata: {},
        deleted: true,
        lastEventCreated: newestEventCreated(
          customer.lastEventCreated,
          args.eventCreated,
        ),
      });
    } else {
      // The customer was never synced, but its subscriptions or payments may
      // have been. Record the deletion so `getOrCreateCustomer` can't hand the
      // ID out through them, and a late `customer.created` can't bring it back.
      await ctx.db.insert("customers", {
        stripeCustomerId: args.stripeCustomerId,
        metadata: {},
        deleted: true,
        lastEventCreated: args.eventCreated,
      });
    }

    return null;
  },
});

function deriveCancelAtPeriodEnd(
  cancelAt: number | undefined,
  currentPeriodEnd: number,
): boolean {
  const tolerance = 60 * 5; // 5 minutes

  if (typeof cancelAt !== "number") return false;
  if (currentPeriodEnd <= 0) return false;
  return Math.abs(cancelAt - currentPeriodEnd) <= tolerance;
}

export const handleSubscriptionCreated = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.string(),
    status: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    cancelAt: v.optional(v.number()),
    quantity: v.optional(v.number()),
    priceId: v.string(),
    metadata: v.optional(v.any()),
    eventCreated: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();

    // Extract orgId and userId from metadata if present
    const metadata = args.metadata || {};
    const orgId = metadata.orgId as string | undefined;
    const userId = metadata.userId as string | undefined;

    const cancelAtPeriodEnd =
      args.cancelAtPeriodEnd ||
      deriveCancelAtPeriodEnd(args.cancelAt, args.currentPeriodEnd);

    if (!existing) {
      await ctx.db.insert("subscriptions", {
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        cancelAt: args.cancelAt ?? undefined,
        quantity: args.quantity,
        priceId: args.priceId,
        metadata: metadata,
        orgId: orgId,
        userId: userId,
        lastEventCreated: args.eventCreated,
      });
    }

    // Backfill any invoices that were created before this subscription
    // (fixes webhook timing issues where invoice arrives before subscription)
    if (orgId || userId) {
      const invoices = await ctx.db
        .query("invoices")
        .withIndex("by_stripe_subscription_id", (q) =>
          q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
        )
        .collect();

      for (const invoice of invoices) {
        if (!invoice.orgId || !invoice.userId) {
          await ctx.db.patch("invoices", invoice._id, {
            ...(orgId && !invoice.orgId && { orgId }),
            ...(userId && !invoice.userId && { userId }),
          });
        }
      }
    }

    return null;
  },
});

export const handleSubscriptionUpdated = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    status: v.string(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    cancelAt: v.optional(v.number()),
    quantity: v.optional(v.number()),
    priceId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    eventCreated: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();

    const metadata = args.metadata || {};
    const orgId = metadata.orgId as string | undefined;
    const userId = metadata.userId as string | undefined;
    const cancelAtPeriodEnd =
      args.cancelAtPeriodEnd ||
      deriveCancelAtPeriodEnd(args.cancelAt, args.currentPeriodEnd);

    if (subscription) {
      // `canceled` is terminal in Stripe: a cancelled subscription never
      // returns to an active state — resubscribing mints a new subscription id.
      // Stripe does not guarantee webhook ordering and retries for up to three
      // days, so an older `customer.subscription.updated` can arrive after
      // `customer.subscription.deleted` and would otherwise patch this row back
      // to `active`, silently restoring access to somebody who cancelled.
      if (subscription.status === "canceled" && args.status !== "canceled") {
        return null;
      }
      if (isStaleEvent(subscription.lastEventCreated, args.eventCreated)) {
        return null;
      }
      await ctx.db.patch("subscriptions", subscription._id, {
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        cancelAt: args.cancelAt ?? undefined,
        quantity: args.quantity,
        ...(args.priceId !== undefined && { priceId: args.priceId }),
        // Only update metadata fields if provided
        ...(args.metadata !== undefined && { metadata }),
        ...(orgId !== undefined && { orgId }),
        ...(userId !== undefined && { userId }),
        lastEventCreated: newestEventCreated(
          subscription.lastEventCreated,
          args.eventCreated,
        ),
      });
    } else if (args.stripeCustomerId && args.priceId) {
      await ctx.db.insert("subscriptions", {
        stripeSubscriptionId: args.stripeSubscriptionId,
        stripeCustomerId: args.stripeCustomerId,
        status: args.status,
        currentPeriodEnd: args.currentPeriodEnd,
        cancelAtPeriodEnd,
        cancelAt: args.cancelAt ?? undefined,
        quantity: args.quantity,
        priceId: args.priceId,
        metadata,
        orgId,
        userId,
        lastEventCreated: args.eventCreated,
      });
    }

    return null;
  },
});

export const handleSubscriptionDeleted = mutation({
  args: {
    stripeSubscriptionId: v.string(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAt: v.optional(v.number()),
    eventCreated: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_stripe_subscription_id", (q) =>
        q.eq("stripeSubscriptionId", args.stripeSubscriptionId),
      )
      .unique();

    if (subscription) {
      await ctx.db.patch("subscriptions", subscription._id, {
        status: "canceled",
        ...(args.cancelAtPeriodEnd !== undefined && {
          cancelAtPeriodEnd: args.cancelAtPeriodEnd,
        }),
        ...(args.currentPeriodEnd !== undefined && {
          currentPeriodEnd: args.currentPeriodEnd,
        }),
        ...(args.cancelAt !== undefined && { cancelAt: args.cancelAt }),
        lastEventCreated: newestEventCreated(
          subscription.lastEventCreated,
          args.eventCreated,
        ),
      });
    }

    return null;
  },
});

export const handleCheckoutSessionCompleted = mutation({
  args: {
    stripeCheckoutSessionId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    mode: v.string(),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("checkout_sessions")
      .withIndex("by_stripe_checkout_session_id", (q) =>
        q.eq("stripeCheckoutSessionId", args.stripeCheckoutSessionId),
      )
      .unique();

    if (existing) {
      await ctx.db.patch("checkout_sessions", existing._id, {
        status: "complete",
        stripeCustomerId: args.stripeCustomerId,
      });
    } else {
      await ctx.db.insert("checkout_sessions", {
        stripeCheckoutSessionId: args.stripeCheckoutSessionId,
        stripeCustomerId: args.stripeCustomerId,
        status: "complete",
        mode: args.mode,
        metadata: args.metadata || {},
      });
    }

    return null;
  },
});

const INVOICE_STATUS_ORDER: Record<string, number> = {
  draft: 0,
  open: 1,
  paid: 2,
  uncollectible: 2,
  void: 2,
};

function latestInvoiceStatus(existingStatus: string, incomingStatus: string) {
  const existingOrder = INVOICE_STATUS_ORDER[existingStatus] ?? 0;
  const incomingOrder = INVOICE_STATUS_ORDER[incomingStatus] ?? 0;
  return incomingOrder >= existingOrder ? incomingStatus : existingStatus;
}

function shouldApplyInvoiceLifecycleFields(
  existingStatus: string,
  incomingStatus: string,
) {
  const existingOrder = INVOICE_STATUS_ORDER[existingStatus] ?? 0;
  const incomingOrder = INVOICE_STATUS_ORDER[incomingStatus] ?? 0;
  return incomingOrder >= existingOrder;
}

export const handleInvoiceCreated = mutation({
  args: {
    stripeInvoiceId: v.string(),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.string(),
    amountDue: v.number(),
    amountPaid: v.number(),
    created: v.number(),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("invoices")
      .withIndex("by_stripe_invoice_id", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId),
      )
      .unique();

    const metadata = args.metadata || {};
    let orgId = metadata.orgId as string | undefined;
    let userId = metadata.userId as string | undefined;

    if ((!orgId || !userId) && args.stripeSubscriptionId) {
      const subscription = await ctx.db
        .query("subscriptions")
        .withIndex("by_stripe_subscription_id", (q) =>
          q.eq("stripeSubscriptionId", args.stripeSubscriptionId!),
        )
        .unique();

      if (subscription) {
        orgId = orgId ?? subscription.orgId;
        userId = userId ?? subscription.userId;
      }
    }

    if (existing) {
      const useIncomingLifecycleFields = shouldApplyInvoiceLifecycleFields(
        existing.status,
        args.status,
      );
      const patch = {
        stripeCustomerId: args.stripeCustomerId,
        ...(args.stripeSubscriptionId !== undefined && {
          stripeSubscriptionId: args.stripeSubscriptionId,
        }),
        status: latestInvoiceStatus(existing.status, args.status),
        amountDue: useIncomingLifecycleFields
          ? args.amountDue
          : existing.amountDue,
        amountPaid: useIncomingLifecycleFields
          ? args.amountPaid
          : existing.amountPaid,
        created: useIncomingLifecycleFields ? args.created : existing.created,
        metadata: useIncomingLifecycleFields ? metadata : existing.metadata,
        ...(useIncomingLifecycleFields && orgId !== undefined && { orgId }),
        ...(useIncomingLifecycleFields && userId !== undefined && { userId }),
      };
      if (patchChangesDocument(existing, patch)) {
        await ctx.db.patch("invoices", existing._id, patch);
      }
    } else {
      await ctx.db.insert("invoices", {
        stripeInvoiceId: args.stripeInvoiceId,
        stripeCustomerId: args.stripeCustomerId,
        stripeSubscriptionId: args.stripeSubscriptionId,
        status: args.status,
        amountDue: args.amountDue,
        amountPaid: args.amountPaid,
        created: args.created,
        metadata,
        orgId,
        userId,
      });
    }

    return null;
  },
});

export const handleInvoicePaymentFailed = mutation({
  args: {
    stripeInvoiceId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invoice = await ctx.db
      .query("invoices")
      .withIndex("by_stripe_invoice_id", (q) =>
        q.eq("stripeInvoiceId", args.stripeInvoiceId),
      )
      .unique();

    if (invoice) {
      const status = latestInvoiceStatus(invoice.status, "open");
      if (status !== invoice.status) {
        await ctx.db.patch("invoices", invoice._id, { status });
      }
    }

    return null;
  },
});

export const handlePaymentIntentSucceeded = mutation({
  args: {
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.string(),
    created: v.number(),
    metadata: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent_id", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId),
      )
      .unique();

    if (!existing) {
      // Extract orgId and userId from metadata if present
      const metadata = args.metadata || {};
      const orgId = metadata.orgId as string | undefined;
      const userId = metadata.userId as string | undefined;

      await ctx.db.insert("payments", {
        stripePaymentIntentId: args.stripePaymentIntentId,
        stripeCustomerId: args.stripeCustomerId,
        amount: args.amount,
        currency: args.currency,
        status: args.status,
        created: args.created,
        metadata: metadata,
        orgId: orgId,
        userId: userId,
      });
    } else if (args.stripeCustomerId && !existing.stripeCustomerId) {
      // Update customer ID if it wasn't set initially (webhook timing issue)
      await ctx.db.patch("payments", existing._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
    }

    return null;
  },
});

export const handleChargeRefunded = mutation({
  args: {
    stripePaymentIntentId: v.string(),
    amountRefunded: v.number(),
    refunded: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent_id", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId),
      )
      .unique();

    // Subscription charges aren't stored as payments, so there is nothing to
    // mark for them.
    if (!payment) return null;

    // Each event carries the running total, so the largest one is the newest
    // even when two partial refunds arrive out of order.
    const patch = {
      amountRefunded: Math.max(
        payment.amountRefunded ?? 0,
        args.amountRefunded,
      ),
      refunded: (payment.refunded ?? false) || args.refunded,
    };
    if (patchChangesDocument(payment, patch)) {
      await ctx.db.patch("payments", payment._id, patch);
    }

    return null;
  },
});

export const updatePaymentCustomer = mutation({
  args: {
    stripePaymentIntentId: v.string(),
    stripeCustomerId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const payment = await ctx.db
      .query("payments")
      .withIndex("by_stripe_payment_intent_id", (q) =>
        q.eq("stripePaymentIntentId", args.stripePaymentIntentId),
      )
      .unique();

    if (payment && !payment.stripeCustomerId) {
      await ctx.db.patch("payments", payment._id, {
        stripeCustomerId: args.stripeCustomerId,
      });
    }

    return null;
  },
});
