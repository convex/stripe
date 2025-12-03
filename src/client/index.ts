import { httpActionGeneric } from "convex/server";
import StripeSDK from "stripe";
import type {
  MutationCtx,
  ActionCtx,
  HttpRouter,
  RegisterRoutesConfig,
  StripeEventHandlers,
  StripeApiVersion,
} from "./types.js";
import type { ComponentApi } from "../component/_generated/component.js";

type StripeClientConfig = ConstructorParameters<typeof StripeSDK>[1];
type StripeClientConfigWithApiVersion = Omit<
  NonNullable<StripeClientConfig>,
  "apiVersion"
> & {
  apiVersion?: StripeApiVersion;
};

export type StripeComponent = ComponentApi;

export type { RegisterRoutesConfig, StripeEventHandlers };

/**
 * Stripe Component Client
 *
 * Provides methods for managing Stripe customers, subscriptions, payments,
 * and webhooks through Convex.
 */
export class StripeSubscriptions {
  private _apiKey: string;
  private _stripeConfig: StripeClientConfigWithApiVersion | undefined;
  constructor(
    public component: StripeComponent,
    options?: {
      STRIPE_SECRET_KEY?: string;
      apiVersion?: StripeApiVersion;
    },
  ) {
    this._apiKey = options?.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY!;
    this._stripeConfig = options?.apiVersion
      ? { apiVersion: options.apiVersion }
      : undefined;
  }
  get apiKey() {
    if (!this._apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    return this._apiKey;
  }

  private stripe() {
    return new StripeSDK(this.apiKey, this._stripeConfig as StripeClientConfig);
  }

  /**
   * Update subscription quantity (for seat-based pricing).
   * This will update both Stripe and the local database.
   */
  async updateSubscriptionQuantity(
    ctx: ActionCtx,
    args: {
      stripeSubscriptionId: string;
      quantity: number;
    },
  ) {
    const stripe = this.stripe();
    const subscription = await stripe.subscriptions.retrieve(
      args.stripeSubscriptionId,
    );

    if (!subscription.items.data[0]) {
      throw new Error("Subscription has no items");
    }

    await stripe.subscriptionItems.update(subscription.items.data[0].id, {
      quantity: args.quantity,
    });

    await ctx.runMutation(this.component.private.updateSubscriptionQuantityInternal, {
      stripeSubscriptionId: args.stripeSubscriptionId,
      quantity: args.quantity,
    });

    return null;
  }

  /**
   * Cancel a subscription either immediately or at period end.
   * Updates both Stripe and the local database.
   */
  async cancelSubscription(
    ctx: ActionCtx,
    args: {
      stripeSubscriptionId: string;
      cancelAtPeriodEnd?: boolean;
    },
  ) {
    const stripe = this.stripe();
    const cancelAtPeriodEnd = args.cancelAtPeriodEnd ?? true;

    let subscription: StripeSDK.Subscription;

    if (cancelAtPeriodEnd) {
      subscription = await stripe.subscriptions.update(
        args.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        },
      );
    } else {
      subscription = await stripe.subscriptions.cancel(
        args.stripeSubscriptionId,
      );
    }

    // Update local database immediately (don't wait for webhook)
    const item = subscription.items.data[0];
    await ctx.runMutation(this.component.private.handleSubscriptionUpdated, {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: getStripeObjectId(subscription.customer),
      status: subscription.status,
      currentPeriodEnd: item?.current_period_end || 0,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      cancelAt: subscription.cancel_at || undefined,
      quantity: item?.quantity ?? 1,
      priceId: item?.price?.id || undefined,
      metadata: subscription.metadata || {},
    });

    return null;
  }

  /**
   * Reactivate a subscription that was set to cancel at period end.
   * Updates both Stripe and the local database.
   */
  async reactivateSubscription(
    ctx: ActionCtx,
    args: {
      stripeSubscriptionId: string;
    },
  ) {
    const stripe = this.stripe();

    // Reactivate by setting cancel_at_period_end to false
    const subscription = await stripe.subscriptions.update(
      args.stripeSubscriptionId,
      {
        cancel_at_period_end: false,
      },
    );

    // Update local database immediately
    const item = subscription.items.data[0];
    await ctx.runMutation(this.component.private.handleSubscriptionUpdated, {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: getStripeObjectId(subscription.customer),
      status: subscription.status,
      currentPeriodEnd: item?.current_period_end || 0,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      cancelAt: subscription.cancel_at || undefined,
      quantity: item?.quantity ?? 1,
      priceId: item?.price?.id || undefined,
      metadata: subscription.metadata || {},
    });

    return null;
  }

  // ============================================================================
  // CHECKOUT & PAYMENTS
  // ============================================================================

  /**
   * Create a Stripe Checkout session for one-time payments or subscriptions.
   *
   * Use `params` to pass additional Stripe Checkout Session parameters directly
   * to the Stripe API. Values in `params` override constructed defaults except
   * `mode`, which remains controlled by the top-level argument.
   */
  async createCheckoutSession(
    ctx: ActionCtx,
    args: {
      priceId: string;
      customerId?: string;
      mode: "payment" | "subscription" | "setup";
      successUrl: string;
      cancelUrl: string;
      quantity?: number;
      metadata?: Record<string, string>;
      /** Metadata to attach to the subscription (only for mode: "subscription") */
      subscriptionMetadata?: Record<string, string>;
      /** Metadata to attach to the payment intent (only for mode: "payment") */
      paymentIntentMetadata?: Record<string, string>;
      /** Additional Stripe Checkout Session parameters passed through to the API */
      params?: Partial<StripeSDK.Checkout.SessionCreateParams>;
    },
  ) {
    const stripe = this.stripe();

    const sessionParams: StripeSDK.Checkout.SessionCreateParams = {
      mode: args.mode,
      line_items: [
        {
          price: args.priceId,
          quantity: args.quantity ?? 1,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: args.metadata || {},
    };

    if (args.customerId) {
      sessionParams.customer = args.customerId;
    }

    // Add subscription metadata for linking userId/orgId
    if (args.mode === "subscription" && args.subscriptionMetadata) {
      sessionParams.subscription_data = {
        metadata: args.subscriptionMetadata,
      };
    }

    // Add payment intent metadata for linking userId/orgId
    if (args.mode === "payment" && args.paymentIntentMetadata) {
      sessionParams.payment_intent_data = {
        metadata: args.paymentIntentMetadata,
      };
    }

    const { mode: _mode, ...paramsOverrides } = args.params || {};
    const finalParams: StripeSDK.Checkout.SessionCreateParams = {
      ...sessionParams,
      ...paramsOverrides,
    };
    if (sessionParams.subscription_data || paramsOverrides.subscription_data) {
      finalParams.subscription_data = {
        ...sessionParams.subscription_data,
        ...paramsOverrides.subscription_data,
        metadata: {
          ...(paramsOverrides.subscription_data?.metadata ?? {}),
          ...(sessionParams.subscription_data?.metadata ?? {}),
        },
      };
    }
    if (sessionParams.payment_intent_data || paramsOverrides.payment_intent_data) {
      finalParams.payment_intent_data = {
        ...sessionParams.payment_intent_data,
        ...paramsOverrides.payment_intent_data,
        metadata: {
          ...(paramsOverrides.payment_intent_data?.metadata ?? {}),
          ...(sessionParams.payment_intent_data?.metadata ?? {}),
        },
      };
    }
    if (isNonHostedCheckoutUiMode(finalParams.ui_mode)) {
      delete finalParams.success_url;
      delete finalParams.cancel_url;
    }

    const session = await stripe.checkout.sessions.create(finalParams);

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Create a new Stripe customer.
   *
   * @param args.idempotencyKey - Optional key to prevent duplicate customer creation.
   *   If two requests come in with the same key, Stripe returns the same customer.
   *   Recommended: pass `userId` to prevent race conditions.
   */
  async createCustomer(
    ctx: ActionCtx,
    args: {
      email?: string;
      name?: string;
      metadata?: Record<string, string>;
      idempotencyKey?: string;
    },
  ) {
    const stripe = this.stripe();

    // Use idempotency key to prevent duplicate customers from race conditions
    const requestOptions = args.idempotencyKey
      ? { idempotencyKey: `create_customer_${args.idempotencyKey}` }
      : undefined;

    const customer = await stripe.customers.create(
      {
        email: args.email,
        name: args.name,
        metadata: args.metadata,
      },
      requestOptions,
    );

    // Store in our database
    await ctx.runMutation(this.component.public.createOrUpdateCustomer, {
      stripeCustomerId: customer.id,
      email: args.email,
      name: args.name,
      metadata: args.metadata,
    });

    return {
      customerId: customer.id,
    };
  }

  /**
   * Get or create a Stripe customer for a user.
   * Checks existing customers, subscriptions, and payments to avoid duplicates.
   */
  async getOrCreateCustomer(
    ctx: ActionCtx,
    args: {
      userId: string;
      email?: string;
      name?: string;
    },
  ) {
    // Check the customers table directly by userId (uses by_user_id index)
    const existingByUserId = await ctx.runQuery(
      this.component.public.getCustomerByUserId,
      { userId: args.userId },
    );
    if (existingByUserId) {
      return {
        customerId: existingByUserId.stripeCustomerId,
        isNew: false,
      };
    }

    // Fallback: check by email (uses by_email index)
    if (args.email) {
      const existingByEmail = await ctx.runQuery(
        this.component.public.getCustomerByEmail,
        { email: args.email },
      );
      if (existingByEmail) {
        return {
          customerId: existingByEmail.stripeCustomerId,
          isNew: false,
        };
      }
    }

    // Check if customer exists by userId in subscriptions
    const existingSubs = await ctx.runQuery(
      this.component.public.listSubscriptionsByUserId,
      { userId: args.userId },
    );

    if (existingSubs.length > 0) {
      return { customerId: existingSubs[0].stripeCustomerId, isNew: false };
    }

    // Check existing payments
    const existingPayments = await ctx.runQuery(
      this.component.public.listPaymentsByUserId,
      { userId: args.userId },
    );

    if (existingPayments.length > 0 && existingPayments[0].stripeCustomerId) {
      return { customerId: existingPayments[0].stripeCustomerId, isNew: false };
    }

    // Create a new customer with idempotency key to prevent race conditions
    const result = await this.createCustomer(ctx, {
      email: args.email,
      name: args.name,
      metadata: { userId: args.userId },
      idempotencyKey: args.userId,
    });

    return { customerId: result.customerId, isNew: true };
  }

  /**
   * Create a Stripe Customer Portal session for managing subscriptions.
   */
  async createCustomerPortalSession(
    ctx: ActionCtx,
    args: {
      customerId: string;
      returnUrl: string;
    },
  ) {
    const stripe = this.stripe();

    const session = await stripe.billingPortal.sessions.create({
      customer: args.customerId,
      return_url: args.returnUrl,
    });

    return {
      url: session.url,
    };
  }

  // ============================================================================
  // SYNC METHODS
  // ============================================================================

  /**
   * Sync all products from Stripe to the local database.
   * Useful for initial setup or recovery after missed webhooks.
   *
   * @returns The number of products synced
   */
  async syncProducts(ctx: ActionCtx): Promise<{ synced: number }> {
    const stripe = new StripeSDK(this.apiKey);
    let synced = 0;

    // Fetch all products from Stripe (handles pagination automatically)
    for await (const product of stripe.products.list({ limit: 100 })) {
      await ctx.runMutation(this.component.private.handleProductUpdated, {
        stripeProductId: product.id,
        name: product.name,
        description: product.description || undefined,
        active: product.active,
        type: product.type,
        defaultPriceId:
          typeof product.default_price === "string"
            ? product.default_price
            : product.default_price?.id,
        metadata: product.metadata,
        images: product.images,
      });
      synced++;
    }

    return { synced };
  }

  /**
   * Sync all prices from Stripe to the local database.
   * Useful for initial setup or recovery after missed webhooks.
   *
   * @returns The number of prices synced
   */
  async syncPrices(ctx: ActionCtx): Promise<{ synced: number }> {
    const stripe = new StripeSDK(this.apiKey);
    let synced = 0;

    // Fetch all prices from Stripe with tiers expanded (handles pagination automatically)
    for await (const price of stripe.prices.list({
      limit: 100,
      expand: ["data.tiers"],
    })) {
      await ctx.runMutation(this.component.private.handlePriceUpdated, {
        stripePriceId: price.id,
        stripeProductId:
          typeof price.product === "string" ? price.product : price.product.id,
        active: price.active,
        currency: price.currency,
        type: price.type,
        unitAmount: price.unit_amount ?? undefined,
        description: price.nickname || undefined,
        lookupKey: price.lookup_key || undefined,
        recurringInterval: price.recurring?.interval,
        recurringIntervalCount: price.recurring?.interval_count,
        trialPeriodDays: price.recurring?.trial_period_days ?? undefined,
        usageType: price.recurring?.usage_type,
        billingScheme: price.billing_scheme,
        tiersMode: price.tiers_mode ?? undefined,
        tiers: price.tiers?.map((tier) => ({
          upTo: tier.up_to,
          flatAmount: tier.flat_amount ?? undefined,
          unitAmount: tier.unit_amount ?? undefined,
        })),
        metadata: price.metadata,
      });
      synced++;
    }

    return { synced };
  }

  /**
   * Sync all products and prices from Stripe to the local database.
   * Products are synced first, then prices.
   *
   * @returns The number of products and prices synced
   */
  async syncProductsAndPrices(
    ctx: ActionCtx,
  ): Promise<{ products: number; prices: number }> {
    const productsResult = await this.syncProducts(ctx);
    const pricesResult = await this.syncPrices(ctx);

    return {
      products: productsResult.synced,
      prices: pricesResult.synced,
    };
  }
}
/**
 * Register webhook routes with the HTTP router.
 * This simplifies webhook setup by handling signature verification
 * and routing events to the appropriate handlers automatically.
 *
 * @param http - The HTTP router instance
 * @param config - Optional configuration for webhook path and event handlers
 *
 * @example
 * ```typescript
 * // convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { stripe } from "./stripe";
 *
 * const http = httpRouter();
 *
 * stripe.registerRoutes(http, {
 *   events: {
 *     "customer.subscription.updated": async (ctx, event) => {
 *       // Your custom logic after default handling
 *       console.log("Subscription updated:", event.data.object);
 *     },
 *   },
 * });
 *
 * export default http;
 * ```
 */
export function registerRoutes(
  http: HttpRouter,
  component: ComponentApi,
  config?: RegisterRoutesConfig,
) {
  const webhookPath = config?.webhookPath ?? "/stripe/webhook";
  const eventHandlers = config?.events ?? {};

  http.route({
    path: webhookPath,
    method: "POST",
    handler: httpActionGeneric(async (ctx, req) => {
      const webhookSecret =
        config?.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("❌ STRIPE_WEBHOOK_SECRET is not set");
        return new Response("Webhook secret not configured", { status: 500 });
      }

      const signature = req.headers.get("stripe-signature");
      if (!signature) {
        console.error("❌ No Stripe signature in headers");
        return new Response("No signature provided", { status: 400 });
      }

      const body = await req.text();

      const apiKey = config?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;

      if (!apiKey) {
        console.error("❌ STRIPE_SECRET_KEY is not set");
        return new Response("Stripe secret key not configured", {
          status: 500,
        });
      }

      const stripe = new StripeSDK(
        apiKey,
        config?.apiVersion
          ? ({ apiVersion: config.apiVersion } as StripeClientConfig)
          : undefined,
      );

      // Verify webhook signature
      let event: StripeSDK.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret,
        );
      } catch (err) {
        console.error("❌ Webhook signature verification failed:", err);
        return new Response(
          `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
          { status: 400 },
        );
      }

      // Process the event with default handlers
      try {
        await processEvent(ctx, component, event, stripe);

        // Call generic event handler if provided
        if (config?.onEvent) {
          await config.onEvent(ctx, event);
        }

        // Call custom event handler if provided
        const eventType = event.type;
        const customHandler:
          | ((ctx: any, event: any) => Promise<void>)
          | undefined = eventHandlers[eventType] as any;
        if (customHandler) {
          await customHandler(ctx, event);
        }
      } catch (error) {
        console.error("❌ Error processing webhook:", error);
        return new Response("Error processing webhook", { status: 500 });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}

/**
 * Internal method to process Stripe webhook events with default handling.
 * This handles the database syncing for all supported event types.
 */
export async function processEvent(
  ctx: MutationCtx | ActionCtx,
  component: ComponentApi,
  event: StripeSDK.Event,
  stripe: StripeSDK,
): Promise<void> {
  switch (event.type) {
    // ========================================================================
    // PRODUCTS
    // ========================================================================
    case "product.created": {
      const product = event.data.object as StripeSDK.Product;
      await ctx.runMutation(component.private.handleProductCreated, {
        stripeProductId: product.id,
        name: product.name,
        description: product.description || undefined,
        active: product.active,
        type: product.type,
        defaultPriceId:
          typeof product.default_price === "string"
            ? product.default_price
            : product.default_price?.id,
        metadata: product.metadata,
        images: product.images,
      });
      break;
    }

    case "product.updated": {
      const product = event.data.object as StripeSDK.Product;
      await ctx.runMutation(component.private.handleProductUpdated, {
        stripeProductId: product.id,
        name: product.name,
        description: product.description || undefined,
        active: product.active,
        type: product.type,
        defaultPriceId:
          typeof product.default_price === "string"
            ? product.default_price
            : product.default_price?.id,
        metadata: product.metadata,
        images: product.images,
      });
      break;
    }

    case "product.deleted": {
      const product = event.data.object as StripeSDK.Product;
      await ctx.runMutation(component.private.handleProductDeleted, {
        stripeProductId: product.id,
      });
      break;
    }

    // ========================================================================
    // PRICES
    // ========================================================================
    case "price.created": {
      const price = event.data.object as StripeSDK.Price;
      await ctx.runMutation(component.private.handlePriceCreated, {
        stripePriceId: price.id,
        stripeProductId:
          typeof price.product === "string" ? price.product : price.product.id,
        active: price.active,
        currency: price.currency,
        type: price.type,
        unitAmount: price.unit_amount ?? undefined,
        description: price.nickname || undefined,
        lookupKey: price.lookup_key || undefined,
        recurringInterval: price.recurring?.interval,
        recurringIntervalCount: price.recurring?.interval_count,
        trialPeriodDays: price.recurring?.trial_period_days ?? undefined,
        usageType: price.recurring?.usage_type,
        billingScheme: price.billing_scheme,
        tiersMode: price.tiers_mode ?? undefined,
        tiers: price.tiers?.map((tier) => ({
          upTo: tier.up_to,
          flatAmount: tier.flat_amount ?? undefined,
          unitAmount: tier.unit_amount ?? undefined,
        })),
        metadata: price.metadata,
      });
      break;
    }

    case "price.updated": {
      const price = event.data.object as StripeSDK.Price;
      await ctx.runMutation(component.private.handlePriceUpdated, {
        stripePriceId: price.id,
        stripeProductId:
          typeof price.product === "string" ? price.product : price.product.id,
        active: price.active,
        currency: price.currency,
        type: price.type,
        unitAmount: price.unit_amount ?? undefined,
        description: price.nickname || undefined,
        lookupKey: price.lookup_key || undefined,
        recurringInterval: price.recurring?.interval,
        recurringIntervalCount: price.recurring?.interval_count,
        trialPeriodDays: price.recurring?.trial_period_days ?? undefined,
        usageType: price.recurring?.usage_type,
        billingScheme: price.billing_scheme,
        tiersMode: price.tiers_mode ?? undefined,
        tiers: price.tiers?.map((tier) => ({
          upTo: tier.up_to,
          flatAmount: tier.flat_amount ?? undefined,
          unitAmount: tier.unit_amount ?? undefined,
        })),
        metadata: price.metadata,
      });
      break;
    }

    case "price.deleted": {
      const price = event.data.object as StripeSDK.Price;
      await ctx.runMutation(component.private.handlePriceDeleted, {
        stripePriceId: price.id,
      });
      break;
    }

    // ========================================================================
    // CUSTOMERS
    // ========================================================================
    case "customer.created":
    case "customer.updated": {
      const customer = event.data.object as StripeSDK.Customer;
      const handler =
        event.type === "customer.created"
          ? component.private.handleCustomerCreated
          : component.private.handleCustomerUpdated;

      await ctx.runMutation(handler, {
        stripeCustomerId: customer.id,
        email: customer.email || undefined,
        name: customer.name || undefined,
        metadata: customer.metadata,
      });
      break;
    }

    case "customer.deleted": {
      const customer = event.data.object as StripeSDK.Customer;
      await ctx.runMutation(component.private.handleCustomerDeleted, {
        stripeCustomerId: customer.id,
      });
      break;
    }

    case "customer.subscription.created": {
      const subscription = event.data.object as StripeSDK.Subscription;
      const item = subscription.items.data[0];

      await ctx.runMutation(component.private.handleSubscriptionCreated, {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodEnd: item?.current_period_end || 0,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        cancelAt: subscription.cancel_at ?? undefined,
        quantity: subscription.items.data[0]?.quantity ?? 1,
        priceId: item?.price?.id || "",
        metadata: subscription.metadata || {},
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as StripeSDK.Subscription;
      const item = subscription.items.data[0];

      await ctx.runMutation(component.private.handleSubscriptionUpdated, {
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: subscription.customer as string,
        status: subscription.status,
        currentPeriodEnd: item?.current_period_end || 0,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        cancelAt: subscription.cancel_at ?? undefined,
        quantity: subscription.items.data[0]?.quantity ?? 1,
        priceId: item?.price?.id || undefined,
        metadata: subscription.metadata || {},
      });
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as StripeSDK.Subscription;
      const item = subscription.items.data[0];
      await ctx.runMutation(component.private.handleSubscriptionDeleted, {
        stripeSubscriptionId: subscription.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
        currentPeriodEnd: item?.current_period_end ?? undefined,
        cancelAt: subscription.cancel_at ?? undefined,
      });
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as StripeSDK.Checkout.Session;
      await ctx.runMutation(component.private.handleCheckoutSessionCompleted, {
        stripeCheckoutSessionId: session.id,
        stripeCustomerId: session.customer
          ? (session.customer as string)
          : undefined,
        mode: session.mode || "payment",
        metadata: session.metadata || undefined,
      });

      // For payment mode, link the payment to the customer if we have both
      if (
        session.mode === "payment" &&
        session.customer &&
        session.payment_intent
      ) {
        await ctx.runMutation(component.private.updatePaymentCustomer, {
          stripePaymentIntentId: session.payment_intent as string,
          stripeCustomerId: session.customer as string,
        });
      }

      // For subscription mode, fetch and store the latest invoice
      if (session.mode === "subscription" && session.subscription) {
        try {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
          );
          if (subscription.latest_invoice) {
            const invoice = await stripe.invoices.retrieve(
              subscription.latest_invoice as string,
            );
            await ctx.runMutation(component.private.handleInvoiceCreated, {
              stripeInvoiceId: invoice.id,
              stripeCustomerId: invoice.customer as string,
              stripeSubscriptionId: subscription.id,
              status: invoice.status || "paid",
              amountDue: invoice.amount_due,
              amountPaid: invoice.amount_paid,
              created: invoice.created,
              metadata: getInvoiceMetadata(invoice),
            });
          }
        } catch (err) {
          console.error("Error fetching invoice for subscription:", err);
        }
      }
      break;
    }

    case "invoice.created":
    case "invoice.finalized":
    case "invoice.updated":
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as StripeSDK.Invoice;
      await ctx.runMutation(component.private.handleInvoiceCreated, {
        stripeInvoiceId: invoice.id,
        stripeCustomerId: invoice.customer as string,
        stripeSubscriptionId: getInvoiceSubscriptionId(invoice),
        status: invoice.status || "open",
        amountDue: invoice.amount_due,
        amountPaid: invoice.amount_paid,
        created: invoice.created,
        metadata: getInvoiceMetadata(invoice),
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as StripeSDK.Invoice;
      await ctx.runMutation(component.private.handleInvoicePaymentFailed, {
        stripeInvoiceId: invoice.id,
      });
      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as any;

      // Check if this is a subscription payment
      if (paymentIntent.invoice) {
        try {
          const invoice = await stripe.invoices.retrieve(
            paymentIntent.invoice as string,
          );
          if (getInvoiceSubscriptionId(invoice)) {
            console.log(
              "⏭️ Skipping payment_intent.succeeded - subscription payment",
            );
            break;
          }
        } catch (err) {
          console.error("Error checking invoice:", err);
        }
      }

      await ctx.runMutation(component.private.handlePaymentIntentSucceeded, {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer
          ? (paymentIntent.customer as string)
          : undefined,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        created: paymentIntent.created,
        metadata: paymentIntent.metadata || {},
      });
      break;
    }

    default:
      console.log(`ℹ️ Unhandled event type: ${event.type}`);
  }
}

function getInvoiceSubscriptionId(invoice: StripeSDK.Invoice) {
  const parentSubscription = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSubscription === "string") {
    return parentSubscription;
  }
  if (parentSubscription && "id" in parentSubscription) {
    return parentSubscription.id;
  }

  const legacySubscription = (
    invoice as StripeSDK.Invoice & {
      subscription?: string | StripeSDK.Subscription | null;
    }
  ).subscription;
  if (typeof legacySubscription === "string") {
    return legacySubscription;
  }
  if (legacySubscription && "id" in legacySubscription) {
    return legacySubscription.id;
  }
  return undefined;
}

function getStripeObjectId(object: string | { id: string }) {
  return typeof object === "string" ? object : object.id;
}

function getInvoiceMetadata(invoice: StripeSDK.Invoice) {
  const invoiceMetadata = invoice.metadata || {};
  if (Object.keys(invoiceMetadata).length > 0) {
    return invoiceMetadata;
  }
  return invoice.parent?.subscription_details?.metadata || {};
}

function isNonHostedCheckoutUiMode(
  uiMode: StripeSDK.Checkout.SessionCreateParams.UiMode | undefined,
) {
  const value = uiMode as string | undefined;
  return value !== undefined && value !== "hosted_page" && value !== "hosted";
}

export default StripeSubscriptions;
