import {
  httpActionGeneric,
  type GenericActionCtx,
  type GenericDataModel,
} from "convex/server";
import StripeSDK from "stripe";
import type {
  MutationCtx,
  ActionCtx,
  CreateCheckoutSessionArgs,
  HttpRouter,
  RegisterRoutesConfig,
  StripeEventHandlers,
  StripeApiVersion,
  StripeWebhookErrorDetails,
} from "./types.js";
import type { ComponentApi } from "../component/_generated/component.js";
import schema from "../component/schema.js";

type StripeClientConfig = ConstructorParameters<typeof StripeSDK>[1];
type StripeClientConfigWithApiVersion = Omit<
  NonNullable<StripeClientConfig>,
  "apiVersion"
> & {
  apiVersion?: StripeApiVersion;
};

export type StripeComponent = ComponentApi;

export type {
  CreateCheckoutSessionArgs,
  RegisterRoutesConfig,
  StripeEventHandlers,
  StripeWebhookErrorDetails,
};

/** Validators for the documents the component's queries return. */
export const vCustomer = schema.tables.customers.validator;
export const vSubscription = schema.tables.subscriptions.validator;
export const vCheckoutSession = schema.tables.checkout_sessions.validator;
export const vPayment = schema.tables.payments.validator;
export const vInvoice = schema.tables.invoices.validator;

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
   * Create a Stripe Checkout session for a one-time payment, a subscription,
   * or (with `mode: "setup"`) saving a payment method.
   *
   * Use `params` to pass additional Stripe Checkout Session parameters directly
   * to the Stripe API. Values in `params` override constructed defaults except
   * `mode`, which remains controlled by the top-level argument. Setup mode
   * needs `params.currency` unless `params.allowed_payment_method_types` is
   * set.
   */
  async createCheckoutSession(ctx: ActionCtx, args: CreateCheckoutSessionArgs) {
    assertNoPaymentMethodTypes(args.params, this._stripeConfig?.apiVersion);
    const stripe = this.stripe();

    const sessionParams: StripeSDK.Checkout.SessionCreateParams = {
      mode: args.mode,
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      metadata: args.metadata || {},
    };
    if (args.mode !== "setup") {
      sessionParams.line_items = [
        {
          price: args.priceId,
          quantity: args.quantity ?? 1,
        },
      ];
    }

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
   *
   * Looks for a customer linked to `userId`, then for one linked through the
   * user's subscriptions or payments. With `matchByEmail`, it then reuses an
   * unclaimed customer with the same email and links it to the user. Only
   * enable that if your auth provider verifies email addresses, or anyone can
   * claim a customer by signing up with its email. Customers deleted in Stripe
   * are never returned.
   */
  async getOrCreateCustomer(
    ctx: ActionCtx,
    args: {
      userId: string;
      email?: string;
      name?: string;
      matchByEmail?: boolean;
    },
  ) {
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

    const existingSubs = await ctx.runQuery(
      this.component.public.listSubscriptionsByUserId,
      { userId: args.userId },
    );
    const existingPayments = await ctx.runQuery(
      this.component.public.listPaymentsByUserId,
      { userId: args.userId },
    );
    const linkedCustomerIds = [
      ...existingSubs.map((subscription) => subscription.stripeCustomerId),
      ...existingPayments.map((payment) => payment.stripeCustomerId),
    ];
    for (const customerId of new Set(linkedCustomerIds)) {
      if (!customerId) continue;
      const customer = await ctx.runQuery(this.component.public.getCustomer, {
        stripeCustomerId: customerId,
      });
      if (!customer?.deleted) {
        return { customerId, isNew: false };
      }
    }

    if (args.matchByEmail && args.email) {
      const existingByEmail = await ctx.runQuery(
        this.component.public.getCustomerByEmail,
        { email: args.email },
      );
      if (existingByEmail && !existingByEmail.userId) {
        await this.linkCustomerToUser(
          ctx,
          existingByEmail.stripeCustomerId,
          args.userId,
        );
        return {
          customerId: existingByEmail.stripeCustomerId,
          isNew: false,
        };
      }
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

  private async linkCustomerToUser(
    ctx: ActionCtx,
    stripeCustomerId: string,
    userId: string,
  ) {
    const customer = await this.stripe().customers.update(stripeCustomerId, {
      metadata: { userId },
    });
    await ctx.runMutation(this.component.public.createOrUpdateCustomer, {
      stripeCustomerId,
      email: customer.email ?? undefined,
      name: customer.name ?? undefined,
      metadata: customer.metadata,
    });
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
  // WEBHOOK REGISTRATION
  // ============================================================================
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

      let event: StripeSDK.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          body,
          signature,
          webhookSecret,
        );
      } catch (error) {
        console.error("❌ Webhook signature verification failed");
        await reportWebhookError(ctx, config, error, { stage: "signature" });
        return new Response("Webhook signature verification failed", {
          status: 400,
        });
      }

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
        console.error(
          `❌ Error processing webhook event ${event.id} (${event.type})`,
        );
        await reportWebhookError(ctx, config, error, {
          stage: "processing",
          event,
        });
        return new Response("Error processing webhook", { status: 500 });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}

async function reportWebhookError(
  ctx: GenericActionCtx<GenericDataModel>,
  config: RegisterRoutesConfig | undefined,
  error: unknown,
  details: StripeWebhookErrorDetails,
) {
  if (!config?.onError) return;
  try {
    await config.onError(ctx, error, details);
  } catch {
    console.error("❌ Stripe webhook onError handler threw");
  }
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
        stripeCustomerId: getStripeObjectId(subscription.customer),
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
        stripeCustomerId: getStripeObjectId(subscription.customer),
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
      const stripeCustomerId = getStripeObjectId(session.customer);
      await ctx.runMutation(component.private.handleCheckoutSessionCompleted, {
        stripeCheckoutSessionId: session.id,
        stripeCustomerId,
        mode: session.mode || "payment",
        metadata: session.metadata || undefined,
      });

      const stripePaymentIntentId = getStripeObjectId(session.payment_intent);
      if (
        session.mode === "payment" &&
        stripeCustomerId &&
        stripePaymentIntentId
      ) {
        await ctx.runMutation(component.private.updatePaymentCustomer, {
          stripePaymentIntentId,
          stripeCustomerId,
        });
      }

      const stripeSubscriptionId = getStripeObjectId(session.subscription);
      if (session.mode === "subscription" && stripeSubscriptionId) {
        const subscription =
          await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const latestInvoiceId = getStripeObjectId(subscription.latest_invoice);
        if (latestInvoiceId) {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          await syncInvoice(ctx, component, invoice, {
            fallbackStatus: "paid",
            stripeSubscriptionId: subscription.id,
          });
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
      await syncInvoice(ctx, component, invoice, {
        fallbackStatus: "open",
        stripeSubscriptionId: getInvoiceSubscriptionId(invoice),
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
      const paymentIntent = event.data.object as StripeSDK.PaymentIntent;

      if (await getPaymentIntentSubscriptionId(stripe, paymentIntent)) {
        console.log(
          "⏭️ Skipping payment_intent.succeeded - subscription payment",
        );
        break;
      }

      await ctx.runMutation(component.private.handlePaymentIntentSucceeded, {
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: getStripeObjectId(paymentIntent.customer),
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

async function syncInvoice(
  ctx: MutationCtx | ActionCtx,
  component: ComponentApi,
  invoice: StripeSDK.Invoice,
  options: { fallbackStatus: string; stripeSubscriptionId?: string },
) {
  const stripeCustomerId = getStripeObjectId(invoice.customer);
  if (!stripeCustomerId) {
    console.log(`ℹ️ Skipping invoice ${invoice.id} without a customer`);
    return;
  }
  await ctx.runMutation(component.private.handleInvoiceCreated, {
    stripeInvoiceId: invoice.id,
    stripeCustomerId,
    stripeSubscriptionId: options.stripeSubscriptionId,
    status: invoice.status || options.fallbackStatus,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    created: invoice.created,
    metadata: getInvoiceMetadata(invoice),
  });
}

/**
 * API versions from 2025-03-31.basil onward no longer include
 * `PaymentIntent.invoice`; the link only exists through Invoice Payments.
 */
async function getPaymentIntentSubscriptionId(
  stripe: StripeSDK,
  paymentIntent: StripeSDK.PaymentIntent,
) {
  let invoice = (
    paymentIntent as StripeSDK.PaymentIntent & {
      invoice?: string | StripeSDK.Invoice | null;
    }
  ).invoice;
  if (!invoice) {
    const invoicePayments = await stripe.invoicePayments.list({
      payment: { type: "payment_intent", payment_intent: paymentIntent.id },
      limit: 1,
    });
    const linkedInvoice = invoicePayments.data[0]?.invoice;
    if (
      !linkedInvoice ||
      (typeof linkedInvoice !== "string" && linkedInvoice.deleted)
    ) {
      return undefined;
    }
    invoice = linkedInvoice;
  }
  const resolvedInvoice =
    typeof invoice === "string"
      ? await stripe.invoices.retrieve(invoice)
      : invoice;
  return getInvoiceSubscriptionId(resolvedInvoice);
}

function getInvoiceSubscriptionId(invoice: StripeSDK.Invoice) {
  const legacyInvoice = invoice as StripeSDK.Invoice & {
    subscription?: string | StripeSDK.Subscription | null;
  };
  return (
    getStripeObjectId(invoice.parent?.subscription_details?.subscription) ??
    getStripeObjectId(legacyInvoice.subscription)
  );
}

function getStripeObjectId(object: string | { id: string }): string;
function getStripeObjectId(
  object: string | { id: string } | null | undefined,
): string | undefined;
function getStripeObjectId(object: string | { id: string } | null | undefined) {
  if (!object) return undefined;
  return typeof object === "string" ? object : object.id;
}

function getInvoiceMetadata(invoice: StripeSDK.Invoice) {
  const invoiceMetadata = invoice.metadata || {};
  if (Object.keys(invoiceMetadata).length > 0) {
    return invoiceMetadata;
  }
  return invoice.parent?.subscription_details?.metadata || {};
}

const ENDIVE_API_VERSION_DATE = "2026-09-30";

function assertNoPaymentMethodTypes(
  params: object | undefined,
  configuredApiVersion: StripeApiVersion | undefined,
) {
  if (!params || !("payment_method_types" in params)) return;
  const apiVersion =
    configuredApiVersion === undefined
      ? StripeSDK.API_VERSION
      : configuredApiVersion;
  if (typeof apiVersion === "string" && apiVersion >= ENDIVE_API_VERSION_DATE) {
    throw new Error(
      "Stripe removed `payment_method_types` from Checkout Sessions in API version 2026-09-30.endive. " +
        "Pass `allowed_payment_method_types` in `params` instead, or leave it out to use dynamic payment methods.",
    );
  }
}

function isNonHostedCheckoutUiMode(
  uiMode: StripeSDK.Checkout.SessionCreateParams.UiMode | undefined,
) {
  const value = uiMode as string | undefined;
  return value !== undefined && value !== "hosted_page" && value !== "hosted";
}

export default StripeSubscriptions;
